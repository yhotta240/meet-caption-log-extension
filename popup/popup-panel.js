const header = document.querySelector('#header');
const tabMenu = document.querySelector('#tab-menu');
const maximizeButton = document.querySelector("#maximize-button");
const minimizeButton = document.querySelector("#minimize-button");
const closeButton = document.querySelector("#close-button");
const panelButton = document.querySelector("#panel-button");
const resizer = document.getElementById('resizer');
const panel = document.getElementById('panel');
const messagePanel = document.querySelector('#messagePanel');
const panelHeight = () => {
  return document.documentElement.clientHeight - tabMenu.offsetHeight - resizer.offsetHeight;
};
let startY = 0;
let tmpPanelHeight = 0;
let startHeightTop = 0;
let emdHeight = 150;
let isPanelOpen = false; // パネルの状態を管理するフラグ
let isDragging = false; // ドラッグ中かどうかを管理するフラグ
panel.style.display = 'block'; // 初期状態でパネルを非表示にする
panel.style.height = '0'; // 初期状態でパネルを非表示にする
closeButton.style.display = 'none'; // 初期状態で閉じるボタンを非表示にする

panelButton.addEventListener('click', () => {
  togglePanel(true)
  switchMinMaxButtons();
});
closeButton.addEventListener('click', () => {
  togglePanel(false);
  switchMinMaxButtons();
  emdHeight = panel.offsetHeight > panelHeight() - 20 ? 150 : panel.offsetHeight;
  // console.log('emdHeight', panel.offsetHeight, emdHeight);
});

function togglePanel(isPanelOpen) {
  // console.log('高さ', parseFloat(panel.style.height), panel.offsetHeight, panel.offsetHeight > 50, 'isPanelOpen', isPanelOpen, panelHeight(), 'emdHeight', emdHeight);
  if (!isDragging) {
    panel.style.height = `${isPanelOpen ? `${emdHeight}px` : '0px'}`;
  }
  closeButton.style.display = `${parseFloat(panel.style.height) > 50 && isPanelOpen ? 'block' : 'none'}`;
  closeButton.children[0].style.display = `${parseFloat(panel.style.height) > 50 && isPanelOpen ? 'block' : 'none'}`;
  panelButton.style.display = `${parseFloat(panel.style.height) > 50 && isPanelOpen ? 'none' : 'block'}`;
  panelButton.children[0].style.display = `${parseFloat(panel.style.height) > 50 && isPanelOpen ? 'none' : 'block'}`;
  if (isPanelOpen && (panel.offsetHeight === panelHeight())) {
    // panel.style.height = `${150}px`;
    maximizeButton.style.display = 'none';
    minimizeButton.style.display = 'block';
  }
}

//マウスを押したときの処理
resizer.addEventListener('mousedown', (e) => {
  isDragging = true;
  panel.classList.add('no-transition');
  resizer.style.backgroundColor = '#4688F1';
  startY = e.clientY;
  startHeightTop = panel.offsetHeight;
  tmpPanelHeight = panel.offsetHeight === 0 || panel.offsetHeight === panelHeight() || parseFloat(panel.style.height) > panelHeight() - 15 ? 150 : panel.offsetHeight;
});

//マウスを動かしたときの処理
window.addEventListener('mousemove', (e) => {
  if (isDragging) {
    if ((header.offsetHeight / 2) >= e.clientY) {
      panel.style.height = `${panelHeight()}px`;
      return;
    }
    const dy = e.clientY - startY;
    const newHeightTop = startHeightTop - dy;
    panel.style.height = `${newHeightTop}px`;
    togglePanel(true);
    switchMinMaxButtons();
  }

});

//マウスを離したときの処理
window.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    panel.classList.remove('no-transition');
    resizer.style.backgroundColor = '';
    emdHeight = panel.offsetHeight;
    // console.log('emdHeight', emdHeight);
    const panelHeights = panel.offsetHeight;
    if (panelHeights < 50) {
      // panel.style.height = '150px';
      emdHeight = 150;
      togglePanel(false);
    }
    if (panelHeights > panelHeight() - 20) {
      emdHeight = 150;
      panel.style.height = `${panelHeight()}px`;
    }
    switchMinMaxButtons();
  }
});


function switchMinMaxButtons() {
  maximizeButton.style.display = 'block';
  minimizeButton.style.display = 'none';
  if (parseFloat(panel.style.height) > panelHeight() - 20) {
    maximizeButton.style.display = 'none';
    minimizeButton.style.display = 'block';
  }
}
switchMinMaxButtons();

maximizeButton.addEventListener('click', () => {
  tmpPanelHeight = panel.offsetHeight === 0 || panel.offsetHeight === panelHeight() || parseFloat(panel.style.height) > panelHeight() - 20 ? 150 : panel.offsetHeight;
  togglePanel(true);
  panel.style.height = `${panelHeight()}px`;
  switchMinMaxButtons();
});
minimizeButton.addEventListener('click', () => {
  togglePanel(true);
  panel.style.height = `${tmpPanelHeight}px`;
  switchMinMaxButtons();
});

window.addEventListener('resize', (e) => {
  panel.style.height = `${panelHeight() > parseFloat(panel.style.height) ? parseFloat(panel.style.height) : panelHeight()}px`;
  if (minimizeButton.style.display === 'block') {
    panel.style.height = `${panelHeight()}px`;
  }
});