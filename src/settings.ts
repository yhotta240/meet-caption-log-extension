export type CaptionFileFormat = "txt" | "csv" | "md";

export type CaptionSettings = {
  fileName: string;
  fileFormat: CaptionFileFormat;
  headerText: string;
};

export type CaptionOptions = {
  saveOnEndCall: boolean;
  saveOnTabClose: boolean;
  saveHistory: boolean;
  showCaptionsOnStart: boolean;
};

export type CaptionHistoryEntry = {
  savedAt: string;
  fileName: string;
  fileFormat: string;
  content: string;
};

export type Settings = CaptionSettings;

export const DEFAULT_HEADER_TEXT = `---
プロジェクトの打ち合わせ
meet開始時刻    : {meet開始時刻}
字幕ログ開始時刻: {字幕ログ開始時刻}
字幕ログ終了時刻: {字幕ログ終了時刻}
---
`;

export const DEFAULT_MARKDOWN_HEADER_TEXT = `---
title: プロジェクトの打ち合わせ
meet_start: {meet開始時刻}
caption_log_start: {字幕ログ開始時刻}
caption_log_end: {字幕ログ終了時刻}
---
`;

export const DEFAULT_SETTINGS: Settings = {
  fileName: "caption",
  fileFormat: "txt",
  headerText: DEFAULT_HEADER_TEXT,
};

export const DEFAULT_OPTIONS: CaptionOptions = {
  saveOnEndCall: true,
  saveOnTabClose: true,
  saveHistory: false,
  showCaptionsOnStart: false,
};

export const MIME_TYPES: Record<CaptionFileFormat, string> = {
  txt: "text/plain",
  csv: "text/csv",
  md: "text/markdown",
};

export function normalizeCaptionFileFormat(value: unknown): CaptionFileFormat {
  if (value === "csv" || value === "text/csv") return "csv";
  if (value === "md" || value === "text/markdown") return "md";
  return "txt";
}
