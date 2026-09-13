// Copyright © 2026 Rolando Carreon. All rights reserved.

import {
  CANVAS_CLOUD_OPTIONAL_PATTERN,
  exactPermissionPattern,
  exactSupportedCanvasOriginFromPermissionPattern,
  hasExactPermission,
  PROTOTYPE_ORIGINS,
  supportedCanvasOriginFromUrl,
} from "../shared/origin.mjs";

const extensionApi = globalThis.browser || globalThis.chrome;
const runtime = extensionApi?.runtime;

export function canvasOriginFromUrl(value) {
  const origin = supportedCanvasOriginFromUrl(value);
  return origin?.endsWith(".instructure.com") ? origin : null;
}

async function readPermissionOrigins(api) {
  const permissions = await api.permissions.getAll();
  if (!Array.isArray(permissions?.origins)) throw new Error("INVALID_PERMISSION_READBACK");
  return permissions.origins;
}

function hostedResidualCount(permissionOrigins, enrolledOrigin) {
  return new Set(permissionOrigins.filter((pattern) => {
    if (pattern === CANVAS_CLOUD_OPTIONAL_PATTERN) return true;
    const origin = exactSupportedCanvasOriginFromPermissionPattern(pattern);
    return (
      origin !== null &&
      origin !== PROTOTYPE_ORIGINS[0] &&
      origin !== enrolledOrigin
    );
  })).size;
}

async function removeWithReadback(api, origin) {
  try {
    await api.permissions.remove({ origins: [exactPermissionPattern(origin)] });
  } catch {
    // The API may fail after applying the change, so authoritative readback decides.
  }
  return !hasExactPermission(origin, await readPermissionOrigins(api));
}

async function readView(runtimeApi) {
  const response = await runtimeApi.sendMessage({ command: "GET_VIEW" });
  if (!response?.ok || !response.view) throw new Error("VIEW_READBACK_FAILED");
  return response;
}

function failedResult(code, view, residualPermissionCount = 0) {
  return { ok: false, code, view, residualPermissionCount };
}

export async function switchCanvasOriginAccess(origin, api = extensionApi, runtimeApi = runtime) {
  const normalized = canvasOriginFromUrl(origin);
  if (!normalized || !api?.permissions || !runtimeApi?.sendMessage) {
    return failedResult("INVALID_CANVAS_ORIGIN", null);
  }

  let before;
  try {
    before = await readView(runtimeApi);
  } catch {
    return failedResult("PRIOR_ENROLLMENT_UNVERIFIED", null);
  }
  const priorOrigin = before.view.enrolledOrigin || null;
  const targetPattern = exactPermissionPattern(normalized);

  let granted = false;
  try {
    granted = await api.permissions.request({ origins: [targetPattern] });
  } catch {
    granted = false;
  }
  if (!granted) {
    let residualPermissionCount = 0;
    try {
      if (normalized !== priorOrigin && hasExactPermission(normalized, await readPermissionOrigins(api))) {
        const removed = await removeWithReadback(api, normalized);
        residualPermissionCount = removed ? 0 : 1;
      }
    } catch {
      residualPermissionCount = 1;
    }
    return failedResult("PERMISSION_NOT_GRANTED", before.view, residualPermissionCount);
  }

  let committed;
  try {
    committed = await runtimeApi.sendMessage({ command: "ENROLL_ORIGIN", origin: normalized });
  } catch {
    committed = null;
  }
  if (!committed?.ok || committed.view?.enrolledOrigin !== normalized) {
    let residualPermissionCount = 0;
    try {
      if (normalized !== priorOrigin && !(await removeWithReadback(api, normalized))) {
        residualPermissionCount = 1;
      }
    } catch {
      residualPermissionCount = 1;
    }
    let rollbackView = committed?.view || before.view;
    try {
      const reconciledRollback = await runtimeApi.sendMessage({ command: "RECONCILE_PERMISSIONS" });
      rollbackView = reconciledRollback?.view || (await readView(runtimeApi)).view;
      residualPermissionCount = hostedResidualCount(
        await readPermissionOrigins(api),
        rollbackView.enrolledOrigin || null,
      );
    } catch {
      // Preserve the last verified view when a fresh readback is unavailable.
    }
    return failedResult(
      committed?.code || "ENROLLMENT_COMMIT_FAILED",
      rollbackView,
      residualPermissionCount,
    );
  }

  if (priorOrigin && priorOrigin !== normalized) {
    try {
      await removeWithReadback(api, priorOrigin);
    } catch {
      // The adapter reconciliation and final readback below resolve or report it.
    }
  }

  let reconciled;
  try {
    reconciled = await runtimeApi.sendMessage({ command: "RECONCILE_PERMISSIONS" });
  } catch {
    reconciled = null;
  }
  let permissionOrigins = [];
  try {
    permissionOrigins = await readPermissionOrigins(api);
  } catch {
    return failedResult("PERMISSION_READBACK_FAILED", reconciled?.view || committed.view, 1);
  }
  const targetPresent = hasExactPermission(normalized, permissionOrigins);
  const residualPermissionCount = hostedResidualCount(permissionOrigins, normalized);
  if (
    reconciled?.ok &&
    reconciled.view?.enrolledOrigin === normalized &&
    targetPresent &&
    residualPermissionCount === 0
  ) {
    return { ok: true, view: reconciled.view, residualPermissionCount: 0 };
  }

  if (!targetPresent && priorOrigin && hasExactPermission(priorOrigin, permissionOrigins)) {
    try {
      const rollback = await runtimeApi.sendMessage({ command: "ENROLL_ORIGIN", origin: priorOrigin });
      if (rollback?.ok && rollback.view?.enrolledOrigin === priorOrigin) {
        await removeWithReadback(api, normalized);
        const rollbackReconciled = await runtimeApi.sendMessage({ command: "RECONCILE_PERMISSIONS" });
        const rollbackPermissionOrigins = await readPermissionOrigins(api);
        return failedResult(
          "TARGET_PERMISSION_MISSING",
          rollbackReconciled?.view || rollback.view,
          hostedResidualCount(rollbackPermissionOrigins, priorOrigin),
        );
      }
    } catch {
      // Fall through to a truthful residual/unverified result.
    }
  }
  return failedResult(
    residualPermissionCount > 0 ? "RESIDUAL_PERMISSION" : "ENROLLMENT_RECONCILIATION_FAILED",
    reconciled?.view || committed.view,
    residualPermissionCount,
  );
}

export async function removeCanvasOriginAccess(api = extensionApi, runtimeApi = runtime) {
  let before;
  try {
    before = await readView(runtimeApi);
  } catch {
    return failedResult("PRIOR_ENROLLMENT_UNVERIFIED", null);
  }
  const priorOrigin = before.view.enrolledOrigin || null;
  let committed;
  try {
    committed = await runtimeApi.sendMessage({ command: "REMOVE_ENROLLMENT" });
  } catch {
    committed = null;
  }
  if (!committed?.ok || committed.view?.enrolledOrigin !== null) {
    return failedResult(committed?.code || "ENROLLMENT_REMOVAL_FAILED", committed?.view || before.view);
  }

  let priorPermissionRemoved = priorOrigin === null;
  let removalReadbackFailed = false;
  if (priorOrigin) {
    try {
      priorPermissionRemoved = await removeWithReadback(api, priorOrigin);
    } catch {
      removalReadbackFailed = true;
    }
  }
  if (!priorPermissionRemoved) {
    try {
      const rollback = await runtimeApi.sendMessage({ command: "ENROLL_ORIGIN", origin: priorOrigin });
      if (rollback?.ok && rollback.view?.enrolledOrigin === priorOrigin) {
        return failedResult(
          removalReadbackFailed ? "PERMISSION_READBACK_FAILED" : "PERMISSION_REMOVAL_FAILED",
          rollback.view,
          removalReadbackFailed ? 1 : 0,
        );
      }
    } catch {
      // Reconciliation below reports any remaining exact grant.
    }
  }

  let reconciled;
  try {
    reconciled = await runtimeApi.sendMessage({ command: "RECONCILE_PERMISSIONS" });
  } catch {
    reconciled = null;
  }
  let permissionOrigins;
  try {
    permissionOrigins = await readPermissionOrigins(api);
  } catch {
    return failedResult("PERMISSION_READBACK_FAILED", reconciled?.view || committed.view, 1);
  }
  const residualPermissionCount = hostedResidualCount(permissionOrigins, null);
  if (reconciled?.ok && reconciled.view?.enrolledOrigin === null && residualPermissionCount === 0) {
    return { ok: true, view: reconciled.view, residualPermissionCount: 0 };
  }
  return failedResult("RESIDUAL_PERMISSION", reconciled?.view || committed.view, residualPermissionCount);
}

function text(id, value) {
  document.getElementById(id).textContent = String(value);
}

function render(view) {
  text("state-code", view.state);
  text("state-title", view.title);
  text("state-detail", view.detail);
  text("traffic-statement", view.trafficStatement);
  text("reason-code", view.reasonCode);
  text("toggle-disabled", view.disableLabel);
  text("enrolled-origin", view.enrolledOrigin || "None");
  text("residual-permission-count", Number.isInteger(view.residualPermissionCount)
    ? view.residualPermissionCount
    : 0);
  text("blocking-rule-count", Number.isInteger(view.blockingRuleCount) ? view.blockingRuleCount : 0);

  const body = document.getElementById("activity-body");
  body.replaceChildren();
  for (const record of view.activity) {
    const row = document.createElement("tr");
    for (const value of [
      record.observedTimeBucket,
      record.eventClass,
      record.pathClass,
      record.destinationClass,
      record.resourceType,
      record.networkAction,
    ]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    body.append(row);
  }
  text(
    "activity-caption",
    view.activity.length === 0
      ? "No local activity records"
      : `${view.activity.length} redacted local record${view.activity.length === 1 ? "" : "s"}`,
  );
}

async function send(command) {
  text("action-result", "Working…");
  try {
    const response = await runtime.sendMessage({ command });
    if (!response?.ok) {
      text("action-result", `Action not confirmed: ${response?.code || "UNKNOWN_ERROR"}`);
      if (response?.view) render(response.view);
      return;
    }
    render(response.view);
    text("action-result", "Local action confirmed by readback.");
  } catch {
    text("action-result", "Action not confirmed: ADAPTER_ERROR");
  }
}

async function enrollCurrentCanvasOrigin() {
  text("action-result", "Checking the active tab…");
  try {
    const tabs = await extensionApi.tabs.query({ active: true, currentWindow: true });
    const origin = canvasOriginFromUrl(tabs?.[0]?.url);
    if (!origin) {
      text("action-result", "Open the exact institution Canvas tab (*.instructure.com), then try again.");
      return;
    }
    const result = await switchCanvasOriginAccess(origin);
    if (!result.ok) {
      if (result.view) render(result.view);
      const residual = result.residualPermissionCount > 0
        ? ` ${result.residualPermissionCount} residual or unverified exact permission remains; observation is not confirmed.`
        : "";
      text("action-result", `Enrollment not confirmed: ${result.code}.${residual}`);
      return;
    }
    render(result.view);
    text("action-result", `Exact-origin access granted and read back for ${origin}.`);
  } catch {
    text("action-result", "Canvas-origin access was not changed: ADAPTER_ERROR");
  }
}

async function removeCanvasOrigin() {
  text("action-result", "Removing exact-origin access…");
  try {
    const result = await removeCanvasOriginAccess();
    if (!result.ok) {
      if (result.view) render(result.view);
      const residual = result.residualPermissionCount > 0
        ? ` ${result.residualPermissionCount} residual or unverified exact permission remains.`
        : " Previous enrollment was preserved.";
      text("action-result", `Enrollment removal not confirmed: ${result.code}.${residual}`);
      return;
    }
    render(result.view);
    text("action-result", "Canvas-origin enrollment and exact permission were removed.");
  } catch {
    text("action-result", "Canvas-origin access may not be fully removed; use browser extension settings to revoke site access.");
  }
}

if (typeof document !== "undefined") {
  document.getElementById("toggle-disabled").addEventListener("click", () => send("TOGGLE_DISABLED"));
  document.getElementById("delete-activity").addEventListener("click", () => send("DELETE_ACTIVITY"));
  document.getElementById("enroll-origin").addEventListener("click", enrollCurrentCanvasOrigin);
  document.getElementById("remove-origin").addEventListener("click", removeCanvasOrigin);
  void send("GET_VIEW");
}
