import "./popup.css";
import "bootstrap/js/dist/tab.js";
import "bootstrap/js/dist/collapse.js";
import { applyTheme, getTheme } from "./components/theme";
import { PopupManager } from "./manager";

try {
  // フラッシュ防止のため先にテーマを適用
  const theme = getTheme();
  applyTheme(theme);
} catch (_e) {
  // ignore
}

document.addEventListener("DOMContentLoaded", () => new PopupManager());
