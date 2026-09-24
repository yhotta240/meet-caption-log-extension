import {
  type CaptionFileFormat,
  type CaptionHistoryEntry,
  type CaptionOptions,
  type CaptionSettings,
  DEFAULT_HEADER_TEXT,
  DEFAULT_MARKDOWN_HEADER_TEXT,
  DEFAULT_OPTIONS,
  DEFAULT_SETTINGS,
  MIME_TYPES,
  normalizeCaptionFileFormat,
} from "../../settings";
import {
  getHistory,
  getOptions,
  getSettings,
  setHistory,
  setOptions,
  setSettings,
} from "../../utils/storage";

const DEFAULT_HEADERS: Record<CaptionFileFormat, string> = {
  txt: DEFAULT_HEADER_TEXT,
  csv: DEFAULT_HEADER_TEXT,
  md: DEFAULT_MARKDOWN_HEADER_TEXT,
};

type Notify = (message: string) => Promise<void>;

function element<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function insertTag(textarea: HTMLTextAreaElement, tag: string): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.value = `${textarea.value.slice(0, start)}${tag}${textarea.value.slice(end)}`;
  const cursor = start + tag.length;
  textarea.setSelectionRange(cursor, cursor);
  textarea.focus();
}

function applySettings(settings: CaptionSettings): void {
  const fileName = element<HTMLInputElement>("fileName");
  const fileFormat = element<HTMLSelectElement>("fileFormat");
  const headerText = element<HTMLTextAreaElement>("headerText");
  if (!fileName || !fileFormat || !headerText) return;

  fileName.value = settings.fileName || DEFAULT_SETTINGS.fileName;
  fileFormat.value = normalizeCaptionFileFormat(settings.fileFormat);
  headerText.value = settings.headerText || DEFAULT_HEADERS[fileFormat.value as CaptionFileFormat];
}

function applyOptions(options: CaptionOptions): void {
  const saveOnEndCall = element<HTMLInputElement>("saveOnEndCall");
  const saveOnTabClose = element<HTMLInputElement>("saveOnTabClose");
  const saveHistory = element<HTMLInputElement>("saveHistory");
  const showCaptionsOnStart = element<HTMLInputElement>("showCaptionsOnStart");

  if (saveOnEndCall) saveOnEndCall.checked = options.saveOnEndCall;
  if (saveOnTabClose) saveOnTabClose.checked = options.saveOnTabClose;
  if (saveHistory) saveHistory.checked = options.saveHistory;
  if (showCaptionsOnStart) showCaptionsOnStart.checked = options.showCaptionsOnStart;
}

async function saveCaptionSettings(notify: Notify | undefined): Promise<void> {
  const fileName = element<HTMLInputElement>("fileName");
  const fileFormat = element<HTMLSelectElement>("fileFormat");
  const headerText = element<HTMLTextAreaElement>("headerText");
  if (!fileName || !fileFormat || !headerText) return;

  const settings: CaptionSettings = {
    fileName: fileName.value.trim() || DEFAULT_SETTINGS.fileName,
    fileFormat: normalizeCaptionFileFormat(fileFormat.value),
    headerText: headerText.value,
  };
  await setSettings(settings);
  await notify?.("設定が保存されました");
}

async function saveCaptionOptions(notify: Notify | undefined): Promise<void> {
  const options: CaptionOptions = {
    saveOnEndCall:
      element<HTMLInputElement>("saveOnEndCall")?.checked ?? DEFAULT_OPTIONS.saveOnEndCall,
    saveOnTabClose:
      element<HTMLInputElement>("saveOnTabClose")?.checked ?? DEFAULT_OPTIONS.saveOnTabClose,
    saveHistory: element<HTMLInputElement>("saveHistory")?.checked ?? DEFAULT_OPTIONS.saveHistory,
    showCaptionsOnStart:
      element<HTMLInputElement>("showCaptionsOnStart")?.checked ??
      DEFAULT_OPTIONS.showCaptionsOnStart,
  };
  await setOptions(options);
  await notify?.("オプションが保存されました");
}

function formatFileType(fileFormat: string): CaptionFileFormat {
  return normalizeCaptionFileFormat(fileFormat);
}

function extensionFor(fileFormat: string): string {
  return `.${formatFileType(fileFormat)}`;
}

function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return savedAt;

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildPreview(content: string): string {
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .slice(0, 3)
    .map((line) => line.replace(/\s+/g, " "));
  return lines.join(" / ") || "内容なし";
}

function downloadHistory(entry: CaptionHistoryEntry): void {
  const blob = new Blob([entry.content], { type: MIME_TYPES[formatFileType(entry.fileFormat)] });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = entry.fileName.toLowerCase().endsWith(extensionFor(entry.fileFormat))
    ? entry.fileName
    : `${entry.fileName}${extensionFor(entry.fileFormat)}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function createHistoryItem(entry: CaptionHistoryEntry, notify: Notify | undefined): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "list-group-item";

  const header = document.createElement("div");
  header.className = "d-flex justify-content-between align-items-center mb-1 gap-2";

  const metadata = document.createElement("div");
  const title = document.createElement("span");
  title.className = "fw-bold text-break";
  title.textContent = `${entry.fileName || "captions"} (${formatFileType(entry.fileFormat)})`;
  const date = document.createElement("small");
  date.className = "text-muted ms-2";
  date.textContent = formatSavedAt(entry.savedAt);
  metadata.append(title, date);

  const actions = document.createElement("div");
  actions.className = "d-flex gap-2 flex-shrink-0";

  const downloadButton = document.createElement("button");
  downloadButton.type = "button";
  downloadButton.className = "btn btn-sm btn-outline-primary";
  downloadButton.textContent = "ダウンロード";
  downloadButton.addEventListener("click", () => downloadHistory(entry));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "btn btn-sm btn-outline-danger";
  deleteButton.textContent = "削除";
  deleteButton.addEventListener("click", () => {
    void deleteHistory(entry.savedAt, notify);
  });

  actions.append(downloadButton, deleteButton);
  header.append(metadata, actions);

  const preview = document.createElement("div");
  preview.className = "small text-muted text-break";
  preview.textContent = buildPreview(entry.content);

  const full = document.createElement("pre");
  full.className = "small mt-2 mb-0";
  full.style.whiteSpace = "pre-wrap";
  full.hidden = true;
  full.textContent = entry.content;

  const moreButton = document.createElement("button");
  moreButton.type = "button";
  moreButton.className = "btn btn-link btn-sm ps-0";
  moreButton.textContent = "もっと見る";
  moreButton.addEventListener("click", () => {
    full.hidden = !full.hidden;
    preview.hidden = !full.hidden;
    moreButton.textContent = full.hidden ? "もっと見る" : "閉じる";
  });

  item.append(header, preview, moreButton, full);
  return item;
}

export function renderHistory(items: CaptionHistoryEntry[], notify?: Notify): void {
  const historyList = element<HTMLUListElement>("historyList");
  if (!historyList) return;

  historyList.replaceChildren();
  if (items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "list-group-item text-muted";
    empty.textContent = "履歴がまだありません。設定で履歴保存を有効にしてください";
    historyList.appendChild(empty);
    return;
  }

  for (const entry of items.slice(0, 25)) {
    historyList.appendChild(createHistoryItem(entry, notify));
  }
}

async function deleteHistory(savedAt: string, notify: Notify | undefined): Promise<void> {
  const history = await getHistory();
  await setHistory(history.filter((entry) => entry.savedAt !== savedAt));
  renderHistory(await getHistory(), notify);
  await notify?.("履歴を削除しました");
}

export async function setupCaptionSettings(notify?: Notify): Promise<void> {
  const fileFormat = element<HTMLSelectElement>("fileFormat");
  const headerText = element<HTMLTextAreaElement>("headerText");
  const saveButton = element<HTMLButtonElement>("saveButton");
  const resetButton = element<HTMLButtonElement>("resetButton");
  if (!fileFormat || !headerText || !saveButton || !resetButton) return;

  const [settings, options, history] = await Promise.all([
    getSettings(),
    getOptions(),
    getHistory(),
  ]);
  applySettings(settings);
  applyOptions(options);
  renderHistory(history, notify);

  document.getElementById("insertMeetStart")?.addEventListener("click", () => {
    insertTag(headerText, "{meet開始時刻}");
  });
  document.getElementById("insertCaptionStart")?.addEventListener("click", () => {
    insertTag(headerText, "{字幕ログ開始時刻}");
  });
  document.getElementById("insertCaptionEnd")?.addEventListener("click", () => {
    insertTag(headerText, "{字幕ログ終了時刻}");
  });

  fileFormat.addEventListener("change", () => {
    const format = normalizeCaptionFileFormat(fileFormat.value);
    if (!headerText.value.trim() || Object.values(DEFAULT_HEADERS).includes(headerText.value)) {
      headerText.value = DEFAULT_HEADERS[format];
    }
  });

  saveButton.addEventListener("click", () => {
    void saveCaptionSettings(notify).catch((error) => {
      console.error("設定の保存に失敗しました", error);
    });
  });

  resetButton.addEventListener("click", () => {
    const fileName = element<HTMLInputElement>("fileName");
    if (fileName) fileName.value = DEFAULT_SETTINGS.fileName;
    fileFormat.value = DEFAULT_SETTINGS.fileFormat;
    headerText.value = DEFAULT_HEADERS[DEFAULT_SETTINGS.fileFormat];
    void notify?.("設定をリセットしました");
  });

  for (const id of ["saveOnEndCall", "saveOnTabClose", "saveHistory", "showCaptionsOnStart"]) {
    element<HTMLInputElement>(id)?.addEventListener("change", () => {
      void saveCaptionOptions(notify).catch((error) => {
        console.error("オプションの保存に失敗しました", error);
      });
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.history) {
      renderHistory(
        Array.isArray(changes.history.newValue) ? changes.history.newValue : [],
        notify,
      );
    }
  });
}
