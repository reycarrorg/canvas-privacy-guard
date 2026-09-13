// Copyright © 2026 Rolando Carreon. All rights reserved.

import { classifyRedacted } from "./classifier.mjs";
import { NETWORK_ACTION } from "./constants.mjs";
import {
  exactPermissionPattern,
  hasExactPermission,
  isPrototypeOrigin,
  normalizeExactHttpsOrigin,
  PROTOTYPE_ORIGINS,
} from "./origin.mjs";
import { makeRecord, isValidRecord } from "./record.mjs";
import { reduceLifecycle, createInitialState } from "./reducer.mjs";
import { minimizeRawRequest, pathClassFromUrl } from "./request-redactor.mjs";
import { insertRecord, pruneRecords } from "./retention.mjs";
import { makeViewModel } from "./view-model.mjs";

const SETTINGS_KEY = "gate2Settings";
const ACTIVITY_KEY = "gate2Activity";
const RETENTION_ALARM = "gate2-retention";
const CANVAS_ORIGIN = PROTOTYPE_ORIGINS[0];
const OPTIONAL_ORIGIN = PROTOTYPE_ORIGINS[1];
const IDENTITY_ORIGIN = "https://idp.test.invalid";

function callApi(owner, name, ...args) {
  if (!owner || typeof owner[name] !== "function") return Promise.reject(new Error("API_UNAVAILABLE"));
  try {
    const result = owner[name](...args);
    return result && typeof result.then === "function" ? result : Promise.resolve(result);
  } catch {
    return Promise.reject(new Error("API_FAILURE"));
  }
}

function assessmentFromPath(pathClass) {
  if (pathClass === "assessment_suspected") return "suspected";
  if (["static_asset", "course_or_navigation"].includes(pathClass)) return "not_suspected";
  return "unknown";
}

function surfaceFromTab(tab, enrolledOrigins, nowMonotonic) {
  if (
    !tab ||
    !Number.isInteger(tab.id) ||
    tab.incognito === true ||
    typeof tab.url !== "string"
  ) return null;
  try {
    const parsed = new URL(tab.url);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      !enrolledOrigins.includes(parsed.origin)
    ) return null;
    const pathClass = pathClassFromUrl(parsed, "enrolled_canvas_origin");
    return {
      key: `tab:${String(tab.id)}`,
      phase: "recognized",
      assessment: assessmentFromPath(pathClass),
      transitDeadline: nowMonotonic,
    };
  } catch {
    return null;
  }
}

function validatedSettings(raw) {
  if (raw === undefined) return { disabled: false, enrolledOrigins: [], schemaVersion: 1 };
  if (!raw || typeof raw !== "object" || raw.schemaVersion !== 1 || typeof raw.disabled !== "boolean") {
    return null;
  }
  if (!Array.isArray(raw.enrolledOrigins) || !raw.enrolledOrigins.every(isPrototypeOrigin)) return null;
  const normalized = [...new Set(raw.enrolledOrigins.map(normalizeExactHttpsOrigin))].sort();
  return { disabled: raw.disabled, enrolledOrigins: normalized, schemaVersion: 1 };
}

export function createObservationAdapter(browserApi, browserFamily, options = {}) {
  if (!["firefox", "chromium", "synthetic"].includes(browserFamily)) {
    throw new Error("UNSUPPORTED_BROWSER_FAMILY");
  }

  let coreState = createInitialState();
  let enrolledOrigins = [];
  let requestObserverAttached = false;
  let started = false;
  let reconstructionVersion = 0;
  let observationGeneration = 0;
  let activityQueue = Promise.resolve();
  let committedActivity = [];
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const monotonic = typeof options.monotonic === "function" ? options.monotonic : () => performance.now();
  const readProspectiveRules = typeof options.readProspectiveRules === "function"
    ? options.readProspectiveRules
    : async () => [];

  function dispatch(event) {
    coreState = reduceLifecycle(coreState, event);
    syncRequestObserver();
    return coreState;
  }

  function enqueueActivity(operation) {
    const result = activityQueue.then(operation);
    activityQueue = result.catch(() => undefined);
    return result;
  }

  function beginPrivacyAction() {
    reconstructionVersion += 1;
    observationGeneration += 1;
    detachRequestObserver();
    return structuredClone(committedActivity);
  }

  async function restoreActivityBaseline(baseline) {
    await enqueueActivity(async () => {
      if (baseline.length === 0) {
        await callApi(browserApi.storage.local, "remove", ACTIVITY_KEY);
      } else {
        await callApi(browserApi.storage.local, "set", { [ACTIVITY_KEY]: baseline });
      }
      committedActivity = structuredClone(baseline);
      await scheduleRetention(baseline);
    });
  }

  function suspendSurface(key, assessment) {
    const surface = key ? coreState.surfaces[key] : null;
    if (!surface || surface.phase !== "recognized") {
      enterFault("ADAPTER_ERROR");
      return;
    }
    const baseline = structuredClone(committedActivity);
    observationGeneration += 1;
    detachRequestObserver();
    dispatch({
      kind: "FRAME_CLASS_CHANGED",
      surface: { ...surface, assessment },
      nowMonotonic: monotonic(),
    });
    void restoreActivityBaseline(baseline).catch(() => enterFault("STORAGE_ERROR"));
  }

  function detachRequestObserver() {
    if (!requestObserverAttached) return;
    browserApi.webRequest.onBeforeRequest.removeListener(onBeforeRequest);
    requestObserverAttached = false;
  }

  function syncRequestObserver() {
    const shouldAttach = coreState.observationEligible === true;
    if (!shouldAttach) {
      detachRequestObserver();
      return;
    }
    if (!requestObserverAttached) {
      browserApi.webRequest.onBeforeRequest.addListener(
        onBeforeRequest,
        { urls: [exactPermissionPattern(CANVAS_ORIGIN), exactPermissionPattern(OPTIONAL_ORIGIN)] },
      );
      requestObserverAttached = true;
    }
  }

  function enterFault(kind = "ADAPTER_ERROR") {
    reconstructionVersion += 1;
    observationGeneration += 1;
    detachRequestObserver();
    dispatch({ kind, nowMonotonic: monotonic() });
  }

  async function readActivity() {
    const stored = await callApi(browserApi.storage.local, "get", ACTIVITY_KEY);
    const current = stored?.[ACTIVITY_KEY];
    if (current !== undefined && (!Array.isArray(current) || !current.every(isValidRecord))) {
      throw new Error("INVALID_ACTIVITY");
    }
    const pruned = pruneRecords(current || [], now());
    if (JSON.stringify(pruned) !== JSON.stringify(current || [])) {
      await callApi(browserApi.storage.local, "set", { [ACTIVITY_KEY]: pruned });
    }
    committedActivity = structuredClone(pruned);
    await scheduleRetention(pruned);
    return pruned;
  }

  async function scheduleRetention(records) {
    const deadlines = records
      .map((record) => Date.parse(record.retentionExpiresAtBucket))
      .filter((deadline) => Number.isFinite(deadline) && deadline > now());
    if (deadlines.length === 0) {
      await callApi(browserApi.alarms, "clear", RETENTION_ALARM);
      return;
    }
    await callApi(browserApi.alarms, "create", RETENTION_ALARM, { when: Math.min(...deadlines) });
  }

  async function persistRecord(record, generation) {
    if (!isValidRecord(record) || record.networkAction !== NETWORK_ACTION) {
      enterFault("SCHEMA_ERROR");
      return;
    }
    try {
      if (generation !== observationGeneration) return;
      const activity = await readActivity();
      if (generation !== observationGeneration || !coreState.observationEligible) return;
      const next = insertRecord(activity, record, now());
      if (generation !== observationGeneration) return;
      await callApi(browserApi.storage.local, "set", { [ACTIVITY_KEY]: next });
      if (generation !== observationGeneration) return;
      committedActivity = structuredClone(next);
      await scheduleRetention(next);
    } catch {
      enterFault("STORAGE_ERROR");
    }
  }

  function onBeforeRequest(rawEvent) {
    let redacted = null;
    const generation = observationGeneration;
    try {
      const key = rawEvent && Number.isInteger(rawEvent.tabId) ? `tab:${rawEvent.tabId}` : null;
      const recognizedSurface = key !== null && coreState.surfaces[key]?.phase === "recognized";
      if (
        recognizedSurface &&
        (!Number.isInteger(rawEvent.parentFrameId) || rawEvent.parentFrameId < -1)
      ) {
        suspendSurface(key, "unknown");
        return undefined;
      }
      if (recognizedSurface && rawEvent.parentFrameId >= 0) {
        suspendSurface(key, "unknown");
        return undefined;
      }
      redacted = minimizeRawRequest(rawEvent, {
        active: coreState.observationEligible,
        recognizedSurface,
        canvasOrigin: CANVAS_ORIGIN,
        optionalOrigin: OPTIONAL_ORIGIN,
        identityOrigin: IDENTITY_ORIGIN,
        lifecycleState: coreState.state,
      });
    } catch {
      enterFault("ADAPTER_ERROR");
      return undefined;
    }
    if (!redacted) return undefined;

    const decision = classifyRedacted(redacted, { optionalCandidateAccepted: true });
    if (decision.suspendObservation) {
      const key = rawEvent && Number.isInteger(rawEvent.tabId) ? `tab:${rawEvent.tabId}` : null;
      suspendSurface(key, "suspected");
      return undefined;
    }
    if (decision.observationAction === "REDACTED_RECORD") {
      const record = makeRecord(redacted, decision, browserFamily, now());
      void enqueueActivity(() => persistRecord(record, generation));
    }
    return undefined;
  }

  async function reconstruct(kind = "WAKE") {
    const version = ++reconstructionVersion;
    observationGeneration += 1;
    detachRequestObserver();
    dispatch({ kind, nowMonotonic: monotonic() });
    try {
      const rules = await readProspectiveRules();
      const ruleStateEmpty = Array.isArray(rules) && rules.length === 0;
      const stored = await callApi(browserApi.storage.local, "get", SETTINGS_KEY);
      const settings = validatedSettings(stored?.[SETTINGS_KEY]);
      if (!settings) {
        dispatch({ kind: "STORAGE_ERROR", nowMonotonic: monotonic() });
        return coreState;
      }
      enrolledOrigins = settings.enrolledOrigins;
      await activityQueue;
      await readActivity();
      const permissions = await callApi(browserApi.permissions, "getAll");
      const permissionOrigins = Array.isArray(permissions?.origins) ? permissions.origins : [];
      const enrollmentValid = enrolledOrigins.length === 1 && enrolledOrigins[0] === CANVAS_ORIGIN;
      const permissionValid = enrollmentValid && hasExactPermission(CANVAS_ORIGIN, permissionOrigins);
      const tabs = await callApi(browserApi.tabs, "query", {});
      const surfaces = (Array.isArray(tabs) ? tabs : [])
        .map((tab) => surfaceFromTab(tab, enrolledOrigins, monotonic()))
        .filter(Boolean);
      if (version !== reconstructionVersion) return coreState;
      dispatch({
        kind: "TAB_SNAPSHOT",
        disabled: settings.disabled,
        enrollmentValid,
        permissionValid,
        consistent: true,
        ruleStateEmpty,
        surfaces,
        reasonCode: ruleStateEmpty ? "SNAPSHOT_RECONCILED" : "RULE_READBACK_MISMATCH",
        nowMonotonic: monotonic(),
      });
      return coreState;
    } catch {
      if (version === reconstructionVersion) enterFault("ADAPTER_ERROR");
      return coreState;
    }
  }

  async function handleTabChanged(tabId, tab) {
    try {
      if (!Number.isInteger(tabId) || tab?.id !== tabId) throw new Error("INVALID_TAB_EVENT");
      const surface = surfaceFromTab(tab, enrolledOrigins, monotonic());
      const key = `tab:${String(tabId)}`;
      if (surface) {
        const prior = coreState.surfaces[key];
        if (prior?.phase === "recognized" && prior.assessment !== "not_suspected") {
          surface.assessment = prior.assessment;
        }
        dispatch({ kind: "TAB_COMMITTED", surface, nowMonotonic: monotonic() });
      } else if (coreState.surfaces[key]) {
        dispatch({ kind: "TAB_REMOVED", key, nowMonotonic: monotonic() });
      }
    } catch {
      enterFault("ADAPTER_ERROR");
    }
  }

  async function setDisabled(disabled) {
    if (disabled) {
      const baseline = beginPrivacyAction();
      try {
        const stored = await callApi(browserApi.storage.local, "get", SETTINGS_KEY);
        const settings = validatedSettings(stored?.[SETTINGS_KEY]);
        if (!settings) throw new Error("INVALID_SETTINGS");
        await callApi(browserApi.storage.local, "set", {
          [SETTINGS_KEY]: { ...settings, disabled: true },
        });
        await restoreActivityBaseline(baseline);
        const rules = await readProspectiveRules();
        dispatch({ kind: "DISABLE", ruleStateEmpty: Array.isArray(rules) && rules.length === 0, nowMonotonic: monotonic() });
      } catch (error) {
        await restoreActivityBaseline(baseline);
        throw error;
      }
    } else {
      reconstructionVersion += 1;
      const stored = await callApi(browserApi.storage.local, "get", SETTINGS_KEY);
      const settings = validatedSettings(stored?.[SETTINGS_KEY]);
      if (!settings) throw new Error("INVALID_SETTINGS");
      await callApi(browserApi.storage.local, "set", {
        [SETTINGS_KEY]: { ...settings, disabled: false },
      });
      dispatch({ kind: "REENABLE", nowMonotonic: monotonic() });
      await reconstruct("WAKE");
    }
  }

  async function enrollSyntheticOrigin(enroll) {
    const baseline = beginPrivacyAction();
    const settings = {
      disabled: false,
      enrolledOrigins: enroll ? [CANVAS_ORIGIN] : [],
      schemaVersion: 1,
    };
    try {
      await callApi(browserApi.storage.local, "set", { [SETTINGS_KEY]: settings });
      await restoreActivityBaseline(baseline);
      await reconstruct("WAKE");
    } catch (error) {
      await restoreActivityBaseline(baseline);
      throw error;
    }
  }

  async function deleteActivity() {
    beginPrivacyAction();
    const readbackEmpty = await enqueueActivity(async () => {
      await callApi(browserApi.storage.local, "remove", ACTIVITY_KEY);
      await callApi(browserApi.alarms, "clear", RETENTION_ALARM);
      const readback = await callApi(browserApi.storage.local, "get", ACTIVITY_KEY);
      const empty = readback?.[ACTIVITY_KEY] === undefined;
      if (empty) committedActivity = [];
      return empty;
    });
    dispatch({ kind: "DELETE_ACTIVITY", readbackEmpty, nowMonotonic: monotonic() });
    return readbackEmpty;
  }

  async function handleMessage(message) {
    if (!message || typeof message !== "object") return { ok: false, code: "INVALID_COMMAND" };
    try {
      if (message.command === "GET_VIEW") {
        await activityQueue;
        const activity = await readActivity();
        return { ok: true, view: makeViewModel(coreState, activity) };
      }
      if (message.command === "TOGGLE_DISABLED") {
        await setDisabled(coreState.state !== "DISABLED");
      } else if (message.command === "DELETE_ACTIVITY") {
        if (!(await deleteActivity())) return { ok: false, code: "DELETE_READBACK_FAILED" };
      } else if (message.command === "ENROLL_SYNTHETIC") {
        await enrollSyntheticOrigin(true);
      } else if (message.command === "REMOVE_ENROLLMENT") {
        await enrollSyntheticOrigin(false);
      } else {
        return { ok: false, code: "UNKNOWN_COMMAND" };
      }
      await activityQueue;
      const activity = await readActivity();
      return { ok: true, view: makeViewModel(coreState, activity) };
    } catch {
      enterFault("ADAPTER_ERROR");
      return { ok: false, code: "ADAPTER_ERROR", view: makeViewModel(coreState, []) };
    }
  }

  function addBaseListeners() {
    browserApi.runtime.onStartup.addListener(() => void reconstruct("START"));
    browserApi.runtime.onInstalled.addListener((details) =>
      void reconstruct(details?.reason === "update" ? "UPDATE" : "INSTALL"));
    if (browserApi.runtime.onSuspend) {
      browserApi.runtime.onSuspend.addListener(() => {
        detachRequestObserver();
        dispatch({ kind: "SUSPEND", nowMonotonic: monotonic() });
      });
    }
    browserApi.permissions.onAdded.addListener(() => void reconstruct("WAKE"));
    browserApi.permissions.onRemoved.addListener(() => void reconstruct("WAKE"));
    browserApi.alarms.onAlarm.addListener((alarm) => {
      if (alarm?.name !== RETENTION_ALARM) return;
      void enqueueActivity(() => readActivity()).catch(() => enterFault("STORAGE_ERROR"));
    });
    browserApi.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => void handleTabChanged(tabId, tab));
    browserApi.tabs.onRemoved.addListener((tabId) => {
      const key = `tab:${String(tabId)}`;
      if (coreState.surfaces[key]) dispatch({ kind: "TAB_REMOVED", key, nowMonotonic: monotonic() });
    });
    browserApi.tabs.onReplaced.addListener(() => void reconstruct("WAKE"));
    browserApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      void handleMessage(message).then(sendResponse);
      return true;
    });
  }

  async function start() {
    if (started) return coreState;
    started = true;
    addBaseListeners();
    return reconstruct("WAKE");
  }

  return Object.freeze({
    start,
    reconstruct,
    handleMessage,
    handleTabChanged,
    getState: () => structuredClone(coreState),
    isRequestObserverAttached: () => requestObserverAttached,
    constants: Object.freeze({ CANVAS_ORIGIN, OPTIONAL_ORIGIN, IDENTITY_ORIGIN }),
  });
}
