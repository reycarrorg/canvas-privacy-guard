# Gate 1 Synthetic Testing and Acceptance Plan

Status: **Contract validation complete when every Gate 1 check passes; runtime tests are Gate 2 entry requirements**

This plan maps every invariant in [`invariants.json`](../contracts/invariants.json) to deterministic evidence. Gate 1 uses documentation, schemas, synthetic fixtures, and standard-library validation only. It never launches a browser, installs an extension/package/binary, signs into Canvas, or sends traffic.

## Evidence tiers

| Tier | Gate | Environment | Permitted evidence |
| --- | --- | --- | --- |
| Contract/static | Gate 1 | Repository only | JSON parse/schema checks, link checks, policy strings, license/secret/path/data scans, synthetic static fixtures |
| Pure core | Gate 2 | Standard-library/unit-test process | Reducer/classifier tables and generated synthetic event sequences; no browser/account |
| Synthetic browser | Gate 2 | Later pinned, reviewed harness | Loopback synthetic sites/profiles only; observation extension; no Canvas data |
| Self-owned Canvas | Later, separately authorized | Pinned isolated local instance, fabricated data | Functional observation baseline; no production backup/account |
| Institution non-production | Gate 4, separately authorized | Written scope, synthetic tenant/accounts | Named-owner acceptance; never graded/production without new authority |

No lower tier proves a higher tier. Gate 1 completion does not claim runtime, packaging, browser-permission, extension-installation, or institution evidence.

## Gate 1 deterministic checks

- `T-STATIC-01`: repository diff contains only documentation, JSON contracts, synthetic fixtures, and local validation checks; no manifest, extension source, request listener, rule, proxy, certificate, dependency manifest, lockfile, or binary.
- `T-SCHEMA-01`: standard-library validator proves `networkAction` is JSON Schema constant `ALLOW`; invalid synthetic `BLOCK` is rejected.
- `T-SCHEMA-02`: schema is closed and its exact forbidden-field contract includes URL/origin/path/query/fragment, cookies/headers/bodies/auth, identifiers, answers/grades/course content/history; negative URL fixture is rejected.
- `T-SCHEMA-03`: schema metadata fixes default/maximum retention at 24 hours, 500 rows, no private persistence, and no remote transmission; valid fixture deadline is within 24 hours on a 15-minute boundary.
- `T-STATIC-02`: bounded source scan finds no telemetry/analytics SDK, remote rule/update design, cloud sync, account integration, or remote-code mechanism in added non-research artifacts.
- `T-AUTHZ-01`: ADR 0002 states Gate 1 and Gate 2 enforcement are prohibited and enumerates the rule authorization record.
- `T-AUTHZ-02`: data-flow review confirms classifier-to-rule-engine and rule-engine-to-browser edges are disconnected/prohibited.
- `T-SUPPLY-01`: dependency inventory remains empty and no package/lock/vendor/generated bundle is added.
- `T-LICENSE-01`: license, notice, copyright, source-available description, and no-copy GPL/AGPL/MPL boundaries are unchanged; file-level scan finds no new third-party notices or conflicting license assertion.

## Gate 2 pure lifecycle and classifier tests

These IDs are executable acceptance requirements for the future observation prototype; they are not claimed as run in Gate 1.

- `T-REDUCER-01`: for every state/event pair, network action equals `ALLOW` and output has no enforcement command.
- `T-REDUCER-02`: table cases reject HTTP, wildcard, suffix, lookalike, non-default port, page-title, and opener-only recognition; accept only normalized exact enrolled HTTPS origin with current permission.
- `T-REDUCER-03`: missing/invalid enum, impossible transition, stale snapshot, or storage mismatch produces `UNCERTAIN_ALLOW` and observation off.
- `T-REDUCER-04`: suspected and unknown assessment classification from any member produces `ASSESSMENT_SAFE`.
- `T-REDUCER-05`: same snapshot/event inputs produce byte-identical canonical state; duplicate events are idempotent.
- `T-REDUCER-06`: permutations with dropped/duplicated/out-of-order events converge after the same authoritative snapshot.
- `T-CLASSIFIER-01`: unknown, conflict, stale revision, and schema mismatch always return `unknown`, `ALLOW`, and no future rule.
- `T-CLASSIFIER-02`: each protected class—essential, assessment, authentication/SSO, autosave/submission, security, and unknown—returns `ALLOW`; assessment also requests observation suspension.
- `T-CLASSIFIER-03`: every same-origin optional-looking case is protected or unknown, never `optional_separable`.
- `T-CLASSIFIER-04`: synthetic batched combinations of optional + focus/answer/save/submission/security are never optional-separable; classifier never requests body inspection.
- `T-MULTI-01`: assessment suspected/unknown in any tab/frame/window pauses observation across that context while another normal Canvas tab exists.
- `T-MULTI-02`: zero/one/many tabs across zero/one/many windows produce correct reference counts and state.
- `T-MULTI-03`: close/navigate/replace one member never removes another; unknown removal triggers reconciliation.
- `T-ASSESS-01`: Classic-like, New-like, external-frame, unknown-frame, and changed-route cases enter assessment-safe; route names alone cannot mark an assessment “safe.”
- `T-PRIVATE-01`: private events are ignored before membership and never change normal context state/counts.
- `T-PRIVATE-02`: no private tab/window/request identifier or record reaches session/local/sync storage, UI history, logs, or exports.
- `T-RESTART-01`: cold start, update, crash-like wake, and missing shutdown callback begin `INITIALIZING_ALLOW`, clear/read back future rules, then reconstruct from current tabs/permissions.
- `T-RESTART-02`: forced MV3 service-worker suspension loses all globals without changing reconstructed state or leaving stale observation/rules.
- `T-DISABLE-01`: emergency disable from every state detaches observers, clears volatile data/future rules, persists disabled state, and displays confirmation only after readback.
- `T-DISABLE-02`: restart remains disabled; explicit re-enable performs full reconstruction and does not restore stale membership.
- `T-SSO-01`: success, cancel, timeout, loop, popup, unrelated opener, and redirect-away cases allow all, request no IDP permission, and record no identity URL/traffic.
- `T-SSO-02`: SSO transit expires within five monotonic minutes, is per tab, is not restored from history after wake, and never implies logged-in state.
- `T-PERMISSION-01`: revoke/add/mismatch sequences stop observation immediately; reactivation waits for current grant plus reconstruction.
- `T-FAULT-01`: adapter, classifier, schema, and storage exceptions discard candidate data, emit a constant code, and allow without raw logging.
- `T-FAULT-02`: simulated prospective-rule removal/readback mismatch stays `UNCERTAIN_ALLOW`; no active/disabled success indicator is shown.
- `T-RETENTION-01`: writes 501+ records and bucket boundary cases; oldest records are removed before insertion and every record expires by 24 hours.
- `T-RETENTION-02`: delete-history removes records/aggregates, reads back empty, preserves enrollment/disable settings, and reports failure without claiming deletion.

## Gate 2 synthetic browser equivalence tests

- `T-ADAPTER-01`: browser fixtures confirm exact origin/permission handling, URL standard port normalization, and no access outside the enrolled synthetic origin.
- `T-ADAPTER-02`: hostile synthetic URLs, encodings, queries, fragments, headers, bodies, identifiers, Unicode, and exception strings never cross the adapter boundary or appear in artifacts.
- `T-MANIFEST-01`: Firefox and Chromium manifests contain only reviewed minimum observation capabilities; reject `<all_urls>`, blocking/DNR, cookies, history, debugger, proxy, native messaging, downloads, clipboard, capture, accessibility, or remote code.
- `T-PRIVACY-01`: scan memory-safe outputs, local/session/sync storage, logs, screenshots/traces, and reports for seeded unique forbidden canaries; find zero.
- `T-NETWORK-01`: fixture network ledger shows the extension contacts no remote endpoint and sends no product telemetry; loopback requests are test-owned only.
- `T-EQUIV-01`: server receipts for login-like, navigation, files/media, accessibility, SSO-like, LTI-like, autosave, timer, answer, submission, confirmation, and security flows are byte-for-byte identical with observation disabled/enabled.
- `T-EQUIV-02`: focus, visibility, suspected assessment, same-origin batch, beacon, fetch/XHR, WebSocket, worker, cache, retry, and deliberate failure receipts are identical; no event is suppressed, falsified, reordered, or delayed by the extension.

## Fixture design

Future dynamic fixtures must use reserved `.invalid` names or loopback ephemeral origins, fabricated generic users/content, and seeded canary values. They must not copy Canvas HTML, course content, quiz questions, real domains, school identifiers, cookies, tokens, or student records. Server receipt ledgers are synthetic test oracles, not product logs, and are deleted with the test workspace.

No TLS interception, certificate installation, DNS edit, proxy, privileged port/helper, ordinary browser profile, real Canvas account, or graded assessment is permitted. Browser binaries and Playwright remain uninstalled in Gate 1; later adoption requires the reuse matrix’s pinned dependency review.

## Gate 1 acceptance commands

Run from the repository root:

```text
./tests/check_repo.sh
python3 tests/validate_contracts.py
git diff --check
```

Then run bounded repository scans for credential-file extensions and secret patterns; absolute local paths/usernames; student or course data; bypass/stealth instructions; license drift; and claims implying implementation, installation, enforcement, runtime proof, institution approval, or release. Expected occurrences inside explicit prohibitions, synthetic negative fixtures, and historical research must be manually distinguished from unsafe guidance.

## Gate 1 exit and exact Gate 2 entry criteria

Gate 1 is ready for review when all Gate 1 checks pass, every invariant has at least one deterministic test ID, documentation links resolve, the threat model covers each trust boundary and abuse class, and no high-severity contract contradiction remains.

Gate 2 may start only after:

1. This Gate 1 pull request is reviewed, accepted, and merged to `main` without weakening the contracts.
2. Current `main` is reverified as the exact Gate 1 merge or a direct successor.
3. The Gate 2 branch scope is limited to an observation-only scaffold, browser adapters, pure reducer/classifier, accessible visible UI, and synthetic tests.
4. Dependency and manifest proposals identify exact versions/hashes/licenses/permissions before installation or lockfile change; no GPL/AGPL/MPL implementation is copied.
5. The implementation exposes no blocking/DNR/request-body/content-script interception capability and keeps `networkAction = ALLOW` machine-checked.
6. Tests are synthetic and local; no real Canvas login, account, course, student data, graded assessment, extension installation in an ordinary profile, package publication, or release claim is included.
7. Firefox and Chromium adapter parity, private-inactive behavior, restart/suspension reconstruction, assessment dominance, redaction, retention, deletion, SSO transit, accessibility, and byte-equivalence tests are planned as blocking CI evidence.

Gate 2 ends only after those deterministic tests and a synthetic runtime demonstration pass. Gate 2 still does not authorize enforcement, real-account testing, installation for ordinary use, or release.
