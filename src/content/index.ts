import "./badge.css";
import {
  type CaptionHistoryEntry,
  type CaptionOptions,
  type CaptionSettings,
  DEFAULT_OPTIONS,
  DEFAULT_SETTINGS,
  MIME_TYPES,
  normalizeCaptionFileFormat,
} from "../settings";
import { logError } from "../utils/logger";
import { getOptions, getSettings, getStorage, isEnabled, setStorage } from "../utils/storage";

// 会議中のURLの正規表現
const MEET_URL_PATTERN = /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/;

// UTF-8 BOM
const BOM = "\uFEFF";

type Caption = {
  num: number;
  time: string;
  speaker: string;
  text: string;
};

let isCaptionsSaved = true; // 保存が行われたかを記録するフラグ
let isSaving = false;
let meetStartTime: string | null = null; // {meet開始時刻} に対応
let captionStartTime: string | null = null; // {字幕ログ開始時刻} に対応
let captionEndTime: string | null = null; // {字幕ログ終了時刻} に対応
let prevSpeakerCount = 1; // 前回のスピーカーの数
let caption: Caption | null = null; // 字幕を保存するオブジェクト
let captions: Caption[] = []; // 字幕を保存する配列
let options: CaptionOptions = DEFAULT_OPTIONS; // オプションを保存するオブジェクト
let captionSettings: CaptionSettings = DEFAULT_SETTINGS;
let isEnabledLog = true; // デフォルトは有効

async function checkMeetingStatus(): Promise<void> {
  if (!MEET_URL_PATTERN.test(window.location.href) || meetStartTime) return;

  meetStartTime = dateTime();
  await setStorage({ meetStartTime });
}

async function loadSettings(): Promise<void> {
  isEnabledLog = await isEnabled();
  options = await getOptions();
  captionSettings = await getSettings();
}

async function handleLogState(): Promise<void> {
  if (!isEnabledLog) {
    document.querySelector("#captionEnabledBadge")?.remove();
    return;
  }

  if (options.showCaptionsOnStart) displayCaptions();
  monitorCaptions();
}

function displayBadge(isVisible: boolean): void {
  const captionButton = document.querySelector<HTMLButtonElement>('button[jsname="RrG0hf"]');
  let badge = document.querySelector<HTMLSpanElement>("#captionEnabledBadge");

  if (!badge && captionButton) {
    badge = document.createElement("span");
    badge.id = "captionEnabledBadge";
    captionButton.appendChild(badge);
  }

  if (!badge) return;

  badge.className = isVisible ? "green-badge" : "yellow-badge";
  badge.title = isVisible ? "字幕ログ記録中" : "字幕ログ待機中";
}

function displayCaptions(): void {
  const captionContainer = document.querySelector<HTMLElement>('[jscontroller="D1tHje"]');
  if (!captionContainer || captionContainer.children.length > 0) return;

  const captionButton = document.querySelector<HTMLButtonElement>('button[jsname="RrG0hf"]');
  if (!captionButton || captionContainer.classList.contains("caption-button-clicked")) return;

  captionContainer.classList.add("caption-button-clicked");
  captionButton.click();
}

function monitorCaptions(): void {
  const endButton = document.querySelector<HTMLButtonElement>("button.Iootmd.vLQezd");
  if (endButton && !endButton.dataset.captionLogListener) {
    endButton.addEventListener("click", () => {
      if (options.saveOnEndCall) void endCaptionLoggingAndSave();
    });
    endButton.dataset.captionLogListener = "true";
  }

  // Meetの字幕DOMは動的に差し替わるため，毎回最新の発言要素を取得する
  const captionItems = document.querySelectorAll<HTMLElement>(".nMcdL.bj4p3b");
  const speakers = document.querySelectorAll<HTMLElement>(".adE6rb");

  if (captionItems.length === 0) {
    if (!isCaptionsSaved) void endCaptionLoggingAndSave();
    displayBadge(false);
    return;
  }

  const latestCaption = captionItems[captionItems.length - 1];
  const latestSpeaker = speakers[speakers.length - 1];
  const textElement = latestCaption.querySelector<HTMLElement>(".ygicle.VbkSUe");
  if (!textElement) return;

  isCaptionsSaved = false;
  if (!captionStartTime) {
    captionStartTime = dateTime();
    captionEndTime = null;
    void setStorage({ captionStartTime, captionEndTime });
  }

  // 話者が切り替わった時点で前の発言を確定して保存対象へ移す
  if (prevSpeakerCount !== speakers.length && caption) captions.push(caption);

  caption = {
    num: speakers.length,
    time: dateTime(),
    speaker: latestSpeaker?.textContent?.trim() || "",
    text: textElement.textContent?.trim() || "",
  };
  prevSpeakerCount = speakers.length;
  displayBadge(true);
}

async function saveCaptions(): Promise<void> {
  const settings: CaptionSettings = {
    ...DEFAULT_SETTINGS,
    ...captionSettings,
    fileFormat: normalizeCaptionFileFormat(captionSettings.fileFormat),
  };
  let fileName = settings.fileName || DEFAULT_SETTINGS.fileName;
  const mimeType = MIME_TYPES[settings.fileFormat];
  let headerText = settings.headerText || DEFAULT_SETTINGS.headerText;

  if (settings.fileFormat === "csv") headerText = BOM + headerText;
  if (settings.fileFormat === "md" && !fileName.toLowerCase().endsWith(".md")) {
    fileName += ".md";
  }

  headerText = headerText
    .replace(/{meet開始時刻}/g, meetStartTime ?? "")
    .replace(/{字幕ログ開始時刻}/g, captionStartTime ?? "")
    .replace(/{字幕ログ終了時刻}/g, captionEndTime ?? "");

  const captionText = captions.map((item) => `\n${item.speaker}:\n ${item.text}\n`).join("");
  const fileContent = `${headerText}${captionText}\n`;

  const blob = new Blob([fileContent], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  try {
    // 履歴保存（最大25件）
    if (options.saveHistory) {
      const { history = [] } = await getStorage<{ history?: CaptionHistoryEntry[] }>("history");
      const entry: CaptionHistoryEntry = {
        savedAt: new Date().toISOString(),
        fileName,
        fileFormat: mimeType,
        content: fileContent,
      };
      await setStorage({ history: [entry, ...history].slice(0, 25) });
    }
  } catch (error) {
    void logError("字幕履歴の保存に失敗しました", "content", error);
  } finally {
    isCaptionsSaved = true;
    prevSpeakerCount = 1;
    caption = null;
    captions = [];
    captionStartTime = null;
    captionEndTime = null;
  }
}

async function endCaptionLoggingAndSave(): Promise<void> {
  // 二重保存を防止
  if (isCaptionsSaved || isSaving) return;

  isSaving = true;
  try {
    if (caption) captions.push(caption);
    captionEndTime = dateTime();
    void setStorage({ captionEndTime }).catch((error) => {
      void logError("字幕ログ終了時刻の保存に失敗しました", "content", error);
    });
    await saveCaptions();
  } catch (error) {
    void logError("字幕ログの保存に失敗しました", "content", error);
  } finally {
    isSaving = false;
  }
}

// ページから離脱する際に保存する
window.addEventListener("beforeunload", () => {
  if (options.saveOnTabClose) void endCaptionLoggingAndSave();
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== "local") return;

  if (changes.isLogEnabled) {
    isEnabledLog = Boolean(changes.isLogEnabled.newValue ?? isEnabledLog);
    void handleLogState();
  }

  if (changes.options) {
    options = { ...DEFAULT_OPTIONS, ...(changes.options.newValue as Partial<CaptionOptions>) };
  }

  if (changes.settings) {
    captionSettings = (changes.settings.newValue as CaptionSettings) ?? DEFAULT_SETTINGS;
  }
});

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
const observer = new MutationObserver(() => {
  // DOM更新をデバウンス
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void handleLogState(), 200);
});
observer.observe(document, { childList: true, attributes: true, subtree: true });

function dateTime(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

async function initialize(): Promise<void> {
  try {
    await checkMeetingStatus();
    await loadSettings();
    await handleLogState();
  } catch (error) {
    void logError("字幕ログの初期化に失敗しました", "content", error);
  }
}

void initialize();
