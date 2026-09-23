import ".";
import { reloadExtension } from "../../scripts/reload";
import { reloadTargetTabs } from "../utils/reload-tabs";

// 開発用のターゲットURLパターン
const targetUrls = ["https://meet.google.com/*"];

if (process.env.NODE_ENV === "development") {
  console.log("開発環境：", process.env.NODE_ENV);
  console.log("ターゲットタブのリロードを開始します", targetUrls);
  // 開発時のみ実行する処理をここに置く（本番には含めない）
  reloadExtension();
  reloadTargetTabs(targetUrls);
}
