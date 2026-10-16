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

const CONFIG_SAVE_LOCK = "caption-config-save";

const SAVE_DESTINATIONS = {
  local: "saveToLocal",
  drive: "saveToGoogleDrive",
} as const;

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
  const saveToLocal = element<HTMLInputElement>(SAVE_DESTINATIONS.local);
  const saveToGoogleDrive = element<HTMLInputElement>(SAVE_DESTINATIONS.drive);

  if (saveOnEndCall) saveOnEndCall.checked = options.saveOnEndCall;
  if (saveOnTabClose) saveOnTabClose.checked = options.saveOnTabClose;
  if (saveHistory) saveHistory.checked = options.saveHistory;
  if (showCaptionsOnStart) showCaptionsOnStart.checked = options.showCaptionsOnStart;
  if (saveToLocal) saveToLocal.checked = options.saveToLocal;
  if (saveToGoogleDrive) {
    saveToGoogleDrive.checked = options.saveToGoogleDrive;
  }
}

async function retryGoogleDriveLogs(): Promise<void> {
  try {
    const result = await chrome.runtime.sendMessage({ type: "drive:retry" });
    if (!result?.ok) {
      throw new Error(result?.error ?? "再送に失敗しました");
    }
  } catch (error) {
    console.error("未送信ログの再送に失敗しました", error);
  }
}

function setupSaveDestinations(
  saveOptions: (changes: Partial<CaptionOptions>) => Promise<boolean>,
): void {
  const local = element<HTMLInputElement>(SAVE_DESTINATIONS.local);
  const drive = element<HTMLInputElement>(SAVE_DESTINATIONS.drive);

  local?.addEventListener("change", () => {
    if (!local.checked && !drive?.checked) {
      local.checked = true;
      return;
    }
    void saveOptions({ saveToLocal: local.checked });
  });

  drive?.addEventListener("change", async () => {
    if (drive.disabled) {
      return;
    }
    if (!drive.checked && !local?.checked) {
      drive.checked = true;
      await retryGoogleDriveLogs();
      return;
    }

    const checked = drive.checked;
    const saved = await saveOptions({ saveToGoogleDrive: checked });
    if (saved && checked) {
      await retryGoogleDriveLogs();
    }
  });
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
  const fileName = entry.fileName || "captions";
  const savedAt = formatSavedAt(entry.savedAt);
  const item = document.createElement("li");
  item.className = "list-group-item px-3 py-1";

  const header = document.createElement("div");
  header.className = "d-flex align-items-start gap-2";

  const metadata = document.createElement("div");
  metadata.className = "flex-grow-1 overflow-hidden";
  const title = document.createElement("span");
  title.className = "d-block fw-semibold text-truncate";
  title.textContent = fileName;
  title.title = fileName;
  const date = document.createElement("small");
  date.className = "d-block text-body-secondary";
  date.textContent = `${savedAt} · ${formatFileType(entry.fileFormat).toUpperCase()}`;
  metadata.append(title, date);

  const actions = document.createElement("div");
  actions.className = "d-flex gap-1 flex-shrink-0";

  const downloadButton = document.createElement("button");
  downloadButton.type = "button";
  downloadButton.className = "btn btn-sm btn-link text-secondary p-1";
  downloadButton.title = "ダウンロード";
  downloadButton.setAttribute("aria-label", `${fileName}（${savedAt}）をダウンロード`);
  const downloadIcon = document.createElement("i");
  downloadIcon.className = "bi bi-download";
  downloadIcon.setAttribute("aria-hidden", "true");
  downloadButton.append(downloadIcon);
  downloadButton.addEventListener("click", () => downloadHistory(entry));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "btn btn-sm btn-link text-danger p-1";
  deleteButton.title = "削除";
  deleteButton.setAttribute("aria-label", `${fileName}（${savedAt}）を削除`);
  const deleteIcon = document.createElement("i");
  deleteIcon.className = "bi bi-trash";
  deleteIcon.setAttribute("aria-hidden", "true");
  deleteButton.append(deleteIcon);
  deleteButton.addEventListener("click", () => {
    void deleteHistory(entry.savedAt, notify);
  });

  actions.append(downloadButton, deleteButton);
  header.append(metadata, actions);

  const details = document.createElement("details");
  details.className = "history-content small text-body-secondary mt-1";
  const summary = document.createElement("summary");
  summary.className = "d-flex align-items-center gap-2";
  summary.setAttribute("aria-label", `${fileName}（${savedAt}）の内容`);
  const chevron = document.createElement("i");
  chevron.className = "bi bi-chevron-right history-chevron";
  chevron.setAttribute("aria-hidden", "true");
  const preview = document.createElement("span");
  preview.className = "text-truncate";
  preview.textContent = buildPreview(entry.content);
  const close = document.createElement("span");
  close.className = "history-close";
  close.textContent = "閉じる";

  const full = document.createElement("pre");
  full.className = "text-body text-break overflow-auto mt-1 mb-0";
  full.tabIndex = 0;
  full.setAttribute("aria-label", `${fileName} のログ本文`);
  full.textContent = entry.content;

  summary.append(chevron, preview, close);
  details.append(summary, full);
  item.append(header, details);
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
  const fileName = element<HTMLInputElement>("fileName");
  const fileFormat = element<HTMLSelectElement>("fileFormat");
  const headerText = element<HTMLTextAreaElement>("headerText");
  const resetButton = element<HTMLButtonElement>("resetButton");
  const status = element<HTMLElement>("settings-save-status");
  if (!fileName || !fileFormat || !headerText || !resetButton || !status) return;

  const [settings, options, history] = await Promise.all([
    getSettings(),
    getOptions(),
    getHistory(),
  ]);
  applySettings(settings);
  applyOptions(options);
  renderHistory(history, notify);

  const failedFields = new Set<string>();
  let pendingSaves = 0;

  const showStatus = (message: string, failed = false): void => {
    status.textContent = message;
    status.classList.toggle("text-danger", failed);
    status.classList.toggle("text-body-secondary", !failed);
  };

  const updateSaveStatus = (): void => {
    if (failedFields.size > 0) {
      showStatus("保存できていない項目があります", true);
      return;
    }
    if (pendingSaves > 0) {
      showStatus("保存中…");
      return;
    }
    const savedAt = new Date().toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
    showStatus(`保存済み ${savedAt}`);
  };

  const save = async (fields: string[], write: () => Promise<void>): Promise<boolean> => {
    pendingSaves += 1;
    updateSaveStatus();
    try {
      await navigator.locks.request(CONFIG_SAVE_LOCK, write);
      for (const field of fields) {
        failedFields.delete(field);
      }
      return true;
    } catch (error) {
      for (const field of fields) {
        failedFields.add(field);
      }
      console.error("設定の保存に失敗しました", error);
      return false;
    } finally {
      pendingSaves -= 1;
      updateSaveStatus();
    }
  };

  const saveSettings = async (changes: Partial<CaptionSettings>): Promise<void> => {
    await save(Object.keys(changes), async () => {
      const current = await getSettings();
      await setSettings({ ...current, ...changes });
    });
  };

  const saveOptions = async (changes: Partial<CaptionOptions>): Promise<boolean> => {
    return await save(Object.keys(changes), async () => {
      const current = await getOptions();
      const options = { ...current, ...changes };
      if (!options.saveToLocal && !options.saveToGoogleDrive) {
        applyOptions(current);
        return;
      }
      await setOptions(options);
    });
  };

  const saveText = (event: Event): void => {
    if ((event as InputEvent).isComposing) {
      return;
    }
    if (event.currentTarget === fileName) {
      void saveSettings({ fileName: fileName.value.trim() || DEFAULT_SETTINGS.fileName });
    } else {
      void saveSettings({ headerText: headerText.value });
    }
  };

  for (const input of [fileName, headerText]) {
    input.addEventListener("input", saveText);
    input.addEventListener("compositionend", saveText);
  }

  document.getElementById("insertMeetStart")?.addEventListener("click", () => {
    insertTag(headerText, "{meet開始時刻}");
    void saveSettings({ headerText: headerText.value });
  });
  document.getElementById("insertCaptionStart")?.addEventListener("click", () => {
    insertTag(headerText, "{字幕ログ開始時刻}");
    void saveSettings({ headerText: headerText.value });
  });
  document.getElementById("insertCaptionEnd")?.addEventListener("click", () => {
    insertTag(headerText, "{字幕ログ終了時刻}");
    void saveSettings({ headerText: headerText.value });
  });

  fileFormat.addEventListener("change", () => {
    const format = normalizeCaptionFileFormat(fileFormat.value);
    const changes: Partial<CaptionSettings> = { fileFormat: format };
    if (!headerText.value.trim() || Object.values(DEFAULT_HEADERS).includes(headerText.value)) {
      headerText.value = DEFAULT_HEADERS[format];
      changes.headerText = headerText.value;
    }
    void saveSettings(changes);
  });

  resetButton.addEventListener("click", () => {
    fileName.value = DEFAULT_SETTINGS.fileName;
    fileFormat.value = DEFAULT_SETTINGS.fileFormat;
    headerText.value = DEFAULT_HEADERS[DEFAULT_SETTINGS.fileFormat];
    void saveSettings(DEFAULT_SETTINGS);
  });

  setupSaveDestinations(saveOptions);

  for (const id of ["saveOnEndCall", "saveOnTabClose", "saveHistory", "showCaptionsOnStart"]) {
    const checkbox = element<HTMLInputElement>(id);
    checkbox?.addEventListener("change", () => {
      if (!checkbox.disabled) {
        void saveOptions({ [id]: checkbox.checked });
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.options) {
      applyOptions({ ...DEFAULT_OPTIONS, ...changes.options.newValue });
    }
    if (area === "local" && changes.history) {
      renderHistory(
        Array.isArray(changes.history.newValue) ? changes.history.newValue : [],
        notify,
      );
    }
  });
}
