// Copyright © 2026 Rolando Carreon. All rights reserved.

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXTENSION = path.join(ROOT, "extension");

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  }));
  return nested.flat().sort();
}

test("T-MANIFEST-01 both MV3 manifests use the exact observation-only capability set", async () => {
  const deniedPermissions = new Set([
    "webRequestBlocking", "declarativeNetRequest", "declarativeNetRequestWithHostAccess",
    "cookies", "history", "debugger", "proxy", "nativeMessaging", "downloads", "clipboardRead",
    "clipboardWrite", "desktopCapture", "tabCapture", "activeTab", "scripting",
  ]);
  for (const name of ["manifest.firefox.json", "manifest.chromium.json"]) {
    const manifest = JSON.parse(await readFile(path.join(EXTENSION, name), "utf8"));
    assert.equal(manifest.manifest_version, 3);
    assert.deepEqual(manifest.permissions, ["alarms", "storage", "webRequest"]);
    assert.equal(manifest.incognito, "not_allowed");
    for (const permission of manifest.permissions) assert.equal(deniedPermissions.has(permission), false);
    assert.deepEqual(manifest.host_permissions, [
      "https://canvas.test.invalid/*",
      "https://optional.test.invalid/*",
    ]);
    assert.equal(JSON.stringify(manifest).includes("<all_urls>"), false);
    assert.equal(JSON.stringify(manifest).includes("*."), false);
    assert.equal(Object.hasOwn(manifest, "content_scripts"), false);
    assert.equal(manifest.background.type, "module");
  }
});

test("T-NETWORK-01 executable source has no remote endpoint, remote code, or enforcement API", async () => {
  const files = (await filesBelow(EXTENSION)).filter((file) => file.endsWith(".mjs"));
  const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
  for (const forbidden of [
    "fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket(", "eval(", "new Function(",
    "declarativeNetRequest", "webRequestBlocking", "onBeforeSendHeaders", "onHeadersReceived",
    "filterResponseData", "proxy.settings", "chrome.cookies", "browser.cookies", "console.",
  ]) assert.equal(source.includes(forbidden), false, forbidden);
  const urls = [...source.matchAll(/https?:\/\/[^\s"'`]+/g)].map((match) => match[0]);
  assert.ok(urls.length > 0);
  assert.ok(urls.every((url) => url.includes(".test.invalid")), JSON.stringify(urls));
});

test("T-PRIVACY-01 shared/output paths prohibit raw interpolation and dynamic logging", async () => {
  const files = await filesBelow(EXTENSION);
  const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
  for (const forbidden of ["innerHTML", "outerHTML", "document.write", "JSON.stringify(rawEvent)", "String(rawEvent)"]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("accessible visible state UI is keyboard reachable and truthful without color dependence", async () => {
  const html = await readFile(path.join(EXTENSION, "ui/popup.html"), "utf8");
  const css = await readFile(path.join(EXTENSION, "ui/popup.css"), "utf8");
  const script = await readFile(path.join(EXTENSION, "ui/popup.mjs"), "utf8");
  for (const label of [
    "Emergency disable observation",
    "Delete local activity",
    "Enroll exact synthetic Canvas origin",
    "All traffic is allowed. This prototype never blocks or changes network requests.",
  ]) assert.ok(html.includes(label), label);
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(html.includes('aria-label="Scrollable redacted activity table"'));
  assert.ok(html.includes('<th scope="col">'));
  assert.ok(css.includes(":focus-visible"));
  assert.ok(css.includes("outline:"));
  assert.ok(script.includes("textContent"));
  assert.equal(script.includes("innerHTML"), false);
  assert.equal(/color:\s*(red|green|orange)/i.test(css), false);
});
