// Copyright © 2026 Rolando Carreon. All rights reserved.

const LABELS = Object.freeze({
  DISABLED: ["Off — user disabled", "Observation is off until you explicitly re-enable it."],
  INITIALIZING_ALLOW: ["Starting safely — allowing traffic", "Current permissions and tabs are being reconstructed."],
  NO_PERMISSION: ["Permission required", "Choose one exact Canvas origin and grant access from its open tab."],
  IDLE: ["Idle — no enrolled Canvas tab", "Observation is off because no recognized surface is open."],
  CANDIDATE: ["Checking origin", "A navigation is awaiting an exact committed-origin check."],
  SSO_TRANSIT: ["Paused for sign-in", "Identity-provider traffic is not accessed or observed."],
  ACTIVE_OBSERVE: ["Observing", "Only bounded categorical metadata is stored locally."],
  ASSESSMENT_SAFE: ["Assessment-safe — observation and filtering paused", "Unknown or suspected assessment context dominates all windows."],
  UNCERTAIN_ALLOW: ["Uncertain — allowing traffic", "Observation stopped because authoritative state could not be verified."],
  STOPPING: ["Stopping safely", "Volatile observation state is being discarded."],
});

export function makeViewModel(
  coreState,
  activity = [],
  enrolledOrigin = null,
  residualPermissionCount = 0,
) {
  const [title, detail] = LABELS[coreState?.state] || LABELS.UNCERTAIN_ALLOW;
  return Object.freeze({
    title: coreState?.state === "ACTIVE_OBSERVE"
      ? `${title} — ${coreState.recognizedCount} Canvas tab${coreState.recognizedCount === 1 ? "" : "s"}`
      : title,
    detail,
    state: coreState?.state || "UNCERTAIN_ALLOW",
    reasonCode: coreState?.reasonCode || "UNKNOWN_STATE",
    observationRunning: coreState?.state === "ACTIVE_OBSERVE",
    trafficStatement: "Canvas, assessment, sign-in, save, submission, security, accessibility, and uncertain traffic is always allowed. No optional blocking rule is installed in this preview.",
    disableLabel: coreState?.state === "DISABLED" ? "Re-enable observation" : "Emergency disable observation",
    enrolledOrigin: typeof enrolledOrigin === "string" ? enrolledOrigin : null,
    residualPermissionCount: Number.isInteger(residualPermissionCount) && residualPermissionCount > 0
      ? residualPermissionCount
      : 0,
    blockingRuleCount: 0,
    activity: Array.isArray(activity) ? activity : [],
  });
}
