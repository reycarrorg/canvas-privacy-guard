// Copyright © 2026 Rolando Carreon. All rights reserved.

const LABELS = Object.freeze({
  DISABLED: ["Off — user disabled", "Observation is off until you explicitly re-enable it."],
  INITIALIZING_ALLOW: ["Starting safely — allowing traffic", "Current permissions and tabs are being reconstructed."],
  NO_PERMISSION: ["Permission required", "The exact synthetic Canvas origin permission is missing."],
  IDLE: ["Idle — no enrolled Canvas tab", "Observation is off because no recognized surface is open."],
  CANDIDATE: ["Checking origin", "A navigation is awaiting an exact committed-origin check."],
  SSO_TRANSIT: ["Paused for sign-in", "Identity-provider traffic is not accessed or observed."],
  ACTIVE_OBSERVE: ["Observing", "Only bounded categorical metadata is stored locally."],
  ASSESSMENT_SAFE: ["Assessment-safe — observation and filtering paused", "Unknown or suspected assessment context dominates all windows."],
  UNCERTAIN_ALLOW: ["Uncertain — allowing traffic", "Observation stopped because authoritative state could not be verified."],
  STOPPING: ["Stopping safely", "Volatile observation state is being discarded."],
});

export function makeViewModel(coreState, activity = []) {
  const [title, detail] = LABELS[coreState?.state] || LABELS.UNCERTAIN_ALLOW;
  return Object.freeze({
    title: coreState?.state === "ACTIVE_OBSERVE"
      ? `${title} — ${coreState.recognizedCount} Canvas tab${coreState.recognizedCount === 1 ? "" : "s"}`
      : title,
    detail,
    state: coreState?.state || "UNCERTAIN_ALLOW",
    reasonCode: coreState?.reasonCode || "UNKNOWN_STATE",
    observationRunning: coreState?.state === "ACTIVE_OBSERVE",
    trafficStatement: "All traffic is allowed. This prototype never blocks or changes network requests.",
    disableLabel: coreState?.state === "DISABLED" ? "Re-enable observation" : "Emergency disable observation",
    activity: Array.isArray(activity) ? activity : [],
  });
}
