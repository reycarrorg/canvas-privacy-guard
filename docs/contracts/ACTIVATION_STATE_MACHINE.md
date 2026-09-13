# Automatic Activation and Deactivation Contract

Status: **Gate 1 specification; no runtime implementation**

Related contracts: [data flow](../architecture/DATA_FLOW.md), [classification](EVENT_CLASSIFICATION.md), [metadata](METADATA_AND_RETENTION.md), and [acceptance plan](../testing/GATE_1_ACCEPTANCE_PLAN.md).

## Definition of a recognized Canvas surface

A recognized surface is a non-private top-level browser tab whose committed URL has `https` scheme and exact origin equality with a user-enrolled Canvas origin for which the browser currently grants host permission. Port normalization follows the URL standard: an omitted default HTTPS port and explicit `:443` compare as the same origin; every other port is distinct.

Recognition does not mean that the user is logged in, the tab is focused, the page is genuine beyond origin/permission checks, or a person has been identified. Wildcards, registrable-domain matching, `<all_urls>`, page titles, favicons, content text, redirects alone, opener relationships, and `*.instructure.com` are not recognition evidence.

A browser context is the browser-defined normal profile/extension storage partition across all of its windows. State does not cross profiles or browsers. Private contexts are excluded in Gate 2 even if the browser grants extension access.

## State model

| State | Entry meaning | Observation | Network behavior | Required visible text |
| --- | --- | --- | --- | --- |
| `DISABLED` | User emergency-disable preference is set | Off | Allow; no rules/listeners | “Off — user disabled” |
| `INITIALIZING_ALLOW` | Runtime started or woke and has not reconciled permissions/tabs | Off | Allow; clear future session rules first | “Starting safely — allowing traffic” |
| `NO_PERMISSION` | No valid enrolled origin or a required exact host grant is absent | Off | Allow | “Permission required” plus exact setting needing action |
| `IDLE` | Permission exists; no recognized or transit surface exists | Off | Allow; future session rules empty | “Idle — no enrolled Canvas tab” |
| `CANDIDATE` | A top-level navigation might commit to an enrolled origin | Navigation facts only; no request record | Allow | “Checking origin” |
| `SSO_TRANSIT` | A recognized tab initiated a finite navigation to an unenrolled identity origin | Off for transit tab; no identity traffic or URL record | Allow | “Paused for sign-in” |
| `ACTIVE_OBSERVE` | One or more recognized surfaces exist and none is assessment-suspected/unknown | Gate 2 redacted metadata only | Allow | “Observing — N Canvas tabs” |
| `ASSESSMENT_SAFE` | Any recognized member/frame is assessment-suspected or assessment-unknown | Request observation and persistence suspended across context | Allow; future rules removed | “Assessment-safe — observation and filtering paused” |
| `UNCERTAIN_ALLOW` | Authoritative inputs, reducer, schema, adapter, or rule state are inconsistent | Off | Allow; future rules removed | “Uncertain — allowing traffic” plus safe reason code |
| `STOPPING` | Last member left, runtime is shutting down, or extension is updating | Off; discard volatile maps | Allow; best-effort future rule removal | “Stopping safely” then derived stable state |

Every state emits `networkAction = ALLOW` in Gate 1 and Gate 2. `CANDIDATE`, `SSO_TRANSIT`, and `STOPPING` are per-surface/transitional facts; the visible context state is derived with the dominance rules below.

## Authoritative and forbidden inputs

Authoritative inputs are exact enrolled origins, current permission grants, current non-private top-level tabs and exposed frame origins, committed navigations, tab/window create/update/remove/replace events, runtime startup/wake/install/update, and local emergency-disable state.

The assessment tripwire receives only a versioned route class and frame-origin category. Unknown equals suspected. It must not inspect DOM, page text, quiz content, answer fields, focus/visibility event payloads, cookies, headers, bodies, queries, fragments, grades, login state, or identity.

Event delivery is a hint, not durable truth. A full current snapshot is authoritative after wake, detected gaps, permission changes, tab replacement, and adapter exceptions.

## Context dominance

The context’s stable visible state is the first true condition:

1. Emergency-disable preference set → `DISABLED`.
2. Reconciliation incomplete → `INITIALIZING_ALLOW`.
3. Any inconsistency or failed cleanup → `UNCERTAIN_ALLOW`.
4. Missing valid enrollment or permission → `NO_PERMISSION`.
5. Any recognized or transit member with suspected/unknown assessment state → `ASSESSMENT_SAFE`.
6. One or more recognized members → `ACTIVE_OBSERVE`.
7. No recognized member but at least one valid finite SSO transit → `SSO_TRANSIT`.
8. Candidate navigation only → `CANDIDATE`.
9. Otherwise → `IDLE`.

Assessment-safe dominance spans every normal window in the browser context. A normal course tab in another window cannot keep observation active while an assessment-suspected/unknown tab or frame exists. State never crosses into a different browser profile; each context independently applies the same rule.

## Per-surface record

The volatile membership map contains only what the reducer needs: context-local tab key, top-level committed origin relation, lifecycle phase, assessment tripwire result, optional opener/transit linkage, and monotonic transit deadline. It contains no request metadata, page content, login state, person identity, or answers.

The map is memory/session state, not local persistent storage. It may use browser session storage solely when the adapter proves the browser deletes it at context end and does not expose private identifiers to normal storage. Correctness never depends on surviving this map: wake always reconstructs from current tabs and permissions.

## Transitions

| Event | Preconditions | Required transition and side effects |
| --- | --- | --- |
| Runtime start/wake/install/update | Any | Enter `INITIALIZING_ALLOW`; remove future session rules; read disable/enrollment/permission; enumerate tabs; rebuild; then derive state |
| Emergency disable | Any | Enter `DISABLED`; detach optional observers; clear volatile records/maps; remove future rules; preserve enrolled origins and already-redacted history until separate deletion |
| Explicit re-enable | `DISABLED` | Enter `INITIALIZING_ALLOW`; reconstruct; do not restore prior active membership |
| Permission revoked/missing | Any active/candidate/transit state | Stop observation; remove future rules; reconcile; derive `NO_PERMISSION` or `UNCERTAIN_ALLOW` if removal/readback fails |
| Top-level navigation starts | Any enabled state | Mark surface `CANDIDATE`; allow; do not recognize until commit |
| Commit to exact enrolled origin | Valid permission, non-private | Add/update recognized member; classify assessment route; derive `ASSESSMENT_SAFE` or `ACTIVE_OBSERVE` |
| Commit away from enrolled origin | Recognized member | Remove recognized membership; enter `SSO_TRANSIT` only if strict transit conditions hold; otherwise derive remaining context state |
| Tab/window removed or tab replaced | Member exists or event is unexpected | Remove only matching membership; reconcile replacement; derive state; unknown removal never deletes another member |
| Frame appears/changes | Recognized top-level member | Apply origin/assessment tripwire only; unknown/suspected frame enters `ASSESSMENT_SAFE`; never grant origin permission from frame presence |
| Adapter/storage/schema exception | Any | Stop observation; discard candidate record; remove future rules; enter `UNCERTAIN_ALLOW` with constant error code |
| Shutdown/suspend | Any | Enter `STOPPING` when callback exists; clear volatile data and future rules best-effort; correctness assumes callback may not run |

Duplicate events are idempotent. Out-of-order, missing, or impossible events trigger snapshot reconciliation. An event never proves that a tab no longer exists when the current snapshot disagrees.

## SSO transit contract

SSO transit exists only to explain why a previously recognized tab temporarily left Canvas; it grants no access to the identity provider.

- Entry requires a committed navigation directly from a recognized surface plus a locally configured identity-origin category. Opener linkage or URL text alone is insufficient.
- The extension does not request identity-provider host permission, inject content, observe requests, read page state, log URLs, or infer MFA/authentication success.
- Transit is per tab and lasts at most five monotonic minutes. The deadline is volatile and is not browsing history.
- Return to an exact enrolled origin becomes a fresh recognized commit. Cancellation, timeout, close, opener detachment, redirect loop, or navigation elsewhere removes transit.
- A popup/new tab is evaluated independently. It cannot inherit Canvas recognition from its opener.
- If transit state is lost during suspension, startup does not recreate it from history. The tab is unrecognized until it commits to an enrolled origin.

## Private browsing

Gate 2 remains inactive in private/incognito windows regardless of browser-level permission. Private tabs do not enter the membership map, increment counts, influence normal context state, create records, or appear in local history. The UI may show the constant message “Inactive in private browsing” within that private surface, without sending the private tab identity to normal storage.

Any future private support requires a new ADR and browser-specific proof of storage and context isolation. A product setting alone is insufficient.

## Restart and service-worker suspension

No in-memory boolean is authoritative. On every runtime wake:

1. Set `INITIALIZING_ALLOW` before exposing an active indicator.
2. Remove and read back any future session-rule set; Gate 2 expects an empty set.
3. Read local disable and exact-origin enrollment settings.
4. Read current browser permission grants.
5. Enumerate current non-private tabs across every window and classify committed origin/assessment categories.
6. Build a new volatile map and derive state.
7. Start redacted observation only if the result is `ACTIVE_OBSERVE`.

Failure at any step enters `UNCERTAIN_ALLOW`. A stale badge, count, map, timer, or prospective rule is never reused.

## Emergency disable guarantees

Emergency disable is a local, keyboard-accessible, single user action available from every visible state. The disabled preference is persisted locally so restart cannot silently re-enable. The UI confirms disable only after observers are detached and any future rules read back empty; otherwise it shows `UNCERTAIN_ALLOW` while continuing cleanup attempts. Re-enable is a separate explicit action followed by full reconstruction.

Gate 1 does not implement this control, and Gate 2 must not install traffic rules. The specification ensures a future enforcement engine cannot remain active when lifecycle authority is absent.
