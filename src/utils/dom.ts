/**
 * HTMLAnchorElement をクリックしたとき，新しいタブでURLを開くハンドラを登録する
 * @param link - URLを持つHTMLAnchorElement
 * @example
 * const link = document.getElementById('my-link') as HTMLAnchorElement;
 * openLinkNewTab(link);
 */
export function openLinkNewTab(link: HTMLAnchorElement): void {
  const isHttpUrl = (url: string): url is string => {
    return typeof url === "string" && /^(http|https):\/\//i.test(url);
  };
  const isChromeUrl = (url: string): url is string => {
    return typeof url === "string" && /^(chrome|chrome-extension|extension):\/\//i.test(url);
  };

  const url = link.href;
  if (!url) return;

  const safeUrl = String(url);

  // 許可するのは HTTP/HTTPS またはブラウザ内部スキーム
  if (!isHttpUrl(safeUrl) && !isChromeUrl(safeUrl)) {
    console.warn(`openLinkNewTab: invalid URL scheme, ignoring: ${safeUrl}`);
    return;
  }

  link.addEventListener("click", (event) => {
    event.preventDefault();
    chrome.tabs.create({ url: safeUrl });
  });
}
