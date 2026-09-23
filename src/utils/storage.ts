import {
  type CaptionHistoryEntry,
  type CaptionOptions,
  DEFAULT_OPTIONS,
  DEFAULT_SETTINGS,
  normalizeCaptionFileFormat,
  type Settings,
} from "../settings";

export async function getSettings(): Promise<Settings> {
  const data = await getStorage<{ settings?: Partial<Settings> }>("settings");
  return {
    ...DEFAULT_SETTINGS,
    ...(data.settings ?? {}),
    fileFormat: normalizeCaptionFileFormat(data.settings?.fileFormat),
  };
}

export async function isEnabled(): Promise<boolean> {
  const data = await getStorage<{ isLogEnabled?: boolean }>("isLogEnabled");
  return data.isLogEnabled ?? true;
}

export async function setSettings(settings: Settings): Promise<void> {
  await setStorage({ settings });
}

export async function setEnabled(enabled: boolean): Promise<void> {
  await setStorage({ isLogEnabled: enabled });
}

export async function getOptions(): Promise<CaptionOptions> {
  const data = await getStorage<{ options?: Partial<CaptionOptions> }>("options");
  return { ...DEFAULT_OPTIONS, ...(data.options ?? {}) };
}

export async function setOptions(options: CaptionOptions): Promise<void> {
  await setStorage({ options });
}

export async function getHistory(): Promise<CaptionHistoryEntry[]> {
  const data = await getStorage<{ history?: CaptionHistoryEntry[] }>("history");
  return Array.isArray(data.history) ? data.history : [];
}

export async function setHistory(history: CaptionHistoryEntry[]): Promise<void> {
  await setStorage({ history });
}

export function getStorage<T extends Record<string, unknown>>(
  keys: string | string[],
): Promise<Partial<T>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve((result ?? {}) as Partial<T>);
    });
  });
}

export function setStorage<T extends Record<string, unknown>>(items: T): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}
