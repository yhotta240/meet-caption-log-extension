import assert from "node:assert/strict";
import { resolve } from "node:path";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { build } from "vite";

const bundle = await build({
  configFile: false,
  logLevel: "silent",
  build: {
    write: false,
    lib: { entry: resolve("src/background/drive.ts"), formats: ["es"] },
  },
});
const code = (Array.isArray(bundle) ? bundle[0] : bundle).output.find(
  (entry) => entry.type === "chunk",
).code;
const { setupDrive } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);
const authBundle = await build({
  configFile: false,
  logLevel: "silent",
  build: {
    write: false,
    lib: { entry: resolve("src/utils/google-auth.ts"), formats: ["es"] },
  },
});
const authCode = (Array.isArray(authBundle) ? authBundle[0] : authBundle).output.find(
  (entry) => entry.type === "chunk",
).code;
const { connectGoogleDrive, disconnectGoogleDrive } = await import(
  `data:text/javascript;base64,${Buffer.from(authCode).toString("base64")}`
);
const log = { fileName: "会議.txt", mimeType: "text/plain", content: "発言者: 日本語の字幕" };

function harness(status = 200, folderExists = true) {
  const data = { driveState: { enabled: true }, options: { saveToGoogleDrive: true } };
  let listener;
  let queue = Promise.resolve();
  const calls = [];
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request(_name, work) {
        const next = queue.then(work);
        queue = next.catch(() => {});
        return next;
      },
    },
  });
  globalThis.chrome = {
    storage: {
      local: {
        async get(key, callback) {
          const result = structuredClone(key === null ? data : { [key]: data[key] });
          if (callback) callback(result);
          return result;
        },
        async set(items, callback) {
          Object.assign(data, structuredClone(items));
          if (callback) callback();
        },
        async remove(key) {
          delete data[key];
        },
      },
    },
    identity: {
      async getAuthToken(details) {
        assert.equal(details.interactive, false);
        return { token: "test" };
      },
    },
    runtime: {
      id: "test",
      getURL: (path) => `chrome-extension://test/${path}`,
      onMessage: {
        addListener(value) {
          listener = value;
        },
      },
    },
  };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    const endpoint = new URL(url);

    if (endpoint.pathname === "/drive/v3/files") {
      if (init.method === "POST") {
        folderExists = true;
        return Response.json({ id: "folder-id" }, { status });
      }

      const files = [];
      if (folderExists) {
        files.push({ id: "folder-id" });
      }
      return Response.json({ files }, { status });
    }

    return Response.json({ id: "saved" }, { status });
  };
  setupDrive();
  const send = (
    message,
    sender = { id: "test", tab: { id: 1 }, url: "https://meet.google.com/abc" },
  ) => new Promise((resolve) => listener(message, sender, resolve));
  const pending = () => Object.keys(data).filter((key) => key.startsWith("driveLog:"));
  return { data, calls, send, pending };
}

test("生成済み本文を multipart で保存し，成功後に未送信ログを削除する", async () => {
  const mock = harness();
  assert.equal((await mock.send({ type: "drive:save", log })).ok, true);
  await setImmediate();
  assert.equal(mock.calls.length, 2);
  const upload = mock.calls.find((call) => call.url.includes("/upload/"));
  assert.ok((await upload.init.body.text()).includes(log.content));
  assert.ok((await upload.init.body.text()).includes('"name":"会議.txt"'));
  assert.ok((await upload.init.body.text()).includes('"parents":["folder-id"]'));
  assert.equal(mock.pending().length, 0);
  assert.equal(mock.data.app_logs[0].level, "info");
  assert.match(mock.data.app_logs[0].message, /Google Drive に保存しました/);
});

test("通信失敗時は本文を保持し，再接続後の再送で削除する", async () => {
  const mock = harness(503);
  await mock.send({ type: "drive:save", log });
  await setImmediate();
  assert.equal(mock.data[mock.pending()[0]].content, log.content);
  assert.equal(mock.data.app_logs[0].level, "error");
  assert.match(mock.data.app_logs[0].detail, /503/);
  globalThis.fetch = async (url) => {
    if (new URL(url).pathname === "/drive/v3/files") {
      return Response.json({ files: [{ id: "folder-id" }] });
    }
    return Response.json({ id: "saved" });
  };
  const response = await mock.send(
    { type: "drive:retry" },
    { id: "test", url: "chrome-extension://test/popup.html" },
  );
  assert.equal(response.ok, true);
  assert.equal(mock.pending().length, 0);
});

test("認証切れでも未送信ログを保持し，対話認証を要求しない", async () => {
  const mock = harness();
  chrome.identity.getAuthToken = async (details) => {
    assert.equal(details.interactive, false);
    throw new Error("認証切れ");
  };
  await mock.send({ type: "drive:save", log });
  await setImmediate();
  assert.equal(mock.pending().length, 1);
  assert.equal(mock.calls.length, 0);
  assert.equal(mock.data.app_logs[0].detail, "認証切れ");
});

test("未接続時は従来のローカル保存に任せ，Drive に送信しない", async () => {
  const mock = harness();
  mock.data.driveState.enabled = false;
  await mock.send({ type: "drive:save", log });
  assert.equal(mock.pending().length, 0);
  assert.equal(mock.calls.length, 0);
});

test("チェックがオフまたは設定が未作成なら，接続済みでも保管・送信しない", async () => {
  for (const options of [{ saveToGoogleDrive: false }, undefined]) {
    const mock = harness();
    mock.data.options = options;
    await mock.send({ type: "drive:save", log });
    await setImmediate();
    assert.equal(mock.pending().length, 0);
    assert.equal(mock.calls.length, 0);
  }
});

test("チェックがオフなら，再接続による再送も止めて未送信ログを保持する", async () => {
  const mock = harness(503);
  await mock.send({ type: "drive:save", log });
  await setImmediate();
  assert.equal(mock.pending().length, 1);
  const requests = mock.calls.length;
  mock.data.options.saveToGoogleDrive = false;
  await mock.send(
    { type: "drive:retry" },
    { id: "test", url: "chrome-extension://test/popup.html" },
  );
  assert.equal(mock.calls.length, requests);
  assert.equal(mock.pending().length, 1);
});

test("接続は認証だけ行い，保存先の選択を変更しない", async () => {
  const mock = harness();
  mock.data.driveState.enabled = false;
  mock.data.options = { saveToLocal: true, saveToGoogleDrive: false };
  chrome.identity.getAuthToken = async (details) => {
    assert.equal(details.interactive, true);
    return { token: "test" };
  };
  await connectGoogleDrive();
  assert.equal(mock.data.driveState.enabled, true);
  assert.deepEqual(mock.data.options, { saveToLocal: true, saveToGoogleDrive: false });
  assert.equal(mock.calls.length, 0);
  assert.match(mock.data.app_logs[0].message, /接続しました/);
});

test("解除は許可を取り消してキャッシュを消し，保存済み・未送信ログを削除しない", async () => {
  const mock = harness();
  mock.data.options.saveToLocal = false;
  mock.data["driveLog:pending"] = log;
  let cleared = false;
  chrome.identity.clearAllCachedAuthTokens = async () => {
    cleared = true;
  };
  await disconnectGoogleDrive();
  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].url, "https://oauth2.googleapis.com/revoke");
  assert.equal(mock.calls[0].init.method, "POST");
  assert.equal(mock.calls[0].init.body.get("token"), "test");
  assert.equal(cleared, true);
  assert.equal(mock.data.driveState.enabled, false);
  assert.equal(mock.data.options.saveToLocal, true);
  assert.equal(mock.data.options.saveToGoogleDrive, false);
  assert.deepEqual(mock.data["driveLog:pending"], log);
  assert.match(mock.data.app_logs[0].message, /接続を解除しました/);
});

for (const status of [400, 503]) {
  test(`解除APIがHTTP ${status}でもローカルの接続状態とキャッシュを解除する`, async () => {
    const mock = harness(status);
    mock.data.options.saveToLocal = false;
    mock.data["driveLog:pending"] = log;
    let cleared = false;
    chrome.identity.clearAllCachedAuthTokens = async () => {
      cleared = true;
    };
    await assert.rejects(disconnectGoogleDrive(), new RegExp(String(status)));
    assert.equal(cleared, true);
    assert.equal(mock.data.driveState.enabled, false);
    assert.equal(mock.data.options.saveToLocal, true);
    assert.equal(mock.data.options.saveToGoogleDrive, false);
    assert.deepEqual(mock.data["driveLog:pending"], log);
    assert.equal(mock.data.app_logs, undefined);
  });
}

for (const error of [
  new TypeError("Failed to fetch"),
  new DOMException("Request timed out", "TimeoutError"),
]) {
  test(`解除APIの${error.name}でもローカルの接続状態とキャッシュを解除する`, async () => {
    const mock = harness();
    mock.data.options.saveToLocal = false;
    mock.data["driveLog:pending"] = log;
    let cleared = false;
    chrome.identity.clearAllCachedAuthTokens = async () => {
      cleared = true;
    };
    globalThis.fetch = async () => {
      throw error;
    };
    await assert.rejects(disconnectGoogleDrive(), (actual) => actual === error);
    assert.equal(cleared, true);
    assert.equal(mock.data.driveState.enabled, false);
    assert.equal(mock.data.options.saveToLocal, true);
    assert.equal(mock.data.options.saveToGoogleDrive, false);
    assert.deepEqual(mock.data["driveLog:pending"], log);
    assert.equal(mock.data.app_logs, undefined);
  });
}

test("トークンを取得できなくてもローカルの接続状態とキャッシュを解除する", async () => {
  const mock = harness();
  mock.data.options.saveToLocal = false;
  mock.data["driveLog:pending"] = log;
  let cleared = false;
  chrome.identity.clearAllCachedAuthTokens = async () => {
    cleared = true;
  };
  chrome.identity.getAuthToken = async () => {
    throw new Error("認証切れ");
  };
  await assert.rejects(disconnectGoogleDrive(), /認証切れ/);
  assert.equal(cleared, true);
  assert.equal(mock.data.driveState.enabled, false);
  assert.equal(mock.data.options.saveToLocal, true);
  assert.equal(mock.data.options.saveToGoogleDrive, false);
  assert.deepEqual(mock.data["driveLog:pending"], log);
  assert.equal(mock.calls.length, 0);
});

test("保存先フォルダがなければ作成し，次回は同じフォルダを使う", async () => {
  const mock = harness(200, false);
  await mock.send({ type: "drive:save", log });
  await setImmediate();
  const creation = mock.calls.find(
    (call) => new URL(call.url).pathname === "/drive/v3/files" && call.init.method === "POST",
  );
  assert.deepEqual(JSON.parse(creation.init.body), {
    name: "Google Meet 字幕ログ",
    mimeType: "application/vnd.google-apps.folder",
    parents: ["root"],
  });
  await mock.send({ type: "drive:save", log });
  await setImmediate();
  assert.equal(
    mock.calls.filter(
      (call) => new URL(call.url).pathname === "/drive/v3/files" && call.init.method === "POST",
    ).length,
    1,
  );
  assert.equal(mock.calls.filter((call) => call.url.includes("/upload/")).length, 2);
});

test("フォルダ検索が失敗した場合は直下へ保存せず，未送信ログを残す", async () => {
  const mock = harness(503);
  await mock.send({ type: "drive:save", log });
  await setImmediate();
  assert.equal(mock.calls.filter((call) => call.url.includes("/upload/")).length, 0);
  assert.equal(mock.pending().length, 1);
  assert.equal(mock.data[mock.pending()[0]].content, log.content);
});
