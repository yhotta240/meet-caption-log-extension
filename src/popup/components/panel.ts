import type { LogEntry, LogLevel } from "../../utils/logger";

const LEVEL_CLASS: Record<LogLevel, string> = {
  info: "text-body",
  warn: "text-warning",
  error: "text-danger",
};

const SOURCE_LABEL: Record<string, string> = {
  popup: "P",
  background: "BG",
  content: "C",
};

export class PopupPanel {
  private header: HTMLElement | null;
  private tabMenu: HTMLElement | null;
  private maximizeButton: HTMLButtonElement | null;
  private minimizeButton: HTMLButtonElement | null;
  private closeButton: HTMLButtonElement | null;
  private panelButton: HTMLButtonElement | null;
  private resizer: HTMLElement | null;
  private panel: HTMLElement | null;
  private messageDiv: HTMLElement | null;
  private messageScrollDiv: HTMLElement | null;
  private clearButton: HTMLButtonElement | null;

  private onClearCallback: (() => void) | null = null;

  private startY: number = 0;
  private tmpPanelHeight: number = 0;
  private startHeightTop: number = 0;
  private emdHeight: number = 150;
  private isDragging: boolean = false;

  constructor() {
    this.header = document.querySelector<HTMLElement>("#header");
    this.tabMenu = document.querySelector<HTMLElement>("#tab-menu");
    this.maximizeButton = document.querySelector<HTMLButtonElement>("#maximize-button");
    this.minimizeButton = document.querySelector<HTMLButtonElement>("#minimize-button");
    this.closeButton = document.querySelector<HTMLButtonElement>("#close-button");
    this.panelButton = document.querySelector<HTMLButtonElement>("#panel-button");
    this.resizer = document.getElementById("resizer");
    this.panel = document.getElementById("panel");
    this.messageDiv = document.getElementById("message");
    this.messageScrollDiv = document.getElementById("messagePanel");
    this.clearButton = document.querySelector<HTMLButtonElement>("#clear-button");
    if (!this.checkRequiredElements()) {
      console.warn("PopupPanel: missing required DOM elements, initialization aborted.");
      return;
    }
    this.initializePanel();
    this.addEventListeners();
  }

  private checkRequiredElements(): boolean {
    return !!(
      this.header &&
      this.tabMenu &&
      this.maximizeButton &&
      this.minimizeButton &&
      this.closeButton &&
      this.panelButton &&
      this.resizer &&
      this.panel &&
      this.messageDiv &&
      this.messageScrollDiv &&
      this.clearButton
    );
  }

  private initializePanel(): void {
    if (this.panel) this.panel.style.height = "0px";
    if (this.closeButton) this.closeButton.classList.add("d-none");
    this.switchMinMaxButtons();
  }

  private getPanelHeight(): number {
    return (
      document.documentElement.clientHeight -
      (this.tabMenu?.offsetHeight || 0) -
      (this.resizer?.offsetHeight || 0)
    );
  }

  private togglePanel(isOpen: boolean): void {
    if (!this.panel) return;
    if (!this.isDragging) {
      this.panel.style.height = isOpen ? `${this.emdHeight}px` : "0px";
    }

    const panelHeight = parseFloat(this.panel.style.height || "0");
    const isPanelVisible = panelHeight > 50 && isOpen;

    this.closeButton?.classList.toggle("d-none", !isPanelVisible);
    this.panelButton?.classList.toggle("d-none", isPanelVisible);

    if (isOpen && this.panel.offsetHeight === this.getPanelHeight()) {
      this.maximizeButton?.classList.add("d-none");
      this.minimizeButton?.classList.remove("d-none");
    }
  }

  private switchMinMaxButtons(): void {
    if (!this.panel) return;
    const panelHeight = parseFloat(this.panel.style.height || "0");
    const isMaximized = panelHeight > this.getPanelHeight() - 20;
    this.maximizeButton?.classList.toggle("d-none", isMaximized);
    this.minimizeButton?.classList.toggle("d-none", !isMaximized);
  }

  private addEventListeners(): void {
    this.panelButton?.addEventListener("click", () => {
      this.togglePanel(true);
      this.switchMinMaxButtons();
      this.panel?.addEventListener(
        "transitionend",
        () => {
          if (this.messageScrollDiv) {
            this.messageScrollDiv.scrollTop = this.messageScrollDiv.scrollHeight;
          }
        },
        { once: true },
      );
    });

    this.closeButton?.addEventListener("click", () => {
      this.togglePanel(false);
      this.switchMinMaxButtons();
      if (this.panel) {
        this.emdHeight =
          this.panel.offsetHeight > this.getPanelHeight() - 20 ? 150 : this.panel.offsetHeight;
      }
    });

    this.resizer?.addEventListener("mousedown", (e: MouseEvent) => {
      if (!this.panel || !this.resizer) return;
      this.isDragging = true;
      this.panel.classList.add("no-transition");
      this.resizer.style.backgroundColor = "#4688F1";
      this.startY = e.clientY;
      this.startHeightTop = this.panel.offsetHeight;
      this.tmpPanelHeight =
        this.panel.offsetHeight === 0 ||
        this.panel.offsetHeight === this.getPanelHeight() ||
        parseFloat(this.panel.style.height || "0") > this.getPanelHeight() - 15
          ? 150
          : this.panel.offsetHeight;
    });

    window.addEventListener("mousemove", (e: MouseEvent) => {
      if (!this.isDragging || !this.panel) return;
      document.body.style.userSelect = "none";
      if ((this.header?.offsetHeight || 0) >= e.clientY - 20) {
        this.panel.style.height = `${this.getPanelHeight()}px`;
        return;
      }
      const dy = e.clientY - this.startY;
      const newHeightTop = this.startHeightTop - dy;
      this.panel.style.height = `${newHeightTop}px`;
      this.togglePanel(true);
      this.switchMinMaxButtons();
    });

    window.addEventListener("mouseup", () => {
      if (!this.isDragging || !this.panel) return;
      this.isDragging = false;
      document.body.style.userSelect = "";
      this.panel.classList.remove("no-transition");
      if (this.resizer) this.resizer.style.backgroundColor = "";
      this.emdHeight = this.panel.offsetHeight;
      const panelHeights = this.panel.offsetHeight;
      if (panelHeights < 50) {
        this.emdHeight = 150;
        this.togglePanel(false);
      }
      if (panelHeights > this.getPanelHeight() - 20) {
        this.emdHeight = 150;
        this.panel.style.height = `${this.getPanelHeight()}px`;
      }
      this.switchMinMaxButtons();
    });

    this.maximizeButton?.addEventListener("click", () => {
      if (!this.panel) return;
      this.tmpPanelHeight =
        this.panel.offsetHeight === 0 ||
        this.panel.offsetHeight === this.getPanelHeight() ||
        parseFloat(this.panel.style.height || "0") > this.getPanelHeight() - 20
          ? 150
          : this.panel.offsetHeight;
      this.togglePanel(true);
      this.panel.style.height = `${this.getPanelHeight()}px`;
      this.switchMinMaxButtons();
    });

    this.minimizeButton?.addEventListener("click", () => {
      this.togglePanel(true);
      if (this.panel) this.panel.style.height = `${this.tmpPanelHeight}px`;
      this.switchMinMaxButtons();
    });

    window.addEventListener("resize", () => {
      if (!this.panel) return;
      const currentHeight = parseFloat(this.panel.style.height || "0");
      const maxHeight = this.getPanelHeight();
      this.panel.style.height = `${Math.min(currentHeight, maxHeight)}px`;
      if (this.minimizeButton && this.minimizeButton.style.display === "block") {
        this.panel.style.height = `${maxHeight}px`;
      }
    });

    this.clearButton?.addEventListener("click", () => {
      this.clearMessage();
      this.onClearCallback?.();
    });
  }

  public setClearCallback(callback: () => void): void {
    this.onClearCallback = callback;
  }

  public messageOutput(
    message: string,
    datetime: string,
    level: LogLevel = "info",
    source: string = "popup",
    issuesUrl?: string,
  ): void {
    if (this.messageDiv && this.messageScrollDiv) {
      this.messageDiv.appendChild(
        this.createLogElement(message, datetime, level, source, issuesUrl),
      );
      this.messageScrollDiv.scrollTop = this.messageScrollDiv.scrollHeight;
    }
  }

  private createLogElement(
    message: string,
    datetime: string,
    level: LogLevel,
    source: string,
    issuesUrl?: string,
  ): HTMLParagraphElement {
    const p = document.createElement("p");
    const levelClass = LEVEL_CLASS[level] ?? "text-body";
    p.className = `m-0 small ${levelClass} d-flex align-items-start gap-1`;

    const sourceLabel = SOURCE_LABEL[source] ?? source;
    const meta = document.createElement("span");
    meta.className = "flex-shrink-0 opacity-50";
    const short = datetime.includes(" ") ? datetime.slice(5) : datetime;
    meta.textContent = `[${short}][${sourceLabel}]`;

    const body = document.createElement("span");
    body.className = "text-break flex-grow-1";
    body.textContent = message;

    if (level === "error" && issuesUrl) {
      const sep = document.createElement("span");
      sep.textContent = " — ";
      const link = document.createElement("a");
      link.href = issuesUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "問題を報告する";
      link.className = "text-danger";
      body.appendChild(sep);
      body.appendChild(link);
    }

    p.appendChild(meta);
    p.appendChild(body);
    return p;
  }

  public loadLogs(entries: LogEntry[], issuesUrl?: string): void {
    if (!this.messageDiv || !this.messageScrollDiv) return;

    this.clearMessage();
    const fragment = document.createDocumentFragment();
    for (const entry of entries) {
      if (entry.hidden) continue;
      fragment.appendChild(
        this.createLogElement(entry.message, entry.timestamp, entry.level, entry.source, issuesUrl),
      );
    }
    this.messageDiv.appendChild(fragment);
    this.messageScrollDiv.scrollTop = this.messageScrollDiv.scrollHeight;
  }

  public clearMessage(): void {
    if (this.messageDiv && this.messageScrollDiv) {
      this.messageDiv.innerHTML = "";
      this.messageScrollDiv.scrollTop = 0;
    }
  }
}
