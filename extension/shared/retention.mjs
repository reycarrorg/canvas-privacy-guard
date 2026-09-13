// Copyright © 2026 Rolando Carreon. All rights reserved.

import { MAX_RECORDS, RETENTION_MS } from "./constants.mjs";

export function floorToQuarterHour(epochMs) {
  const bucket = 15 * 60 * 1000;
  return new Date(Math.floor(epochMs / bucket) * bucket).toISOString().replace(".000Z", "Z");
}

export function expiryBucket(epochMs) {
  return floorToQuarterHour(epochMs + RETENTION_MS);
}

export function pruneRecords(records, nowMs) {
  if (!Array.isArray(records)) return [];
  return records
    .filter((record) => {
      const expires = Date.parse(record?.retentionExpiresAtBucket || "");
      return Number.isFinite(expires) && expires > nowMs;
    })
    .sort((left, right) =>
      left.observedTimeBucket.localeCompare(right.observedTimeBucket) ||
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    )
    .slice(-MAX_RECORDS);
}

export function insertRecord(records, record, nowMs) {
  return pruneRecords([...pruneRecords(records, nowMs), record], nowMs).slice(-MAX_RECORDS);
}
