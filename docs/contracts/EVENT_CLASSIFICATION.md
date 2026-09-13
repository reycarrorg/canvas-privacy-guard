# Event Classification Contract

Status: **Gate 1 contract; Gate 1 and Gate 2 always allow traffic**

This contract classifies only already-redacted categorical metadata from the [metadata contract](METADATA_AND_RETENTION.md). It does not authorize request cancellation, delay, redirection, header changes, body inspection, body rewriting, script injection, or traffic modification.

## Universal decision rule

For Gate 1 and Gate 2:

```text
networkAction(event, state) = ALLOW
```

This is true for every class and every lifecycle state. Classification exists to make observation explainable and to preserve a future review boundary. It is not a disguised enforcement path.

Uncertainty is monotonic toward safety: missing evidence, conflicting evidence, non-enumerated input, classifier failure, schema failure, stale provenance, same-origin ambiguity, or payload-dependent meaning produces `unknown` and `ALLOW`. A classifier may become less specific without new evidence; it may never infer `optional_separable` from absence of evidence.

## Closed event classes

| Class | Required meaning | Gate 1/2 action | Future enforcement eligibility |
| --- | --- | --- | --- |
| `essential` | Traffic needed or plausibly needed for navigation, content, files/media, accessibility, external tools, timers, state, or ordinary LMS operation | `ALLOW` | Never |
| `assessment` | Known, suspected, or possibly assessment-related activity, including focus/visibility/quiz/attempt behavior | `ALLOW`; enter or preserve `ASSESSMENT_SAFE`; skip request recording | Never |
| `authentication_sso` | Login, logout, SSO, MFA, session establishment/refresh, identity-provider transit, authorization, or indeterminate auth support | `ALLOW`; no identity-origin observation | Never |
| `autosave_submission` | Answer save, autosave, draft, upload, final submission, confirmation, receipt, retry, grading handoff, or traffic that may carry these semantics | `ALLOW` | Never |
| `security` | CSRF, abuse prevention, fraud, bot detection, device/session security, integrity, incident response, rate limit, or indeterminate security support | `ALLOW` | Never |
| `optional_separable` | A separately hosted request class proven optional, payload-independent, non-security, non-assessment, and non-functional by accepted evidence | `ALLOW` in Gate 1/2 | Gate 3 candidate only after ADR 0002 authorization |
| `unknown` | Anything not proven to satisfy exactly one safer class, including conflicting, same-origin, batched, or stale classifications | `ALLOW`; disable future enforcement | Never unless new evidence creates a new versioned classification |

“Never” means no future rule may suppress, falsify, redirect, mutate, delay, replace, or synthesize the traffic. It also forbids manipulating page code to prevent the event from being generated.

## Classification inputs

The classifier receives only these schema-defined categories:

- destination relationship, never a raw origin or hostname;
- route/path class, never a URL, query, fragment, or path;
- resource type and coarse method class;
- initiator relationship, never a tab/frame/request identifier;
- current lifecycle state and local classifier revision.

The adapter may compare a volatile URL to exact local origin/rule data only to produce these categories. It must discard the raw URL before shared code or logging. Cookies, headers, bodies, payload lengths, response data, page content, focus details, answer state, grades, and user identity are not inputs.

## Safe precedence

When evidence could match more than one class, choose the first applicable row:

1. `assessment`
2. `authentication_sso`
3. `autosave_submission`
4. `security`
5. `essential`
6. `optional_separable` only if every proof condition below is true
7. `unknown`

This order does not rank importance. It makes safety tripwires dominate an optional classification. Conflicting evidence yields `unknown` if the higher class cannot be established safely.

## Never-alter rules

The following facts independently disqualify a request from `optional_separable`:

- destination is the enrolled Canvas origin, a shared Canvas/Instructure origin, an identity provider, an LTI/external-tool origin, or unknown;
- semantics depend on a request/response body, headers, cookies, query, fragment, page state, JavaScript object, or response content;
- one request can batch more than one event class;
- route or origin may be used for focus, visibility, quiz, attempt, answer, save, autosave, submission, authentication, session, security, accessibility, timer, content, file, media, navigation, or unknown behavior;
- initiator relationship, permission state, route class, browser context, assessment state, or classifier version is missing, stale, or inconsistent;
- the only evidence is a name containing words such as analytics, metrics, telemetry, beacon, events, collect, pixel, or tracking;
- the classification relies on a remotely mutable list, runtime download, vendor marketing, issue text, course content, or another unreviewed source.

Same-origin and batched requests are always `assessment`, another applicable protected class, or `unknown`. They are never `optional_separable`, even if one payload member appears optional. The product must never open the body to split or rewrite the batch.

## Optional-separable proof obligation

All of the following must be established in a rule-specific authorization record before a class can even be proposed for Gate 3:

1. The destination is a technically separate third-party origin, not the enrolled Canvas origin, SSO, an LTI, or shared infrastructure.
2. Official service-owner documentation identifies the class as optional analytics and identifies its owner and purpose.
3. The institution or self-owned operator confirms that the class is not required for authentication, accessibility, content, support, security, assessment, saving, submission, retention, or compliance.
4. Synthetic disabled/enabled receipt tests prove byte-for-byte-equivalent delivery for every protected flow and deliberate failure tests prove safe recovery.
5. The match can be expressed using metadata available consistently on Firefox and Chromium without body/header/query/fragment inspection.
6. The exact rule, browser scope, classifier revision, evidence version, expiry/review date, and rollback behavior are human-reviewed and locally pinned.
7. ADR 0002’s authorization and release gates are satisfied. No remote update can expand the rule.

Failure or expiry of any condition reclassifies the event as `unknown` and removes the rule before traffic is processed.

## Synthetic examples

| Redacted facts | Classification | Reason |
| --- | --- | --- |
| Enrolled origin, state-changing method, unknown path | `unknown` | Same-origin and payload meaning are ambiguous |
| Enrolled origin, suspected assessment path | `assessment` | Assessment tripwire dominates |
| Identity-provider transit with any resource type | `authentication_sso` | SSO is never inspected or altered |
| Separate external-tool origin in an assessment frame | `assessment` | Context dominates destination naming |
| Separate third party labeled “analytics” with no accepted evidence | `unknown` | Names and marketing are not proof |
| Separately hosted synthetic analytics fixture with a Gate 1 label | `optional_separable` + `ALLOW` | Classification may be tested, but enforcement is still unavailable |
| Batched synthetic event endpoint containing optional and save events | `autosave_submission` or `unknown` | Batch cannot be separated without forbidden body access |

## Determinism and versioning

The classifier is a pure function of the closed categorical input, local evidence table, and explicit classifier revision. For identical inputs and revision it returns identical `eventClass`, `networkAction`, `observationAction`, and reason code. Rules and evidence never update remotely. An unknown enum, older/newer schema, or unrecognized revision returns `unknown` and `ALLOW`.
