import privacyPolicyDoc from "../../../docs/policies/privacy-policy.md";
import { openLinkNewTab } from "../../utils/dom";
import { escapeHtml } from "../../utils/html";
import type { ManifestMetadata } from "../types";

const PRIVACY_CLASS_MAP: Record<string, string> = {
  h1: "fs-6 mb-2",
  h2: "fs-6 mb-2",
  h3: "fs-6 mb-2",
  h4: "fs-6 mb-2",
  h5: "fs-6 mb-2",
  h6: "fs-6 mb-2",
  p: "mb-2",
  ul: "ps-4 mb-2",
  ol: "ps-4 mb-2",
  li: "mb-1",
};

/**
 * 拡張機能の情報タブをセットアップする
 */
export function setupInfoTab(
  manifestData: chrome.runtime.Manifest,
  manifestMetadata: ManifestMetadata,
): void {
  const storeLink = document.getElementById("store-link") as HTMLAnchorElement;
  if (storeLink) {
    storeLink.href = `https://chrome.google.com/webstore/detail/${chrome.runtime.id}`;
    openLinkNewTab(storeLink);
  }

  const extensionLink = document.getElementById("extension-link") as HTMLAnchorElement;
  if (extensionLink) {
    extensionLink.href = `chrome://extensions/?id=${chrome.runtime.id}`;
    openLinkNewTab(extensionLink);
  }

  const issuesLink = document.getElementById("issues-link") as HTMLAnchorElement;
  const issuesHref = manifestMetadata.issues_url;
  if (issuesLink && issuesHref) {
    issuesLink.href = issuesHref;
    openLinkNewTab(issuesLink);
  }

  const extensionId = document.getElementById("extension-id");
  if (extensionId) extensionId.textContent = chrome.runtime.id;

  const extensionName = document.getElementById("extension-name");
  if (extensionName) extensionName.textContent = manifestData.name;

  const extensionVersion = document.getElementById("extension-version");
  if (extensionVersion) extensionVersion.textContent = manifestData.version;

  const extensionDescription = document.getElementById("extension-description");
  if (extensionDescription) extensionDescription.textContent = manifestData.description ?? "";

  chrome.permissions.getAll((result) => {
    const permissionInfo = document.getElementById("permission-info");
    if (permissionInfo && result.permissions) {
      permissionInfo.textContent = result.permissions.join(", ");
    }

    const siteAccess = getSiteAccessText(result.origins);
    const siteAccessElement = document.getElementById("site-access");
    if (siteAccessElement) siteAccessElement.innerHTML = siteAccess;
  });

  chrome.extension.isAllowedIncognitoAccess((isAllowedAccess) => {
    const incognitoEnabled = document.getElementById("incognito-enabled");
    if (incognitoEnabled) incognitoEnabled.textContent = isAllowedAccess ? "有効" : "無効";
  });

  const languageMap: { [key: string]: string } = { en: "英語", ja: "日本語" };
  const language = document.getElementById("language") as HTMLElement | null;
  const languages = manifestMetadata.languages || [];
  if (language)
    language.textContent = languages.map((lang: string) => languageMap[lang]).join(", ");

  const publisherName = document.getElementById("publisher-name") as HTMLElement | null;
  const publisher = manifestMetadata.publisher || "不明";
  if (publisherName) publisherName.textContent = publisher;

  const developerName = document.getElementById("developer-name") as HTMLElement | null;
  const developer = manifestMetadata.developer || "不明";
  if (developerName) developerName.textContent = developer;

  const githubLink = document.getElementById("github-link") as HTMLAnchorElement;
  const githubHref = manifestMetadata.github_url;
  if (githubLink && githubHref) {
    githubLink.href = githubHref;
    githubLink.textContent = githubHref;
    openLinkNewTab(githubLink);
  }

  const privacyPolicyContent = document.getElementById("privacy-policy-content");
  if (privacyPolicyContent) {
    renderPrivacyPolicy(privacyPolicyContent, privacyPolicyDoc.content);
  }
}

function renderPrivacyPolicy(container: HTMLElement, html: string): void {
  const template = document.createElement("template");
  template.innerHTML = html;

  Object.entries(PRIVACY_CLASS_MAP).forEach(([tag, className]) => {
    template.content.querySelectorAll(tag).forEach((element) => {
      element.classList.add(...className.split(" "));
    });
  });

  container.replaceChildren(template.content);
}

/**
 * 拡張機能のサイトアクセス権限を日本語テキストに変換する
 */
export function getSiteAccessText(origins: string[] | undefined): string {
  if (origins && origins.length > 0) {
    if (origins.includes("<all_urls>")) {
      return "すべてのサイト";
    } else {
      return origins.map(escapeHtml).join("<br>");
    }
  } else {
    return "クリックされた場合のみ";
  }
}
