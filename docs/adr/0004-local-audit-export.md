# ADR 0004: Privacy-Preserving Local Audit Export

- Status: Implemented in source for review
- Decision date: 2026-09-13
- Installation on a normal browser profile: Not yet authorized
- Real assessment use: Prohibited
- Real optional-telemetry enforcement: No approved rules

## Context

The Gate 2 observation prototype retains bounded, categorical metadata in browser-local storage so a user can inspect telemetry categories. However, viewing records only inside the small extension popup makes external verification, offline review, or longitudinal auditing difficult.

The redacted metadata contract specifies that Gate 2 exports require a dedicated ADR proving that:

1. the export cannot reveal enrolled origins, fine-grained activity timelines, or user/student identifiers;
2. the user previews the exact complete payload before saving it;
3. the implementation requires no elevated capabilities or remote transmission.

## Decision

The extension provides a local audit export action in the popup that serializes already-retained categorical observations and non-sensitive lifecycle state into a deterministic, versioned JSON document and saves it using browser-native Blob and object-URL mechanics.

The implementation:

- generates and displays the exact complete JSON strictly on an explicit user button click in the extension popup;
- keeps saving disabled until that payload is visible and requires a separate user confirmation to save the reviewed bytes;
- constructs a browser-native `Blob` and temporary object URL (`URL.createObjectURL`), triggering download via a standard anchor element with a `download` attribute, and immediately revokes the object URL (`URL.revokeObjectURL`);
- requests **zero new extension permissions** (the `downloads` capability is prohibited and remains denied in both manifests);
- includes only already-minimized categorical records that adhere to the closed metadata record schema;
- includes non-sensitive status (`lifecycleState`, `reasonCode`, `networkAction: "ALLOW"`, and `blockingRuleCount: 0`);
- rounds the generation timestamp down to a 15-minute UTC bucket (`generatedAtBucket`), matching the observation bucket granularity and preventing fine-grained temporal tracking;
- strictly excludes enrolled Canvas origins (per the metadata contract, enrolled origins are user settings and must never appear in exports);
- strictly excludes raw URLs, paths, query strings, headers, request/response bodies, cookies, credentials, answers, grades, course content, student identifiers, tab IDs, and window IDs;
- sorts records deterministically before serialization; and
- preserves existing 24-hour retention, 500-record maximum, deletion readback, exact-origin enrollment, and universal `ALLOW` invariants.

## Export Schema

The exported document conforms to a closed schema (`docs/contracts/audit-export.schema.json`):

- `schemaVersion`: exact integer `1`;
- `exportFormat`: exact string `"canvas-privacy-guard-audit-export"`;
- `generatedAtBucket`: UTC 15-minute time bucket;
- `lifecycleState`: current lifecycle enum value;
- `reasonCode`: standard machine-readable reason code;
- `networkAction`: constant `"ALLOW"`;
- `blockingRuleCount`: constant `0`;
- `recordCount`: count of retained observation records;
- `records`: array of validated, closed categorical observation records.

## Evidence boundary

This decision is supported by static policy tests, unit tests, and fake-browser adapter integration tests. It proves that the exported object is strictly minimized, free of forbidden fields, free of enrolled origins, and deterministically serialized. It does not prove OS file picker behavior, browser-specific download shelf UX, or real browser profile execution. Those behaviors remain subject to higher-tier user-supervised testing gates.
