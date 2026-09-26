import type { Plugin } from "vite";
import { basename } from "node:path";
import matter from "gray-matter";
import { Marked, marked } from "marked";
import sanitizeHtml from "sanitize-html";

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "br",
    "hr",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "code",
    "pre",
    "blockquote",
    "aside",
    "i",
    "a",
    "img",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    aside: ["class"],
    i: ["class", "aria-hidden"],
    img: ["src", "alt", "title", "width", "height"],
    th: ["align"],
    td: ["align"],
  },
  allowedClasses: { aside: ["md-tip"], i: ["bi", "bi-lightbulb"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: "_blank",
        rel: "noopener noreferrer",
      },
    }),
  },
};

const documentMarkdown = new Marked({
  renderer: {
    blockquote({ text }) {
      if (!text.startsWith("[!TIP]\n")) return false;

      const body = marked.parse(text.slice("[!TIP]\n".length), { async: false });
      return `<aside class="md-tip"><strong><i class="bi bi-lightbulb" aria-hidden="true"></i>Tip</strong>${body}</aside>`;
    },
  },
});

function parseDocument(source: string) {
  const { data, content } = matter(source);
  const html = String(documentMarkdown.parse(content, { async: false }));

  return {
    metadata: {
      id: data.id || "",
      title: data.title || "Untitled",
      order: data.order || 0,
      visible: data.visible !== false,
      expanded: data.expanded !== false,
      date: data.date || "",
      lang: data.lang || "",
    },
    content: sanitizeHtml(html, sanitizeOptions),
  };
}

const versionRegex = /(\d+\.\d+\.\d+)/;
const dateRegex = /-?\s*(\d{4}-\d{2}-\d{2})/;

function parseChangelog(source: string) {
  const { content } = matter(source);
  const fullHtml = String(marked.parse(content, { async: false }));
  const sections = fullHtml.split(/<h2[^>]*>/);

  sections.shift();

  return sections.flatMap((section) => {
    const closeTag = section.indexOf("</h2>");
    if (closeTag < 0) return [];

    const headerText = section.slice(0, closeTag).trim();
    const body = section.slice(closeTag + "</h2>".length).trim();
    const version = headerText.match(versionRegex)?.[1] || "";
    if (!version) return [];

    const date = headerText.match(dateRegex)?.[1] || "";
    const versionLabel = headerText.match(/^\[([^\]]+)\]/)?.[1] || version;
    const [major, minor, patch] = version.split(".").map(Number);
    const order = major * 1_000_000 + minor * 1_000 + patch;

    return [
      {
        metadata: {
          id: versionLabel,
          title: headerText,
          version,
          date,
          order,
        },
        content: sanitizeHtml(body, sanitizeOptions),
      },
    ];
  });
}

/** Markdown と CHANGELOG.md を型定義に対応したオブジェクトへ変換する Vite プラグイン */
export function markdownPlugin(): Plugin {
  return {
    name: "markdown-loader",
    transform(source, id) {
      if (!id.endsWith(".md")) return;

      const parsed =
        basename(id.split("?", 1)[0]) === "CHANGELOG.md"
          ? parseChangelog(source)
          : parseDocument(source);

      return {
        code: `export default ${JSON.stringify(parsed, null, 2)};`,
        map: null,
      };
    },
  };
}
