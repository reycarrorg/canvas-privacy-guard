# Gate 2 Synthetic Runtime Evidence

Status: **review candidate; deterministic synthetic-runtime evidence plus authenticated-origin source support**

Gate 2 implements an observation-only prototype without authorizing installation, live Canvas use, browser-specific compatibility claims, packaging, enforcement, publication, or release. The complete network action vocabulary remains `{ALLOW}`.

## Evidence boundary

The test harness is a dependency-free, in-memory fake browser. It exercises the repository's real browser adapter, browser-neutral reducer and classifier, redacted record path, local retention behavior, and UI view model. It does not launch or install Firefox or Chromium, contact DNS, start a server, authenticate, use a Canvas instance, or process student/course data.

The manifests retain two exact reserved synthetic origins:

- `https://canvas.test.invalid` for the enrolled synthetic surface;
- `https://optional.test.invalid` for a separately hosted synthetic observation fixture.

The provider-hosted pattern `https://*.instructure.com/*` is declared only as an optional permission. The popup uses the temporary `activeTab` grant to validate that it was opened from a hosted Canvas tab, requests only that exact origin, and sends the normalized origin to the adapter. Arbitrary sites and wildcard enrollment are rejected. The identity-provider fixture has no manifest host permission. Private/incognito operation is disabled in both manifests. A local alarm wakes the same pruning path at the earliest record expiry. There is no content script, page script, remote endpoint, rule engine, blocking listener, DNR permission, body/header/cookie access, account, sync area, remote sync/export, or outbound telemetry path.

## Implementation map

| Boundary | Evidence |
| --- | --- |
| Pure lifecycle | `extension/shared/reducer.mjs` applies context-wide assessment dominance, multi-surface reference counting, fail-open uncertainty, disable/re-enable, and snapshot reconstruction. |
| Pure classification | `extension/shared/classifier.mjs` accepts closed categories and emits `networkAction: ALLOW` plus no future rule. |
| Pre-storage minimization | `extension/shared/request-redactor.mjs` handles a raw URL only synchronously and returns categorical fields; identity and unrelated origins are discarded. |
| Local bounded history | `extension/shared/record.mjs` and `retention.mjs` enforce a closed record, 15-minute buckets, 24-hour expiry, 500 rows, and delete readback. |
| Local audit export | `extension/shared/audit-export.mjs` serializes already-minimized categorical records and non-sensitive state into a closed schema, omitting enrolled origins, full URLs, headers, bodies, cookies, credentials, and identifiers. |
| Browser parity surface | Both MV3 manifests use the same synthetic hosts, optional hosted-Canvas pattern, `activeTab`, local `alarms`/`storage`, and non-blocking `webRequest`; thin browser entry modules call the same adapter. No content or navigation-wide permission is requested. |
| Visible control | The popup states the protected traffic classes, exact enrolled origin, and zero active optional rules, and provides native keyboard-reachable disable, re-enable, exact-origin enrollment/removal, delete controls, exact-payload audit preview, and separately confirmed local saving via browser-native Blob/object-URL behavior without new permissions. |

## Deterministic receipt result

The harness covers login, navigation, files, media, accessibility, SSO, LTI, autosave, timer, answer, submission, confirmation, security, focus, visibility, batching, beacon, fetch, XHR, WebSocket, worker, cache, retry, and deliberate-failure flows. Request and response bytes belong to the in-memory test oracle and are never passed to the adapter.

For the canonical 24-flow fixture, disabled and enabled receipt ledgers both hash to:

```text
0f801179d64d43295239696774f9b523748900e49f08f4a5e65953b0bc6eaeb6
```

The harness also requires every listener return to be `undefined`, every derived network action to be `ALLOW`, and every seeded forbidden canary to be absent from local activity. Two consecutive runs must produce the same evidence object.

## Commands

Run from the repository root with a local Node.js runtime and Python standard library:

```text
./tests/check_repo.sh
./tests/run_gate2.sh
node tests/gate2/synthetic-harness.mjs
python3 tests/validate_contracts.py
git diff --check
```

No package installation, dependency manifest, lockfile, vendored code, copied third-party implementation, browser binary, or remote service is required.

## Scoped security review

The pre-PR executable diff review covered all 16 extension source, manifest, and UI files. It found two reproducible local prototype defects: an unrelated tab could create a categorical record for the separate synthetic fixture while another tab kept observation active, and a pending activity write could restore a row after successful deletion readback. Neither issue enabled traffic modification, remote transmission, raw-value persistence, or real-domain access, and neither survived as a reportable vulnerability under the repository's current source-only `.invalid` threat model.

Both defects were nevertheless blocking Gate 2 contract failures and were repaired before commit. The adapter now requires recognized-tab and enrolled-initiator evidence, serializes all activity mutations, detaches observation during deletion, and cancels stale reconstructions. Targeted regressions require unrelated rows and post-delete restored rows to remain zero. The full Gate 1 and Gate 2 checks are rerun after those repairs.

## Follow-up privacy-boundary repair

A focused review of the same adapter found that emergency disable and enrollment removal detached only after their settings writes, and that an activity write already in progress could complete after either privacy action. The repair now detaches synchronously before the first asynchronous settings operation, advances an observation generation, and restores the last fully committed activity baseline after all older queued work drains. Deterministic held-write tests cover both actions at the settings boundary and at an already-pending activity write.

The adapter also validates `parentFrameId` as an integer no smaller than `-1`. Malformed frame metadata and any delivered child-frame metadata immediately enter `ASSESSMENT_SAFE`, detach observation, fence earlier queued work, store no activity, and still return `undefined` with `networkAction: ALLOW`. A suspected top-level assessment path stores one minimized categorical `assessment_suspected` signal, then follows the same suspension boundary; the raw path is never stored, and later same-tab update events cannot clear the in-memory assessment lock.

This is adapter-level evidence only. With the exact two-host permission contract, no content script, and no navigation-wide permission, the prototype cannot prove that a real browser will deliver a child navigation to an origin outside those two hosts or reconstruct still-present frames after a service-worker restart. The direct child-frame injection test proves behavior if such metadata reaches the adapter; it does **not** prove external-subframe discovery in Firefox or Chromium. Therefore useful `ACTIVE_OBSERVE` with complete external-frame awareness remains a browser-runtime design blocker, not a verified Gate 2 capability.

## Gate status

Verified by this evidence tier:

- Gate 1 contracts still parse and validate;
- pure reducer/classifier determinism and universal `ALLOW`;
- exact synthetic HTTPS matching and permission cases;
- context-wide assessment dominance and private isolation;
- reconstruction, permission loss, disable/re-enable, faults, retention, and delete readback;
- synchronous detach and pending-write fencing for emergency disable and enrollment removal;
- fail-closed handling of malformed and directly delivered child-frame metadata at the adapter boundary;
- static Firefox/Chromium manifest parity and capability denial;
- exact hosted-Canvas origin acceptance, unrelated-site rejection, and runtime filter construction in the fake browser;
- accessible/truthful UI source properties;
- deterministic local audit export generation, schema validation, and omission of enrolled origins and sensitive fields;
- exact complete audit-payload preview followed by a separate save confirmation, using browser-native Blob/object-URL behavior without elevated or downloads permissions;
- deterministic in-memory request/response receipt equivalence.

Not verified by this evidence tier:

- actual Firefox or Chromium service-worker, permission, event, storage, popup, suspension, and browser-version behavior;
- browser-specific file saving, download prompt UX, and OS download manager integration;
- discovery of external-origin child frames under the intentionally exact host-permission set;
- an installed extension, packaged archive, signed build, store submission, or update path;
- any self-owned Canvas, institution, normal profile, real account, course, assessment, or production use, despite source support for an exact hosted origin;
- Gate 3 enforcement, real-world safety, compatibility, release readiness, or secure erasure from browser/OS backups.

Those higher-tier gates require separate authority and must not be inferred from a passing synthetic harness, pushed branch, or merged pull request.
