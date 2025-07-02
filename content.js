
// 会議中のURLの正規表現
const meetUrlPattern = /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/;

let isCaptionsSaved = true; // 保存が行われたかを記録するフラグ
let meetStartTime = null; // {meet開始時刻} に対応
let captionStartTime = null; // {字幕ログ開始時刻} に対応
let captionEndTime; // {字幕ログ終了時刻} に対応
let prevSpeakerCount = 1; // 前回のスピーカーの数;
let caption = {}; // 字幕を保存するオブジェクト
let captions = []; // 字幕を保存する配列
let outputText = ''; // ファイルに出力するテキスト

// URLの変更を監視する関数
const checkMeetingStatus = () => {
  const currentUrl = window.location.href;
  if (meetUrlPattern.test(currentUrl) && !meetStartTime) {
    meetStartTime = dateTime();
    chrome.storage.local.set({ meetStartTime }, () => { });
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
  const captionItems = document.querySelectorAll('.nMcdL.bj4p3b');
  const speakers = document.querySelectorAll('.adE6rb');

  if (captionItems.length > 0) {
    isCaptionsSaved = false;
    if (!captionStartTime) {
      captionStartTime = dateTime();
      captionEndTime = null;
      chrome.storage.local.set({ captionStartTime, captionEndTime }, () => { });
    };

    const speakerText = speakers[speakers.length - 1].textContent;
    const captionText = captionItems[captionItems.length - 1].querySelector('.ygicle.VbkSUe').textContent;
    // console.log("スピーカー", speakerText, "字幕", captionText);

    // 前回のスピーカー数と現在のスピーカー数が異なる場合
    if (prevSpeakerCount !== speakers.length) {
      captions.push(caption);
    }

    caption = {
      num: speakers.length,
      time: dateTime(),
      speaker: speakerText,
      text: captionText,
    };
    // console.log("caption", caption);

    prevSpeakerCount = speakers.length;

  } else {
    // console.log("字幕が非表示", !isCaptionsSaved);
    if (!isCaptionsSaved) {
      captions.push(caption);

      captionEndTime = dateTime();
      chrome.storage.local.set({ captionEndTime });
      // console.log("字幕が非表示になりました。保存します。", currentText.length);
      saveCaptions(); // 字幕をファイルに保存
      isCaptionsSaved = true;
      prevSpeakerCount = 1;
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

    captions.forEach((caption) => {
      outputText += `\n${caption.speaker}:\n ${caption.text}\n`;
    });

    // ファイル作成
    const blob = new Blob([headerText + outputText + '\n'], { type: fileFormat });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName; // ダウンロードするファイル名を設定
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    captions = [];
    outputText = '';
  });
};

function dateTime() {
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

