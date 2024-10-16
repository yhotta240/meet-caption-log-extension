// 会議中のURLの正規表現
const meetUrlPattern = /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/;

let captionsData = []; // 字幕の内容を保存する配列
let currentText = ''; // 現在の字幕内容を保存
let arrayText = ''

// URLの変更を監視する関数
const checkMeetingStatus = () => {
  const currentUrl = window.location.href;
  // 会議中のURLであるかをチェック
  if (meetUrlPattern.test(currentUrl)) {
    monitorCaptions(); // 字幕の監視を開始
  } else {
    console.log('会議開始前');
  }
};

// 字幕の表示を監視する関数
const monitorCaptions = () => {
  const captionsContainer = document.querySelector('div[jsname="dsyhDe"].iOzk7.XDPoIe');
  if (!captionsContainer) {
    return;
  }
  if (captionsContainer.style.display === '') {
    // console.log('字幕が表示されました');
    extractCaptions(captionsContainer); // 字幕を抽出
  } else if (captionsContainer.style.display === 'none') {
    // console.log('字幕が非表示');
    if (captionsData.length > 0) {
      currentText = '';
      saveCaptionsToFile(); // 字幕をファイルに保存
    }
  }
};
let newCurrentText = ""
// 字幕のテキストを抽出して配列に追加する関数
const extractCaptions = (captionsContainer) => {
  const captionDivs = captionsContainer.querySelectorAll('div[jsname="tgaKEf"].iTTPOb.VbkSUe span');

  let newText = ''; // 新しい字幕内容を保存する変数

  captionDivs.forEach(span => {
    newText += span.textContent.trim(); // スペースを取り除きながら内容を追加
  });

  // 現在の字幕内容を更新

  console.log('new', newText);

  console.log('現在の字幕:', currentText);
  let len = currentText.length
  console.log('現在の字幕文字数:', len);
  let commonSubstring = matchCaptions(currentText, newText); // 共通部分を探す
  currentText = currentText.slice(0, currentText.indexOf(commonSubstring)) + newText; // マージ
  console.log('cur', currentText);
  tmp = len;
  if(tmp>len){
    
  }
  if (len > 500) { // 500文字以上になった場合に配列にプッシュ
    captionsData.push(currentText);
    console.log('currentText', currentText);
    console.log('captionsDataにプッシュ', captionsData);
    currentText = '';
    
  }

  arrayText = captionsData[captionsData.length - 1]; // captionsDataから最新のテキスト取得
  console.log("arrayText(取得):", arrayText);

  if (arrayText) {
    let commonArray = matchCaptions(arrayText, currentText); // 共通部分
    console.log("共通部分配列:", commonArray);

    // let newArrayText = arrayText.slice(0, arrayText.indexOf(commonArray)) + commonArray; // 最初から共通部分の最初まで + 共通部分
    // console.log("newArrayText（正規化）:", newArrayText);

    // if (newArrayText) {
    //   captionsData[captionsData.length - 1] = newArrayText;
    //   console.log("最新のcaptionsData:", captionsData);
    // }

    // 現在のテキストの正規化（共通部分以降を保持）
    newCurrentText = currentText.slice(currentText.indexOf(commonArray) + commonArray.length);
    console.log("newCurrentText(正規化後):", newCurrentText);
  } else {

  }
  console.log('------------------');

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


// // 字幕の内容をテキストファイルに出力する関数
// const saveCaptionsToFile = () => {
//   // 先頭に付ける文章
//   const headerText = 
//   `-----------------------------------------------\n` +
//   `2024/10/16(水)20:11 - 2024/10/16(水)20:11\n` +
//   `-----------------------------------------------\n\n`;
  
//   const blob = new Blob([headerText + captionsData.join('\n')], { type: 'text/plain' });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement('a');
//   a.href = url;
//   a.download = 'captions.txt'; // ダウンロードするファイル名
//   document.body.appendChild(a);
//   a.click();
//   document.body.removeChild(a);
//   console.log('字幕がテキストファイルに保存されました');
//   captionsData = []; // 配列をリセット
// };


//captionsの内容をファイルとして保存する関数
const saveCaptionsToFile = () => {
  // chrome.storage.localから設定を取得
  chrome.storage.local.get('settings', (data) => {
    if (data.settings) {
      // 設定からヘッダーテキストを取得
      const headerText = data.settings.headerText || 
      `-----------------------------------------------\n` +
      `{meet開始時刻} - {meet終了時刻}\n` +
      `{字幕ログ開始時刻} - {字幕ログ終了時刻}\n` +
      `打ち合わせ\n` +
      `-----------------------------------------------\n\n`;

      // 設定からファイル名と形式を取得
      const fileName = data.settings.fileName || 'captions';
      const fileFormat = data.settings.fileFormat || 'text/plain';

      // Blobを使ってファイル作成
      const blob = new Blob([headerText + captionsData.join('\n')], { type: fileFormat });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName; // ダウンロードするファイル名を設定
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      console.log('字幕がテキストファイルに保存されました:', fileName);
      
      // 字幕データをリセット
      captionsData = [];
    } else {
      console.log('設定が見つかりませんでした。デフォルトの設定を使用します。');
    }
  });
};



// ページのURLが変更されたときに監視する
const observer = new MutationObserver(() => {
  checkMeetingStatus();
});

// URLの変更を監視するために設定
observer.observe(document, { childList: true, attributes: true, subtree: true });

// 初回チェック
checkMeetingStatus();
