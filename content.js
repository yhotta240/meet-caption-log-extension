
// 会議中のURLの正規表現
const meetUrlPattern = /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/;

let captionsSaved = false; // 保存が行われたかを記録するフラグ
let captionsData = []; // 字幕の内容を保存する配列
let currentText = ''; // 現在の字幕内容を保存/ 
let backupText = ''; // バックアップ
let previousLen = -1; // 前のlenの値を保存する
let meetStartTime = null;      // {meet開始時刻} に対応
let captionStartTime = null;   // {字幕ログ開始時刻} に対応
let captionEndTime;            // {字幕ログ終了時刻} に対応

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
    // console.log(isLogEnabled ? '字幕ログが有効:' : '字幕ログが無効:');
    if (data.isLogEnabled) monitorCaptions();
  });
};

// 字幕の表示を監視する関数
const monitorCaptions = () => {
  const captionsContainer = document.querySelector('div[jsname="dsyhDe"].iOzk7.XDPoIe');
  if (!captionsContainer) return;

  if (captionsContainer.style.display === '') {
    // console.log('字幕が表示されました');
    captionsSaved = false;
    if (!captionStartTime) captionStartTime = dateTime();
    extractCaptions(captionsContainer); // 字幕を抽出
  } else if (captionsContainer.style.display === 'none') {
    // console.log('字幕が非表示');
    captionEndTime = dateTime();
    if (captionsData.length > 0 && !captionsSaved) {
      captionsData.push(currentText);
      saveCaptions(); // 字幕をファイルに保存
      currentText = '';
      backupText = '';
      captionsSaved = true;
    }
  }
};

// 字幕のテキストを抽出して配列に追加する関数
const extractCaptions = (captionsContainer) => {
  const captionDivs = captionsContainer.querySelectorAll('div[jsname="tgaKEf"].iTTPOb.VbkSUe span');
  let newText = ''; // 新しい字幕内容を保存する変数
  captionDivs.forEach(span => {
    newText += span.textContent.trim(); // スペースを取り除きながら内容を追加
  });

  let commonSubstring = matchCaptions(currentText, newText); // 共通部分を探す
  currentText = currentText.slice(0, currentText.indexOf(commonSubstring)) + newText; // マージ
  // console.log('現在の字幕:', currentText);
  let len = currentText.length;

  if (len === 0 && previousLen !== 0) { // バックアップ
    captionsData.push(backupText);
  }
  backupText = currentText;
  previousLen = len;

  if (len > 500) { // 500文字以上になった場合に配列にプッシュ
    captionsData.push(currentText);
    currentText = '';
  }

};

// 共通部分を見つける関数
const matchCaptions = (str1, str2) => {
  if (!str1 || !str2) return '';
  let commonSubstring = '';
  for (let i = 0; i < str1.length; i++) {
    for (let j = i; j < str1.length; j++) {
      let substring = str1.substring(i, j + 1);
      if (str2.includes(substring) && substring.length > commonSubstring.length) {
        commonSubstring = substring;
      }
    }
  }
  return commonSubstring;
};

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
        `-----------------------------------------------\n\n`;

    }

    headerText = headerText
      .replace(/{meet開始時刻}/g, meetStartTime)
      .replace(/{字幕ログ開始時刻}/g, captionStartTime)
      .replace(/{字幕ログ終了時刻}/g, captionEndTime);

    captionStartTime = null;
    captionEndTime = null;

    // ファイル作成
    const blob = new Blob([headerText + captionsData.join('\n')], { type: fileFormat });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName; // ダウンロードするファイル名を設定
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    captionsData = []; // 字幕データをリセット
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
  // console.log(formattedDateTime);
  return formattedDateTime;
};

// URL変更監視
const observer = new MutationObserver(() => logEnabled());
observer.observe(document, { childList: true, attributes: true, subtree: true });

checkMeetingStatus(); // 初回チェック

