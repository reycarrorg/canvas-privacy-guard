// Copyright © 2026 Rolando Carreon. All rights reserved.

const extensionApi = globalThis.browser || globalThis.chrome;
const runtime = extensionApi?.runtime;
let pendingAuditExport = null;

function canvasOriginFromUrl(value) {
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      !parsed.hostname.endsWith(".instructure.com")
    ) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function text(id, value) {
  document.getElementById(id).textContent = String(value);
}

function clearAuditPreview() {
  pendingAuditExport = null;
  const preview = document.getElementById("audit-preview");
  const json = document.getElementById("audit-preview-json");
  const save = document.getElementById("save-audit");
  preview.hidden = true;
  json.value = "";
  save.disabled = true;
}

function render(view) {
  clearAuditPreview();
  text("state-code", view.state);
  text("state-title", view.title);
  text("state-detail", view.detail);
  text("traffic-statement", view.trafficStatement);
  text("reason-code", view.reasonCode);
  text("toggle-disabled", view.disableLabel);
  text("enrolled-origin", view.enrolledOrigin || "None");
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
    const granted = await extensionApi.permissions.request({ origins: [`${origin}/*`] });
    if (!granted) {
      text("action-result", `Access was not granted for ${origin}.`);
      return;
    }
    const response = await runtime.sendMessage({ command: "ENROLL_ORIGIN", origin });
    if (!response?.ok) {
      await extensionApi.permissions.remove({ origins: [`${origin}/*`] });
      text("action-result", `Enrollment failed safely: ${response?.code || "UNKNOWN_ERROR"}`);
      if (response?.view) render(response.view);
      return;
    }
    render(response.view);
    text("action-result", `Exact-origin access granted and read back for ${origin}.`);
  } catch {
    text("action-result", "Canvas-origin access was not changed: ADAPTER_ERROR");
  }
}

async function removeCanvasOrigin() {
  text("action-result", "Removing exact-origin access…");
  try {
    const current = await runtime.sendMessage({ command: "GET_VIEW" });
    const origin = current?.view?.enrolledOrigin || null;
    const response = await runtime.sendMessage({ command: "REMOVE_ENROLLMENT" });
    if (!response?.ok) {
      text("action-result", `Enrollment removal failed safely: ${response?.code || "UNKNOWN_ERROR"}`);
      if (response?.view) render(response.view);
      return;
    }
    if (origin) await extensionApi.permissions.remove({ origins: [`${origin}/*`] });
    render(response.view);
    text("action-result", "Canvas-origin enrollment and exact permission were removed.");
  } catch {
    text("action-result", "Canvas-origin access may not be fully removed; use browser extension settings to revoke site access.");
  }
}

async function previewAuditLog() {
  clearAuditPreview();
  text("action-result", "Preparing exact local audit export for review…");
  try {
    const response = await runtime.sendMessage({ command: "GET_AUDIT_EXPORT" });
    if (!response?.ok || !response?.exportData) {
      text("action-result", `Export failed safely: ${response?.code || "UNKNOWN_ERROR"}`);
      return;
    }
    pendingAuditExport = Object.freeze({
      json: `${JSON.stringify(response.exportData, null, 2)}\n`,
      filename: `canvas-privacy-guard-audit-${response.exportData.generatedAtBucket.replace(/[:]/g, "-")}.json`,
      recordCount: response.exportData.recordCount,
    });
    document.getElementById("audit-preview-json").value = pendingAuditExport.json;
    document.getElementById("audit-preview").hidden = false;
    document.getElementById("save-audit").disabled = false;
    text("action-result", "Review the exact JSON below, then choose Save reviewed audit JSON.");
  } catch {
    clearAuditPreview();
    text("action-result", "Export preview failed: ADAPTER_ERROR");
  }
}

// saveReviewedAuditLog is async: at save time it re-issues GET_AUDIT_EXPORT and
// compares the fresh canonical JSON to the exact previewed payload string.
// If they differ (adapter-side activity, lifecycle, or retention revision changed)
// the stale pending payload is consumed and cleared, the download is refused, and
// the user is required to preview again. If they match, the Blob is built from the
// exact preview string (byte-identical to what was reviewed). One-shot consumption
// occurs on every save attempt regardless of outcome.
async function saveReviewedAuditLog() {
  if (!pendingAuditExport) {
    text("action-result", "Nothing was saved: preview the current audit export first.");
    return;
  }
  // One-shot: capture and immediately consume the pending payload so it cannot be reused.
  const payload = pendingAuditExport;
  clearAuditPreview();

  // Adapter-side freshness check: re-issue GET_AUDIT_EXPORT and compare canonical JSON.
  let freshJson;
  try {
    const fresh = await runtime.sendMessage({ command: "GET_AUDIT_EXPORT" });
    if (!fresh?.ok || !fresh?.exportData) {
      text("action-result", `Export validation failed: ${fresh?.code || "UNKNOWN_ERROR"}. Preview again before saving.`);
      return;
    }
    freshJson = `${JSON.stringify(fresh.exportData, null, 2)}\n`;
  } catch {
    text("action-result", "Export validation failed: ADAPTER_ERROR. Preview again before saving.");
    return;
  }

  // If the adapter-side state has changed the payload since preview, refuse the download.
  if (freshJson !== payload.json) {
    text("action-result", "Audit data changed since preview. Preview again to review the current export before saving.");
    return;
  }

  // Payload is fresh and byte-identical to what was reviewed. Proceed with download.
  // The object URL is managed in try/finally so revocation is guaranteed even if
  // anchor.click() throws.
  let url = null;
  try {
    const blob = new Blob([payload.json], { type: "application/json" });
    url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = payload.filename;
    anchor.click();
    // Truthful wording: we can only confirm that a download was requested,
    // not that the user accepted it or that the file was written to disk.
    text(
      "action-result",
      `Download of ${payload.recordCount} reviewed local record${payload.recordCount === 1 ? "" : "s"} requested. Save location depends on your browser settings.`,
    );
  } catch {
    text("action-result", "Reviewed export was not saved: LOCAL_SAVE_ERROR");
  } finally {
    // Deferred revocation: safe cleanup after the browser has processed the
    // click event and queued the download. Guaranteed exactly once.
    if (url !== null) setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

document.getElementById("toggle-disabled").addEventListener("click", () => send("TOGGLE_DISABLED"));
document.getElementById("delete-activity").addEventListener("click", () => send("DELETE_ACTIVITY"));
document.getElementById("export-audit").addEventListener("click", previewAuditLog);
document.getElementById("save-audit").addEventListener("click", saveReviewedAuditLog);
document.getElementById("enroll-origin").addEventListener("click", enrollCurrentCanvasOrigin);
document.getElementById("remove-origin").addEventListener("click", removeCanvasOrigin);
void send("GET_VIEW");
