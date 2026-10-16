import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { Script } from "node:vm";
import { build } from "vite";

const bundles = await build({
  configFile: false,
  publicDir: false,
  logLevel: "silent",
  build: {
    write: false,
    lib: { entry: resolve("src/content/index.ts"), formats: ["iife"], name: "Captions" },
  },
});
const outputs = [bundles].flat().flatMap((bundle) => bundle.output);
const script = new Script(outputs.find((output) => output.type === "chunk").code);

async function startMeeting(options) {
  const data = { options: { saveHistory: true, ...options } };
  const downloads = [];
  const blobs = [];
  const messages = [];
  const storageListeners = [];
  let beforeUnload;
  const chrome = {
    storage: {
      local: {
        async get(key, callback) {
          const result = structuredClone({ [key]: data[key] });
          callback?.(result);
          return result;
        },
        async set(items, callback) {
          Object.assign(data, structuredClone(items));
          for (const listener of storageListeners) {
            const changes = Object.fromEntries(
              Object.entries(items).map(([key, value]) => [key, { newValue: value }]),
            );
            listener(changes, "local");
          }
          callback?.();
        },
      },
      onChanged: { addListener: (listener) => storageListeners.push(listener) },
    },
    runtime: {
      async sendMessage(message) {
        messages.push(message);
        return { ok: true };
      },
    },
  };

  script.runInNewContext({
    chrome,
    Blob,
    setTimeout,
    clearTimeout,
    URL: {
      createObjectURL(blob) {
        blobs.push(blob);
        return "blob:captions";
      },
      revokeObjectURL() {},
    },
    document: {
      querySelector: () => null,
      querySelectorAll(selector) {
        if (selector === ".nMcdL.bj4p3b") {
          return [{ querySelector: () => ({ textContent: "保存先のテスト" }) }];
        }
        if (selector === ".adE6rb") {
          return [{ textContent: "発言者" }];
        }
        return [];
      },
      body: { appendChild() {} },
      createElement(tag) {
        assert.equal(tag, "a");
        return {
          click() {
            downloads.push(this.download);
          },
          remove() {},
        };
      },
    },
    window: {
      location: { href: "https://meet.google.com/abc-defg-hij" },
      addEventListener(type, listener) {
        assert.equal(type, "beforeunload");
        beforeUnload = listener;
      },
    },
    MutationObserver: class {
      observe() {}
    },
  });
  await setImmediate();
  assert.ok(data.captionStartTime, "字幕ログが開始されていること");

  return {
    data,
    downloads,
    blobs,
    messages,
    chrome,
    async end() {
      beforeUnload();
      await setImmediate();
    },
  };
}

for (const scenario of [
  { name: "初期値", options: {}, local: 1, drive: 0 },
  {
    name: "このPCのみ",
    options: { saveToLocal: true, saveToGoogleDrive: false },
    local: 1,
    drive: 0,
  },
  {
    name: "Google Driveのみ",
    options: { saveToLocal: false, saveToGoogleDrive: true },
    local: 0,
    drive: 1,
  },
  { name: "両方", options: { saveToLocal: true, saveToGoogleDrive: true }, local: 1, drive: 1 },
  { name: "既存のDrive設定", options: { saveToGoogleDrive: true }, local: 1, drive: 1 },
]) {
  test(`${scenario.name}では選択した保存先だけに保存し，履歴も保持する`, async () => {
    const meeting = await startMeeting(scenario.options);
    await meeting.end();
    assert.equal(meeting.downloads.length, scenario.local);
    assert.equal(meeting.messages.length, scenario.drive);
    assert.equal(meeting.data.history.length, 1);
    const content = meeting.data.history[0].content;
    assert.match(content, /発言者:\n 保存先のテスト/);
    for (const blob of meeting.blobs) {
      assert.equal(await blob.text(), content);
    }
    for (const message of meeting.messages) {
      assert.equal(message.type, "drive:save");
      assert.equal(message.log.content, content);
    }
  });
}

test("会議中の保存先変更を次の保存に反映する", async () => {
  const meeting = await startMeeting({});
  await meeting.chrome.storage.local.set({
    options: { saveToLocal: false, saveToGoogleDrive: true },
  });
  await meeting.end();
  assert.equal(meeting.downloads.length, 0);
  assert.equal(meeting.messages.length, 1);
});

test("履歴保存をオフにしても選択した保存先には保存する", async () => {
  const meeting = await startMeeting({
    saveToLocal: false,
    saveToGoogleDrive: true,
    saveHistory: false,
  });
  await meeting.end();
  assert.equal(meeting.downloads.length, 0);
  assert.equal(meeting.messages.length, 1);
  assert.equal(meeting.data.history, undefined);
});
