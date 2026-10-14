import { logInfo } from "./logger";
import { getOptions, setOptions } from "./storage";

const STATE_KEY = "driveState";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const REVOKE_TIMEOUT_MS = 20_000;

export async function getGoogleAccessToken(interactive = false): Promise<string> {
  const { token } = await chrome.identity.getAuthToken({ interactive });

  if (!token) {
    throw new Error("Google Drive に再接続してください");
  }

  return token;
}

export async function removeGoogleAccessToken(token: string): Promise<void> {
  await chrome.identity.removeCachedAuthToken({ token });
}

export async function isGoogleDriveConnected(): Promise<boolean> {
  const data = await chrome.storage.local.get(STATE_KEY);
  return Boolean(data[STATE_KEY]?.enabled);
}

export async function connectGoogleDrive(): Promise<void> {
  await getGoogleAccessToken(true);

  const options = await getOptions();
  await setOptions({ ...options, saveToGoogleDrive: true });
  await chrome.storage.local.set({ [STATE_KEY]: { enabled: true } });
  await logInfo("Google Drive に接続しました", "popup");
}

export async function disconnectGoogleDrive(): Promise<void> {
  const options = await getOptions();
  await setOptions({ ...options, saveToGoogleDrive: false });

  const token = await getGoogleAccessToken();
  const response = await fetch(REVOKE_URL, {
    method: "POST",
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(REVOKE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Google Drive の解除に失敗しました（HTTP ${response.status}）`);
  }

  await chrome.identity.clearAllCachedAuthTokens();
  await chrome.storage.local.set({ [STATE_KEY]: { enabled: false } });
  await logInfo("Google Drive の接続を解除しました", "popup");
}
