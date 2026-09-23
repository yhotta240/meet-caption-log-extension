/**
 * メニューボタンの挙動を設定する
 */
export function setupMoreMenu(): void {
  const moreButton = document.getElementById("more-button");
  const moreMenu = document.getElementById("more-menu");
  const themeButton = document.getElementById("theme-button");
  const newTabButton = document.getElementById("new-tab-button");

  if (!moreButton || !moreMenu) return;

  moreButton.addEventListener("click", (e) => {
    e.stopPropagation();
    moreMenu.classList.toggle("d-none");
  });

  document.addEventListener("click", (e) => {
    const target = e.target as Node;
    if (!moreMenu.contains(target) && !moreButton.contains(target)) {
      moreMenu.classList.add("d-none");
    }
  });

  themeButton?.addEventListener("click", () => {
    moreMenu.classList.add("d-none");
  });

  newTabButton?.addEventListener("click", () => {
    chrome.tabs.create({ url: "popup.html" });
    moreMenu.classList.add("d-none");
  });
}
