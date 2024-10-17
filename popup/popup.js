
//チェックボックスの状態
let isLogEnabled = false;

document.getElementById('captionLogLabel').addEventListener('change', (event) => {
  isLogEnabled = event.target.checked; // チェックボックスの状態を取得
  chrome.storage.local.set({ isLogEnabled: isLogEnabled }, () => {
    messageOutput(dateTime(), isLogEnabled ? '字幕ログが有効になりました' : '字幕ログが無効になりました');
  });
});

// イベントリスナーを設定
document.getElementById('insertMeetStart').addEventListener('click', () => insertTag('{meet開始時刻}'));
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

const defaultHeaderText =
  `-----------------------------------------------\n` +
  `プロジェクトの打ち合わせ\n` +
  `meet開始時刻    : {meet開始時刻}\n` +
  `字幕ログ開始時刻: {字幕ログ開始時刻}\n` +
  `字幕ログ終了時刻: {字幕ログ終了時刻}\n` +
  `-----------------------------------------------\n\n`;

// 設定をリセットする関数
function resetSettings() {
  document.getElementById('fileName').value = 'caption'; // ファイル名をリセット
  document.getElementById('fileFormat').value = 'txt'; // ファイル名をリセット
  document.getElementById('headerText').value = defaultHeaderText; // テキストエリアをデフォルトにリセット
  // saveSettings(dateTime(), '設定がリセットされました'); // リセットされた設定を保存
}
document.getElementById('resetButton').addEventListener('click', () => resetSettings());


// 設定を保存する関数
function saveSettings(datetime, message) {
  isLogEnabled = document.getElementById('captionLogLabel').checked;
  console.log('字幕ログ保存:', isLogEnabled);

  const fileName = document.getElementById('fileName').value; // ファイル名を取得
  const fileFormat = document.getElementById('fileFormat').value; // ファイル形式を取得
  let headerText = document.getElementById('headerText').value; // ヘッダーのテキストを取得

  // 保存するデータをオブジェクトにまとめる
  const settings = {
    isLogEnabled: isLogEnabled,
    fileName: fileName,
    fileFormat: fileFormat,
    headerText: headerText,
    message: [datetime, message],
  };

  // プレースホルダーを実際の値に置き換え
  headerText = headerText
    .replace(/{meet開始時刻}/g, dateTime())
    .replace(/{字幕ログ開始時刻}/g, dateTime())
    .replace(/{字幕ログ終了時刻}/g, dateTime());

  // chrome.storage.localに保存
  chrome.storage.local.set({ settings: settings }, () => {
    messageOutput(datetime, message);
  });

}
document.getElementById('saveButton').addEventListener('click', () => {
  saveSettings(dateTime(), '設定が保存されました');
});


const messageDiv = document.getElementById('message');
function messageOutput(datetime, message) {
  messageDiv.innerHTML += '<p class="m-0">' + datetime + ' ' + message + '</p>'; // <p> タグで囲んで新しい行にする
}

document.getElementById('messageClearButton').addEventListener('click', () => {
  messageDiv.innerHTML = '<p class="m-0">' + '' + '</p>'; // <p> タグで囲んで新しい行にする
});


function dateTime() {
  // 現在の日付と時刻を取得
  const now = new Date();
  const year = now.getFullYear();           // 年
  const month = String(now.getMonth() + 1).padStart(2, '0'); // 月
  const day = String(now.getDate()).padStart(2, '0');         // 日
  const hours = String(now.getHours()).padStart(2, '0');       // 時
  const minutes = String(now.getMinutes()).padStart(2, '0');   // 分
  const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}`;
  // console.log(formattedDateTime);
  return formattedDateTime;
}

// 保存された設定を読み込む関数
function loadSettings() {
  chrome.storage.local.get(['settings', 'isLogEnabled'], (data) => {
    if (data.settings) {
      // 設定を読み込む
      document.getElementById('fileName').value = data.settings.fileName || 'captions'; // ファイル名の設定
      document.getElementById('fileFormat').value = data.settings.fileFormat || 'text/plain'; // ファイル形式の設定
      document.getElementById('headerText').value = data.settings.headerText || defaultHeaderText; // ヘッダーのテキストを設定
      // const messageDiv = document.getElementById('message');
      // messageDiv.innerHTML = '<p class="m-0">' + data.settings.message[0] + ' ' + data.settings.message[1] + '</p>'; // 保存されたログを表示
    }

    // logEnabledの値を取得
    const isLogEnabled = data.isLogEnabled || false; // デフォルトはfalse
    document.getElementById('captionLogLabel').checked = isLogEnabled; // チェックボックスの状態を設定
    console.log('字幕ログが有効:', isLogEnabled);
    messageOutput(dateTime(), isLogEnabled ? '字幕ログは有効になっています' : '字幕ログは無効になっています');
  });
}
loadSettings(); // 初期化時に設定を読み込む