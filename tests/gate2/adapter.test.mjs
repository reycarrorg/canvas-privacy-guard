// Copyright © 2026 Rolando Carreon. All rights reserved.

import assert from "node:assert/strict";
import test from "node:test";

import { createObservationAdapter } from "../../extension/shared/browser-adapter.mjs";
import { minimizeRawRequest } from "../../extension/shared/request-redactor.mjs";
import { makeFakeBrowser, flushAsyncWork } from "./fake-browser.mjs";

const FIXED_NOW = Date.parse("2026-01-01T12:07:39Z");

test("T-ADAPTER-01 real adapter path reconstructs exact synthetic permissions", async () => {
  const browser = makeFakeBrowser();
  const adapter = createObservationAdapter(browser, "synthetic", { now: () => FIXED_NOW, monotonic: () => 100 });
  await adapter.start();
  assert.equal(adapter.getState().state, "ACTIVE_OBSERVE");
  assert.equal(adapter.isRequestObserverAttached(), true);
  browser.permissions.origins = ["https://*.test.invalid/*"];
  await adapter.reconstruct("WAKE");
  assert.equal(adapter.getState().state, "NO_PERMISSION");
  assert.equal(adapter.isRequestObserverAttached(), false);
});

test("T-ADAPTER-02 raw URL and hostile values are synchronously minimized", () => {
  const canary = "FORBIDDEN_CANARY_CREDENTIAL_7f3a";
  const raw = {
    url: `https://canvas.test.invalid/courses/synthetic?token=${canary}#${canary}`,
    initiator: "https://canvas.test.invalid/courses/synthetic",
    method: "POST",
    type: "xmlhttprequest",
    tabId: 918273,
    requestId: canary,
    body: canary,
    headers: [{ name: "Authorization", value: canary }],
    incognito: false,
    parentFrameId: -1,
  };
  const reduced = minimizeRawRequest(raw, {
    active: true,
    recognizedSurface: true,
    canvasOrigin: "https://canvas.test.invalid",
    optionalOrigin: "https://optional.test.invalid",
    identityOrigin: "https://idp.test.invalid",
    lifecycleState: "ACTIVE_OBSERVE",
  });
  const serialized = JSON.stringify(reduced);
  assert.equal(serialized.includes(canary), false);
  for (const forbidden of ["url", "origin", "path", "query", "fragment", "tabId", "requestId", "body", "headers"]) {
    assert.equal(Object.hasOwn(reduced, forbidden), false, forbidden);
  }
  assert.equal(minimizeRawRequest({ ...raw, incognito: true }, {
    active: true,
    recognizedSurface: true,
    canvasOrigin: "https://canvas.test.invalid",
    optionalOrigin: "https://optional.test.invalid",
    identityOrigin: "https://idp.test.invalid",
    lifecycleState: "ACTIVE_OBSERVE",
  }), null);
  assert.equal(minimizeRawRequest({ ...raw, url: "https://idp.test.invalid/synthetic" }, {
    active: true,
    recognizedSurface: true,
    canvasOrigin: "https://canvas.test.invalid",
    optionalOrigin: "https://optional.test.invalid",
    identityOrigin: "https://idp.test.invalid",
    lifecycleState: "ACTIVE_OBSERVE",
  }), null);
});

test("unrelated tabs and initiators cannot create categorical activity", async () => {
  const browser = makeFakeBrowser();
  const adapter = createObservationAdapter(browser, "synthetic", { now: () => FIXED_NOW, monotonic: () => 100 });
  await adapter.start();
  browser.webRequest.onBeforeRequest.emitSync({
    url: "https://optional.test.invalid/collect",
    initiator: "https://unrelated.test.invalid/page",
    method: "POST",
    type: "beacon",
    tabId: 99,
    parentFrameId: -1,
    incognito: false,
  });
  await flushAsyncWork();
  assert.deepEqual(browser.storage.local.data.gate2Activity, []);
});

test("T-PRIVATE-01 private fake-browser tabs are excluded before reconstruction", async () => {
  const browser = makeFakeBrowser({ tabs: [
    { id: 1, windowId: 1, incognito: true, url: "https://canvas.test.invalid/courses/private" },
  ] });
  const adapter = createObservationAdapter(browser, "synthetic", { now: () => FIXED_NOW, monotonic: () => 100 });
  await adapter.start();
  assert.equal(adapter.getState().state, "IDLE");
  assert.deepEqual(adapter.getState().surfaces, {});
});

test("T-PERMISSION-01 permission revoke and add require full reconstruction", async () => {
  const browser = makeFakeBrowser();
  const adapter = createObservationAdapter(browser, "synthetic", { now: () => FIXED_NOW, monotonic: () => 100 });
  await adapter.start();
  browser.permissions.origins = [];
  await browser.permissions.onRemoved.emit({ origins: ["https://canvas.test.invalid/*"] });
  await flushAsyncWork();
  assert.equal(adapter.getState().state, "NO_PERMISSION");
  browser.permissions.origins = ["https://canvas.test.invalid/*"];
  await browser.permissions.onAdded.emit({ origins: ["https://canvas.test.invalid/*"] });
  await flushAsyncWork();
  assert.equal(adapter.getState().state, "ACTIVE_OBSERVE");
});

test("T-RESTART-02 simulated MV3 suspension loses globals and reconstructs", async () => {
  const browser = makeFakeBrowser();
  const first = createObservationAdapter(browser, "synthetic", { now: () => FIXED_NOW, monotonic: () => 100 });
  await first.start();
  browser.runtime.onSuspend.emitSync();
  assert.equal(first.getState().state, "STOPPING");
  assert.equal(first.isRequestObserverAttached(), false);
  const second = createObservationAdapter(browser, "synthetic", { now: () => FIXED_NOW, monotonic: () => 200 });
  await second.start();
  assert.equal(second.getState().state, "ACTIVE_OBSERVE");
  assert.equal(second.isRequestObserverAttached(), true);
});

test("T-DISABLE-01 T-DISABLE-02 emergency disable persists and re-enable reconstructs", async () => {
  const browser = makeFakeBrowser();
  const adapter = createObservationAdapter(browser, "synthetic", { now: () => FIXED_NOW, monotonic: () => 100 });
  await adapter.start();
  await adapter.handleMessage({ command: "TOGGLE_DISABLED" });
  assert.equal(adapter.getState().state, "DISABLED");
  assert.equal(adapter.isRequestObserverAttached(), false);
  await adapter.reconstruct("WAKE");
  assert.equal(adapter.getState().state, "DISABLED");
  await adapter.handleMessage({ command: "TOGGLE_DISABLED" });
  assert.equal(adapter.getState().state, "ACTIVE_OBSERVE");
});

test("T-RETENTION-02 delete-history readback preserves settings", async () => {
  const browser = makeFakeBrowser({ activity: [{ invalid: true }] });
  const adapter = createObservationAdapter(browser, "synthetic", { now: () => FIXED_NOW, monotonic: () => 100 });
  await adapter.start();
  assert.equal(adapter.getState().state, "UNCERTAIN_ALLOW");

  const healthy = makeFakeBrowser();
  const active = createObservationAdapter(healthy, "synthetic", { now: () => FIXED_NOW, monotonic: () => 100 });
  await active.start();
  healthy.webRequest.onBeforeRequest.emitSync({
    url: "https://canvas.test.invalid/courses/synthetic/file.css",
    initiator: "https://canvas.test.invalid/courses/synthetic",
    method: "GET",
    type: "stylesheet",
    tabId: 1,
    parentFrameId: -1,
    incognito: false,
  });
  await flushAsyncWork();
  assert.equal(healthy.storage.local.data.gate2Activity.length, 1);
  const settingsBefore = structuredClone(healthy.storage.local.data.gate2Settings);
  const response = await active.handleMessage({ command: "DELETE_ACTIVITY" });
  assert.equal(response.ok, true);
  assert.equal(healthy.storage.local.data.gate2Activity, undefined);
  assert.deepEqual(healthy.storage.local.data.gate2Settings, settingsBefore);
});

test("T-RETENTION-02 deletion waits for earlier writes and cannot be repopulated by them", async () => {
  const browser = makeFakeBrowser();
  const originalSet = browser.storage.local.set.bind(browser.storage.local);
  let releaseWrite;
  let signalWriteEntered;
  const writeEntered = new Promise((resolve) => { signalWriteEntered = resolve; });
  browser.storage.local.set = async (values) => {
    if (values.gate2Activity?.length) {
      signalWriteEntered();
      await new Promise((resolve) => { releaseWrite = resolve; });
    }
    return originalSet(values);
  };
  const adapter = createObservationAdapter(browser, "synthetic", { now: () => FIXED_NOW, monotonic: () => 100 });
  await adapter.start();
  browser.webRequest.onBeforeRequest.emitSync({
    url: "https://canvas.test.invalid/courses/synthetic/file.css",
    initiator: "https://canvas.test.invalid/courses/synthetic",
    method: "GET",
    type: "stylesheet",
    tabId: 1,
    parentFrameId: -1,
    incognito: false,
  });
  await writeEntered;
  const deletionPromise = adapter.handleMessage({ command: "DELETE_ACTIVITY" });
  releaseWrite();
  const deletion = await deletionPromise;
  await flushAsyncWork();
  assert.equal(deletion.ok, true);
  assert.equal(browser.storage.local.data.gate2Activity, undefined);
});

test("T-RETENTION-01 local alarm prunes records at the 24-hour deadline", async () => {
  let currentTime = FIXED_NOW;
  const browser = makeFakeBrowser();
  const adapter = createObservationAdapter(browser, "synthetic", {
    now: () => currentTime,
    monotonic: () => 100,
  });
  await adapter.start();
  browser.webRequest.onBeforeRequest.emitSync({
    url: "https://canvas.test.invalid/courses/synthetic/file.css",
    initiator: "https://canvas.test.invalid/courses/synthetic",
    method: "GET",
    type: "stylesheet",
    tabId: 1,
    parentFrameId: -1,
    incognito: false,
  });
  await flushAsyncWork();
  const deadline = Date.parse(browser.storage.local.data.gate2Activity[0].retentionExpiresAtBucket);
  assert.deepEqual(browser.alarms.rows["gate2-retention"], { when: deadline });
  currentTime = deadline;
  await browser.alarms.onAlarm.emit({ name: "gate2-retention" });
  await flushAsyncWork();
  assert.deepEqual(browser.storage.local.data.gate2Activity, []);
  assert.equal(browser.alarms.rows["gate2-retention"], undefined);
});

test("T-FAULT-01 T-FAULT-02 adapter and prospective-rule exceptions fail to UNCERTAIN_ALLOW", async () => {
  const mismatchBrowser = makeFakeBrowser();
  const mismatch = createObservationAdapter(mismatchBrowser, "synthetic", {
    now: () => FIXED_NOW,
    monotonic: () => 100,
    readProspectiveRules: async () => [{ syntheticUnexpectedRule: true }],
  });
  await mismatch.start();
  assert.equal(mismatch.getState().state, "UNCERTAIN_ALLOW");
  assert.equal(mismatch.isRequestObserverAttached(), false);

  const failureBrowser = makeFakeBrowser();
  failureBrowser.storage.local.failNext = "get";
  const failure = createObservationAdapter(failureBrowser, "synthetic", { now: () => FIXED_NOW, monotonic: () => 100 });
  await failure.start();
  assert.equal(failure.getState().state, "UNCERTAIN_ALLOW");
  assert.equal(failure.getState().networkAction, "ALLOW");
});
