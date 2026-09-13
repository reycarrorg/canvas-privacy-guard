# ADR 0002: Enforcement Authorization Boundary

- Status: Proposed for Gate 1 review
- Decision date: 2026-09-12
- Gate 1 network enforcement: Prohibited
- Gate 2 network enforcement: Prohibited
- Production or real-account enforcement: Not authorized

## Context

ADR 0001 selected a WebExtension architecture but explicitly withheld traffic-altering authority. Canvas request destinations and endpoints can be shared by essential, assessment, authentication, autosave, submission, security, and optional-looking events. A design document, classifier label, passing unit test, browser capability, user preference, or merged pull request does not prove that changing a request is safe in a real institution.

The project needs a boundary that code and reviewers can enforce before any future rule engine exists.

## Decision

Gate 1 is documentation, schemas, synthetic fixtures, and deterministic contract validation only. Gate 2 is observation-only. In both gates the complete network action set is `{ALLOW}`. Neither gate may add a blocking listener, declarative rule, redirect, cancellation, delay, request/response mutation, header operation, body access, page-script interception, proxy, or certificate control.

A future enforcement engine is outside the trusted Gate 1/2 data path. Its interface remains logically disconnected and must default to an empty rule set. No event, classifier output, stored record, remote input, or UI toggle can populate that set.

## Rule-specific authorization record

Gate 3 may implement one narrow synthetic enforcement candidate only after the pull request includes an accepted, human-readable authorization record containing all of the following:

1. Stable rule ID, owner, purpose, exact browser adapters, match semantics, and explicit expiry/review date.
2. Primary-source evidence that the destination is separately hosted, optional, and not shared with Canvas, SSO, LTI, content, accessibility, assessment, save/submission, security, support, or compliance functions.
3. Written confirmation from the self-owned environment operator or named institutional owners for Canvas administration, privacy, accessibility, security, and academic integrity.
4. Proof that matching requires no cookies, headers, bodies, query, fragment, page/answer state, or raw stored URL and works at the Chromium portability floor.
5. Deterministic baseline/equivalence, multi-tab/window, assessment-dominance, SSO, restart/suspension, permission-revocation, failure-injection, rollback, and stale-evidence tests.
6. Exact local pinned rule content and hash. Remote rules, remote code, automatic list downloads, dynamic expansion, and unreviewed redirects are prohibited.
7. Dependency and file-level license review preserving PolyForm Noncommercial and all third-party obligations.
8. A reviewed rollback that removes the rule atomically and proves the installed rule set empty on mismatch.

The record authorizes implementation and synthetic testing only. It does not authorize installation in a normal browser profile, use with a real Canvas account/course, institution testing, graded work, packaging, signing, store submission, release, or claim of safety.

## Two-stage runtime boundary for a later gate

If Gate 3 is separately accepted, a rule could become eligible only when both independent conditions are true:

- **static authorization:** the running build contains the exact unexpired reviewed record and rule hash; and
- **dynamic safety:** lifecycle state is future enforcement-eligible, assessment state is definitely not suspected, permissions and tab state reconcile, classifier revision matches, and the event is `optional_separable` without conflicting evidence.

Any missing, stale, unknown, or conflicting condition yields `ALLOW` and an empty session rule set. Assessment-safe, SSO transit, initialization, permission loss, emergency disable, private browsing, restart, schema mismatch, rule mismatch, or adapter failure removes rules before other processing.

## Never-authorized classes

No gate may alter essential, assessment, focus, visibility, quiz, answer, save, autosave, submission, authentication/SSO, security, accessibility, same-origin, batched, payload-dependent, or unknown traffic. The rule engine must not inspect or rewrite a body to isolate an optional object.

## Release and institutional boundary

Gate 3 synthetic evidence does not authorize Gate 4. Gate 4 requires a separately approved non-graded environment, synthetic accounts/content, exact build and rule hash, named administrators, and documented retention/rollback. Gate 5 review does not itself authorize public release; publishing or representing a build as safe requires explicit owner authority and the roadmap’s security, provenance, packaging, and compatibility evidence.

## Consequences

- Gate 2 can validate lifecycle, privacy, accessibility, and classification without creating a dormant bypass path.
- Optional-looking same-origin traffic remains allowed even if that limits privacy benefits.
- Each future rule carries its own evidence and expiration instead of inheriting trust from a broad list.
- Institution-specific uncertainty blocks enforcement rather than blocking Canvas.
- Implementing observation first cannot be cited as implicit approval to modify traffic later.

## Rejected alternatives

| Alternative | Reason rejected |
| --- | --- |
| Add disabled enforcement code in Gate 2 | Dormant privileged code widens risk and weakens the review boundary |
| Let users opt in to arbitrary URL rules | A user toggle cannot establish separability or protect assessments |
| Use a remote maintained filter list | Compromise or drift could silently break login, save, submission, or security |
| Permit Firefox-only body-aware rules | Body access violates minimization and cannot meet Chromium parity |
| Treat repository merge as production approval | Source review is not installation, institutional acceptance, or release evidence |

## Gate 2 entry criteria

Gate 2 may begin only after this Gate 1 set is reviewed and accepted on `main`, all contract checks pass, no unresolved high-severity contract contradiction remains, and the Gate 2 pull request is constrained to an observation-only scaffold plus pure reducer and synthetic tests. It must request no blocking capability and must preserve `networkAction = ALLOW` as a machine-checked invariant.
