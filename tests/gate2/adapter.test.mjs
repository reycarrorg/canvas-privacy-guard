// Copyright © 2026 Rolando Carreon. All rights reserved.

import assert from "node:assert/strict";
import test from "node:test";

import { createObservationAdapter } from "../../extension/shared/browser-adapter.mjs";
import { isValidAuditExport, serializeAuditExport } from "../../extension/shared/audit-export.mjs";
import { minimizeRawRequest } from "../../extension/shared/request-redactor.mjs";
import { makeFakeBrowser, flushAsyncWork } from "./fake-browser.mjs";

const FIXED_NOW = Date.parse("2026-01-01T12:07:39Z");

function syntheticRequest(overrides = {}) {
  return {
    url: "https://canvas.test.invalid/courses/synthetic/file.css",
    initiator: "https://canvas.test.invalid/courses/synthetic",
    method: "GET",
    type: "stylesheet",
    tabId: 1,
    parentFrameId: -1,
    incognito: false,
    ...overrides,
  };
}

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

test("T-AUTH-01 one exact authenticated Canvas cloud origin can be enrolled", async () => {
  const canvasOrigin = "https://example-university.instructure.com";
  const browser = makeFakeBrowser({
    settings: { schemaVersion: 1, disabled: false, enrolledOrigins: [canvasOrigin] },
    permissions: [`${canvasOrigin}/*`, "https://optional.test.invalid/*"],
    tabs: [{
      id: 7,
      windowId: 1,
      incognito: false,
      url: `${canvasOrigin}/courses/123`,
    }],
  });
  const adapter = createObservationAdapter(browser, "synthetic", {
    now: () => FIXED_NOW,
    monotonic: () => 100,
  });
  await adapter.start();
  assert.equal(adapter.getState().state, "ACTIVE_OBSERVE");
  assert.equal(adapter.isRequestObserverAttached(), true);
  assert.deepEqual(browser.webRequest.onBeforeRequest.registrations[0], [{ urls: [
    `${canvasOrigin}/*`,
    "https://optional.test.invalid/*",
  ] }]);
  const response = await adapter.handleMessage({ command: "GET_VIEW" });
  assert.equal(response.ok, true);
  assert.equal(response.view.enrolledOrigin, canvasOrigin);
  assert.equal(response.view.blockingRuleCount, 0);
});

test("T-AUTH-02 arbitrary authenticated websites cannot be enrolled as Canvas", async () => {
  const browser = makeFakeBrowser();
  const adapter = createObservationAdapter(browser, "synthetic", {
    now: () => FIXED_NOW,
    monotonic: () => 100,
  });
  await adapter.start();
  const response = await adapter.handleMessage({
    command: "ENROLL_ORIGIN",
    origin: "https://accounts.example.com",
  });
  assert.equal(response.ok, false);
  assert.equal(response.code, "ADAPTER_ERROR");
  assert.deepEqual(browser.storage.local.data.gate2Settings.enrolledOrigins, [
    "https://canvas.test.invalid",
  ]);
  assert.equal(adapter.isRequestObserverAttached(), false);
  assert.equal(adapter.getState().networkAction, "ALLOW");
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

test("malformed parent-frame identifiers are never reinterpreted as top-level", () => {
  const context = {
    active: true,
    recognizedSurface: true,
    canvasOrigin: "https://canvas.test.invalid",
    optionalOrigin: "https://optional.test.invalid",
    identityOrigin: "https://idp.test.invalid",
    lifecycleState: "ACTIVE_OBSERVE",
  };
  for (const parentFrameId of [undefined, null, "-1", -2, 0.5, {}, Number.NaN]) {
    assert.equal(minimizeRawRequest(syntheticRequest({ parentFrameId }), context), null);
  }
  assert.notEqual(minimizeRawRequest(syntheticRequest({ parentFrameId: -1 }), context), null);
  assert.notEqual(minimizeRawRequest(syntheticRequest({ parentFrameId: 0 }), context), null);
});

test("malformed delivered frame metadata suspends observation and stores nothing", async () => {
  const browser = makeFakeBrowser();
  const adapter = createObservationAdapter(browser, "synthetic", { now: () => FIXED_NOW, monotonic: () => 100 });
  await adapter.start();
  const results = browser.webRequest.onBeforeRequest.emitSync(syntheticRequest({ parentFrameId: undefined }));
  assert.deepEqual(results, [undefined]);
  assert.equal(adapter.getState().state, "ASSESSMENT_SAFE");
  assert.equal(adapter.getState().networkAction, "ALLOW");
  assert.equal(adapter.isRequestObserverAttached(), false);
  await flushAsyncWork();
  assert.deepEqual(browser.storage.local.data.gate2Activity ?? [], []);
});

test("directly delivered child-frame metadata suspends before destination inspection", async () => {
  const canary = "EXTERNAL_FRAME_CANARY_5dd3";
  const browser = makeFakeBrowser();
  const adapter = createObservationAdapter(browser, "synthetic", { now: () => FIXED_NOW, monotonic: () => 100 });
  await adapter.start();
  const results = browser.webRequest.onBeforeRequest.emitSync(syntheticRequest({
    url: `https://external.test.invalid/${canary}`,
    type: "sub_frame",
    parentFrameId: 0,
  }));
  assert.deepEqual(results, [undefined]);
  assert.equal(adapter.getState().state, "ASSESSMENT_SAFE");
  assert.equal(adapter.getState().networkAction, "ALLOW");
  assert.equal(adapter.isRequestObserverAttached(), false);
  await flushAsyncWork();
  assert.deepEqual(browser.storage.local.data.gate2Activity ?? [], []);
  assert.equal(JSON.stringify(browser.storage.local.data).includes(canary), false);
});

test("tab updates cannot erase a delivered child-frame assessment lock", async () => {
  const browser = makeFakeBrowser();
  const adapter = createObservationAdapter(browser, "synthetic", { now: () => FIXED_NOW, monotonic: () => 100 });
  await adapter.start();
  assert.deepEqual(browser.webRequest.onBeforeRequest.emitSync(syntheticRequest({
    type: "sub_frame",
    parentFrameId: 0,
  })), [undefined]);
  await browser.tabs.onUpdated.emit(1, { title: "Synthetic course" }, {
    id: 1,
    windowId: 1,
    incognito: false,
    url: "https://canvas.test.invalid/courses/synthetic",
  });
  assert.equal(adapter.getState().state, "ASSESSMENT_SAFE");
  assert.equal(adapter.getState().networkAction, "ALLOW");
  assert.equal(adapter.isRequestObserverAttached(), false);
  assert.deepEqual(browser.webRequest.onBeforeRequest.emitSync(syntheticRequest()), []);
});

test("delivered child-frame metadata fences an already-pending activity write", async () => {
  const browser = makeFakeBrowser();
  const originalSet = browser.storage.local.set.bind(browser.storage.local);
  let releaseActivity;
  let signalActivityEntered;
  const activityEntered = new Promise((resolve) => { signalActivityEntered = resolve; });
  browser.storage.local.set = async (values) => {
    if (values.gate2Activity?.length) {
      signalActivityEntered();
      await new Promise((resolve) => { releaseActivity = resolve; });
    }
    return originalSet(values);
  };
  const adapter = createObservationAdapter(browser, "synthetic", { now: () => FIXED_NOW, monotonic: () => 100 });
  await adapter.start();
  assert.deepEqual(browser.webRequest.onBeforeRequest.emitSync(syntheticRequest()), [undefined]);
  await activityEntered;
  const frameResults = browser.webRequest.onBeforeRequest.emitSync(syntheticRequest({
    url: "https://external.test.invalid/frame",
    type: "sub_frame",
    parentFrameId: 0,
  }));
  assert.deepEqual(frameResults, [undefined]);
  assert.equal(adapter.getState().state, "ASSESSMENT_SAFE");
  assert.equal(adapter.getState().networkAction, "ALLOW");
  assert.equal(adapter.isRequestObserverAttached(), false);
  releaseActivity();
  await flushAsyncWork();
  assert.deepEqual(browser.storage.local.data.gate2Activity ?? [], []);
});

test("suspected top-level assessment request records one redacted signal, suspends, and remains ALLOW", async () => {
  const browser = makeFakeBrowser();
  const adapter = createObservationAdapter(browser, "synthetic", { now: () => FIXED_NOW, monotonic: () => 100 });
  await adapter.start();
  const results = browser.webRequest.onBeforeRequest.emitSync(syntheticRequest({
    url: "https://canvas.test.invalid/quizzes/synthetic",
    type: "main_frame",
  }));
  assert.deepEqual(results, [undefined]);
  assert.equal(adapter.getState().state, "ASSESSMENT_SAFE");
  assert.equal(adapter.getState().networkAction, "ALLOW");
  assert.equal(adapter.isRequestObserverAttached(), false);
  await flushAsyncWork();
  const activity = browser.storage.local.data.gate2Activity ?? [];
  assert.equal(activity.length, 1);
  assert.deepEqual({
    eventClass: activity[0].eventClass,
    pathClass: activity[0].pathClass,
    networkAction: activity[0].networkAction,
    observationAction: activity[0].observationAction,
  }, {
    eventClass: "assessment",
    pathClass: "assessment_suspected",
    networkAction: "ALLOW",
    observationAction: "REDACTED_RECORD",
  });
  assert.equal(JSON.stringify(activity).includes("/quizzes/synthetic"), false);
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

test("emergency disable detaches before a pending settings write", async () => {
  const browser = makeFakeBrowser();
  const originalSet = browser.storage.local.set.bind(browser.storage.local);
  let releaseSettings;
  let signalSettingsEntered;
  const settingsEntered = new Promise((resolve) => { signalSettingsEntered = resolve; });
  browser.storage.local.set = async (values) => {
    if (values.gate2Settings?.disabled === true) {
      signalSettingsEntered();
      await new Promise((resolve) => { releaseSettings = resolve; });
    }
    return originalSet(values);
  };
  const adapter = createObservationAdapter(browser, "synthetic", { now: () => FIXED_NOW, monotonic: () => 100 });
  await adapter.start();
  const disabling = adapter.handleMessage({ command: "TOGGLE_DISABLED" });
  await settingsEntered;
  assert.equal(adapter.isRequestObserverAttached(), false);
  assert.deepEqual(browser.webRequest.onBeforeRequest.emitSync(syntheticRequest()), []);
  releaseSettings();
  const response = await disabling;
  assert.equal(response.ok, true);
  assert.equal(adapter.getState().state, "DISABLED");
  assert.equal(adapter.getState().networkAction, "ALLOW");
  assert.deepEqual(browser.storage.local.data.gate2Activity ?? [], []);
});

test("enrollment removal detaches before a pending settings write", async () => {
  const browser = makeFakeBrowser();
  const originalSet = browser.storage.local.set.bind(browser.storage.local);
  let releaseSettings;
  let signalSettingsEntered;
  const settingsEntered = new Promise((resolve) => { signalSettingsEntered = resolve; });
  browser.storage.local.set = async (values) => {
    if (values.gate2Settings?.enrolledOrigins?.length === 0) {
      signalSettingsEntered();
      await new Promise((resolve) => { releaseSettings = resolve; });
    }
    return originalSet(values);
  };
  const adapter = createObservationAdapter(browser, "synthetic", { now: () => FIXED_NOW, monotonic: () => 100 });
  await adapter.start();
  const removing = adapter.handleMessage({ command: "REMOVE_ENROLLMENT" });
  await settingsEntered;
  assert.equal(adapter.isRequestObserverAttached(), false);
  assert.deepEqual(browser.webRequest.onBeforeRequest.emitSync(syntheticRequest()), []);
  releaseSettings();
  const response = await removing;
  assert.equal(response.ok, true);
  assert.equal(adapter.getState().state, "NO_PERMISSION");
  assert.equal(adapter.getState().networkAction, "ALLOW");
  assert.deepEqual(browser.storage.local.data.gate2Activity ?? [], []);
});

for (const privacyAction of [
  { name: "emergency disable", command: "TOGGLE_DISABLED", finalState: "DISABLED" },
  { name: "enrollment removal", command: "REMOVE_ENROLLMENT", finalState: "NO_PERMISSION" },
]) {
  test(`${privacyAction.name} fences an already-pending activity write`, async () => {
    const browser = makeFakeBrowser();
    const originalSet = browser.storage.local.set.bind(browser.storage.local);
    let releaseActivity;
    let signalActivityEntered;
    const activityEntered = new Promise((resolve) => { signalActivityEntered = resolve; });
    browser.storage.local.set = async (values) => {
      if (values.gate2Activity?.length) {
        signalActivityEntered();
        await new Promise((resolve) => { releaseActivity = resolve; });
      }
      return originalSet(values);
    };
    const adapter = createObservationAdapter(browser, "synthetic", { now: () => FIXED_NOW, monotonic: () => 100 });
    await adapter.start();
    assert.deepEqual(browser.webRequest.onBeforeRequest.emitSync(syntheticRequest()), [undefined]);
    await activityEntered;
    const action = adapter.handleMessage({ command: privacyAction.command });
    assert.equal(adapter.isRequestObserverAttached(), false);
    releaseActivity();
    const response = await action;
    await flushAsyncWork();
    assert.equal(response.ok, true);
    assert.equal(adapter.getState().state, privacyAction.finalState);
    assert.equal(adapter.getState().networkAction, "ALLOW");
    assert.deepEqual(browser.storage.local.data.gate2Activity ?? [], []);
  });
}

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

test("T-ADAPTER-03 GET_AUDIT_EXPORT returns valid audit export without sensitive fields or enrolled origins", async () => {
  const canvasOrigin = "https://example-university.instructure.com";
  const browser = makeFakeBrowser({
    settings: { schemaVersion: 1, disabled: false, enrolledOrigins: [canvasOrigin] },
    permissions: [`${canvasOrigin}/*`, "https://optional.test.invalid/*"],
    tabs: [{
      id: 7,
      windowId: 1,
      incognito: false,
      url: `${canvasOrigin}/courses/123`,
    }],
  });
  const adapter = createObservationAdapter(browser, "synthetic", {
    now: () => FIXED_NOW,
    monotonic: () => 100,
  });
  await adapter.start();

  browser.webRequest.onBeforeRequest.emitSync({
    url: `${canvasOrigin}/courses/123/module.css`,
    initiator: `${canvasOrigin}/courses/123`,
    method: "GET",
    type: "stylesheet",
    tabId: 7,
    parentFrameId: -1,
    incognito: false,
  });
  await flushAsyncWork();

  const response = await adapter.handleMessage({ command: "GET_AUDIT_EXPORT" });
  assert.equal(response.ok, true);
  assert.equal(isValidAuditExport(response.exportData), true);
  assert.equal(response.exportData.schemaVersion, 1);
  assert.equal(response.exportData.exportFormat, "canvas-privacy-guard-audit-export");
  assert.equal(response.exportData.networkAction, "ALLOW");
  assert.equal(response.exportData.blockingRuleCount, 0);
  assert.equal(response.exportData.recordCount, 1);
  assert.equal(response.exportData.records.length, 1);

  // Verify that the record is categorical and contains no raw URLs or identifiers
  const record = response.exportData.records[0];
  assert.equal(record.destinationClass, "enrolled_canvas_origin");
  assert.equal(record.pathClass, "static_asset");
  assert.equal(record.resourceType, "stylesheet");
  assert.equal(record.networkAction, "ALLOW");

  // Serialization must never leak the enrolled origin string or forbidden tokens
  const serialized = serializeAuditExport(response.exportData);
  assert.equal(serialized.includes("example-university.instructure.com"), false);
  assert.equal(serialized.includes("enrolledOrigin"), false);
  assert.equal(serialized.includes("module.css"), false);
  assert.equal(serialized.includes("tabId"), false);

  // Test browser-native Blob and object URL creation and revocation
  const blob = new Blob([serialized], { type: "application/json" });
  assert.equal(blob.type, "application/json");
  const objUrl = URL.createObjectURL(blob);
  assert.equal(typeof objUrl, "string");
  URL.revokeObjectURL(objUrl);
});

test("T-ADAPTER-04 DELETE_ACTIVITY empties audit export records while preserving state", async () => {
  const browser = makeFakeBrowser();
  const adapter = createObservationAdapter(browser, "synthetic", {
    now: () => FIXED_NOW,
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

  const preDelete = await adapter.handleMessage({ command: "GET_AUDIT_EXPORT" });
  assert.equal(preDelete.ok, true);
  assert.equal(preDelete.exportData.recordCount, 1);

  const deleteResponse = await adapter.handleMessage({ command: "DELETE_ACTIVITY" });
  assert.equal(deleteResponse.ok, true);

  const postDelete = await adapter.handleMessage({ command: "GET_AUDIT_EXPORT" });
  assert.equal(postDelete.ok, true);
  assert.equal(isValidAuditExport(postDelete.exportData), true);
  assert.equal(postDelete.exportData.recordCount, 0);
  assert.deepEqual(postDelete.exportData.records, []);
  assert.equal(postDelete.exportData.networkAction, "ALLOW");
  assert.equal(postDelete.exportData.blockingRuleCount, 0);
});
