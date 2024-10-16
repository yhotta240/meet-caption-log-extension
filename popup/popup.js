
// イベントリスナーを設定
document.getElementById('insertMeetStart').addEventListener('click', () => insertTag('{meet開始時刻}'));
document.getElementById('insertMeetEnd').addEventListener('click', () => insertTag('{meet終了時刻}'));
document.getElementById('insertCaptionStart').addEventListener('click', () => insertTag('{字幕ログ開始時刻}'));
document.getElementById('insertCaptionEnd').addEventListener('click', () => insertTag('{字幕ログ終了時刻}'));
// タグを挿入する関数
function insertTag(tag) {
  const textarea = document.getElementById('headerText');
  const startPos = textarea.selectionStart;
  const endPos = textarea.selectionEnd;
  const textBefore = textarea.value.substring(0, startPos);
  const textAfter = textarea.value.substring(endPos, textarea.value.length);
  textarea.value = textBefore + tag + textAfter;

  // カーソルをタグの後ろに移動させる処理
  const newPos = startPos + tag.length;
  textarea.setSelectionRange(newPos, newPos); // カーソル位置を変更
  textarea.focus(); // フォーカスをテキストエリアに戻す
}


// 設定をリセットする関数
function resetSettings() {
  const defaultHeaderText =
    `-----------------------------------------------\n` +
    `{meet開始時刻} - {meet終了時刻}\n` +
    `{字幕ログ開始時刻} - {字幕ログ終了時刻}\n` +
    `打ち合わせ\n` +
    `-----------------------------------------------\n\n`;

  document.getElementById('fileName').value = 'caption'; // ファイル名をリセット
  document.getElementById('fileFormat').value = 'txt'; // ファイル名をリセット
  document.getElementById('headerText').value = defaultHeaderText; // テキストエリアをデフォルトにリセット
  saveSettings(); // リセットされた設定を保存
  console.log('設定がリセットされました');
}
document.getElementById('resetButton').addEventListener('click', () => resetSettings());


// 設定を保存する関数
function saveSettings() {
  const fileName = document.getElementById('fileName').value; // ファイル名を取得
  const fileFormat = document.getElementById('fileFormat').value; // ファイル形式を取得
  const headerText = document.getElementById('headerText').value; // ヘッダーのテキストを取得

  // 保存するデータをオブジェクトにまとめる
  const settings = {
    fileName: fileName,
    fileFormat: fileFormat,
    headerText: headerText,
  };

  // chrome.storage.localに保存
  chrome.storage.local.set({ settings: settings }, () => {
    console.log('設定が保存されました:', settings);
  });
}
document.getElementById('saveButton').addEventListener('click', () => {
  // saveCaptionsToFile(); // ファイルを保存する関数を呼び出す
  saveSettings(); // 設定を保存する関数を呼び出す
});


// 保存された設定を読み込む関数
function loadSettings() {
  chrome.storage.local.get('settings', (data) => {
    if (data.settings) {
      document.getElementById('fileName').value = data.settings.fileName || 'captions'; // 修正
      document.getElementById('fileFormat').value = data.settings.fileFormat || 'text/plain'; // 修正
      document.getElementById('headerText').value = data.settings.headerText || ''; // ヘッダーのテキストを設定
    }
  });
}
loadSettings(); // 初期化時に設定を読み込む
