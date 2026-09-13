// Copyright © 2026 Rolando Carreon. All rights reserved.

import {
  AUDIT_EXPORT_FORMAT,
  AUDIT_EXPORT_SCHEMA_VERSION,
  MAX_RECORDS,
  NETWORK_ACTION,
  STATES,
} from "./constants.mjs";
import { isValidRecord, PERSISTED_RECORD_KEYS } from "./record.mjs";
import { floorToQuarterHour } from "./retention.mjs";

export const AUDIT_EXPORT_KEYS = Object.freeze([
  "blockingRuleCount",
  "exportFormat",
  "generatedAtBucket",
  "lifecycleState",
  "networkAction",
  "reasonCode",
  "recordCount",
  "records",
  "schemaVersion",
]);

const FORBIDDEN_KEYS = new Set([
  "answer",
  "authorization",
  "body",
  "cookie",
  "courseContent",
  "credential",
  "enrolledOrigin",
  "enrolledOrigins",
  "fragment",
  "fullHistory",
  "grade",
  "header",
  "hostname",
  "ipAddress",
  "origin",
  "path",
  "query",
  "rawEvent",
  "requestId",
  "response",
  "studentIdentifier",
  "tabId",
  "url",
  "userAgent",
  "windowId",
]);

function hasForbiddenKey(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) return true;
    if (hasForbiddenKey(child)) return true;
  }
  return false;
}

function cleanRecord(record) {
  const result = {};
  for (const key of PERSISTED_RECORD_KEYS) {
    result[key] = record[key];
  }
  return Object.freeze(result);
}

export function makeAuditExport(coreState, activity = [], nowMs = Date.now()) {
  const validRecords = (Array.isArray(activity) ? activity : [])
    .filter(isValidRecord)
    .map(cleanRecord)
    .sort((left, right) =>
      left.observedTimeBucket.localeCompare(right.observedTimeBucket) ||
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    )
    .slice(-MAX_RECORDS);

  return Object.freeze({
    schemaVersion: AUDIT_EXPORT_SCHEMA_VERSION,
    exportFormat: AUDIT_EXPORT_FORMAT,
    generatedAtBucket: floorToQuarterHour(nowMs),
    lifecycleState: STATES.includes(coreState?.state) ? coreState.state : "UNCERTAIN_ALLOW",
    reasonCode: typeof coreState?.reasonCode === "string" && /^[A-Z][A-Z0-9_]{2,63}$/.test(coreState.reasonCode)
      ? coreState.reasonCode
      : "UNKNOWN_STATE",
    networkAction: NETWORK_ACTION,
    blockingRuleCount: 0,
    recordCount: validRecords.length,
    records: Object.freeze(validRecords),
  });
}

export function isValidAuditExport(exportPayload) {
  if (!exportPayload || typeof exportPayload !== "object" || Array.isArray(exportPayload)) {
    return false;
  }
  const keys = Object.keys(exportPayload).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...AUDIT_EXPORT_KEYS].sort())) {
    return false;
  }
  if (
    exportPayload.schemaVersion !== AUDIT_EXPORT_SCHEMA_VERSION ||
    exportPayload.exportFormat !== AUDIT_EXPORT_FORMAT ||
    exportPayload.networkAction !== NETWORK_ACTION ||
    exportPayload.blockingRuleCount !== 0 ||
    !STATES.includes(exportPayload.lifecycleState) ||
    !/^[A-Z][A-Z0-9_]{2,63}$/.test(exportPayload.reasonCode) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:(?:00|15|30|45):00Z$/.test(exportPayload.generatedAtBucket) ||
    !Array.isArray(exportPayload.records) ||
    exportPayload.recordCount !== exportPayload.records.length ||
    exportPayload.records.length > MAX_RECORDS ||
    !exportPayload.records.every(isValidRecord) ||
    hasForbiddenKey(exportPayload)
  ) {
    return false;
  }
  return true;
}

export function serializeAuditExport(exportPayload) {
  if (!isValidAuditExport(exportPayload)) {
    throw new Error("INVALID_AUDIT_EXPORT");
  }
  return `${JSON.stringify(exportPayload, null, 2)}\n`;
}
