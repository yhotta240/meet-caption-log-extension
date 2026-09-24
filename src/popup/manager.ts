import meta from "../../public/manifest.meta.json";
import { DEFAULT_SETTINGS, type Settings } from "../settings";
import {
  addLog,
  clearLogs,
  getLogs,
  LOG_STORAGE_KEY,
  type LogEntry,
  type LogLevel,
} from "../utils/logger";
import { getSettings, getStorage, isEnabled, setEnabled, setSettings } from "../utils/storage";
import { setupCaptionSettings } from "./components/captions";
import { setupDocumentTab } from "./components/document";
import { setupInfoTab } from "./components/info";
import { setupMoreMenu } from "./components/menu";
import { PopupPanel } from "./components/panel";
import { initShareMenu } from "./components/share";
import { applyTheme, setupThemeMenu } from "./components/theme";
import { setupVersionTab } from "./components/version";
import type { ManifestMetadata, SharePlatform, Theme } from "./types";

export class PopupManager {
  private panel: PopupPanel;
  private enabled: boolean = false;
  private settings: Settings = DEFAULT_SETTINGS;
  private manifestData: chrome.runtime.Manifest;
  private manifestMetadata: ManifestMetadata;
  private enabledElement: HTMLInputElement | null;
  // private notificationToggle: HTMLInputElement | null;
  // private fontSizeRange: HTMLInputElement | null;

  constructor() {
    this.panel = new PopupPanel();
    this.manifestData = chrome.runtime.getManifest();
    this.manifestMetadata = meta || {};
    this.enabledElement = document.getElementById("enabled") as HTMLInputElement | null;
    // this.notificationToggle = document.getElementById('notification-toggle') as HTMLInputElement | null;
    // this.fontSizeRange = document.getElementById('font-size') as HTMLInputElement | null;

    this.initialize();
  }

  private async initialize(): Promise<void> {
    this.panel.setClearCallback(async () => {
      await clearLogs();
    });
    // storageの読み込みを待たずに、基本UIと操作を先に初期化する。
    this.setupUI();
    this.addEventListeners();

    try {
      await setupCaptionSettings((message) => this.showLog(message));
    } catch (err) {
      console.error("字幕ログ設定の読み込みエラー", err);
      await this.showLog("字幕ログ設定の読み込みに失敗しました", "error", err);
    }

    try {
      const logs = await getLogs();
      const visibleCount = logs.filter((e) => !e.hidden).length;
      if (logs.length > 0) {
        this.panel.loadLogs(logs, this.manifestMetadata.issues_url);
      }
      this.watchStorageLogs(visibleCount);
    } catch (err) {
      console.error("ログ読み込みエラー", err);
      this.watchStorageLogs(0);
    }

    try {
      await this.loadCaptionEvents();
    } catch (err) {
      console.error("字幕ログ状態の読み込みエラー", err);
    }

    try {
      this.settings = await getSettings();
      this.enabled = await isEnabled();
      if (this.enabledElement) this.enabledElement.checked = this.enabled;
    } catch (err) {
      console.error("error", err);
      await this.showLog("設定の読み込みに失敗しました", "error", err);
    }
  }

  private watchStorageLogs(knownLength: number): void {
    let currentLength = knownLength;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[LOG_STORAGE_KEY]) {
        const rawEntries = changes[LOG_STORAGE_KEY]?.newValue;
        const entries: LogEntry[] = Array.isArray(rawEntries) ? rawEntries : [];
        const visible = entries.filter((e) => !e.hidden);
        const newEntries = visible.slice(currentLength);
        for (const entry of newEntries) {
          this.panel.messageOutput(
            entry.message,
            entry.timestamp,
            entry.level,
            entry.source,
            this.manifestMetadata.issues_url,
          );
        }
        currentLength = visible.length;
      }
    });
  }

  private async loadCaptionEvents(): Promise<void> {
    const keys = ["meetStartTime", "captionStartTime", "captionEndTime"] as const;
    const labels: Record<(typeof keys)[number], string> = {
      meetStartTime: "会議が開始されました",
      captionStartTime: "字幕ログが開始されました",
      captionEndTime: "字幕ログが終了しました",
    };
    const data = await getStorage<Partial<Record<(typeof keys)[number], string | null>>>([...keys]);
    const lastValues = new Map<string, string>();
    const initialEvents = keys
      .map((key) => ({ key, time: data[key] }))
      .filter((event): event is { key: (typeof keys)[number]; time: string } => Boolean(event.time))
      .sort((a, b) => a.time.localeCompare(b.time));

    for (const event of initialEvents) {
      lastValues.set(event.key, event.time);
      this.panel.messageOutput(labels[event.key], event.time, "info", "content");
    }

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;

      for (const key of keys) {
        const value = changes[key]?.newValue;
        if (typeof value !== "string" || lastValues.get(key) === value) continue;
        lastValues.set(key, value);
        this.panel.messageOutput(labels[key], value, "info", "content");
      }
    });
  }

  private addEventListeners(): void {
    this.enabledElement?.addEventListener("change", async (event) => {
      this.enabled = (event.target as HTMLInputElement).checked;
      try {
        await setEnabled(this.enabled);
        await this.showLog(
          this.enabled
            ? `${this.manifestData.short_name} は有効になりました`
            : `${this.manifestData.short_name} は無効になりました`,
        );
      } catch (err) {
        console.error("failed to save enabled state", err);
        await this.showLog("有効状態の保存に失敗しました", "error", err);
      }
    });

    // テーマ設定のイベントリスナー
    setupThemeMenu(async (value: Theme) => {
      try {
        applyTheme(value);
        await this.showLog(`テーマを ${value} に変更しました`);
      } catch (e) {
        await this.showLog("テーマ設定の保存に失敗しました", "error", e);
      }
    });

    // シェアメニューの初期化
    initShareMenu(async (platform: SharePlatform, success: boolean) => {
      const platformNames: Record<SharePlatform, string> = {
        twitter: "X (Twitter)",
        facebook: "Facebook",
        copy: "クリップボード",
      };
      if (success) {
        if (platform === "copy") {
          await this.showLog("URLをコピーしました");
        } else {
          await this.showLog(`${platformNames[platform]}でシェアしました`);
        }
      } else {
        await this.showLog("シェアに失敗しました", "error");
      }
    });

    // 他の設定項目のイベントリスナー例

    // チェックボックスの例:
    // this.notificationToggle?.addEventListener('change', (event) => {
    //   const checked = (event.target as HTMLInputElement).checked;
    //   this.updateSettings({ notifications: checked }, `通知を${checked ? '有効' : '無効'}にしました`, '通知の保存に失敗しました');
    // });

    // スライダーの例:
    // this.fontSizeRange?.addEventListener('change', (event) => {
    //   const fontSize = (event.target as HTMLInputElement).value;
    //   this.updateSettings({ fontSize: Number(fontSize) }, 'フォントサイズを保存しました', 'フォントサイズの保存に失敗しました');
    // });
  }

  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: 設定を更新する際はこの関数を呼び出してください
  private async updateSettings(
    patch: Partial<Settings>,
    successMessage?: string,
    failedMessage?: string,
  ): Promise<void> {
    try {
      this.settings = { ...this.settings, ...patch };
      await setSettings(this.settings);
      if (successMessage) await this.showLog(successMessage);
    } catch (err) {
      console.error("failed to save settings", err);
      await this.showLog(failedMessage || "設定の保存に失敗しました", "error", err);
    }
  }

  private setupUI(): void {
    const short_name = this.manifestData.short_name || this.manifestData.name;
    const title = document.getElementById("title");
    if (title) {
      title.textContent = short_name;
    }
    const titleHeader = document.getElementById("title-header");
    if (titleHeader) {
      titleHeader.textContent = short_name;
    }
    const enabledLabel = document.getElementById("enabled-label");
    if (enabledLabel) {
      enabledLabel.textContent = "字幕ログを有効にする";
    }

    setupMoreMenu();
    setupInfoTab(this.manifestData, this.manifestMetadata);
    setupDocumentTab();
    setupVersionTab(this.manifestData.version);
  }

  private async showLog(message: string, level: LogLevel = "info", error?: unknown): Promise<void> {
    const detail = error instanceof Error ? error.message : error ? String(error) : undefined;
    try {
      await addLog(message, level, "popup", detail);
    } catch (e) {
      console.error("ログ保存エラー", e);
    }
  }
}
