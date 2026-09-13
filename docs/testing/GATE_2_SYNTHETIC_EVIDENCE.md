# Gate 2 Synthetic Runtime Evidence

Status: **review candidate; source/static and deterministic synthetic-runtime evidence only**

Gate 2 implements an observation-only prototype without authorizing installation, live Canvas use, browser-specific compatibility claims, packaging, enforcement, publication, or release. The complete network action vocabulary remains `{ALLOW}`.

## Evidence boundary

The test harness is a dependency-free, in-memory fake browser. It exercises the repository's real browser adapter, browser-neutral reducer and classifier, redacted record path, local retention behavior, and UI view model. It does not launch or install Firefox or Chromium, contact DNS, start a server, authenticate, use a Canvas instance, or process student/course data.

The manifests are intentionally constrained to two exact reserved synthetic origins:

- `https://canvas.test.invalid` for the enrolled synthetic surface;
- `https://optional.test.invalid` for a separately hosted synthetic observation fixture.

The identity-provider fixture has no manifest host permission. Private/incognito operation is disabled in both manifests. A local alarm wakes the same pruning path at the earliest record expiry. There is no content script, page script, remote endpoint, rule engine, blocking listener, DNR permission, body/header/cookie access, account, sync area, export, or telemetry path.

## Implementation map

| Boundary | Evidence |
| --- | --- |
| Pure lifecycle | `extension/shared/reducer.mjs` applies context-wide assessment dominance, multi-surface reference counting, fail-open uncertainty, disable/re-enable, and snapshot reconstruction. |
| Pure classification | `extension/shared/classifier.mjs` accepts closed categories and emits `networkAction: ALLOW` plus no future rule. |
| Pre-storage minimization | `extension/shared/request-redactor.mjs` handles a raw URL only synchronously and returns categorical fields; identity and unrelated origins are discarded. |
| Local bounded history | `extension/shared/record.mjs` and `retention.mjs` enforce a closed record, 15-minute buckets, 24-hour expiry, 500 rows, and delete readback. |
| Browser parity surface | Both MV3 manifests use the same exact hosts and only local `alarms`, `storage`, plus non-blocking `webRequest`; thin browser entry modules call the same adapter. |
| Visible control | The popup always states that all traffic is allowed and provides native keyboard-reachable disable, re-enable, enrollment, removal, and delete controls. |

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

## Gate status

Verified by this evidence tier:

- Gate 1 contracts still parse and validate;
- pure reducer/classifier determinism and universal `ALLOW`;
- exact synthetic HTTPS matching and permission cases;
- context-wide assessment dominance and private isolation;
- reconstruction, permission loss, disable/re-enable, faults, retention, and delete readback;
- static Firefox/Chromium manifest parity and capability denial;
- accessible/truthful UI source properties;
- deterministic in-memory request/response receipt equivalence.

Not verified by this evidence tier:

- actual Firefox or Chromium service-worker, permission, event, storage, popup, suspension, and browser-version behavior;
- an installed extension, packaged archive, signed build, store submission, or update path;
- any self-owned Canvas, institution, normal profile, real account, course, assessment, or production use;
- Gate 3 enforcement, real-world safety, compatibility, release readiness, or secure erasure from browser/OS backups.

Those higher-tier gates require separate authority and must not be inferred from a passing synthetic harness, pushed branch, or merged pull request.
