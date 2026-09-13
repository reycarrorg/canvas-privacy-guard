// Copyright © 2026 Rolando Carreon. All rights reserved.

const runtime = globalThis.browser?.runtime || globalThis.chrome?.runtime;

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

  const body = document.getElementById("activity-body");
  body.replaceChildren();
  for (const record of view.activity) {
    const row = document.createElement("tr");
    for (const value of [
      record.observedTimeBucket,
      record.eventClass,
      record.destinationClass,
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

document.getElementById("toggle-disabled").addEventListener("click", () => send("TOGGLE_DISABLED"));
document.getElementById("delete-activity").addEventListener("click", () => send("DELETE_ACTIVITY"));
document.getElementById("enroll-origin").addEventListener("click", () => send("ENROLL_SYNTHETIC"));
document.getElementById("remove-origin").addEventListener("click", () => send("REMOVE_ENROLLMENT"));
void send("GET_VIEW");
