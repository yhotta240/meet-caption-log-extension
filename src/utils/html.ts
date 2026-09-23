/**
 * HTML特殊文字をエスケープする
 * @param str - エスケープ対象の文字列
 * @returns エスケープされた文字列
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
