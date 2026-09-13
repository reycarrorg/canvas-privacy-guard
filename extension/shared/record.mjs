// Copyright © 2026 Rolando Carreon. All rights reserved.

import {
  CLASSIFIER_REVISION,
  DESTINATION_CLASSES,
  EVENT_CLASSES,
  INITIATOR_RELATIONS,
  METHOD_CLASSES,
  NETWORK_ACTION,
  PATH_CLASSES,
  RESOURCE_TYPES,
  SCHEMA_VERSION,
  STATES,
} from "./constants.mjs";
import { expiryBucket, floorToQuarterHour } from "./retention.mjs";

const RECORD_KEYS = Object.freeze([
  "schemaVersion",
  "observedTimeBucket",
  "browserFamily",
  "destinationClass",
  "pathClass",
  "resourceType",
  "methodClass",
  "initiatorRelation",
  "eventClass",
  "lifecycleState",
  "networkAction",
  "observationAction",
  "reasonCode",
  "classifierRevision",
  "retentionExpiresAtBucket",
]);

export function makeRecord(redactedInput, decision, browserFamily, nowMs) {
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    observedTimeBucket: floorToQuarterHour(nowMs),
    browserFamily,
    destinationClass: redactedInput.destinationClass,
    pathClass: redactedInput.pathClass,
    resourceType: redactedInput.resourceType,
    methodClass: redactedInput.methodClass,
    initiatorRelation: redactedInput.initiatorRelation,
    eventClass: decision.eventClass,
    lifecycleState: redactedInput.lifecycleState,
    networkAction: NETWORK_ACTION,
    observationAction: decision.observationAction,
    reasonCode: decision.reasonCode,
    classifierRevision: CLASSIFIER_REVISION,
    retentionExpiresAtBucket: expiryBucket(nowMs),
  });
}

export function isValidRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return false;
  const keys = Object.keys(record).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...RECORD_KEYS].sort())) return false;
  return (
    record.schemaVersion === SCHEMA_VERSION &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:(?:00|15|30|45):00Z$/.test(record.observedTimeBucket) &&
    ["firefox", "chromium", "safari", "synthetic"].includes(record.browserFamily) &&
    DESTINATION_CLASSES.includes(record.destinationClass) &&
    PATH_CLASSES.includes(record.pathClass) &&
    RESOURCE_TYPES.includes(record.resourceType) &&
    METHOD_CLASSES.includes(record.methodClass) &&
    INITIATOR_RELATIONS.includes(record.initiatorRelation) &&
    EVENT_CLASSES.includes(record.eventClass) &&
    STATES.includes(record.lifecycleState) &&
    record.networkAction === NETWORK_ACTION &&
    ["COUNT_ONLY", "REDACTED_RECORD", "SKIP"].includes(record.observationAction) &&
    /^[A-Z][A-Z0-9_]{2,63}$/.test(record.reasonCode) &&
    record.classifierRevision === CLASSIFIER_REVISION &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:(?:00|15|30|45):00Z$/.test(record.retentionExpiresAtBucket) &&
    Date.parse(record.retentionExpiresAtBucket) - Date.parse(record.observedTimeBucket) > 0 &&
    Date.parse(record.retentionExpiresAtBucket) - Date.parse(record.observedTimeBucket) <= 24 * 60 * 60 * 1000
  );
}

export const PERSISTED_RECORD_KEYS = RECORD_KEYS;
