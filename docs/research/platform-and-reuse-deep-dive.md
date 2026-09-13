# Platform and Reuse Deep Dive

## Executive decision

Canvas Privacy Guard should use a **standards-based WebExtension architecture with a Firefox-first observation prototype**. The shared core should remain portable to Chromium Manifest V3, with a Chromium adapter built and tested before any enforcement work. Safari should be a later compatibility port through a Safari Web Extension container. A native companion should not be built unless a future accepted requirement cannot be met inside the browser.

This is a platform decision, not authorization to alter production traffic. Gate 1 must still define the threat model and event-classification contract. Gate 2 should be observation-only. Any eventual enforcement must be limited to an explicitly documented optional third-party request class and must default to allowing traffic when the route, origin, payload semantics, browser state, or assessment status is uncertain.

The decisive reasons are:

- A browser extension is the smallest layer that can automatically correlate tabs, windows, frames, navigation, initiator origin, and browser-visible request metadata without TLS interception or operating-system-wide privileges.[^1][^2]
- Institution-specific Canvas origins can be enrolled as optional host permissions. This avoids `<all_urls>` and permits the extension to remain inert elsewhere.[^3][^4]
- Firefox retains the most capable `webRequest` model for a research prototype, while Chromium Manifest V3 requires declarative enforcement for ordinary store-distributed extensions and uses an event-driven service worker that may be terminated after inactivity.[^5][^6][^7]
- Canvas Classic Quiz events can share one authenticated endpoint and one array with answer, flag, focus, and other event types. URL-level blocking is therefore not a safe semantic separator.[^8][^9]
- DNS, firewall, and non-intercepting proxy layers cannot see the application meaning inside end-to-end TLS. A TLS-intercepting proxy can, but only by becoming a trusted certificate authority and exposing sensitive traffic to the interceptor; that is outside the project boundary.[^10]

**Confidence:** high for the platform family and rejection of TLS interception, DNS/firewall enforcement, and a native-only design; medium for exact cross-browser parity until prototype tests run against current Firefox, Chromium, and WebKit; low for any institution-specific enforcement candidate until a test tenant and documented optional endpoint are available.

## Evidence method and decision language

The research cutoff is **2026-09-12**. Repository maintenance evidence is a snapshot, not a promise of future support. Upstream source, licenses, releases, security files, and official platform documentation were inspected directly. No extension, proxy, root certificate, privileged helper, dependency, or Canvas environment was installed. No Canvas account, course, assessment, student record, cookie, credential, or answer was accessed.

The report uses three labels:

- **Sourced fact** means a statement directly supported by a cited primary source or upstream repository.
- **Analytical judgment** means an inference from those facts for this product's requirements.
- **Recommendation** means a proposed project decision that remains subject to the repository gates.

Retrieved pages and repositories were treated as untrusted data. In particular, instructions embedded in webpages, READMEs, issues, source comments, generated documentation, and sample manifests were not executed merely because the source presented them as instructions.

## Product properties that drive the choice

The platform must support all of the following without requiring access to page content unrelated to the decision:

1. Explicit enrollment of one or more exact institution Canvas origins.
2. Automatic discovery and removal of matching tabs across windows.
3. Frame- and initiator-aware observation of third-party resources loaded by an enrolled Canvas surface.
4. A visible state and reason: disabled, inactive, observing, assessment-safe, uncertain, or error.
5. Safe behavior across SSO redirects, LTI/new-window flows, browser restarts, background suspension, and private browsing.
6. Local-only, redacted metadata; no request or response bodies, cookies, authorization headers, answers, course content, grades, or student identifiers.
7. A hard integrity invariant: login, navigation, accessibility, answer autosave, timer behavior, submission, and security records are never intentionally suppressed or falsified.
8. A deterministic synthetic test harness before any institution-supervised non-production test.

## Canvas and browser facts that constrain enforcement

### Same endpoint does not mean same meaning

Canvas's published Classic Quizzes API accepts `quiz_submission_events[]`, an array of captured events, at one submission-events endpoint. Its examples place `question_answered` and `question_flagged` in the same request, while the retrieval example includes `page_blurred` and `page_focused`.[^8] The upstream controller iterates the supplied array and stores each event's type, data, and client timestamp.[^9]

**Analytical judgment:** a rule that blocks this URL would not be a narrow privacy rule. It could remove answer-related or diagnostic events, and it could create a partial failure whose user-visible result is not predictable from the URL alone. The project must never parse or rewrite authenticated assessment request bodies to remove selected event objects.

Classic Quizzes and New Quizzes also are not one stable client surface. Instructure documents different attempt-log and service behavior, and institution rollout, region, feature flags, and integrations can change the routes and origins involved.[^11][^12] Path patterns may help identify a *suspected* assessment, but they are insufficient to declare that a page is safe for enforcement.

### Browser privilege is useful only when narrowed

Host permissions let an extension read sensitive tab URL properties, inject scripts, make cross-origin requests, or observe network requests for matching hosts, depending on the API requested.[^3] Chrome recommends optional permissions and smaller host scopes because permission changes can generate prominent warnings.[^3] Safari likewise instructs developers to prefer `activeTab`, host permissions, and optional permissions over `<all_urls>`.[^13]

**Recommendation:** store the institution enrollment as an exact scheme-and-host origin selected by the user. Request that origin at runtime. Do not declare `<all_urls>`, cookies, history, downloads, clipboard, debugger, proxy, nativeMessaging, or accessibility permissions. A third-party destination should be observed only when the browser provides both the destination and an enrolled Canvas initiator/tab relationship; it should not be added as a standing host permission merely because one Canvas page loaded it.

### Lifecycle state must be reconstructed

Chromium Manifest V3 service workers are event-driven and can be terminated after roughly 30 seconds of inactivity; global variables are lost, and the official guidance is to persist necessary state and tolerate unexpected termination.[^6] Extension update and browser-start behavior can also restart the runtime.[^7]

**Recommendation:** the current activation state must be a pure derivation from authoritative inputs—enrolled origins, current tabs/frames, permission grants, and the latest classified navigation—not an assumption that an in-memory boolean remained correct. On startup, installation/update, permission change, tab replacement, or runtime wake, enumerate current tabs and reconstruct state before displaying “active.”

### Private browsing is a distinct consent boundary

Firefox and Chromium leave private/incognito access under user control. Firefox's manifest model defaults to spanning when access is granted, does not support split mode, and warns that `storage.local` can be shared across private and non-private contexts.[^14] Chromium similarly requires the user to enable incognito access.[^3] Safari exposes profile and private-browsing controls; on current Safari versions a website access grant can span profiles/private browsing even though extension enablement can be controlled separately.[^13][^15]

**Recommendation:** default private-browsing support to off at the product layer even if the browser grant exists. If a future user explicitly enables it, retain no browsing log, never bridge private tab identifiers or observations into normal-session storage, show a distinct private-state indicator, and test each browser separately. Where isolation cannot be proven, remain inactive in private windows.

## Weighted platform comparison

Scores use 1 (poor) through 5 (strong). The weighted total is out of 100. The scoring is an analytical judgment based on the cited platform capabilities and this repository's non-negotiable integrity rules.

| Criterion | Weight | What a 5 means |
| --- | ---: | --- |
| Integrity and safe failure | 25 | Can fail open without disrupting login, save, submission, or security records |
| Request granularity | 15 | Can correlate browser request metadata with tab, frame, initiator, and route without TLS interception |
| Canvas-only lifecycle | 15 | Reliably discovers and removes matching surfaces across windows and restarts |
| Least privilege and privacy | 12 | Exact optional origin scope; no system-wide visibility or sensitive-body collection |
| Portability | 10 | Practical support across Firefox, Chromium, and Safari |
| Recovery and observability | 8 | Reconstructable state, visible reasons, deterministic fault handling |
| Distribution burden | 6 | Low signing, review, packaging, and update burden |
| Maintenance ecosystem | 5 | Current standards, samples, tooling, and maintainers |
| Accessibility | 4 | State and controls can be keyboard- and assistive-technology accessible |

| Candidate | Integrity | Granularity | Lifecycle | Least privilege | Portability | Recovery | Distribution | Ecosystem | Accessibility | Weighted total | Disposition |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Cross-browser WebExtension architecture | 4 | 4 | 5 | 4 | 5 | 4 | 3 | 4 | 4 | **83.8** | **Select** |
| Firefox-first extension | 4 | 5 | 5 | 4 | 2 | 4 | 4 | 4 | 4 | **82.0** | **First implementation target** |
| Chromium Manifest V3 extension | 4 | 3 | 5 | 4 | 3 | 3 | 5 | 5 | 4 | **78.6** | Required second adapter |
| Safari Web Extension/native container | 4 | 3 | 4 | 4 | 2 | 3 | 2 | 3 | 4 | **68.0** | Later port |
| Hybrid extension/native companion | 4 | 4 | 5 | 2 | 2 | 3 | 1 | 2 | 4 | **67.0** | Defer; no requirement justifies it |
| CLI or script | 4 | 2 | 2 | 4 | 3 | 2 | 5 | 3 | 2 | **61.4** | Test/support tooling only |
| Userscript or content-blocker ruleset | 2 | 2 | 3 | 3 | 4 | 2 | 3 | 4 | 2 | **52.6** | Reject as product runtime |
| DNS or outbound firewall control | 3 | 1 | 1 | 3 | 4 | 2 | 4 | 5 | 1 | **50.0** | Reference/diagnostics only |
| Native macOS app | 3 | 2 | 2 | 2 | 1 | 3 | 2 | 3 | 4 | **47.2** | Reject as primary runtime |
| Local TLS-intercepting proxy | 1 | 5 | 1 | 1 | 2 | 1 | 2 | 4 | 1 | **38.2** | Reject |

### Cross-browser WebExtension

**Sourced facts.** Firefox, Chromium, Edge, and Safari implement overlapping WebExtension APIs. Official Mozilla and Chrome samples cover tabs, navigation, permissions, and request observation; Safari packages common web-extension files inside an Apple platform container.[^1][^13][^16] APIs still differ materially in background lifecycle, private modes, blocking capability, and rule support.[^5][^6][^14]

**Judgment.** A shared domain model with small browser adapters offers the best balance: origin enrollment, tab/frame correlation, a browser toolbar state, local storage, and request metadata belong in the shared core; runtime wakeup, request hooks, private-context behavior, and packaging belong behind adapters.

**Recommendation.** Define a browser-neutral state reducer and event schema. Do not paper over behavioral differences with a claim of perfect parity. The support table and tests must disclose each browser's actual capability.

### Firefox-first extension

**Sourced facts.** Firefox exposes `webRequest` events with URL filters, request IDs, request stages, tab/frame information, and—when separately permitted—blocking responses.[^2] Full uBlock Origin's current Firefox manifest demonstrates the mature but broad end of that permission surface: `<all_urls>`, tabs, navigation, request observation, and request blocking.[^17]

**Judgment.** Firefox is the best research target because observation and rule experiments can be expressed explicitly and tested without designing around Chromium's declarative rule limits first. uBlock Origin and Privacy Badger prove the platform can support sophisticated privacy tools; their broad permissions are not a template for this project.

**Recommendation.** The Firefox prototype should request only storage plus the exact enrolled Canvas origin and the minimum tab/navigation/request APIs needed for observation. Do not request request-body access, cookies, or `<all_urls>`. Even though Firefox can block synchronously, Gate 2 must not use that capability.

### Chromium Manifest V3 extension

**Sourced facts.** Chrome removed `webRequestBlocking` for most Manifest V3 extensions and points developers to `declarativeNetRequest` (DNR). DNR makes URL/resource/header decisions without exposing full request content, requires relevant host access for many actions, and does not affect responses generated from a service worker's CacheStorage.[^4][^5] The background service worker can be suspended and restarted.[^6]

**Judgment.** Chromium is viable for exact-origin lifecycle and observation, but a future enforcement feature must fit DNR's declarative, URL-oriented model. That limitation is beneficial here: if an optional event cannot be separated by stable origin/path/resource class, it is not safe to enforce in Chromium and probably is not a sound product rule anywhere.

**Recommendation.** Use Chromium as the portability floor for enforceable rule semantics. A Firefox-only rule that requires body mutation or quiz-code interception is categorically out of scope, not a premium capability.

### Safari Web Extension and native container

**Sourced facts.** Safari Web Extensions reuse common extension formats, support DNR with browser-specific action/condition availability, and require user website access.[^13][^18] Distribution requires an Apple container plus signing/App Store or Developer ID/notarization workflows; unsigned development extensions are temporary or require explicit developer testing settings.[^19][^20]

**Judgment.** Safari is technically plausible but adds packaging, signing, permission-model, profile, and testing costs before it adds a unique privacy capability. A native container is required for distribution but is not by itself a justification for a native companion data plane.

**Recommendation.** Keep the shared core Safari-compatible, but delay the port until Firefox and Chromium observation behavior is stable and an Apple signing/distribution decision is separately authorized.

### Native macOS application

**Sourced facts.** A native app that controls or queries other apps can trigger Automation/Apple Events or Accessibility permissions.[^21][^22] A Network Extension content filter uses special entitlements and system/app extensions to pass or block network flows and operates at an OS-wide control plane.[^23][^24]

**Judgment.** A native-only app cannot reliably know all Firefox, Chromium, and Safari tab origins without per-browser automation or accessibility access. A Network Extension is broader than needed and still does not turn a same-origin encrypted body into a safe semantic rule without inspecting sensitive content.

**Recommendation.** Reject native macOS as the primary platform. Revisit a small companion only for a concrete later requirement such as enterprise-managed policy, signed local export, or Safari packaging—not for traffic inspection or browser surveillance.

### CLI or local script

**Sourced fact.** Browser automation frameworks can launch and inspect controlled browser contexts, but they do not automatically attach to every ordinary user tab without a persistent profile, debugging connection, or browser extension.[^25][^26]

**Judgment.** A CLI is excellent for deterministic fixtures, rule compilation, linting, provenance checks, and redacted report inspection. It is poor as an automatic end-user lifecycle manager: terminal persistence, browser attachment, permissions, and visible state become user burdens.

**Recommendation.** Use CLI code only in development/test tooling. Do not require users to launch a script alongside school browsing.

### Userscript or content-blocker ruleset

**Sourced facts.** Browser content blocking can make URL/resource decisions; Safari and Chromium expose declarative rules, and mature lists use similar host/path patterns.[^4][^18] A userscript executes inside authenticated page contexts selected by match patterns.

**Judgment.** A static ruleset cannot manage nuanced lifecycle or distinguish objects within a batched same-origin body. A userscript powerful enough to intercept Canvas event generation would be fragile, difficult to audit, and dangerously close to the misconduct/evasion tools excluded by the charter.

**Recommendation.** Rules may eventually be an exported, reviewable implementation detail of a browser extension for separately hosted optional analytics. Reject standalone userscripts and quiz-page scriptlets as the product.

### DNS and firewall controls

**Sourced facts.** DNS policies decide by hostname, while LuLu and similar outbound firewalls primarily decide using process, destination, address/domain, and port. The existing landscape report documents these limits in detail. TLS, connection reuse, shared CDNs, SSO, media, LTIs, and region-specific Canvas hosts further reduce safe precision.

**Judgment.** These controls can identify or block a distinct third-party tracker domain, but cannot know which Canvas semantic event is inside a connection to the institution's first-party host. Automatic activation based on an open Canvas tab is also outside their normal lifecycle model.

**Recommendation.** Use them only as comparative visibility evidence in a separately authorized sandbox if already available. Do not install or configure them for this project and do not publish a Canvas denylist.

### Local proxy and mitmproxy

**Sourced facts.** mitmproxy can decrypt TLS only when the client trusts its generated certificate authority; the official documentation describes installing that CA and generating per-site interception certificates.[^10] Certificate pinning can make interception fail.[^10]

**Judgment.** The proxy would handle credentials, cookies, answers, course content, and authentication flows. Its failure surface includes certificate errors, pinning, HTTP/3 differences, SSO breakage, and accidental capture outside Canvas. That is disproportionate and contradicts the repository's certificate and sensitive-data boundaries.

**Recommendation.** Reject mitmproxy and any TLS-intercepting proxy as product controls. Do not install, run, or copy a proxy configuration. A local synthetic server can expose its own test request bodies directly without interception.

### Hybrid extension plus native companion

**Sourced fact.** Browser native messaging can connect an extension to a registered host process, while Safari's container can exchange data with its extension.[^27][^20]

**Judgment.** A companion adds a second privilege boundary, native-host registration, platform-specific packaging, IPC validation, update coordination, and a larger attack surface. It does not solve same-origin semantic ambiguity.

**Recommendation.** Keep the extension self-contained. Reconsider only through a new ADR with a named capability gap, least-privilege IPC schema, signing/update plan, and proof that browser-only operation is inadequate.

## Selected architecture

```text
Browser events ──> browser adapter ──> pure lifecycle reducer ──> visible state
                         │                      │
                         │                      └── local, minimal settings
                         │
                         └── redacted request metadata ──> classifier
                                                             │
                                  essential / assessment / unknown ──> allow
                                  optional + separable + approved ──> future rule
```

The architecture has four layers:

1. **Browser adapter:** converts tabs, windows, frames, navigation, permission changes, and browser startup/wakeup into a small event vocabulary.
2. **Lifecycle reducer:** a pure, deterministic state machine. It does not inspect page text, answer fields, cookies, or request bodies.
3. **Metadata classifier:** consumes only normalized origin, path class, resource type, initiator/tab relationship, method category, and a locally assigned rule identifier. Query strings and fragments are removed before storage.
4. **UI/audit surface:** a keyboard-accessible toolbar/panel showing state, reason, enrolled origins, rules, and emergency disable. Chrome's accessibility guidance recommends native HTML controls, keyboard access, visible focus, and accessible toolbar titles.[^28] WCAG 2.2 is the acceptance baseline for the extension UI.[^29]

The initial implementation must not include remote telemetry, cloud sync, accounts, analytics, advertising, update-time remote rule downloads, or a native host. Dependencies and browser binaries used in CI are development artifacts, not product data services.

## Automatic activation state machine

### State definitions

| State | Meaning | Network behavior | Visible requirement |
| --- | --- | --- | --- |
| `DISABLED` | User emergency disable or extension disabled | No observation or enforcement | “Off — user disabled” |
| `NO_PERMISSION` | No enrolled origin or host grant missing/revoked | No observation or enforcement | Exact origin needing approval |
| `IDLE` | Permissions exist; no recognized Canvas surface | No Canvas processing; session rules cleared | “Idle — no enrolled Canvas tab” |
| `CANDIDATE` | Top-level tab is navigating toward an enrolled origin; classification incomplete | Observe navigation only; allow all | “Checking origin” |
| `SSO_TRANSIT` | Finite redirect/new-window chain initiated by a recognized tab but currently on an unenrolled identity origin | No content injection, no request blocking, no logging of URL/query | “Paused for sign-in” |
| `ACTIVE_OBSERVE` | At least one confirmed top-level enrolled Canvas tab exists | Redacted metadata observation only in Gate 2 | “Observing — N Canvas tabs” |
| `ASSESSMENT_SAFE` | Any recognized tab/frame is a suspected assessment or assessment status is ambiguous | **Allow all; no body/DOM capture; enforcement disabled globally for the affected browser context** | “Assessment-safe — filtering paused” |
| `UNCERTAIN_ALLOW` | Permission, route, initiator, lifecycle, browser API, or classifier result is inconsistent/unknown | Allow all; retain only local error code | “Uncertain — allowing traffic” |
| `STOPPING` | Last recognized surface closed/navigated away or browser is shutting down | Remove session-scoped rules/listeners; discard ephemeral tab map | “Stopping” then `IDLE` |

### Authoritative inputs

- Exact enrolled origins and current permission grants.
- Current top-level tabs across all browser windows and, when exposed, their frames.
- Navigation commit, tab create/update/remove/replace, window remove, permission add/remove, runtime startup/install/update, and browser suspend/wake events.
- A versioned, local assessment-route classifier whose only output is `suspected`, `not_suspected`, or `unknown`.
- Private/incognito context flag and whether product-level private support was explicitly enabled.

Page text, quiz questions, answer fields, cookies, authorization state, grades, course IDs, student names, and request bodies are **not** inputs.

For the observation prototype, “Canvas is running” means at least one top-level tab in the browser context has a committed URL on an exact enrolled Canvas origin, regardless of whether that tab currently has keyboard focus. It does **not** mean that the extension has detected login state, inferred attention, or identified a person. Deactivation begins when the last such tab closes or commits a navigation away, subject only to the finite `SSO_TRANSIT` pause described below.

### Transition rules

1. On runtime start/wake/update, begin in `UNCERTAIN_ALLOW`, enumerate permissions and all tabs, reconstruct the tab map, then reduce to `NO_PERMISSION`, `IDLE`, `ACTIVE_OBSERVE`, or `ASSESSMENT_SAFE`.
2. An exact-origin top-level navigation enters `CANDIDATE`; it becomes active only after the committed URL matches an enrolled origin and the host grant still exists.
3. A navigation from an active Canvas tab to an unenrolled identity provider enters `SSO_TRANSIT` for that tab only. The transit has a short monotonic timeout, does not broaden host permissions, and ends on return to an enrolled origin, navigation elsewhere, tab close, or timeout.
4. New windows or tabs opened by an active Canvas tab are evaluated independently. Opener linkage is supporting evidence, never permission to treat an arbitrary destination as Canvas.
5. The context enters `ASSESSMENT_SAFE` if any matching top-level tab or child frame is suspected or unknown-assessment. This context-wide pause avoids a second Canvas tab keeping filters enabled while an assessment is open elsewhere.
6. Multiple active tabs use reference-counted membership keyed by browser context and tab ID. Closing or navigating one tab removes only that member. The extension stops only when the last member leaves and no assessment-safe member remains.
7. Revoking a host permission, losing authoritative tab state, an adapter exception, storage/schema mismatch, or rule-application mismatch immediately enters `UNCERTAIN_ALLOW` and clears session enforcement.
8. Private tabs are ignored by default. If explicitly enabled and supported, they use an ephemeral in-memory tab map and never write browsing observations to shared storage.
9. Browser shutdown, extension disable, or update enters `STOPPING`. Session rules must be safe if cleanup does not run; on the next start, reconstruction clears stale rule state before activation.

### Assessment recognition is a safety tripwire, not a surveillance feature

The classifier may use only route/placement facts already visible to the extension, such as a versioned set of known Classic/New Quizzes path classes and frame-origin categories. It must not inspect quiz content or infer whether an attempt is graded. Unknown equals suspected. This can cause privacy filtering to pause too often; that is the intended failure direction.

The extension must never suppress focus/visibility events, mutate Canvas JavaScript, block quiz event APIs, alter answer or submission transactions, keep a page artificially active, fabricate a clean log, or claim that “no event recorded” proves no focus change.

## Permission design

### Initial Firefox manifest target

- Required API permissions: `storage`; `tabs` only if current Firefox behavior and tests show exact-origin host grants cannot provide the required URL events.
- Optional origin permissions: user-enrolled exact `https://institution.example/*` patterns.
- Observation permission: `webRequest` only when Gate 2 request inventory begins; no `webRequestBlocking` in the observation prototype.
- Navigation permission: prefer tab update events; add `webNavigation` only if frame/commit evidence is needed and documented.
- Explicitly absent: `<all_urls>`, `cookies`, `history`, `downloads`, `proxy`, `nativeMessaging`, `debugger`, `management`, clipboard, geolocation, camera, microphone, screen capture, and remote code.

### Chromium adapter

- Manifest V3 service worker with state reconstruction.
- Exact optional host permissions.
- `declarativeNetRequestWithHostAccess` only in a future approved enforcement gate; static/session rule IDs must be auditable.
- No `declarativeNetRequestFeedback` in production because it is a debugging surface and may create additional warnings/visibility.
- Session rules must be empty by default and cleared before activation reconstruction.

### Safari adapter

- Same exact-origin and minimal-permission model.
- Explicit test matrix for profile/private enablement and website grants.
- No native data export by default. The container is packaging/UI only unless a later ADR establishes a need.

## Failure analysis

| Failure | Potential consequence | Required safe response | Release evidence |
| --- | --- | --- | --- |
| Canvas origin changes | Tool fails to activate or matches wrong site | Exact-origin enrollment fails closed for activation; no broad wildcard | Origin migration test |
| SSO redirect exceeds timeout | Login may appear inactive | Pause, allow, and show state; never block identity domains | Redirect/timeout tests |
| MV3 worker suspension | Stale tab count or stale rules | Reconstruct from tabs/permissions; clear rules first | Forced-idle restart test |
| Two windows disagree | Filtering remains on during assessment | Context-wide assessment-safe dominance | Multi-window property tests |
| Tab replacement/prerender/bfcache | Ghost active member | Handle replace/commit events and periodic user-visible reconciliation | Lifecycle fault tests |
| Private-access mismatch | Undisclosed private observation | Ignore private tabs unless explicit product opt-in and isolation verified | Per-browser private tests |
| LTI/iframe unknown | Login/tool breakage | Classify unknown; allow all | Synthetic third-party-frame tests |
| Optional endpoint becomes shared | Save/submission failure | Provenance/version mismatch disables rule | Contract and negative tests |
| Filter-list update compromised | Broad denial or exfiltration | No remote runtime lists; reviewed pinned rules in releases | Reproducible rule hash/diff |
| UI inaccessible | User cannot disable or understand state | Native controls, keyboard tests, screen-reader labels, non-color state text | WCAG/keyboard checklist |
| Local log contains identifiers | Privacy harm | Schema rejects query/body/header/content fields; retention and delete tests | Snapshot and property tests |
| Extension error | Hidden partial enforcement | Atomic rule application; on any mismatch remove rules and show `UNCERTAIN_ALLOW` | Fault injection |

## Synthetic and self-owned test environment

### Tier 0: pure reducer tests

Use table-driven and property-based tests against the state reducer. Generate tab/window/permission event sequences, including duplicate events, out-of-order removals, worker restarts, and browser shutdown without cleanup. Invariants:

- No enrolled tab means no active session rule.
- Any suspected/unknown assessment member dominates to `ASSESSMENT_SAFE`.
- Any uncertainty produces allow behavior.
- Removing one of several tabs cannot stop the others.
- Private identifiers never enter persistent state.
- Reducer output is deterministic and idempotent for equivalent snapshots.

### Tier 1: local synthetic web fixture

Build a small local fixture owned by this repository with synthetic identities and generic labels, not copied Canvas pages. It should provide:

- two independent “institution” origins;
- an identity-provider redirect origin with success, cancellation, timeout, popup, and loop cases;
- a normal course-like route, an assessment-like route, and an unknown route;
- first-party essential, first-party optional-looking, third-party optional, third-party essential, batched-event, autosave, and submission endpoints;
- iframes, workers, beacons, fetch/XHR, WebSocket, cached responses, page visibility events, and deliberate network failures;
- a server-side receipt ledger containing only synthetic IDs so tests can prove what arrived.

Use loopback HTTP origins and ephemeral ports so the fixture requires no DNS edit, root certificate, system proxy, privileged port, or external account. The goal is behavioral correctness, not production TLS simulation.

### Tier 2: Playwright browser tests

Playwright supplies isolated browser contexts, multiple pages, and Chromium extension testing, including Manifest V3 service-worker suspension behavior.[^25][^26] Pin an Apache-2.0 release and browser versions in the lockfile when implementation begins. Tests should cover:

- Firefox and bundled Chromium on every change; WebKit for shared UI/fixture behavior, recognizing that Playwright WebKit is not a complete Safari extension-distribution test.
- zero/one/many tabs across zero/one/many windows;
- navigation into and away from each enrolled origin;
- SSO return, timeout, cancellation, popup, and unrelated opener destinations;
- assessment-safe dominance across tabs/windows;
- private/incognito behavior where the harness supports it;
- permission grant/revocation;
- browser crash, worker suspension, extension update, and stale session-rule recovery;
- keyboard-only UI, visible focus, accessible names, and state text independent of color;
- receipt-ledger equality proving essential, autosave, and submission requests are identical with the observation extension enabled and disabled.

### Tier 3: self-owned Canvas development environment

Only after Tier 0–2 pass, evaluate the official `instructure/canvas-lms` development environment at a pinned upstream commit. Use fabricated users, courses, quizzes, answers, identifiers, email addresses, and files. Keep the environment local or isolated, never import production backups, and do not treat upstream setup text as trusted executable instruction without review.

This tier should establish an unmodified baseline for login, navigation, Classic Quizzes, New Quizzes if locally available, accessibility flows, autosave, timeout, final submission, files/media, and selected synthetic LTIs. Compare browser receipts with the self-owned server's own logs. Do not use TLS interception.

### Tier 4: institution-approved non-production tenant

This is not authorized by Gate 0. It requires written scope, a non-graded test tenant/course, synthetic accounts/content, named administrators, approved browsers, and confirmation of logging/retention. The exact extension build and rule hash must be reviewed by institutional Canvas, privacy, accessibility, security, and academic-integrity owners. Any production or graded assessment remains out of scope unless separately and explicitly approved.

## Reuse and licensing decision

The detailed project-by-project evidence is in [reuse-matrix.md](reuse-matrix.md). The recommended reuse posture is:

- **Adopt later, pinned:** WXT as an MIT-licensed cross-browser build/scaffold candidate; Playwright as an Apache-2.0 synthetic test dependency.
- **Evaluate conditionally:** Ghostery's MPL-2.0 parser/matcher as a separable dependency only if Gate 1 requires mature filter syntax and legal packaging preserves MPL-covered files and notices. A simpler clean-room allow/observe classifier is preferred initially.
- **Selective sample reuse:** Apache-2.0 Chrome samples can be adapted with attribution; MPL-2.0 MDN examples are safer as references unless file-level MPL handling is intentionally added.
- **Architectural reference only:** Canvas LMS (AGPL-3.0), uBlock Origin (GPL-3.0), Privacy Badger (GPL-3.0-or-later), AdGuard Browser Extension (GPL-3.0), LuLu (GPL-3.0), OpenWPM (GPL-3.0), HaGeZi lists (GPL-3.0), and Canvancement (ISC, but authenticated-page scripting is unnecessary here).
- **Reject as runtime:** mitmproxy/TLS interception, standalone userscripts, broad lists, and tools marketed for answers, proctoring bypass, focus hiding, stealth, or clean-log fabrication.

### Compatibility rules for this repository

The repository is copyright © 2026 Rolando Carreon under PolyForm Noncommercial 1.0.0. That license permits use, modification, and distribution only for its defined permitted noncommercial purposes and requires preservation of its terms/URL and `Required Notice` lines.[^30]

Because commercial use is restricted, the project is **source-available, not OSI-open-source**. The Open Source Definition requires free redistribution and no discrimination against fields of endeavor, including business use.[^31] Public GitHub visibility does not change that classification.

Practical rules:

1. New original project files remain under PolyForm Noncommercial 1.0.0 with Rolando Carreon's notice.
2. MIT, ISC, and Apache-2.0 code may be reusable if copyright/license/NOTICE and patent obligations are preserved. Do not erase upstream authorship or imply that third-party code is owned by Rolando.
3. MPL-2.0 permits a larger work under other terms, but MPL-covered files and modifications remain MPL and recipients must retain their MPL rights/source access.[^32] Keep such packages separable and document them; do not apply PolyForm restrictions to the upstream MPL-covered files.
4. GPL/AGPL code must not be copied, translated, or used to create a distributed combined derivative that is offered only under PolyForm's noncommercial restriction. GPLv3 forbids additional restrictions, and AGPL/GPL obligations may govern the combined work.[^33][^34] Study behavior and public interfaces, then implement original code from requirements and official API documentation.
5. A dependency is not approved merely because its top-level license looks compatible. Before adoption, record the exact version/hash, transitive licenses, notices, source availability, build scripts, update channel, security policy, permissions, and generated/bundled artifacts.
6. This is engineering guidance, not a substitute for legal advice. Any release containing third-party code should receive a fresh license review.

No upstream code was copied into this Gate 0 change.

## Rejected high-risk candidates

The existing telemetry landscape records public marketing for products that claim answers, hidden tab switching, suppression of “stopped viewing,” stealth, or clean quiz logs. Those products and the `canvas-blinders` class of scripts are **rejected**. They were not installed, executed, copied, reverse-engineered, or used as implementation templates.

The rejection is based on purpose and privilege, not an unsupported claim that every product is malware. A tool running inside an authenticated assessment can potentially access questions, choices, typed answers, identifiers, and session context. Its marketed behavior also conflicts with this project's integrity invariants. The repository will not publish bypass instructions, endpoints, rules, or code derived from these products.

## Unknowns and confirmation gates

Before any test involving an institutional environment, obtain answers and evidence for all of the following:

- Exact institution Canvas origins, custom domains, regional service domains, and whether wildcard subdomains are actually required.
- SSO identity-provider origins, redirect patterns, popup/frame behavior, logout paths, MFA/captive-portal behavior, and whether extension access is prohibited on identity pages.
- Classic Quizzes/New Quizzes availability, current presentation architecture, assessment paths, LTI origins, feature flags, multi-session settings, autosave/submission behavior, and phased rollouts.
- Which third-party analytics endpoints, if any, the institution and Instructure identify as optional, purpose-limited, and technically separable from content, authentication, accessibility, security, support, and assessment functions.
- Browser/device management policy; allowed extension stores; required signing; private-browsing rules; browser versions; and whether Firefox is permitted/supported.
- Accessibility owner acceptance criteria, assistive technologies, keyboard/screen-reader matrix, reduced-motion/high-contrast requirements, and any approved accessibility LTIs that must never be disrupted.
- Written authorization, data-retention rules, incident contacts, rollback owner, non-production tenant, synthetic accounts, and evidence-review process.
- Whether the project owner wants to retain PolyForm Noncommercial or pursue a separately approved licensing strategy. Gate 0 does not authorize a license change.

Until these facts are confirmed, the only approved path is local deterministic development and a self-owned synthetic environment. A visible repository, a passing unit test, or a browser API capability is not evidence that a rule is safe for a real institution.

## Gate decision and next work

Research Gate 0 supports this sequence:

1. Accept ADR 0001's platform family and Firefox-first observation target.
2. Complete Gate 1 threat model, data-flow diagram, redaction schema, event-classification contract, and explicit “never alter” list.
3. Scaffold a dependency-minimal, observation-only extension and pure state reducer.
4. Build Tier 0–2 synthetic tests before considering the official local Canvas environment.
5. Do not implement production enforcement until a separately hosted optional event class is sourced, versioned, institutionally accepted, and covered by baseline/equivalence/fault tests.

## Sources

1. Mozilla Developer Network. [WebExtensions overview and examples](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Examples). Accessed 2026-09-12.
2. Mozilla Developer Network. [`webRequest` API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest). Accessed 2026-09-12.
3. Google Chrome Developers. [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions). Accessed 2026-09-12.
4. Google Chrome Developers. [`declarativeNetRequest` API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest). Accessed 2026-09-12.
5. Google Chrome Developers. [`webRequest` API and Manifest V3 limitation](https://developer.chrome.com/docs/extensions/reference/api/webRequest). Accessed 2026-09-12.
6. Google Chrome Developers. [Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle). Accessed 2026-09-12.
7. Google Chrome Developers. [Extension update lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/extensions-update-lifecycle). Accessed 2026-09-12.
8. Instructure. [Canvas Quiz Submission Events API](https://developerdocs.instructure.com/services/canvas/resources/quiz_submission_events). Accessed 2026-09-12.
9. Instructure. [Quiz submission events controller](https://github.com/instructure/canvas-lms/blob/master/app/controllers/quizzes/quiz_submission_events_api_controller.rb). Accessed 2026-09-12.
10. mitmproxy. [About certificates](https://docs.mitmproxy.org/stable/concepts/certificates/). Accessed 2026-09-12.
11. Instructure. [Classic Quiz log guide](https://community.instructure.com/en/kb/articles/661037-unknown). Accessed 2026-09-12.
12. Instructure. [New Quizzes Moderate and attempt-log guide](https://community.instructure.com/en/kb/articles/661091-unknown). Accessed 2026-09-12.
13. Apple Developer. [Managing Safari Web Extension permissions](https://developer.apple.com/documentation/safariservices/managing-safari-web-extension-permissions). Accessed 2026-09-12.
14. Mozilla Developer Network. [`incognito` manifest key](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/incognito). Accessed 2026-09-12.
15. Apple Support. [Use Safari extensions on Mac](https://support.apple.com/102343). Accessed 2026-09-12.
16. GoogleChrome. [Chrome extensions samples](https://github.com/GoogleChrome/chrome-extensions-samples). Accessed 2026-09-12.
17. Raymond Hill. [uBlock Origin Firefox manifest](https://github.com/gorhill/uBlock/blob/master/platform/firefox/manifest.json). Accessed 2026-09-12.
18. Apple Developer. [Blocking content with a Safari Web Extension](https://developer.apple.com/documentation/safariservices/blocking-content-with-your-safari-web-extension). Accessed 2026-09-12.
19. Apple Developer. [Distributing a Safari Web Extension](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension). Accessed 2026-09-12.
20. Apple Developer. [Safari Web Extensions](https://developer.apple.com/documentation/safariservices/safari-web-extensions). Accessed 2026-09-12.
21. Apple Support. [Change Privacy & Security settings on Mac](https://support.apple.com/guide/mac-help/change-privacy-security-settings-on-mac-mchl211c911f/mac). Accessed 2026-09-12.
22. Apple Developer. [Apple Events entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.automation.apple-events). Accessed 2026-09-12.
23. Apple Developer. [Content filter providers](https://developer.apple.com/documentation/networkextension/content-filter-providers). Accessed 2026-09-12.
24. Apple Developer. [Network Extensions entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.networking.networkextension). Accessed 2026-09-12.
25. Microsoft. [Playwright browser-context isolation](https://playwright.dev/docs/browser-contexts). Accessed 2026-09-12.
26. Microsoft. [Testing Chrome extensions with Playwright](https://playwright.dev/docs/chrome-extensions). Accessed 2026-09-12.
27. Mozilla Developer Network. [Native messaging](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging). Accessed 2026-09-12.
28. Google Chrome Developers. [Make your extension accessible](https://developer.chrome.com/docs/extensions/develop/ui/a11y). Accessed 2026-09-12.
29. W3C. [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/). 2023, accessed 2026-09-12.
30. PolyForm Project. [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0). Accessed 2026-09-12.
31. Open Source Initiative. [The Open Source Definition](https://opensource.org/osd). Accessed 2026-09-12.
32. Mozilla. [MPL 2.0 FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/). Updated 2024-01-30; accessed 2026-09-12.
33. Free Software Foundation. [GNU GPL version 3](https://www.gnu.org/licenses/gpl-3.0.en.html). Accessed 2026-09-12.
34. Free Software Foundation. [GNU license compatibility](https://www.gnu.org/licenses/license-compatibility.html). Accessed 2026-09-12.

[^1]: Mozilla Developer Network, “WebExtensions overview and examples.”
[^2]: Mozilla Developer Network, “webRequest API.”
[^3]: Google Chrome Developers, “Declare permissions.”
[^4]: Google Chrome Developers, “declarativeNetRequest API.”
[^5]: Google Chrome Developers, “webRequest API and Manifest V3 limitation.”
[^6]: Google Chrome Developers, “Extension service worker lifecycle.”
[^7]: Google Chrome Developers, “Extension update lifecycle.”
[^8]: Instructure, “Canvas Quiz Submission Events API.”
[^9]: Instructure, “Quiz submission events controller.”
[^10]: mitmproxy, “About certificates.”
[^11]: Instructure, “Classic Quiz log guide.”
[^12]: Instructure, “New Quizzes Moderate and attempt-log guide.”
[^13]: Apple Developer, “Managing Safari Web Extension permissions.”
[^14]: Mozilla Developer Network, “incognito manifest key.”
[^15]: Apple Support, “Use Safari extensions on Mac.”
[^16]: GoogleChrome, “Chrome extensions samples.”
[^17]: Raymond Hill, “uBlock Origin Firefox manifest.”
[^18]: Apple Developer, “Blocking content with a Safari Web Extension.”
[^19]: Apple Developer, “Distributing a Safari Web Extension.”
[^20]: Apple Developer, “Safari Web Extensions.”
[^21]: Apple Support, “Change Privacy & Security settings on Mac.”
[^22]: Apple Developer, “Apple Events entitlement.”
[^23]: Apple Developer, “Content filter providers.”
[^24]: Apple Developer, “Network Extensions entitlement.”
[^25]: Microsoft, “Playwright browser-context isolation.”
[^26]: Microsoft, “Testing Chrome extensions with Playwright.”
[^27]: Mozilla Developer Network, “Native messaging.”
[^28]: Google Chrome Developers, “Make your extension accessible.”
[^29]: W3C, “Web Content Accessibility Guidelines 2.2.”
[^30]: PolyForm Project, “PolyForm Noncommercial License 1.0.0.”
[^31]: Open Source Initiative, “The Open Source Definition.”
[^32]: Mozilla, “MPL 2.0 FAQ.”
[^33]: Free Software Foundation, “GNU GPL version 3.”
[^34]: Free Software Foundation, “GNU license compatibility.”
