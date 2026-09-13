# Redacted Metadata and Retention Contract

Status: **Gate 1 contract; Gate 2 input boundary; no enforcement authority**

Related contracts: [event classification](EVENT_CLASSIFICATION.md), [activation state machine](ACTIVATION_STATE_MACHINE.md), [machine-checkable schema](metadata-record.schema.json), and [acceptance plan](../testing/GATE_1_ACCEPTANCE_PLAN.md).

## Purpose and scope

The browser may expose a full request URL and browser-local identifiers to an adapter. Those values are sensitive working inputs. The adapter must synchronously reduce them to the categorical record defined here and discard the raw values before calling shared code. A raw browser event is never a valid classifier input, log entry, diagnostic, export, exception payload, or test snapshot.

The JSON Schema is the complete allowlist for any persisted Gate 2 observation record. If a value is not represented by a schema property, it must not be persisted. `additionalProperties: false` makes that rule deterministic.

## Data minimization pipeline

1. The browser adapter receives one browser event in volatile memory.
2. It verifies the event belongs to an exact enrolled Canvas surface. Events outside that scope are discarded without a record.
3. It parses the URL only long enough to compare its scheme and host to local enrollment and rule data. It drops user information, port normalization surprises, query, and fragment before any handoff.
4. It maps the destination and path to enumerated classes. The classifier never receives a full URL, hostname, origin string, or raw path.
5. It maps the browser request method and resource type to coarse enums. Unknown values become `unknown`; they are not copied through.
6. It removes tab, window, frame, request, navigation, and profile identifiers. The lifecycle reducer may use ephemeral identifiers in a separate volatile map, but they never enter the record.
7. It rounds the observation time down to a 15-minute UTC bucket.
8. It creates the closed-schema record. Schema failure causes `SKIP`, deletes the candidate object, and enters `UNCERTAIN_ALLOW`; it never falls back to raw logging.

This pipeline must execute before debug logging, metrics, persistence, UI history, or error reporting. Redaction after storage is not compliant.

## Persistable fields

| Field | Purpose | Privacy constraint |
| --- | --- | --- |
| `schemaVersion` | Deterministic migration/rejection | Exact integer `1` |
| `observedTimeBucket` | Bounded local audit ordering | UTC; 15-minute boundary; no exact timestamp |
| `browserFamily` | Adapter compatibility evidence | Product family only; no version, profile, or device data |
| `destinationClass` | First/third-party relationship | Category only; no host, origin, IP, or domain hash |
| `pathClass` | Safety-relevant route category | Category only; no raw or templated path |
| `resourceType` | Coarse browser resource class | Fixed enum; unknown stays unknown |
| `methodClass` | Read/state-changing distinction | Fixed enum; no verb if unrecognized |
| `initiatorRelation` | Relationship to enrolled surface | No initiator URL or identifiers |
| `eventClass` | Result of the classification contract | Seven closed classes |
| `lifecycleState` | Safety state at classification time | No tab/window membership details |
| `networkAction` | Integrity receipt | Constant `ALLOW` in Gate 1 and Gate 2 |
| `observationAction` | Whether a record was retained | `COUNT_ONLY`, `REDACTED_RECORD`, or `SKIP` |
| `reasonCode` | Reviewable local explanation | Stable non-sensitive code; no interpolated data |
| `classifierRevision` | Provenance for deterministic replay | Local revision label; no remote update URL |
| `retentionExpiresAtBucket` | Deletion deadline | At most 24 hours after observation bucket |

The product may show aggregate counts computed from these records. Aggregates inherit the same deletion deadline and must not restore a finer timeline or destination identity.

## Forbidden data

The following data must never be captured for product use or persisted, even temporarily in a queue, error object, crash report, test artifact, export, or browser storage:

- cookies, cookie names, headers, authorization material, bearer values, credentials, session identifiers, or authentication state;
- request or response bodies, form data, POST data, WebSocket messages, beacon payloads, raw browser events, or response content;
- answers, answer state, grades, quiz or assignment content, course content, files, messages, rosters, student identifiers, names, email addresses, course IDs, or attempt IDs;
- full URLs, query strings, fragments, raw paths, hostnames, origins, IP addresses, referrers, user-agent strings, or full browsing history;
- tab, window, frame, request, navigation, installation, device, profile, or private-context identifiers;
- page text, DOM content, screenshots, clipboard content, keystrokes, focus history, visibility-event content, or accessibility-tree data.

The enrolled Canvas origins are a user setting, not observation history. They may be stored locally as exact HTTPS origins only. They must never be copied into observation records, exports, or telemetry.

## Retention and deletion

- Default and maximum persistent retention: **24 hours**.
- Maximum persistent records: **500**. Before inserting record 501, delete the oldest bucket first.
- Private browsing: **no persistence**. Gate 2 is inactive in private browsing, so no private record exists.
- Emergency disable: immediately stops new records and clears volatile candidate data. Existing redacted records remain until the user chooses deletion or their deadline arrives, so disablement is not mislabeled as deletion.
- “Delete local activity”: atomically removes all observation records and derived aggregates, then reads storage back and shows either success or `UNCERTAIN_ALLOW` with a deletion-failure code. It does not remove enrolled origins or the emergency-disable preference unless the user selects a separate reset action.
- Automatic deletion runs before every read, before every write, on runtime startup/wake, and when the retention deadline is reached while the runtime is active. Missed timers are handled on the next wake.
- Disabling or uninstalling should rely on browser-managed extension-storage removal where supported, but the product must not promise secure erasure from browser backups, filesystem snapshots, or device forensics.
- There is no cloud sync, browser sync storage, remote backup, remote telemetry, or automatic export.

If the storage schema version is missing, newer than supported, corrupt, or inconsistent, the product deletes no user settings automatically. It stops observation, exposes a local error, and enters `UNCERTAIN_ALLOW`. A separately labeled user action may delete incompatible records.

## Logging and diagnostics

Production logs contain stable error codes and aggregate counters only. Stringifying browser event objects is prohibited. Exceptions must be caught at the adapter boundary and mapped to constant reason codes. Developer diagnostics use synthetic fixtures only and must pass the same schema before being written.

Local audit export was authorized for the Gate 2 observation prototype by [ADR 0004](../adr/0004-local-audit-export.md). The exact complete JSON payload is generated and displayed locally on an explicit user gesture, and saving requires a separate user confirmation after that preview. It contains only already-minimized categorical records (with 15-minute time buckets) and non-sensitive lifecycle state. It strictly omits enrolled origins, full URLs, paths, headers, bodies, cookies, credentials, answers, grades, student identifiers, and tab IDs.

## Deterministic rejection examples

- A record with `networkAction: "BLOCK"` is invalid.
- A record containing an otherwise useful `url`, `origin`, `path`, `tabId`, or `requestId` property is invalid.
- A record with a 30-hour deletion deadline is invalid by the retention contract.
- A record with a non-enumerated route or destination becomes `unknown`; copying the raw value is invalid.
- A valid record from a private context is still forbidden because the lifecycle contract prevents its creation.

The standard-library validator in `tests/validate_contracts.py` verifies the closed schema, the positive fixture, the negative URL/block fixture, field allowlist, event classes, record cap, and retention constants.
