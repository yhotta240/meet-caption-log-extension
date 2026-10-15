import { MIME_TYPES } from "../settings";
import {
  getGoogleAccessToken,
  isGoogleDriveConnected,
  removeGoogleAccessToken,
} from "../utils/google-auth";
import { logError, logInfo } from "../utils/logger";
import { getOptions } from "../utils/storage";

const UPLOAD_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id";
const FILES_URL = "https://www.googleapis.com/drive/v3/files";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const MAX_UPLOAD_MB = 5;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 20_000;
const UPLOAD_LOCK = "drive-upload";
const DRIVE_SAVE_FOLDER_NAME = "Google Meet 字幕ログ";
const MEET_ORIGIN = "https://meet.google.com";
const POPUP_PATH = "popup.html";
const PENDING_LOG_PREFIX = "driveLog:";

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
function createUploadBody(log: DriveLog, folderId: string): UploadBody {
  const boundary = `meet_${crypto.randomUUID()}`;
  const metadata = {
    name: log.fileName,
    mimeType: log.mimeType,
    parents: [folderId],
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

async function requestDrive(
  url: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });

  if (response.status === 401) {
    await removeGoogleAccessToken(token);
  }

  if (!response.ok) {
    throw new Error(`Drive 保存に失敗しました（HTTP ${response.status}）`);
  }

  return response;
}

async function getSaveFolderId(token: string): Promise<string> {
  const folderName = DRIVE_SAVE_FOLDER_NAME.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const query = new URLSearchParams({
    q: [
      `name = '${folderName}'`,
      `mimeType = '${FOLDER_MIME_TYPE}'`,
      "'root' in parents",
      "trashed = false",
    ].join(" and "),
    fields: "files(id)",
    pageSize: "1",
    spaces: "drive",
  });
  const searchResponse = await requestDrive(`${FILES_URL}?${query}`, token);
  const searchResult = await searchResponse.json();

  if (searchResult.files?.length) {
    return searchResult.files[0].id;
  }

  const createResponse = await requestDrive(`${FILES_URL}?fields=id`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: DRIVE_SAVE_FOLDER_NAME,
      mimeType: FOLDER_MIME_TYPE,
      parents: ["root"],
    }),
  });
  const folder = await createResponse.json();

  if (!folder.id) {
    throw new Error("Drive の保存先フォルダを確認できませんでした");
  }

  return folder.id;
}

async function upload(log: DriveLog): Promise<void> {
  if (new Blob([log.content]).size > MAX_UPLOAD_BYTES) {
    throw new Error(`ログが${MAX_UPLOAD_MB} MBを超えています`);
  }

  const token = await getGoogleAccessToken();
  const folderId = await getSaveFolderId(token);
  const { body, contentType } = createUploadBody(log, folderId);
  const response = await requestDrive(UPLOAD_URL, token, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body,
  });

  const result = await response.json();

  if (!result.id) {
    throw new Error("Drive の保存結果を確認できませんでした");
  }
}

async function sendPending(): Promise<void> {
  // 同時に保存要求が来ても，同じ未送信ログを並行送信しない．
  await navigator.locks.request(UPLOAD_LOCK, async () => {
    const connected = await isGoogleDriveConnected();
    const options = await getOptions();

    if (!connected || !options.saveToGoogleDrive) {
      return;
    }

    const data = await chrome.storage.local.get(null);

    for (const [key, log] of Object.entries(data)) {
      if (!key.startsWith(PENDING_LOG_PREFIX)) {
        continue;
      }

      const currentOptions = await getOptions();
      if (!currentOptions.saveToGoogleDrive) {
        return;
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
async function storePendingLog(
  log: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<boolean> {
  if (!sender.tab || !sender.url?.startsWith(`${MEET_ORIGIN}/`) || !isDriveLog(log)) {
    throw new Error("無効な字幕ログです");
  }

  const connected = await isGoogleDriveConnected();

  if (!connected) {
    return false;
  }

  const options = await getOptions();
  if (!options.saveToGoogleDrive) {
    return false;
  }

  const key = `${PENDING_LOG_PREFIX}${crypto.randomUUID()}`;
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

async function handleMessage(
  message: DriveMessage,
  sender: chrome.runtime.MessageSender,
  respond: Respond,
): Promise<void> {
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
