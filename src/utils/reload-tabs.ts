/**
 * タブのURLがターゲットURLパターンのいずれかに一致するかチェック
 */
function isTargetTab(tabUrl: string | undefined, targetUrls: string[]): boolean {
  if (!tabUrl) return false;
  return targetUrls.some((pattern) => {
    try {
      // まず正規表現のメタ文字をエスケープしてから * をワイルドカードに変換する
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      return new RegExp(escaped).test(tabUrl);
    } catch (error) {
      console.warn(`無効なURLパターン: ${pattern}`, error);
      return false;
    }
  });
}

/**
 * ターゲットURLパターンに一致するタブをリロード
 */
export async function reloadTargetTabs(targetUrls: string[]): Promise<void> {
  try {
    if (targetUrls.length === 0) {
      console.log("ターゲットURLパターンが設定されていません");
      return;
    }

    const tabs = await chrome.tabs.query({});
    let reloadedCount = 0;

    for (const tab of tabs) {
      if (tab.id && isTargetTab(tab.url, targetUrls)) {
        try {
          await chrome.tabs.reload(tab.id);
          reloadedCount++;
          console.log(`タブをリロードしました: ${tab.url}`);
        } catch (error) {
          console.warn(`タブ ${tab.id} のリロードに失敗しました:`, error);
        }
      }
    }

    console.log(`${reloadedCount} 個のタブをリロードしました`);
  } catch (error) {
    console.error("ターゲットタブのリロードに失敗しました:", error);
  }
}
