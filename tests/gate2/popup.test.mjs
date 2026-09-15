// Copyright © 2026 Rolando Carreon. All rights reserved.
//
// T-POPUP-HARNESS: Executable popup harness that dynamically imports the REAL
// extension/ui/popup.mjs once, captures its real addEventListener handlers
// through a minimal fake document/URL/Blob/runtime, and proves all five
// invariants:
//   A. Preview bytes equal attempted-download bytes after a distinct save gesture.
//   B. An adapter-side state or retention-revision change requires a fresh preview.
//   C. Stale payload cannot be silently reused (one-shot consumption).
//   D. Object-URL lifetime is safe: created once, revoked deferred-exactly-once
//      after click.
//   E. UI success copy reports only a download request; no Saved/completed claim.
//
// DESIGN: popup.mjs is an ES module — Node caches it after the first import.
// The module captures `runtime` from globalThis.browser.runtime at evaluation
// time and calls `new URL(...)` in its closure. Therefore:
//   1. A single MUTABLE sendMessage delegate is installed before import so every
//      test scenario can swap its adapter without re-importing.
//   2. globalThis.URL is never replaced with a plain object: the native URL class
//      is preserved as the constructor. Only the static createObjectURL /
//      revokeObjectURL methods are intercepted per-scenario by assigning directly
//      on the native URL class (and restored after each scenario).
//   3. Each scenario provides its own fake document (swapped into globalThis so
//      popup.mjs DOM calls hit the scenario's document at call time).
//   4. Created anchors and their click counts are tracked via a createElement
//      intercept on the scenario document.

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createObservationAdapter } from "../../extension/shared/browser-adapter.mjs";
import { makeFakeBrowser, flushAsyncWork } from "./fake-browser.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const POPUP_URL = pathToFileURL(path.join(ROOT, "extension/ui/popup.mjs")).href;

const FIXED_NOW = Date.parse("2026-01-01T12:07:39Z");

// Capture the native URL class BEFORE any override so `new URL(...)` always works.
const NativeURL = globalThis.URL;

// ---------------------------------------------------------------------------
// Mutable sendMessage delegate — the popup module captures `runtime` once;
// each test scenario replaces `delegate.current` to route to its adapter.
// ---------------------------------------------------------------------------
const delegate = { current: null };

// ---------------------------------------------------------------------------
// Minimal fake DOM element.
// ---------------------------------------------------------------------------
function makeFakeElement(id) {
  const listenerMap = {};
  return {
    id,
    textContent: "",
    value: "",
    hidden: false,
    disabled: false,
    _children: [],
    _clicks: 0,
    replaceChildren() { this._children = []; },
    append(child) { this._children.push(child); },
    click() { this._clicks += 1; },
    addEventListener(type, fn) {
      if (!listenerMap[type]) listenerMap[type] = [];
      listenerMap[type].push(fn);
    },
    async _fire(type) {
      for (const fn of (listenerMap[type] || [])) await fn();
    },
    _listenerMap: listenerMap,
  };
}

function makeFakeDocument(ids) {
  const store = {};
  // Track anchors created via document.createElement("a")
  const createdAnchors = [];
  const doc = {
    getElementById(id) {
      if (!store[id]) store[id] = makeFakeElement(id);
      return store[id];
    },
    createElement(tag) {
      const el = makeFakeElement(`__${tag}_${Math.random()}`);
      if (tag === "a") createdAnchors.push(el);
      return el;
    },
    _store: store,
    _anchors: createdAnchors,
  };
  for (const id of ids) store[id] = makeFakeElement(id);
  return doc;
}

// ---------------------------------------------------------------------------
// ALL ELEMENT IDs referenced by popup.mjs.
// ---------------------------------------------------------------------------
const ELEMENT_IDS = [
  "audit-preview", "audit-preview-json", "save-audit",
  "state-code", "state-title", "state-detail", "traffic-statement",
  "reason-code", "toggle-disabled", "enrolled-origin", "blocking-rule-count",
  "activity-body", "activity-caption", "action-result",
  "export-audit", "delete-activity", "enroll-origin", "remove-origin",
];

// ---------------------------------------------------------------------------
// One-time module import with stable globals installed first.
// ---------------------------------------------------------------------------
const stubBrowserForImport = {
  runtime: {
    sendMessage(message) {
      if (!delegate.current) return Promise.resolve({ ok: false, code: "NO_DELEGATE" });
      return delegate.current(message);
    },
  },
  tabs: { query: async () => [] },
  permissions: { request: async () => false, remove: async () => {} },
};

// Prime document for the module-level addEventListener calls and initial GET_VIEW.
const primeDoc = makeFakeDocument(ELEMENT_IDS);

globalThis.browser = stubBrowserForImport;
globalThis.chrome = undefined;
globalThis.document = primeDoc;
// Leave globalThis.URL as the native URL class — the Blob/createObjectURL stubs
// are applied per-scenario by temporarily overriding the static methods.

// Noop delegate for the module-level send("GET_VIEW") that fires at import.
delegate.current = async (_msg) => ({
  ok: true,
  view: {
    state: "ACTIVE_OBSERVE",
    title: "Observing",
    detail: "Synthetic.",
    trafficStatement: "All traffic allowed.",
    reasonCode: "SNAPSHOT_RECONCILED",
    disableLabel: "Emergency disable observation",
    enrolledOrigin: null,
    blockingRuleCount: 0,
    activity: [],
  },
});
// Import the real popup.mjs exactly once.
await import(POPUP_URL);
await flushAsyncWork();

// ---------------------------------------------------------------------------
// Per-scenario setup helper.
// ---------------------------------------------------------------------------
async function makeScenario({ adapterBrowserOptions = {}, initialNowMs = FIXED_NOW } = {}) {
  let nowMs = initialNowMs;
  const browser = makeFakeBrowser(adapterBrowserOptions);
  const adapter = createObservationAdapter(browser, "synthetic", {
    now: () => nowMs,
    monotonic: () => 100,
  });
  await adapter.start();

  const doc = makeFakeDocument(ELEMENT_IDS);

  // URL instrumentation: override static methods on the native URL class and
  // restore them after each scenario.  This preserves `new URL(...)` construction
  // which the adapter uses during origin classification.
  const urlLog = { creates: [], revokes: [] };
  const blobLog = [];
  let blobSeq = 0;
  const origCreate = NativeURL.createObjectURL?.bind(NativeURL);
  const origRevoke = NativeURL.revokeObjectURL?.bind(NativeURL);

  // Blob instrumentation: subclass to capture content.
  class FakeBlob {
    constructor(parts, opts = {}) {
      this._text = parts.join("");
      this.type = opts.type || "";
      blobLog.push(this);
    }
    text() { return Promise.resolve(this._text); }
    // Implement enough of Blob interface for createObjectURL to accept it.
    get size() { return this._text.length; }
  }

  NativeURL.createObjectURL = function(blob) {
    const url = `blob:fake-${++blobSeq}`;
    urlLog.creates.push({ url, blob });
    return url;
  };
  NativeURL.revokeObjectURL = function(url) {
    urlLog.revokes.push(url);
  };

  // Route popup.mjs runtime.sendMessage to this scenario's adapter.
  delegate.current = (msg) => adapter.handleMessage(msg);

  // Swap globalThis.document so popup.mjs DOM calls hit this scenario's doc.
  globalThis.document = doc;
  globalThis.Blob = FakeBlob;

  // Drain any prior action-result.
  doc.getElementById("action-result").textContent = "";

  // Flush any async work from the import-time send("GET_VIEW").
  await flushAsyncWork();

  // Await deferred revocations (setTimeout 0) after each action.
  async function flushTimers() {
    await new Promise((r) => setTimeout(r, 10));
  }

  function restore() {
    if (origCreate) NativeURL.createObjectURL = origCreate;
    else delete NativeURL.createObjectURL;
    if (origRevoke) NativeURL.revokeObjectURL = origRevoke;
    else delete NativeURL.revokeObjectURL;
    globalThis.Blob = undefined;
  }

  return {
    adapter,
    browser,
    doc,
    urlLog,
    blobLog,
    flushTimers,
    restore,
    setNow(ms) { nowMs = ms; },
    async fire(buttonId) {
      // Handlers were registered on primeDoc at import time; fire them while
      // globalThis.document points to this scenario's doc so DOM writes land here.
      await primeDoc.getElementById(buttonId)._fire("click");
    },
    actionResult() {
      return doc.getElementById("action-result").textContent;
    },
    previewJson() {
      return doc.getElementById("audit-preview-json").value;
    },
    previewHidden() {
      return doc.getElementById("audit-preview").hidden;
    },
    saveDisabled() {
      return doc.getElementById("save-audit").disabled;
    },
  };
}

// ===========================================================================
// T-POPUP-01: Preview bytes equal attempted-download bytes after distinct save.
// ===========================================================================
test("T-POPUP-01 preview bytes equal attempted-download bytes after distinct save gesture", async () => {
  const s = await makeScenario();
  try {
    // Distinct preview gesture.
    await s.fire("export-audit");
    const previewedJson = s.previewJson();
    assert.ok(previewedJson.length > 0, "preview textarea must have content after preview gesture");
    assert.equal(s.previewHidden(), false, "audit-preview must be visible after preview");
    assert.equal(s.saveDisabled(), false, "save button must be enabled after preview");

    // Distinct save gesture.
    await s.fire("save-audit");
    await s.flushTimers();

    // Exactly one Blob must have been created; its content must equal the previewed string.
    assert.equal(s.blobLog.length, 1, "exactly one Blob created per save");
    const blobText = await s.blobLog[0].text();
    assert.equal(blobText, previewedJson, "Blob content must be byte-identical to the previewed JSON");

    // Object URL created once; revoked exactly once (deferred via setTimeout).
    assert.equal(s.urlLog.creates.length, 1, "one object URL created");
    assert.equal(s.urlLog.revokes.length, 1, "object URL revoked exactly once");
    assert.equal(s.urlLog.creates[0].url, s.urlLog.revokes[0], "revoked URL matches created URL");

    // The anchor was clicked exactly once.
    assert.equal(s.doc._anchors.length, 1, "exactly one anchor created");
    assert.equal(s.doc._anchors[0]._clicks, 1, "anchor clicked exactly once");
  } finally {
    s.restore();
  }
});

// ===========================================================================
// T-POPUP-02: Adapter-side activity change causes save-time freshness check to
// refuse the stale payload.
// ===========================================================================
test("T-POPUP-02 adapter-side activity change requires fresh preview before save", async () => {
  const s = await makeScenario();
  try {
    // Emit one activity record into the adapter.
    s.browser.webRequest.onBeforeRequest.emitSync({
      url: "https://canvas.test.invalid/courses/synthetic/file.css",
      initiator: "https://canvas.test.invalid/courses/synthetic",
      method: "GET",
      type: "stylesheet",
      tabId: 1,
      parentFrameId: -1,
      incognito: false,
    });
    await flushAsyncWork();

    // Preview — must show 1 record.
    await s.fire("export-audit");
    const previewedJson = s.previewJson();
    assert.ok(
      previewedJson.includes('"recordCount": 1'),
      `preview must show 1 record, got: ${previewedJson.slice(0, 200)}`,
    );

    // Mutate adapter activity BEFORE save: delete so GET_AUDIT_EXPORT returns recordCount 0.
    await s.adapter.handleMessage({ command: "DELETE_ACTIVITY" });

    // Fire save — freshness check must detect the change and refuse.
    await s.fire("save-audit");
    await s.flushTimers();

    // No Blob, no object URL, no anchor click.
    assert.equal(s.blobLog.length, 0, "no Blob when adapter payload changed since preview");
    assert.equal(s.urlLog.creates.length, 0, "no object URL when payload is stale");
    assert.equal(s.urlLog.revokes.length, 0, "no revocation when nothing was created");
    assert.equal(s.doc._anchors.length, 0, "no anchor created for stale payload");

    // Action result must require re-preview.
    const result = s.actionResult();
    assert.ok(
      result.toLowerCase().includes("preview") || result.toLowerCase().includes("changed"),
      `result must require re-preview, got: "${result}"`,
    );
    assert.equal(result.toLowerCase().includes("download"), false, "must not claim download requested");
    assert.equal(result.toLowerCase().includes("saved"), false, "must not claim save completed");
  } finally {
    s.restore();
  }
});

// ===========================================================================
// T-POPUP-03: Adapter-side lifecycle change causes save-time freshness check
// to refuse the pre-change preview.
// ===========================================================================
test("T-POPUP-03 adapter-side lifecycle change requires fresh preview before save", async () => {
  const s = await makeScenario();
  try {
    // Preview in ACTIVE_OBSERVE state.
    await s.fire("export-audit");
    const previewedJson = s.previewJson();
    assert.ok(
      previewedJson.includes("ACTIVE_OBSERVE"),
      `preview must reflect ACTIVE_OBSERVE, got: ${previewedJson.slice(0, 200)}`,
    );

    // Change lifecycle state BEFORE save.
    await s.adapter.handleMessage({ command: "TOGGLE_DISABLED" });
    assert.equal(s.adapter.getState().state, "DISABLED", "adapter must be DISABLED after toggle");

    // Fire save — freshness check detects lifecycleState field changed.
    await s.fire("save-audit");
    await s.flushTimers();

    // No Blob, no object URL.
    assert.equal(s.blobLog.length, 0, "no Blob when lifecycle changed since preview");
    assert.equal(s.urlLog.creates.length, 0, "no object URL when lifecycle changed");
    assert.equal(s.urlLog.revokes.length, 0, "no revocation for stale lifecycle payload");

    // Action result must require fresh preview.
    const result = s.actionResult();
    assert.ok(
      result.toLowerCase().includes("preview") || result.toLowerCase().includes("changed"),
      `result must require re-preview, got: "${result}"`,
    );
  } finally {
    s.restore();
  }
});

// ===========================================================================
// T-POPUP-04: Stale payload cannot be silently reused after one-shot save.
// ===========================================================================
test("T-POPUP-04 stale payload cannot be silently reused after consumption", async () => {
  const s = await makeScenario();
  try {
    // Preview and save once — adapter unchanged, freshness check passes.
    await s.fire("export-audit");
    await s.fire("save-audit");
    await s.flushTimers();

    assert.equal(s.blobLog.length, 1, "first save must produce a Blob");
    assert.equal(s.urlLog.creates.length, 1, "first save must create an object URL");
    assert.equal(s.urlLog.revokes.length, 1, "first save must revoke the object URL");

    // Reset log for second attempt.
    s.blobLog.length = 0;
    s.urlLog.creates.length = 0;
    s.urlLog.revokes.length = 0;
    s.doc._anchors.length = 0;

    // Second save WITHOUT re-preview — pending was cleared (one-shot), refused immediately.
    await s.fire("save-audit");
    await s.flushTimers();

    assert.equal(s.blobLog.length, 0, "second save without re-preview must not create a Blob");
    assert.equal(s.urlLog.creates.length, 0, "second save without re-preview must not create an object URL");
    assert.equal(s.doc._anchors.length, 0, "no anchor created on second save without preview");

    const result = s.actionResult();
    assert.ok(
      result.toLowerCase().includes("preview"),
      `second save must require preview, got: "${result}"`,
    );
    assert.equal(result.toLowerCase().includes("download"), false, "second save must not claim download");
  } finally {
    s.restore();
  }
});

// ===========================================================================
// T-POPUP-05: Object-URL created exactly once; anchor clicked exactly once;
// URL revoked exactly once via the deferred finally setTimeout.
// ===========================================================================
test("T-POPUP-05 object-URL created exactly once and revoked exactly once after click", async () => {
  const s = await makeScenario();
  try {
    await s.fire("export-audit");
    await s.fire("save-audit");

    // Before timers fire: URL is created and anchor is clicked but not yet revoked.
    assert.equal(s.urlLog.creates.length, 1, "exactly one createObjectURL call");
    assert.equal(s.doc._anchors.length, 1, "exactly one anchor created");
    assert.equal(s.doc._anchors[0]._clicks, 1, "anchor clicked exactly once");

    // After timers fire: revocation occurs exactly once.
    await s.flushTimers();
    assert.equal(s.urlLog.revokes.length, 1, "exactly one revokeObjectURL call via deferred finally");
    assert.equal(s.urlLog.creates[0].url, s.urlLog.revokes[0],
      "revoked URL must be the one that was created");
    assert.equal(s.blobLog[0].type, "application/json", "Blob type must be application/json");
  } finally {
    s.restore();
  }
});

// ===========================================================================
// T-POPUP-06: Success copy reports only a download request; no completion claim.
// ===========================================================================
test("T-POPUP-06 success copy reports only a download request without unobservable-completion claim", async () => {
  const s = await makeScenario();
  try {
    await s.fire("export-audit");
    await s.fire("save-audit");
    await s.flushTimers();

    const result = s.actionResult();

    // Must contain "requested".
    assert.ok(
      result.toLowerCase().includes("requested"),
      `action result must say "requested", got: "${result}"`,
    );

    // Must NOT contain any completion/success claim.
    for (const forbidden of ["Saved", "saved", "completed", "success", "written", "downloaded"]) {
      assert.equal(
        result.includes(forbidden), false,
        `action result must not contain "${forbidden}", got: "${result}"`,
      );
    }
  } finally {
    s.restore();
  }
});

// ===========================================================================
// T-POPUP-07: Retention-alarm-driven staleness. After the real gate2-retention
// alarm fires and prunes an expired record, GET_AUDIT_EXPORT returns a
// different canonical JSON than what was previewed (recordCount 0 vs 1).
// The save-time freshness check must detect this and refuse the download,
// consuming and clearing the pending payload.
// ===========================================================================
test("T-POPUP-07 retention alarm expiry changes audit payload and requires fresh preview", async () => {
  const s = await makeScenario();
  try {
    // Emit one activity record at FIXED_NOW.
    s.browser.webRequest.onBeforeRequest.emitSync({
      url: "https://canvas.test.invalid/courses/synthetic/file.css",
      initiator: "https://canvas.test.invalid/courses/synthetic",
      method: "GET",
      type: "stylesheet",
      tabId: 1,
      parentFrameId: -1,
      incognito: false,
    });
    await flushAsyncWork();

    // Confirm the record exists.
    const activity = s.browser.storage.local.data.gate2Activity || [];
    assert.equal(activity.length, 1, "one activity record must exist before preview");

    // Read the retentionExpiresAtBucket so we know when to advance the clock.
    const expiresAt = Date.parse(activity[0].retentionExpiresAtBucket);
    assert.ok(Number.isFinite(expiresAt) && expiresAt > FIXED_NOW,
      "retentionExpiresAtBucket must be a future timestamp");

    // Preview at FIXED_NOW — shows recordCount 1.
    await s.fire("export-audit");
    const previewedJson = s.previewJson();
    assert.ok(
      previewedJson.includes('"recordCount": 1'),
      `preview must show 1 record, got: ${previewedJson.slice(0, 200)}`,
    );

    // Advance the clock to exactly the expiry moment.
    s.setNow(expiresAt);

    // Fire the real gate2-retention alarm (same path as the real adapter listener).
    await s.browser.alarms.onAlarm.emit({ name: "gate2-retention" });
    await flushAsyncWork();

    // Confirm the adapter has pruned the record from storage.
    const afterPrune = s.browser.storage.local.data.gate2Activity;
    assert.ok(
      !afterPrune || afterPrune.length === 0,
      `record must be pruned after retention alarm at expiry, got: ${JSON.stringify(afterPrune)}`,
    );

    // Now fire save — the freshness check re-issues GET_AUDIT_EXPORT which returns
    // recordCount 0 (different from the previewed recordCount 1).
    await s.fire("save-audit");
    await s.flushTimers();

    // No Blob, no object URL, no anchor click.
    assert.equal(s.blobLog.length, 0, "no Blob when retention alarm expired record since preview");
    assert.equal(s.urlLog.creates.length, 0, "no object URL when retention-changed payload is stale");
    assert.equal(s.urlLog.revokes.length, 0, "no revocation when nothing was created");
    assert.equal(s.doc._anchors.length, 0, "no anchor created for stale retention payload");

    // Pending must be cleared — a subsequent save without re-preview is also refused.
    await s.fire("save-audit");
    await s.flushTimers();
    assert.equal(s.blobLog.length, 0, "pending must be cleared after retention-stale refusal");

    // Action result must require fresh preview.
    const result = s.actionResult();
    assert.ok(
      result.toLowerCase().includes("preview") || result.toLowerCase().includes("changed"),
      `result must require re-preview after retention expiry, got: "${result}"`,
    );
    assert.equal(result.toLowerCase().includes("download"), false,
      "must not claim download requested when payload was stale");
  } finally {
    s.restore();
  }
});
