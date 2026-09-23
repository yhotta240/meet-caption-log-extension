export type Theme = "system" | "light" | "dark";

export type SharePlatform = "twitter" | "facebook" | "copy";

export interface ShareConfig {
  title: string;
  url: string;
  text?: string;
}

export type ManifestMetadata = {
  issues_url?: string;
  languages?: string[];
  publisher?: string;
  developer?: string;
  github_url?: string;
  [key: string]: unknown;
};

export interface DocumentMetadata {
  id: string;
  title: string;
  order: number;
  visible?: boolean;
  expanded?: boolean;
  date?: string;
  lang?: string;
}

export interface DocItem {
  metadata: DocumentMetadata;
  content: string; // HTML
}

export interface VersionMetadata {
  id: string;
  title: string;
  version: string;
  date?: string;
  order: number;
}

export interface VersionItem {
  metadata: VersionMetadata;
  content: string; // HTML
}
