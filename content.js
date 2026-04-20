// 会議中のURLの正規表現
const meetUrlPattern = /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/;

// ファイルフォーマット定義
const format = {
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/markdown': 'md',
};

// UTF-8 BOM
const bom = '\uFEFF';

// バッジのスタイル定義
const BADGE_STYLES = {
  keyframes: `
    @keyframes badgePulseYellow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(251, 188, 4, 0.7); }
      50% { box-shadow: 0 0 0 3px rgba(251, 188, 4, 0.3); }
    }
    @keyframes badgePulseGreen {
      0%, 100% { box-shadow: 0 0 0 0 rgba(0, 150, 136, 0.7); }
      50% { box-shadow: 0 0 0 3px rgba(0, 150, 136, 0.3); }
    }
  `,
  base: `
    #captionEnabledBadge {
      position: absolute;
      width: 15px;
      height: 15px;
      border-radius: 50%;
      z-index: 1000;
    }
  `,
  yellow: `
    #captionEnabledBadge.yellow-badge {
      background: linear-gradient(135deg, #fbbc04 0%, #f9ab00 100%);
      animation: badgePulseYellow 2s infinite;
      top: -2px;
      right: -2px;
    }
  `,
  green: `
    #captionEnabledBadge.green-badge {
      background: linear-gradient(135deg, #00b600 0%, #00b900 100%);
      animation: badgePulseGreen 2s infinite;
      top: -2px;
      right: -2px;
    }
  `,
};

let isCaptionsSaved = true; // 保存が行われたかを記録するフラグ
let meetStartTime = null; // {meet開始時刻} に対応
let captionStartTime = null; // {字幕ログ開始時刻} に対応
let captionEndTime = null; // {字幕ログ終了時刻} に対応
let prevSpeakerCount = 1; // 前回のスピーカーの数;
let caption = {}; // 字幕を保存するオブジェクト
let captions = []; // 字幕を保存する配列
let outputText = ''; // ファイルに出力するテキスト
let options = {}; // オプションを保存するオブジェクト
let isEnabledLog = false; // 字幕ログの有効/無効状態

function addBadgeAnimationStyles() {
  if (!document.querySelector('#badgeAnimationStyles')) {
    const style = document.createElement('style');
    style.id = 'badgeAnimationStyles';
    style.textContent = `${BADGE_STYLES.keyframes}${BADGE_STYLES.base}${BADGE_STYLES.yellow}${BADGE_STYLES.green}`;
    document.head.appendChild(style);
  }
}

function checkMeetingStatus() {
  const currentUrl = window.location.href;
  if (meetUrlPattern.test(currentUrl) && !meetStartTime) {
    meetStartTime = dateTime();
    chrome.storage.local.set({ meetStartTime });
  }
}

async function loadSettings() {
  isEnabledLog = await getEnabledLog();
  options = await getOptions();
}

async function getEnabledLog() {
  try {
    const { isLogEnabled } = await chrome.storage.local.get('isLogEnabled');
    return isLogEnabled;
  } catch (error) {
    return false;
  }
}

async function getOptions() {
  try {
    const { options } = await chrome.storage.local.get('options');
    return options;
  } catch (error) {
    return null;
  }
}

async function handleLogState() {
  if (isEnabledLog) {
    if (options?.showCaptionsOnStart) {
      displayCaptions();
    }
    monitorCaptions();
  } else {
    const badge = document.querySelector('#captionEnabledBadge');
    if (badge) {
      badge.remove();
    }
  }
}

// DOM操作
function displayBadge(isVisible) {
  const createBadge = () => {
    const badge = document.createElement('span');
    badge.id = 'captionEnabledBadge';
    badge.className = 'yellow-badge';
    badge.title = '字幕ログ待機中';
    return badge;
  };

  const updateBadge = (badge, isVisible) => {
    if (isVisible) {
      badge.className = 'green-badge';
      badge.title = '字幕ログ記録中';
    } else {
      badge.className = 'yellow-badge';
      badge.title = '字幕ログ待機中';
    }
  };

  const captionBtn = document.querySelector('button[jsname="RrG0hf"]');
  let badge = document.querySelector('#captionEnabledBadge');

  if (!badge && captionBtn) {
    badge = createBadge();
    captionBtn.appendChild(badge);
  }

  if (badge) {
    updateBadge(badge, isVisible);
  }
}

function displayCaptions() {
  const captionContainer = document.querySelector('[jscontroller="D1tHje"]');
  if (captionContainer && captionContainer.children.length === 0) {
    const captionBtn = document.querySelector('button[jsname="RrG0hf"]');
    if (captionBtn && !captionContainer.classList.contains('caption-button-clicked')) {
      captionContainer.classList.add('caption-button-clicked');
      captionBtn.click();
    }
  }
}

function monitorCaptions() {
  const endButton = document.querySelector('button.Iootmd.vLQezd');
  if (endButton) {
    if (!endButton.dataset.captionLogListener) {
      endButton.addEventListener('click', () => {
        if (options?.saveOnEndCall) {
          endCaptionLoggingAndSave();
        }
      });
      endButton.dataset.captionLogListener = 'true';
    }
  }

  const captionItems = document.querySelectorAll('.nMcdL.bj4p3b');
  const speakers = document.querySelectorAll('.adE6rb');

  if (captionItems.length > 0) {
    isCaptionsSaved = false;
    if (!captionStartTime) {
      captionStartTime = dateTime();
      captionEndTime = null;
      chrome.storage.local.set({ captionStartTime, captionEndTime }, () => { });
    }

    const speakerText = speakers[speakers.length - 1].textContent;
    const captionText = captionItems[captionItems.length - 1].querySelector('.ygicle.VbkSUe').textContent;

    if (prevSpeakerCount !== speakers.length) {
      captions.push(caption);
    }

    caption = {
      num: speakers.length,
      time: dateTime(),
      speaker: speakerText,
      text: captionText,
    };

    prevSpeakerCount = speakers.length;

    displayBadge(true);
  } else {
    if (!isCaptionsSaved) {
      endCaptionLoggingAndSave();
    }
    displayBadge(false);
  }
}

function saveCaptions() {
  chrome.storage.local.get('settings', (data) => {
    let fileName, fileFormat, headerText;

    if (data.settings) {
      // 設定からファイル名と形式を取得
      fileName = data.settings.fileName;
      fileFormat = format[data.settings.fileFormat];
      headerText = data.settings.headerText;

      // CSV形式の場合は BOM を付与
      if (fileFormat === 'text/csv') {
        headerText = bom + headerText;
      }

      // Markdown 形式の場合はファイル名に .md を追加
      if (fileFormat === 'text/markdown' && !fileName.endsWith('.md')) {
        fileName += ".md";
      }

    } else {
      // デフォルト設定
      fileName = 'captions';
      fileFormat = 'text/plain';
      headerText =
        `---\n` +
        `プロジェクトの打ち合わせ\n` +
        `meet開始時刻    : {meet開始時刻}\n` +
        `字幕ログ開始時刻: {字幕ログ開始時刻}\n` +
        `字幕ログ終了時刻: {字幕ログ終了時刻}\n` +
        `---\n`;
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

    const fileContent = headerText + outputText + '\n';

    // ファイル作成
    const blob = new Blob([fileContent], { type: fileFormat });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName; // ダウンロードするファイル名を設定
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url); // メモリ解放

    // 状態をリセット
    isCaptionsSaved = true;
    prevSpeakerCount = 1;
    caption = {};
    captions = [];
    outputText = '';

    // 履歴保存（最大25件）
    if (options?.saveHistory) {
      chrome.storage.local.get('history', ({ history = [] }) => {
        const entry = {
          savedAt: new Date().toISOString(),
          fileName,
          fileFormat,
          content: fileContent,
        };
        const updatedHistory = [entry, ...(history || [])].slice(0, 25);
        chrome.storage.local.set({ history: updatedHistory });
      });
    }
  });
}

function endCaptionLoggingAndSave() {
  if (isCaptionsSaved) return; // 既に保存済みの場合は何もしない
  captions.push(caption);
  captionEndTime = dateTime();
  chrome.storage.local.set({ captionEndTime });
  saveCaptions();
}

// ページから離脱する際に保存する
window.addEventListener('beforeunload', async (event) => {
  if (options?.saveOnTabClose) {
    endCaptionLoggingAndSave();
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes.isLogEnabled || changes.options)) {
    isEnabledLog = changes.isLogEnabled ? changes.isLogEnabled.newValue : isEnabledLog;
    options = changes.options ? changes.options.newValue : options;
  }
});

let debounceTimer;

const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    handleLogState();
  }, 200);
});
observer.observe(document, { childList: true, attributes: true, subtree: true });

function dateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

addBadgeAnimationStyles();
checkMeetingStatus();
loadSettings();