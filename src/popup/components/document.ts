import overviewDoc from "../../../docs/overview.md";
import tutorialDoc from "../../../docs/usage.md";
import { escapeHtml } from "../../utils/html";
import type { DocItem } from "../types";

const MARKDOWN_CLASS_MAP: Record<string, string> = {
  h1: "md-h1 fs-5",
  h2: "md-h2 fs-6",
  h3: "md-h3 fs-6",
  h4: "md-h4 fs-6",
  h5: "md-h5 fs-6",
  h6: "md-h6 fs-6",
  p: "md-p",
  ul: "md-ul",
  ol: "md-ol",
  li: "md-li",
};

/**
 * ドキュメントタブをセットアップする
 */
export function setupDocumentTab(): void {
  const documentTab = document.getElementById("document");
  if (!documentTab) return;

  const allDocs: DocItem[] = [overviewDoc, tutorialDoc].sort(
    (a, b) => a.metadata.order - b.metadata.order,
  );

  const visibleDocs = allDocs.filter((doc) => doc.metadata.visible !== false);

  if (visibleDocs.length === 0) {
    documentTab.innerHTML = '<p class="text-center text-muted mt-5">ドキュメントがありません</p>';
    return;
  }

  const accordionHTML = createAccordionHTML(visibleDocs);
  documentTab.innerHTML = accordionHTML;
}

/**
 * アコーディオンHTMLを生成
 */
function createAccordionHTML(docs: DocItem[]): string {
  const items = docs
    .map((doc) => {
      const { id, title, expanded } = doc.metadata;
      const safeId = escapeHtml(String(id));
      const safeTitle = escapeHtml(String(title));
      const collapseClass = expanded ? "show" : "";
      const buttonClass = expanded ? "" : "collapsed";
      const ariaExpanded = expanded ? "true" : "false";
      const styledContent = applyMarkdownClassMap(doc.content);

      return `
      <div class="accordion-item">
        <h2 class="accordion-header">
          <button class="accordion-button ${buttonClass}" type="button" data-bs-toggle="collapse"
            data-bs-target="#doc-${safeId}" aria-expanded="${ariaExpanded}" aria-controls="doc-${safeId}">
            ${safeTitle}
          </button>
        </h2>
        <div id="doc-${safeId}" class="accordion-collapse collapse ${collapseClass}" data-bs-parent="#accordion">
          <div class="accordion-body p-3">
            ${styledContent}
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  return `<div class="accordion" id="accordion">${items}</div>`;
}

/**
 * Markdown のタグにクラスを付与する
 */
function applyMarkdownClassMap(html: string): string {
  return Object.entries(MARKDOWN_CLASS_MAP).reduce((result, [tag, className]) => {
    const openTag = `<${tag}>`;
    const openTagWithClass = `<${tag} class="${className}">`;
    return result.replace(new RegExp(openTag, "g"), openTagWithClass);
  }, html);
}
