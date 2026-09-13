// Copyright © 2026 Rolando Carreon. All rights reserved.

export const NETWORK_ACTION = "ALLOW";
export const CLASSIFIER_REVISION = "gate2.1";
export const SCHEMA_VERSION = 1;
export const RETENTION_MS = 24 * 60 * 60 * 1000;
export const MAX_RECORDS = 500;
export const SSO_TRANSIT_MS = 5 * 60 * 1000;
export const AUDIT_EXPORT_SCHEMA_VERSION = 1;
export const AUDIT_EXPORT_FORMAT = "canvas-privacy-guard-audit-export";

export const STATES = Object.freeze([
  "DISABLED",
  "INITIALIZING_ALLOW",
  "NO_PERMISSION",
  "IDLE",
  "CANDIDATE",
  "SSO_TRANSIT",
  "ACTIVE_OBSERVE",
  "ASSESSMENT_SAFE",
  "UNCERTAIN_ALLOW",
  "STOPPING",
]);

export const EVENT_KINDS = Object.freeze([
  "START",
  "WAKE",
  "INSTALL",
  "UPDATE",
  "SUSPEND",
  "SHUTDOWN",
  "PERMISSION_SNAPSHOT",
  "PERMISSION_ADDED",
  "PERMISSION_REMOVED",
  "TAB_SNAPSHOT",
  "TAB_CREATED",
  "TAB_COMMITTED",
  "TAB_REMOVED",
  "TAB_REPLACED",
  "WINDOW_REMOVED",
  "FRAME_CLASS_CHANGED",
  "DISABLE",
  "REENABLE",
  "ENROLL_ORIGIN",
  "REMOVE_ORIGIN",
  "DELETE_ACTIVITY",
  "ADAPTER_ERROR",
  "SCHEMA_ERROR",
  "STORAGE_ERROR",
  "RULE_READBACK_MISMATCH",
]);

export const ASSESSMENT_STATES = Object.freeze([
  "suspected",
  "not_suspected",
  "unknown",
]);

export const DESTINATION_CLASSES = Object.freeze([
  "enrolled_canvas_origin",
  "enrolled_canvas_subresource",
  "separate_third_party",
  "identity_provider_transit",
  "external_tool",
  "unknown",
]);

export const PATH_CLASSES = Object.freeze([
  "static_asset",
  "course_or_navigation",
  "assessment_suspected",
  "authentication",
  "autosave_or_submission",
  "security",
  "optional_candidate",
  "unknown",
]);

export const RESOURCE_TYPES = Object.freeze([
  "document",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "media",
  "xhr",
  "fetch",
  "beacon",
  "websocket",
  "other",
  "unknown",
]);

export const METHOD_CLASSES = Object.freeze(["read", "state_changing", "other", "unknown"]);

export const INITIATOR_RELATIONS = Object.freeze([
  "enrolled_top_level",
  "enrolled_child_frame",
  "sso_transit",
  "unrelated",
  "unknown",
]);

export const EVENT_CLASSES = Object.freeze([
  "essential",
  "assessment",
  "authentication_sso",
  "autosave_submission",
  "security",
  "optional_separable",
  "unknown",
]);
