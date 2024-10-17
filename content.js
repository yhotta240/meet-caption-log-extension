
// 会議中のURLの正規表現
const meetUrlPattern = /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/;

let captionsSaved = false; // 保存が行われたかを記録するフラグ
let captionsData = []; // 字幕の内容を保存する配列
let currentText = ''; // 現在の字幕内容を保存
let arrayText = '';
let backupText = ''; // バックアップ
let len = 0;
let previousLen = -1; // 前のlenの値を保存する
let meetStartTime = null;      // {meet開始時刻} に対応
let captionStartTime = null;   // {字幕ログ開始時刻} に対応
let captionEndTime;

// URLの変更を監視する関数
const checkMeetingStatus = () => {
  const currentUrl = window.location.href;

  if (meetUrlPattern.test(currentUrl)) { // 会議中のURLであるかをチェック
    // console.log('会議開始');
    if (!meetStartTime) {
      meetStartTime = dateTime();
    }
  } else {
    // console.log('会議開始前');
  }
};

// 字幕ログの有効/無効を確認する関数
const logEnabled = () => {
  chrome.storage.local.get('isLogEnabled', (data) => {
    const isLogEnabled = data.isLogEnabled || false; // デフォルトはfalse
    // console.log(isLogEnabled ? '字幕ログが有効:' : '字幕ログが無効:');
    if (isLogEnabled) { // 字幕ログが有効
      monitorCaptions();
    }
  });
};

// 字幕の表示を監視する関数
const monitorCaptions = () => {
  const captionsContainer = document.querySelector('div[jsname="dsyhDe"].iOzk7.XDPoIe');
  if (!captionsContainer) {
    return;
  }

  if (captionsContainer.style.display === '') {
    // console.log('字幕が表示されました');
    captionsSaved = false;
    if (!captionStartTime) {
      captionStartTime = dateTime();
    }
    extractCaptions(captionsContainer); // 字幕を抽出

  } else if (captionsContainer.style.display === 'none') {
    // console.log('字幕が非表示');
    captionEndTime = dateTime();
    if (captionsData.length > 0 && !captionsSaved) {
      captionsData.push(currentText);
      console.log('currentText残りを', currentText);
      console.log('captionsDataにcurrentTextをプッシュ', captionsData);
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

  // 現在の字幕内容を更新

  // console.log('new', newText);
  let commonSubstring = matchCaptions(currentText, newText); // 共通部分を探す
  currentText = currentText.slice(0, currentText.indexOf(commonSubstring)) + newText; // マージ
  // console.log('現在の字幕:', currentText);
  let len = currentText.length;
  console.log('現在の字幕文字数:', len);

  if (len === 0 && previousLen !== 0) { // バックアップ
    captionsData.push(backupText);
    console.log('currentText.lengthが0になったため', backupText);
    console.log('captionsDataにbackupTextをプッシュ', captionsData);
  }
  backupText = currentText;
  previousLen = len;

  if (len > 500) { // 500文字以上になった場合に配列にプッシュ
    captionsData.push(currentText);
    console.log('currentText', currentText);
    console.log('captionsDataにプッシュ', captionsData);
    currentText = '';
  }

  arrayText = captionsData[captionsData.length - 1]; // captionsDataから最新のテキスト取得
  // console.log("arrayText(取得):", arrayText);

  if (arrayText) {
    let commonArray = matchCaptions(arrayText, currentText); // 共通部分
    // console.log("共通部分配列:", commonArray);

    // let newArrayText = arrayText.slice(0, arrayText.indexOf(commonArray)) + commonArray; // 最初から共通部分の最初まで + 共通部分
    // console.log("newArrayText（正規化）:", newArrayText);

    // if (newArrayText) {
    //   captionsData[captionsData.length - 1] = newArrayText;
    //   console.log("最新のcaptionsData:", captionsData);
    // }

    // 現在のテキストの正規化（共通部分以降を保持）
    // let newCurrentText = currentText.slice(currentText.indexOf(commonArray) + commonArray.length);
    // console.log("newCurrentText(正規化後):", newCurrentText);
  } else {

  }

};

const matchCaptions = (str1, str2) => {
  if (!str1 || !str2) {
    return "";
  }
  let commonSubstring = "";
  for (let i = 0; i < str1.length; i++) {
    for (let j = i; j < str1.length; j++) {
      let substring = str1.substring(i, j + 1);
      if (str2.includes(substring)) {
        if (substring.length > commonSubstring.length) {
          commonSubstring = substring;
        }
      }
    }
  }
  return commonSubstring;
};


const saveCaptions = () => {
  chrome.storage.local.get('settings', (data) => {
    let fileName, fileFormat, headerText;

    if (data.settings) {
      // 設定からファイル名と形式を取得
      fileName = data.settings.fileName;
      fileFormat = data.settings.fileFormat;
      headerText = data.settings.headerText;

    } else {
      console.log('設定が見つかりませんでした。デフォルトの設定を使用します。');

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

    console.log('字幕がテキストファイルに保存されました:', fileName);
    captionsData = []; // 字幕データをリセット

    console.log('------------------');
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

// ページのURLが変更されたときに監視する
const observer = new MutationObserver(() => {
  logEnabled();
});

// URLの変更を監視するために設定
observer.observe(document, { childList: true, attributes: true, subtree: true });

// 初回チェック
checkMeetingStatus();

