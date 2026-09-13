// Copyright © 2026 Rolando Carreon. All rights reserved.

import {
  ASSESSMENT_STATES,
  EVENT_KINDS,
  NETWORK_ACTION,
  SSO_TRANSIT_MS,
  STATES,
} from "./constants.mjs";

function cleanSurface(surface, nowMonotonic) {
  if (!surface || typeof surface !== "object" || typeof surface.key !== "string") return null;
  if (surface.private === true) return null;
  const phase = ["recognized", "transit", "candidate"].includes(surface.phase)
    ? surface.phase
    : null;
  if (!phase) return null;
  const assessment = ASSESSMENT_STATES.includes(surface.assessment)
    ? surface.assessment
    : "unknown";
  const deadline = Number.isFinite(surface.transitDeadline)
    ? surface.transitDeadline
    : nowMonotonic + SSO_TRANSIT_MS;
  return {
    key: surface.key,
    phase,
    assessment,
    transitDeadline: phase === "transit" ? deadline : 0,
  };
}

function copyState(state) {
  return {
    ...state,
    surfaces: Object.fromEntries(
      Object.entries(state.surfaces || {}).map(([key, value]) => [key, { ...value }]),
    ),
  };
}

export function createInitialState() {
  return deriveState({
    disabled: false,
    reconciled: false,
    inconsistent: false,
    enrollmentValid: false,
    permissionValid: false,
    ruleStateEmpty: true,
    surfaces: {},
    lastReasonCode: "STARTING_SAFE",
    state: "INITIALIZING_ALLOW",
    networkAction: NETWORK_ACTION,
  });
}

export function deriveState(input, nowMonotonic = 0) {
  const state = copyState(input);
  let visibleState;
  let reasonCode;

  if (state.disabled) {
    visibleState = "DISABLED";
    reasonCode = "USER_DISABLED";
  } else if (!state.reconciled) {
    visibleState = "INITIALIZING_ALLOW";
    reasonCode = "RECONCILIATION_REQUIRED";
  } else if (state.inconsistent || !state.ruleStateEmpty) {
    visibleState = "UNCERTAIN_ALLOW";
    reasonCode = state.lastReasonCode || "INCONSISTENT_STATE";
  } else if (!state.enrollmentValid || !state.permissionValid) {
    visibleState = "NO_PERMISSION";
    reasonCode = "EXACT_PERMISSION_REQUIRED";
  } else {
    const surfaces = Object.values(state.surfaces);
    const assessmentDominates = surfaces.some(
      (surface) =>
        (surface.phase === "recognized" || surface.phase === "transit") &&
        surface.assessment !== "not_suspected",
    );
    const recognizedCount = surfaces.filter((surface) => surface.phase === "recognized").length;
    const transitCount = surfaces.filter(
      (surface) => surface.phase === "transit" && surface.transitDeadline > nowMonotonic,
    ).length;
    const candidateCount = surfaces.filter((surface) => surface.phase === "candidate").length;

    if (assessmentDominates) {
      visibleState = "ASSESSMENT_SAFE";
      reasonCode = "ASSESSMENT_UNKNOWN_OR_SUSPECTED";
    } else if (recognizedCount > 0) {
      visibleState = "ACTIVE_OBSERVE";
      reasonCode = "EXACT_SURFACE_ACTIVE";
    } else if (transitCount > 0) {
      visibleState = "SSO_TRANSIT";
      reasonCode = "SSO_TRANSIT_PAUSED";
    } else if (candidateCount > 0) {
      visibleState = "CANDIDATE";
      reasonCode = "CHECKING_EXACT_ORIGIN";
    } else {
      visibleState = "IDLE";
      reasonCode = "NO_ENROLLED_SURFACE";
    }
  }

  const recognizedCount = Object.values(state.surfaces).filter(
    (surface) => surface.phase === "recognized",
  ).length;
  return {
    ...state,
    state: visibleState,
    reasonCode,
    recognizedCount,
    observationEligible: visibleState === "ACTIVE_OBSERVE",
    networkAction: NETWORK_ACTION,
  };
}

export function reduceLifecycle(current, event) {
  const state = copyState(current);
  const nowMonotonic = Number.isFinite(event?.nowMonotonic) ? event.nowMonotonic : 0;
  if (!event || typeof event !== "object" || !EVENT_KINDS.includes(event.kind)) {
    return deriveState({
      ...state,
      reconciled: true,
      inconsistent: true,
      surfaces: {},
      lastReasonCode: "UNKNOWN_EVENT",
    }, nowMonotonic);
  }

  switch (event.kind) {
    case "START":
    case "WAKE":
    case "INSTALL":
    case "UPDATE":
      return deriveState({
        ...state,
        reconciled: false,
        inconsistent: false,
        surfaces: {},
        lastReasonCode: "RECONCILIATION_REQUIRED",
      }, nowMonotonic);
    case "SUSPEND":
    case "SHUTDOWN":
      return {
        ...deriveState({ ...state, reconciled: false, surfaces: {} }, nowMonotonic),
        state: "STOPPING",
        reasonCode: "STOPPING_SAFE",
        observationEligible: false,
        networkAction: NETWORK_ACTION,
      };
    case "DISABLE":
      return deriveState({
        ...state,
        disabled: true,
        reconciled: true,
        surfaces: {},
        ruleStateEmpty: event.ruleStateEmpty === true,
        inconsistent: event.ruleStateEmpty !== true,
        lastReasonCode: event.ruleStateEmpty === true ? "USER_DISABLED" : "RULE_READBACK_MISMATCH",
      }, nowMonotonic);
    case "REENABLE":
      return deriveState({
        ...state,
        disabled: false,
        reconciled: false,
        surfaces: {},
        lastReasonCode: "RECONCILIATION_REQUIRED",
      }, nowMonotonic);
    case "PERMISSION_SNAPSHOT":
    case "PERMISSION_ADDED":
      return deriveState({
        ...state,
        permissionValid: event.permissionValid === true,
        enrollmentValid: event.enrollmentValid === true,
        inconsistent: false,
      }, nowMonotonic);
    case "PERMISSION_REMOVED":
    case "REMOVE_ORIGIN":
      return deriveState({
        ...state,
        permissionValid: false,
        enrollmentValid: event.kind === "REMOVE_ORIGIN" ? false : state.enrollmentValid,
        reconciled: true,
        surfaces: {},
      }, nowMonotonic);
    case "ENROLL_ORIGIN":
      return deriveState({ ...state, reconciled: false, surfaces: {} }, nowMonotonic);
    case "TAB_SNAPSHOT": {
      const surfaces = {};
      let invalid = false;
      for (const rawSurface of Array.isArray(event.surfaces) ? event.surfaces : []) {
        if (rawSurface?.private === true) continue;
        const surface = cleanSurface(rawSurface, nowMonotonic);
        if (!surface || surfaces[surface.key]) {
          invalid = true;
          continue;
        }
        surfaces[surface.key] = surface;
      }
      return deriveState({
        ...state,
        disabled: event.disabled === true,
        reconciled: true,
        inconsistent: invalid || event.consistent !== true || event.ruleStateEmpty !== true,
        enrollmentValid: event.enrollmentValid === true,
        permissionValid: event.permissionValid === true,
        ruleStateEmpty: event.ruleStateEmpty === true,
        surfaces,
        lastReasonCode: invalid ? "INVALID_SNAPSHOT" : event.reasonCode || "SNAPSHOT_RECONCILED",
      }, nowMonotonic);
    }
    case "TAB_CREATED":
    case "TAB_COMMITTED":
    case "FRAME_CLASS_CHANGED": {
      const surface = cleanSurface(event.surface, nowMonotonic);
      if (!surface) {
        return deriveState({ ...state, inconsistent: true, lastReasonCode: "INVALID_SURFACE_EVENT" }, nowMonotonic);
      }
      state.surfaces[surface.key] = surface;
      return deriveState(state, nowMonotonic);
    }
    case "TAB_REMOVED":
    case "WINDOW_REMOVED": {
      if (typeof event.key !== "string" || !(event.key in state.surfaces)) {
        return deriveState({ ...state, inconsistent: true, lastReasonCode: "UNKNOWN_REMOVAL" }, nowMonotonic);
      }
      delete state.surfaces[event.key];
      return deriveState(state, nowMonotonic);
    }
    case "TAB_REPLACED": {
      if (typeof event.oldKey !== "string" || !(event.oldKey in state.surfaces)) {
        return deriveState({ ...state, inconsistent: true, lastReasonCode: "UNKNOWN_REPLACEMENT" }, nowMonotonic);
      }
      delete state.surfaces[event.oldKey];
      const replacement = cleanSurface(event.surface, nowMonotonic);
      if (!replacement) {
        return deriveState({ ...state, inconsistent: true, lastReasonCode: "INVALID_REPLACEMENT" }, nowMonotonic);
      }
      state.surfaces[replacement.key] = replacement;
      return deriveState(state, nowMonotonic);
    }
    case "DELETE_ACTIVITY":
      return deriveState({
        ...state,
        inconsistent: event.readbackEmpty !== true,
        lastReasonCode: event.readbackEmpty === true ? state.lastReasonCode : "DELETE_READBACK_FAILED",
      }, nowMonotonic);
    case "ADAPTER_ERROR":
    case "SCHEMA_ERROR":
    case "STORAGE_ERROR":
    case "RULE_READBACK_MISMATCH":
      return deriveState({
        ...state,
        reconciled: true,
        inconsistent: true,
        surfaces: {},
        ruleStateEmpty: event.kind === "RULE_READBACK_MISMATCH" ? false : state.ruleStateEmpty,
        lastReasonCode: event.kind,
      }, nowMonotonic);
    default:
      return deriveState({ ...state, inconsistent: true, lastReasonCode: "UNKNOWN_EVENT" }, nowMonotonic);
  }
}

export function isKnownState(value) {
  return STATES.includes(value);
}
