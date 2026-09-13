// Copyright © 2026 Rolando Carreon. All rights reserved.

import assert from "node:assert/strict";
import test from "node:test";

import { classifyRedacted } from "../../extension/shared/classifier.mjs";
import { CLASSIFIER_REVISION, EVENT_KINDS, NETWORK_ACTION, STATES } from "../../extension/shared/constants.mjs";
import {
  normalizeExactHttpsOrigin,
  hasExactPermission,
  isSupportedCanvasOrigin,
} from "../../extension/shared/origin.mjs";
import { createInitialState, reduceLifecycle } from "../../extension/shared/reducer.mjs";
import { insertRecord, pruneRecords } from "../../extension/shared/retention.mjs";

const ACTIVE_INPUT = Object.freeze({
  destinationClass: "enrolled_canvas_origin",
  pathClass: "course_or_navigation",
  resourceType: "document",
  methodClass: "read",
  initiatorRelation: "enrolled_top_level",
  lifecycleState: "ACTIVE_OBSERVE",
  classifierRevision: CLASSIFIER_REVISION,
});

function snapshot(surfaces = [], overrides = {}) {
  return {
    kind: "TAB_SNAPSHOT",
    disabled: false,
    enrollmentValid: true,
    permissionValid: true,
    consistent: true,
    ruleStateEmpty: true,
    surfaces,
    nowMonotonic: 10,
    ...overrides,
  };
}

test("T-REDUCER-02 exact HTTPS origin and permission cases", () => {
  assert.equal(normalizeExactHttpsOrigin("https://canvas.test.invalid"), "https://canvas.test.invalid");
  assert.equal(normalizeExactHttpsOrigin("https://canvas.test.invalid:443"), "https://canvas.test.invalid");
  for (const invalid of [
    "http://canvas.test.invalid",
    "https://*.test.invalid",
    "https://canvas.test.invalid:444",
    "https://canvas.test.invalid/path",
    "https://canvas.test.invalid?query=1",
  ]) assert.equal(normalizeExactHttpsOrigin(invalid), null, invalid);
  for (const unsupported of [
    "https://canvas.test.invalid.evil.invalid",
    "https://evilcanvas.test.invalid",
    "https://accounts.example.com",
    "https://instructure.com",
  ]) assert.equal(isSupportedCanvasOrigin(unsupported), false, unsupported);
  assert.equal(isSupportedCanvasOrigin("https://example-university.instructure.com"), true);
  assert.equal(hasExactPermission("https://canvas.test.invalid", ["https://canvas.test.invalid/*"]), true);
  assert.equal(hasExactPermission("https://canvas.test.invalid", ["https://*.test.invalid/*"]), false);
});

test("T-REDUCER-01 every lifecycle event and state remains ALLOW-only", () => {
  for (const visibleState of STATES) {
    for (const kind of EVENT_KINDS) {
      const seed = { ...createInitialState(), state: visibleState };
      const event = {
        kind,
        key: "tab:1",
        oldKey: "tab:1",
        surface: { key: "tab:1", phase: "recognized", assessment: "not_suspected" },
        surfaces: [],
        disabled: false,
        enrollmentValid: true,
        permissionValid: true,
        consistent: true,
        ruleStateEmpty: true,
        readbackEmpty: true,
        nowMonotonic: 1,
      };
      assert.equal(reduceLifecycle(seed, event).networkAction, NETWORK_ACTION, `${visibleState}/${kind}`);
    }
  }
});

test("T-REDUCER-03 invalid inputs enter UNCERTAIN_ALLOW", () => {
  const state = reduceLifecycle(createInitialState(), { kind: "NOT_AN_EVENT" });
  assert.equal(state.state, "UNCERTAIN_ALLOW");
  assert.equal(state.observationEligible, false);
  assert.equal(state.networkAction, "ALLOW");
});

test("T-REDUCER-04 T-MULTI-01 assessment unknown dominates tabs and windows", () => {
  const state = reduceLifecycle(createInitialState(), snapshot([
    { key: "window:1/tab:1", phase: "recognized", assessment: "not_suspected" },
    { key: "window:2/tab:8", phase: "recognized", assessment: "unknown" },
  ]));
  assert.equal(state.state, "ASSESSMENT_SAFE");
  assert.equal(state.recognizedCount, 2);
  assert.equal(state.observationEligible, false);
});

test("T-MULTI-02 T-MULTI-03 membership is reference counted", () => {
  let state = reduceLifecycle(createInitialState(), snapshot([
    { key: "tab:1", phase: "recognized", assessment: "not_suspected" },
    { key: "tab:2", phase: "recognized", assessment: "not_suspected" },
  ]));
  assert.equal(state.recognizedCount, 2);
  state = reduceLifecycle(state, { kind: "TAB_REMOVED", key: "tab:1", nowMonotonic: 11 });
  assert.equal(state.state, "ACTIVE_OBSERVE");
  assert.equal(state.recognizedCount, 1);
  state = reduceLifecycle(state, { kind: "TAB_REMOVED", key: "tab:404", nowMonotonic: 12 });
  assert.equal(state.state, "UNCERTAIN_ALLOW");
});

test("T-PRIVATE-01 T-PRIVATE-02 private surfaces never enter state", () => {
  const state = reduceLifecycle(createInitialState(), snapshot([
    { key: "private:1", phase: "recognized", assessment: "not_suspected", private: true },
  ]));
  assert.equal(state.state, "IDLE");
  assert.deepEqual(state.surfaces, {});
});

test("T-RESTART-01 T-RESTART-02 wake discards globals and requires reconstruction", () => {
  let state = reduceLifecycle(createInitialState(), snapshot([
    { key: "tab:1", phase: "recognized", assessment: "not_suspected" },
  ]));
  assert.equal(state.state, "ACTIVE_OBSERVE");
  state = reduceLifecycle(state, { kind: "WAKE", nowMonotonic: 20 });
  assert.equal(state.state, "INITIALIZING_ALLOW");
  assert.deepEqual(state.surfaces, {});
  assert.equal(state.observationEligible, false);
});

test("T-DISABLE-01 T-DISABLE-02 disable and explicit re-enable reconstruct", () => {
  let state = reduceLifecycle(createInitialState(), snapshot([
    { key: "tab:1", phase: "recognized", assessment: "not_suspected" },
  ]));
  state = reduceLifecycle(state, { kind: "DISABLE", ruleStateEmpty: true, nowMonotonic: 20 });
  assert.equal(state.state, "DISABLED");
  assert.deepEqual(state.surfaces, {});
  state = reduceLifecycle(state, { kind: "REENABLE", nowMonotonic: 21 });
  assert.equal(state.state, "INITIALIZING_ALLOW");
});

test("T-SSO-01 T-SSO-02 SSO transit is finite, isolated, and never identity evidence", () => {
  const transit = { key: "tab:1", phase: "transit", assessment: "not_suspected", transitDeadline: 300_000 };
  let state = reduceLifecycle(createInitialState(), snapshot([
    { key: "tab:1", phase: "recognized", assessment: "not_suspected" },
  ], { nowMonotonic: 1 }));
  state = reduceLifecycle(state, { kind: "TAB_COMMITTED", surface: transit, nowMonotonic: 2 });
  assert.equal(state.state, "SSO_TRANSIT");
  const loop = reduceLifecycle(state, { kind: "TAB_COMMITTED", surface: transit, nowMonotonic: 10 });
  assert.equal(loop.surfaces["tab:1"].transitDeadline, 300_000);

  const success = reduceLifecycle(state, {
    kind: "TAB_COMMITTED",
    surface: { key: "tab:1", phase: "recognized", assessment: "not_suspected" },
    nowMonotonic: 20,
  });
  assert.equal(success.state, "ACTIVE_OBSERVE");

  const cancelled = reduceLifecycle(state, { kind: "TAB_REMOVED", key: "tab:1", nowMonotonic: 20 });
  assert.equal(cancelled.state, "IDLE");
  const redirectedAway = reduceLifecycle(state, snapshot([], { nowMonotonic: 20 }));
  assert.equal(redirectedAway.state, "IDLE");
  const popup = reduceLifecycle(state, {
    kind: "TAB_CREATED",
    surface: { key: "tab:popup", phase: "candidate", assessment: "unknown" },
    nowMonotonic: 20,
  });
  assert.equal(popup.surfaces["tab:popup"].phase, "candidate");
  assert.equal(popup.recognizedCount, 0);

  const timedOut = reduceLifecycle(state, snapshot([transit], { nowMonotonic: 300_001 }));
  assert.equal(timedOut.state, "IDLE");
  const afterWake = reduceLifecycle(state, { kind: "WAKE", nowMonotonic: 21 });
  assert.deepEqual(afterWake.surfaces, {});
  assert.equal(afterWake.state, "INITIALIZING_ALLOW");
  for (const result of [state, loop, success, cancelled, redirectedAway, popup, timedOut, afterWake]) {
    assert.equal(result.networkAction, "ALLOW");
  }
});

test("T-ASSESS-01 Classic-like, New-like, external-frame, unknown, and changed routes suspend observation", () => {
  for (const assessment of ["suspected", "unknown"]) {
    const state = reduceLifecycle(createInitialState(), snapshot([
      { key: `tab:${assessment}`, phase: "recognized", assessment },
    ]));
    assert.equal(state.state, "ASSESSMENT_SAFE");
  }
  const externalFrame = classifyRedacted({
    ...ACTIVE_INPUT,
    destinationClass: "external_tool",
    initiatorRelation: "enrolled_child_frame",
  });
  assert.equal(externalFrame.eventClass, "assessment");
  assert.equal(externalFrame.suspendObservation, true);

  let changed = reduceLifecycle(createInitialState(), snapshot([
    { key: "tab:1", phase: "recognized", assessment: "not_suspected" },
  ]));
  for (const routeStyle of ["suspected", "unknown"]) {
    changed = reduceLifecycle(changed, {
      kind: "FRAME_CLASS_CHANGED",
      surface: { key: "tab:1", phase: "recognized", assessment: routeStyle },
      nowMonotonic: 12,
    });
    assert.equal(changed.state, "ASSESSMENT_SAFE");
  }
});

test("T-REDUCER-05 T-REDUCER-06 authoritative snapshots converge byte-identically", () => {
  const finalSnapshot = snapshot([
    { key: "tab:1", phase: "recognized", assessment: "not_suspected" },
    { key: "tab:2", phase: "recognized", assessment: "not_suspected" },
  ]);
  const paths = [
    [
      { kind: "TAB_COMMITTED", surface: finalSnapshot.surfaces[0] },
      { kind: "TAB_COMMITTED", surface: finalSnapshot.surfaces[1] },
    ],
    [
      { kind: "TAB_COMMITTED", surface: finalSnapshot.surfaces[1] },
      { kind: "TAB_COMMITTED", surface: finalSnapshot.surfaces[1] },
      { kind: "TAB_COMMITTED", surface: finalSnapshot.surfaces[0] },
    ],
    [],
  ];
  const canonical = paths.map((events) => {
    let state = reduceLifecycle(createInitialState(), snapshot([]));
    for (const event of events) state = reduceLifecycle(state, { ...event, nowMonotonic: 9 });
    return JSON.stringify(reduceLifecycle(state, finalSnapshot));
  });
  assert.equal(new Set(canonical).size, 1);
  assert.equal(JSON.stringify(reduceLifecycle(createInitialState(), finalSnapshot)), canonical[0]);
});

test("T-CLASSIFIER-01 through T-CLASSIFIER-04 protected and ambiguous classes are never alterable", () => {
  const cases = [
    ["assessment_suspected", "assessment"],
    ["authentication", "authentication_sso"],
    ["autosave_or_submission", "autosave_submission"],
    ["security", "security"],
    ["course_or_navigation", "essential"],
    ["unknown", "unknown"],
  ];
  for (const [pathClass, eventClass] of cases) {
    const result = classifyRedacted({ ...ACTIVE_INPUT, pathClass });
    assert.equal(result.eventClass, eventClass);
    assert.equal(result.networkAction, "ALLOW");
    assert.equal(result.futureRule, null);
    if (pathClass === "assessment_suspected") {
      assert.equal(result.observationAction, "REDACTED_RECORD");
      assert.equal(result.suspendObservation, true);
    }
  }
  const stale = classifyRedacted({ ...ACTIVE_INPUT, classifierRevision: "stale" });
  assert.deepEqual({ eventClass: stale.eventClass, action: stale.networkAction, observation: stale.observationAction }, {
    eventClass: "unknown", action: "ALLOW", observation: "SKIP",
  });
  const sameOriginOptional = classifyRedacted({ ...ACTIVE_INPUT, pathClass: "optional_candidate" }, { optionalCandidateAccepted: true });
  assert.equal(sameOriginOptional.eventClass, "unknown");
  const unrelatedOptional = classifyRedacted({
    ...ACTIVE_INPUT,
    destinationClass: "separate_third_party",
    pathClass: "optional_candidate",
    initiatorRelation: "unknown",
  }, { optionalCandidateAccepted: true });
  assert.equal(unrelatedOptional.eventClass, "unknown");
  const extraRawField = classifyRedacted({ ...ACTIVE_INPUT, url: "https://forbidden.test.invalid" });
  assert.equal(extraRawField.eventClass, "unknown");
  assert.equal(extraRawField.observationAction, "SKIP");
  for (const batchedPath of ["assessment_suspected", "autosave_or_submission", "security", "unknown"]) {
    assert.notEqual(classifyRedacted({ ...ACTIVE_INPUT, pathClass: batchedPath }).eventClass, "optional_separable");
  }
});

test("T-RETENTION-01 cap, boundary, and expiry are deterministic", () => {
  const base = Date.parse("2026-01-01T00:00:00Z");
  let rows = [];
  for (let index = 0; index < 501; index += 1) {
    rows = insertRecord(rows, {
      observedTimeBucket: new Date(base + index * 15 * 60 * 1000).toISOString().replace(".000Z", "Z"),
      retentionExpiresAtBucket: new Date(base + index * 15 * 60 * 1000 + 24 * 60 * 60 * 1000).toISOString().replace(".000Z", "Z"),
      index,
    }, base);
  }
  assert.equal(rows.length, 500);
  assert.equal(rows[0].index, 1);
  assert.deepEqual(pruneRecords(rows, Date.parse(rows.at(-1).retentionExpiresAtBucket)), []);
});
