import type { Theme } from "../types";

/**
 * テーマ取得
 */
export function getTheme(): Theme {
  const t = localStorage.getItem("theme");
  return (t as Theme) || "system";
}

export function setTheme(theme: Theme): void {
  localStorage.setItem("theme", theme);
}

/**
 * テーマ適用
 */
export function applyTheme(theme: Theme): void {
  const resolvedTheme = resolveTheme(theme);

  // フラッシュ防止のため先に設定
  document.documentElement.setAttribute("data-bs-theme", resolvedTheme);

  const applyToBody = () => {
    toggleBodyTheme(resolvedTheme);
    updateThemeMenu(theme);
    setTheme(theme);
  };

  if (document.body) {
    applyToBody();
  } else {
    document.addEventListener("DOMContentLoaded", applyToBody);
  }
}

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") {
    return theme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function toggleBodyTheme(theme: "light" | "dark"): void {
  document.body.classList.toggle("theme-light", theme === "light");
  document.body.classList.toggle("theme-dark", theme === "dark");
}

function updateThemeMenu(selectedTheme: Theme): void {
  document.querySelectorAll("#theme-menu .theme-option").forEach((el) => {
    const btn = el as HTMLButtonElement;
    btn.classList.toggle("active", (btn.dataset.theme ?? "system") === selectedTheme);
  });
}

/**
 * テーマメニューの初期化
 */
export function setupThemeMenu(onChange: (theme: Theme) => void): void {
  const btn = document.getElementById("theme-button");
  const menu = document.getElementById("theme-menu");
  if (!btn || !menu) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("d-none");
  });

  menu.addEventListener("click", (e) => {
    const opt = (e.target as HTMLElement).closest(".theme-option") as HTMLButtonElement | null;
    if (!opt) return;
    const value = (opt.dataset.theme || "system") as Theme;
    applyTheme(value);
    try {
      onChange(value);
    } catch (err) {
      console.error("persist theme failed", err);
    }
    menu.classList.add("d-none");
  });

  document.addEventListener("click", () => menu.classList.add("d-none"));

  const moreButton = document.getElementById("more-button");
  moreButton?.addEventListener("click", () => {
    menu.classList.add("d-none");
  });
}
