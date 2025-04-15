
// 会議中のURLの正規表現
const meetUrlPattern = /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/;

let captionsSaved = true; // 保存が行われたかを記録するフラグ
let currentText = ''; // 現在の字幕内容を保存/ 
let meetStartTime = null; // {meet開始時刻} に対応
let captionStartTime = null; // {字幕ログ開始時刻} に対応
let captionEndTime; // {字幕ログ終了時刻} に対応

// URLの変更を監視する関数
const checkMeetingStatus = () => {
  const currentUrl = window.location.href;
  if (meetUrlPattern.test(currentUrl) && !meetStartTime) {
    meetStartTime = dateTime();
  }
};

// 字幕ログの有効/無効を確認する関数
const logEnabled = () => {
  chrome.storage.local.get('isLogEnabled', (data) => {
    // console.log(data.isLogEnabled ? '字幕ログが有効:' : '字幕ログが無効:');
    if (data.isLogEnabled) monitorCaptions();
  });
};

// 字幕の表示を監視する関数
const monitorCaptions = () => {
  const captionsContainer = document.querySelector('div[jscontroller="KPn5nb"]');
  const captionsRegion = document.querySelector('.nMcdL.bj4p3b');
  // console.log("captionsSaved", captionsSaved);
  if (captionsRegion) {
    // console.log('字幕が表示されました', captionsContainer.textContent, captionsContainer.textContent.length);
    captionsSaved = false;
    if (!captionStartTime) captionStartTime = dateTime();
    currentText = captionsContainer.textContent.trim();
    // console.log("currentText", currentText.length, currentText);
  } else {
    // console.log("字幕が非表示", !captionsSaved, currentText.length > 20);
    if (!captionsSaved && currentText.length > 20) {
      captionEndTime = dateTime();
      // console.log("字幕が非表示になりました。保存します。", currentText.length);
      saveCaptions();// 字幕をファイルに保存
      captionsSaved = true;
    }
  }
}

// 字幕を保存する関数
const saveCaptions = () => {
  chrome.storage.local.get('settings', (data) => {
    let fileName, fileFormat, headerText;

    if (data.settings) {
      // 設定からファイル名と形式を取得
      fileName = data.settings.fileName;
      fileFormat = data.settings.fileFormat;
      headerText = data.settings.headerText;

    } else {

      // デフォルト設定
      fileName = 'captions';
      fileFormat = 'text/plain';
      headerText =
        `-----------------------------------------------\n` +
        `プロジェクトの打ち合わせ\n` +
        `meet開始時刻    : {meet開始時刻}\n` +
        `字幕ログ開始時刻: {字幕ログ開始時刻}\n` +
        `字幕ログ終了時刻: {字幕ログ終了時刻}\n` +
        `-----------------------------------------------\n`;
    }

    headerText = headerText
      .replace(/{meet開始時刻}/g, meetStartTime)
      .replace(/{字幕ログ開始時刻}/g, captionStartTime)
      .replace(/{字幕ログ終了時刻}/g, captionEndTime);

    captionStartTime = null;
    captionEndTime = null;
    // ファイル作成
    // console.log("currentText", currentText, currentText.length);
    currentText = currentText.slice(0, -20); // currentTextの最後の20文字を削除
    const blob = new Blob([headerText + '\n' + currentText + '\n'], { type: fileFormat });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName; // ダウンロードするファイル名を設定
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    currentText = '';
  });
};

const dateTime = () => {
  // 現在の日付と時刻を取得
  const now = new Date();
  const year = now.getFullYear();           // 年
  const month = String(now.getMonth() + 1).padStart(2, '0'); // 月
  const day = String(now.getDate()).padStart(2, '0');         // 日
  const hours = String(now.getHours()).padStart(2, '0');       // 時
  const minutes = String(now.getMinutes()).padStart(2, '0');   // 分
  const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}`;
  return formattedDateTime;
};

// URL変更監視
let debounceTimer;

const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    logEnabled();
  }, 200);
});
observer.observe(document, { childList: true, attributes: true, subtree: true });

checkMeetingStatus(); // 初回チェック

