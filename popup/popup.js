
// チェックボックスの状態の初期化
let isLogEnabled = false;
// manifest.jsonの情報を取得
const manifestData = chrome.runtime.getManifest();

// ファイルフォーマット定義
const format = {
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/markdown': 'md',
};

chrome.storage.onChanged.addListener((changes) => {
  ['meetStartTime', 'captionStartTime', 'captionEndTime'].forEach(key => {
    if (changes[key]) messageOutput(changes[key].newValue, {
      meetStartTime: '会議が開始されました',
      captionStartTime: '字幕ログが開始されました',
      captionEndTime: '字幕ログが終了しました'
    }[key]);
  });
  const captionEndTime = changes.captionEndTime;
  if (captionEndTime) {
    messageOutput(captionEndTime.newValue, '字幕ログが終了しました');
  }
  if (changes.history) {
    renderHistory(changes.history.newValue || []);
  }
});


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

  const newPos = startPos + tag.length; // カーソルをタグの後ろに移動させる
  textarea.setSelectionRange(newPos, newPos); // カーソル位置を変更
  textarea.focus(); // フォーカスをテキストエリアに戻す
}

const textHeaderDefault =
  `---\n` +
  `プロジェクトの打ち合わせ\n` +
  `meet開始時刻    : {meet開始時刻}\n` +
  `字幕ログ開始時刻: {字幕ログ開始時刻}\n` +
  `字幕ログ終了時刻: {字幕ログ終了時刻}\n` +
  `---\n`;

const mdHeaderDefault =
  `---\n` +
  `title: プロジェクトの打ち合わせ\n` +
  `meet_start: {meet開始時刻}\n` +
  `caption_log_start: {字幕ログ開始時刻}\n` +
  `caption_log_end: {字幕ログ終了時刻}\n` +
  `---\n`;

const defaultHeaderMap = {
  'text/plain': textHeaderDefault,
  'text/csv': textHeaderDefault,
  'text/markdown': mdHeaderDefault,
};

// ファイル形式の選択が変わったときの処理
document.getElementById('fileFormat')?.addEventListener('change', (event) => {
  const selectedFormat = (event.target).value;

  chrome.storage.local.get(['settings'], ({ settings }) => {
    const headerInput = document.getElementById('headerText');
    // settingsがあればそのまま使用
    if (settings) {
      headerInput.value = settings.headerText;
      return;
    }

    headerInput.value = defaultHeaderMap[selectedFormat] || '';
  });
});

// 設定をリセットする関数
function resetSettings() {
  const fileFormatInput = document.getElementById('fileFormat').value;

  document.getElementById('fileName').value = 'caption'; // ファイル名をリセット
  document.getElementById('headerText').value = defaultHeaderMap[fileFormatInput];

  messageOutput(dateTime(), '設定がリセットされました');
}
document.getElementById('resetButton').addEventListener('click', () => resetSettings());


// 設定を保存する関数
function saveSettings(datetime, message) {

  const fileName = document.getElementById('fileName').value; // ファイル名を取得
  const fileFormat = document.getElementById('fileFormat').value; // ファイル形式を取得 （txt, csv）
  let headerText = document.getElementById('headerText').value; // ヘッダーのテキストを取得

  // 保存するデータをオブジェクトにまとめる
  const settings = {
    fileName: fileName,
    fileFormat: format[fileFormat],
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

const saveOnEndCall = document.getElementById('saveOnEndCall');
const saveOnTabClose = document.getElementById('saveOnTabClose');
const saveHistory = document.getElementById('saveHistory');
const historyList = document.getElementById('historyList');
const historyEmpty = document.getElementById('historyEmpty');

// オプションを読み込む
function loadOptions() {
  chrome.storage.local.get('options', (data) => {
    if (data.options) {
      saveOnEndCall.checked = data.options.saveOnEndCall != false;
      saveOnTabClose.checked = data.options.saveOnTabClose != false;
      saveHistory.checked = data.options.saveHistory === true;
    } else {
      saveOnEndCall.checked = true;
      saveOnTabClose.checked = true;
      saveHistory.checked = false;
      chrome.storage.local.set({ options: { saveOnEndCall: true, saveOnTabClose: true, saveHistory: false } });
    }
  });
}
loadOptions();

// オプションを保存する
function saveOptions() {
  const options = {
    saveOnEndCall: saveOnEndCall.checked,
    saveOnTabClose: saveOnTabClose.checked,
    saveHistory: saveHistory.checked,
  };

  chrome.storage.local.set({ options }, () => messageOutput(dateTime(), 'オプションが保存されました'));
}
saveOnEndCall.addEventListener('change', saveOptions);
saveOnTabClose.addEventListener('change', saveOptions);
saveHistory.addEventListener('change', saveOptions);

function renderHistory(items) {
  if (!historyList) return;
  historyList.innerHTML = '';
  if (!items || items.length === 0) {
    historyEmpty.style.display = 'list-item';
    historyList.appendChild(historyEmpty);
    return;
  }
  historyEmpty.style.display = 'none';

  // 最新25件を表示
  items.slice(0, 25).forEach((entry) => {
    const { savedAt, fileName, fileFormat, content } = entry;
    const li = document.createElement('li');
    li.className = 'list-group-item';

    const header = document.createElement('div');
    header.className = 'd-flex justify-content-between align-items-center mb-1';

    const metaWrapper = document.createElement('div');
    const metaTitle = document.createElement('span');
    metaTitle.className = 'fw-bold';
    const displayName = fileName || 'captions';
    metaTitle.textContent = `${displayName} (${format[fileFormat] || fileFormat || ''})`;
    const metaDate = document.createElement('small');
    metaDate.className = 'text-muted ms-2';
    metaDate.textContent = dateTimeFromISO(savedAt ? new Date(savedAt) : new Date());
    metaWrapper.append(metaTitle, metaDate);

    const actionWrapper = document.createElement('div');
    actionWrapper.className = 'd-flex gap-2';

    const dlBtn = document.createElement('button');
    dlBtn.type = 'button';
    dlBtn.className = 'btn btn-sm btn-outline-primary';
    dlBtn.textContent = 'ダウンロード';
    dlBtn.addEventListener('click', () => downloadHistory(entry));
    actionWrapper.appendChild(dlBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-sm btn-outline-danger';
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', () => deleteHistory(savedAt));
    actionWrapper.appendChild(delBtn);

    header.append(metaWrapper, actionWrapper);

    const preview = document.createElement('div');
    preview.className = 'small text-muted';
    preview.textContent = buildPreview(content);

    const full = document.createElement('pre');
    full.className = 'small mt-2 mb-0';
    full.style.whiteSpace = 'pre-wrap';
    full.style.display = 'none';
    full.textContent = content;

    const moreLink = document.createElement('button');
    moreLink.type = 'button';
    moreLink.className = 'btn btn-link btn-sm ps-0';
    moreLink.textContent = 'もっと見る';
    moreLink.addEventListener('click', () => {
      const expanded = full.style.display === 'block';
      full.style.display = expanded ? 'none' : 'block';
      preview.style.display = expanded ? 'block' : 'none';
      moreLink.textContent = expanded ? 'もっと見る' : '閉じる';
    });

    li.append(header, preview, moreLink, full);
    historyList.appendChild(li);
  });
}

function loadHistory() {
  chrome.storage.local.get('history', ({ history }) => {
    renderHistory(history || []);
  });
}

const messageDiv = document.getElementById('message');
function messageOutput(datetime, message) {
  if (!datetime || !message) return;
  messageDiv.innerHTML += '<p class="m-0">' + datetime + ' ' + message + '</p>'; // <p> タグで囲んで新しい行にする
}

document.getElementById('clear-button').addEventListener('click', () => {
  messageDiv.innerHTML = '<p class="m-0">' + '' + '</p>';
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
  chrome.storage.local.get(['settings', 'isLogEnabled', 'meetStartTime', 'captionStartTime', 'captionEndTime'], (data) => {
    // console.log(data);
    if (data.settings) {
      // 設定を読み込む
      document.getElementById('fileName').value = data.settings.fileName || 'captions'; // ファイル名の設定
      document.getElementById('fileFormat').value = format[data.settings.fileFormat] || 'text/plain'; // ファイル形式の設定
      document.getElementById('headerText').value = data.settings.headerText || textHeaderDefault; // ヘッダーのテキストを設定
      // messageDiv.innerHTML = '<p class="m-0">' + data.settings.message[0] + ' ' + data.settings.message[1] + '</p>'; // 保存されたログを表示
    }

    // logEnabledの値を取得
    const isLogEnabled = data.isLogEnabled || false; // デフォルトはfalse
    document.getElementById('captionLogLabel').checked = isLogEnabled; // チェックボックスの状態を設定
    // console.log('字幕ログが有効:', isLogEnabled);

    const logs = [
      { time: dateTime(), message: "字幕ログは有効になっています" },
      { time: data.meetStartTime, message: "会議が開始されました" },
      { time: data.captionStartTime, message: "字幕ログが開始されました" },
      { time: data.captionEndTime, message: "字幕ログが終了しました" }
    ];

    // 並び替え（昇順）
    logs.sort((a, b) => new Date(a.time) - new Date(b.time));
    // 結果表示
    logs.forEach(log => {
      // console.log(`${log.time} ${log.message}`);
      messageOutput(log.time, log.message); // メッセージを表示
    });

  });
}
loadSettings(); // 初期化時に設定を読み込む

document.addEventListener('DOMContentLoaded', function () {

  const newTabButton = document.getElementById('new-tab-button');
  newTabButton.addEventListener('click', () => {
    chrome.tabs.create({ url: 'popup/popup.html' });
  });

  const extensionLink = document.getElementById('extension_link');
  extensionLink.href = `chrome://extensions/?id=${chrome.runtime.id}`;
  if (extensionLink) clickURL(extensionLink);
  const issueLink = document.getElementById('issue-link');
  if (issueLink) clickURL(issueLink);
  const storeLink = document.getElementById('store_link');
  storeLink.href = `https://chrome.google.com/webstore/detail/${chrome.runtime.id}`;
  if (storeLink) clickURL(storeLink);
  // 各情報を要素に反映
  document.getElementById('extension-id').textContent = `${chrome.runtime.id}`;
  document.getElementById('extension-name').textContent = `${manifestData.name}`;
  document.getElementById('extension-version').textContent = `${manifestData.version}`;
  document.getElementById('extension-description').textContent = `${manifestData.description}`;
  chrome.permissions.getAll((result) => {
    document.getElementById('permission-info').textContent = `${result.permissions.join(', ')}`;

    let siteAccess;
    if (result.origins.length > 0) {
      if (result.origins.includes("<all_urls>")) {
        siteAccess = "すべてのサイト";
      } else {
        siteAccess = result.origins.join("<br>");
      }
    } else {
      siteAccess = "クリックされた場合のみ";
    }
    document.getElementById('site-access').innerHTML = siteAccess;
  });
  chrome.extension.isAllowedIncognitoAccess((isAllowedAccess) => {
    document.getElementById('incognito-enabled').textContent = `${isAllowedAccess ? '有効' : '無効'}`;
  });

  const githubLink = document.getElementById('github-link');
  if (githubLink) clickURL(githubLink);

  loadHistory();
});

function clickURL(link) {
  const url = link.href ? link.href : link;
  if (link instanceof HTMLElement) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      chrome.tabs.create({ url });
    });
  }
}

function dateTimeFromISO(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function buildPreview(content = '') {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');
  const previewLines = lines.slice(0, 3).map((l) => l.replace(/\s+/g, ' '));
  return previewLines.join(' / ') || '内容なし';
}

function resolveExtension(mime) {
  const map = {
    'text/plain': '.txt',
    'text/csv': '.csv',
    'text/markdown': '.md',
  };
  return map[mime] || '.txt';
}

function downloadHistory({ fileName = 'captions', fileFormat = 'text/plain', content = '' }) {
  const blob = new Blob([content], { type: fileFormat });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith(resolveExtension(fileFormat)) ? fileName : `${fileName}${resolveExtension(fileFormat)}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function deleteHistory(savedAt) {
  chrome.storage.local.get('history', ({ history = [] }) => {
    const updatedHistory = history.filter((entry) => entry.savedAt !== savedAt);
    chrome.storage.local.set({ history: updatedHistory }, () => {
      loadHistory();
      messageOutput(dateTime(), '履歴を削除しました');
    });
  });
}
