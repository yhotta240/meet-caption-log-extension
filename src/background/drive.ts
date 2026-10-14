import { MIME_TYPES } from "../settings";
import { logError, logInfo } from "../utils/logger";

const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id";
const MAX_UPLOAD_MB = 5;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 20_000;
const UPLOAD_LOCK = "drive-upload";
const DRIVE_SAVE_PATH_NAME = "meet-caption-log";
const MEET_ORIGIN = "https://meet.google.com";
const POPUP_PATH = "popup.html";
const STORAGE = {
  logPrefix: "driveLog:",
  state: "driveState",
};

const MESSAGE = {
  save: "drive:save",
  retry: "drive:retry",
};

type DriveLog = {
  fileName: string;
  mimeType: string;
  content: string;
};

type DriveMessage = {
  type: string;
  log?: unknown;
};

type DriveResponse = {
  ok: boolean;
  error?: string;
};

type UploadBody = {
  body: Blob;
  contentType: string;
};

type Respond = (response: DriveResponse) => void;

/**
 * 指定された値が DriveLog 型であるかを判定する
 */
function isDriveLog(value: unknown): value is DriveLog {
  if (!value || typeof value !== "object") {
    return false;
  }

  const log = value as Partial<DriveLog>;

  if (typeof log.fileName !== "string") {
    return false;
  }

  if (typeof log.content !== "string") {
    return false;
  }

  if (typeof log.mimeType !== "string") {
    return false;
  }

  return Object.values(MIME_TYPES).includes(log.mimeType);
}

/**
 * Drive にアップロードするためのリクエストボディを作成する
 */
function createUploadBody(log: DriveLog): UploadBody {
  const boundary = `meet_${crypto.randomUUID()}`;
  const metadata = {
    name: log.fileName,
    mimeType: log.mimeType,
  };

  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: ${log.mimeType}; charset=UTF-8\r\n\r\n`,
    log.content,
    `\r\n--${boundary}--\r\n`,
  ]);

  return {
    body,
    contentType: `multipart/related; boundary=${boundary}`,
  };
}

async function upload(log: DriveLog): Promise<void> {
  if (new Blob([log.content]).size > MAX_UPLOAD_BYTES) {
    throw new Error(`ログが${MAX_UPLOAD_MB} MBを超えています`);
  }

  const { token } = await chrome.identity.getAuthToken({ interactive: false });

  if (!token) {
    throw new Error("Google Drive に再接続してください");
  }

  const { body, contentType } = createUploadBody(log);
  const response = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
    },
    body,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });

  if (response.status === 401) {
    await chrome.identity.removeCachedAuthToken({ token });
  }

  if (!response.ok) {
    throw new Error(`Drive 保存に失敗しました（HTTP ${response.status}）`);
  }

  const result = await response.json();

  if (!result.id) {
    throw new Error("Drive の保存結果を確認できませんでした");
  }
}

async function sendPending(): Promise<void> {
  // 同時に保存要求が来ても，同じ未送信ログを並行送信しない．
  await navigator.locks.request(UPLOAD_LOCK, async () => {
    const data = await chrome.storage.local.get(null);

    for (const [key, log] of Object.entries(data)) {
      if (!key.startsWith(STORAGE.logPrefix)) {
        continue;
      }

      await upload(log);
      await chrome.storage.local.remove(key);
      await logInfo(`${log.fileName} を Google Drive に保存しました`, "background");
    }
  });
}

/**
 * 指定された字幕ログを保管する．
 * 保管後に true を返す．
 * 保管せずに false を返す場合もある（Drive 保存が無効化されている場合など）．
 * 無効な字幕ログの場合は例外を投げる．
 */
async function storePendingLog(log: unknown, sender: chrome.runtime.MessageSender): Promise<boolean> {
  if (!sender.tab || !sender.url?.startsWith(`${MEET_ORIGIN}/`) || !isDriveLog(log)) {
    throw new Error("無効な字幕ログです");
  }

  const settings = await chrome.storage.local.get(STORAGE.state);

  if (!settings[STORAGE.state]?.enabled) {
    return false;
  }

  const key = `${STORAGE.logPrefix}${crypto.randomUUID()}`;
  await chrome.storage.local.set({ [key]: log });

  return true;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Drive 保存に失敗しました";
}

async function reportError(error: unknown): Promise<void> {
  try {
    await logError(
      "Google Drive 保存に失敗しました．未送信ログは再接続時に再送します",
      "background",
      error,
    );
  } catch {
    console.error("Drive のエラー状態を保存できませんでした");
  }
}

async function handleMessage(message: DriveMessage, sender: chrome.runtime.MessageSender, respond: Respond): Promise<void> {
  if (message.type === MESSAGE.save) {
    const stored = await storePendingLog(message.log, sender);

    // 保管後に応答し，送信はバックグラウンドで続ける．
    respond({ ok: true });

    if (stored) {
      void sendPending().catch(reportError);
    }

    return;
  }

  if (sender.tab || sender.url !== chrome.runtime.getURL(POPUP_PATH)) {
    throw new Error("無効な操作です");
  }

  await sendPending();
  respond({ ok: true });
}

export function setupDrive(): void {
  chrome.runtime.onMessage.addListener((message: DriveMessage | undefined, sender, respond) => {
    if (
      sender.id !== chrome.runtime.id ||
      !message ||
      !Object.values(MESSAGE).includes(message.type)
    ) {
      return;
    }

    void handleMessage(message, sender, respond).catch((error) => {
      respond({
        ok: false,
        error: errorMessage(error),
      });

      void reportError(error);
    });

    return true;
  });
}
