export type LogLevel = "info" | "warn" | "error";
export type LogSource = "popup" | "background" | "content";

export interface LogEntry {
  message: string;
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  detail?: string;
  hidden?: boolean;
}

export const LOG_STORAGE_KEY = "app_logs";
const MAX_LOG_SIZE = 200;

/**
 * 現在日時を "YYYY-MM-DD HH:mm:ss" 形式で返す
 */
export function now(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function getLogs(): Promise<LogEntry[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(LOG_STORAGE_KEY, (result) => {
      resolve((result[LOG_STORAGE_KEY] as LogEntry[]) ?? []);
    });
  });
}

/**
 * ログを1件追加する．MAX_LOG_SIZE を超えた場合は古いものを削除する
 */
export async function addLog(
  message: string,
  level: LogLevel,
  source: LogSource,
  detail?: string,
  hidden?: boolean,
): Promise<void> {
  const entry: LogEntry = { message, timestamp: now(), level, source, detail, hidden };
  const logs = await getLogs();
  logs.push(entry);
  if (logs.length > MAX_LOG_SIZE) {
    logs.splice(0, logs.length - MAX_LOG_SIZE);
  }
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [LOG_STORAGE_KEY]: logs }, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve();
    });
  });
}

export function clearLogs(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(LOG_STORAGE_KEY, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve();
    });
  });
}

export const logInfo = (message: string, source: LogSource, hidden?: boolean) =>
  addLog(message, "info", source, undefined, hidden);

export const logWarn = (message: string, source: LogSource, detail?: string, hidden?: boolean) =>
  addLog(message, "warn", source, detail, hidden);

export const logError = (message: string, source: LogSource, error?: unknown, hidden?: boolean) => {
  const detail = error instanceof Error ? error.message : error ? String(error) : undefined;
  return addLog(message, "error", source, detail, hidden);
};
