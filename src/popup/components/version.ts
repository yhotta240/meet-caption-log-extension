import changeLog from "../../../CHANGELOG.md";
import { escapeHtml } from "../../utils/html";
import type { VersionItem } from "../types";

const MARKDOWN_CLASS_MAP: Record<string, string> = {
  h1: "fs-6 mb-2",
  h2: "fs-6 mb-2",
  h3: "fs-6 mb-2",
  h4: "fs-6 mb-2",
  h5: "fs-6 mb-2",
  h6: "fs-6 mb-2",
  p: "small mb-2",
  ul: "small mb-2 ps-3",
  ol: "small mb-2 ps-3",
  li: "mb-1",
};

/**
 * バージョンタブをセットアップする
 */
export function setupVersionTab(_currentVersion: string): void {
  const versionTab = document.getElementById("version");
  if (!versionTab) return;

  const allVersions: VersionItem[] = changeLog.sort((a, b) => b.metadata.order - a.metadata.order);

  if (allVersions.length === 0) {
    versionTab.innerHTML = '<p class="text-center text-muted mt-5">更新履歴がありません</p>';
    return;
  }

  versionTab.innerHTML = createVersionListHTML(allVersions);
}

function createVersionListHTML(items: VersionItem[]): string {
  const entries = items
    .map((item, index) => {
      const version = String(item.metadata.id || item.metadata.version || "");
      const displayDate = formatReleaseDate(item.metadata.date);
      const badge = createBadgeHTML(index === 0);
      const content = applyMarkdownClassMap(item.content);

      return `
      <li class="list-group-item">
        <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
          <strong>${version}</strong>
          ${badge}
        </div>
        ${displayDate ? `<p class="small text-muted mb-2">${escapeHtml(displayDate)}</p>` : ""}
        <div class="version-body">
          ${content}
        </div>
      </li>
    `;
    })
    .join("");

  return `
    <ul class="list-group list-group-flush">
      <h5 class="pt-3 ps-2 mb-2">更新履歴</h5>
      ${entries}
    </ul>
  `;
}

function formatReleaseDate(dateValue?: string): string {
  if (!dateValue?.trim()) return "";

  const raw = dateValue.trim();

  const match = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
}

function createBadgeHTML(isFirst: boolean): string {
  return isFirst ? '<span class="badge bg-primary">最新</span>' : "";
}

function applyMarkdownClassMap(html: string): string {
  return Object.entries(MARKDOWN_CLASS_MAP).reduce((result, [tag, className]) => {
    const openTag = `<${tag}>`;
    const openTagWithClass = `<${tag} class="${className}">`;
    return result.replace(new RegExp(openTag, "g"), openTagWithClass);
  }, html);
}
