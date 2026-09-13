// Copyright © 2026 Rolando Carreon. All rights reserved.

const extensionApi = globalThis.browser || globalThis.chrome;
const runtime = extensionApi?.runtime;

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

function render(view) {
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

document.getElementById("toggle-disabled").addEventListener("click", () => send("TOGGLE_DISABLED"));
document.getElementById("delete-activity").addEventListener("click", () => send("DELETE_ACTIVITY"));
document.getElementById("enroll-origin").addEventListener("click", enrollCurrentCanvasOrigin);
document.getElementById("remove-origin").addEventListener("click", removeCanvasOrigin);
void send("GET_VIEW");
