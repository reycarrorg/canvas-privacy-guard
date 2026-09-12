# Canvas LMS Tools, Telemetry, and Privacy Controls

This is a defensive, read-only landscape review current to **2026-09-12**. It covers Canvas-native capabilities, representative student and institutional tools, products marketed as Canvas “hacks,” what Canvas can actually record, and the practical limits of Little Snitch, LuLu, DNS filtering, browser blockers, and custom software.

“Every tool” cannot be a literally closed inventory: [Canvas advertises 1,000+ partners and integrations](https://www.instructure.com/canvas), institutions deploy private LTIs, and browser stores and GitHub change continuously. The inventory is therefore systematic and representative: it covers each major tool class plus the visible, current, or historically significant examples found in this review. A product’s presence in a browser store, public source repository, or Canvas marketplace is evidence about identity and availability—not an independent security audit or endorsement.

## Executive assessment

Little Snitch, LuLu, the macOS application firewall, DNS blocklists, hosts files, Pi-hole, and NextDNS cannot reliably suppress only Canvas tab/window-focus telemetry while preserving normal Canvas behavior. The reason is architectural: most of those controls decide at the process, hostname, IP address, port, or protocol level, while the telemetry distinction exists inside an encrypted HTTPS request. Canvas can send focus/blur events to the same first-party Canvas origin and the same quiz-events API used for other quiz-session events. A network firewall sees a browser talking to the institution's Canvas host; it does not see "this payload is a page_blurred record."

Browser extensions such as uBlock Origin can filter more narrowly by URL and resource type because they operate inside the browser. Even there, a URL-only rule cannot distinguish two event types posted to the same endpoint or separate multiple event objects batched into one request. Script-level interception could attempt to alter this behavior, but it is fragile, can break saving or audit records, and crosses from privacy control into monitoring evasion when used in a graded assessment. This report therefore does not provide bypass rules, scripts, endpoint-blocking instructions, or deployment steps for graded work.

The best legitimate direction is to adopt proven tools for general privacy and visibility, while building—if useful—a local-only audit and education tool that records what a self-owned Canvas sandbox emits without altering it. Institution-approved filtering is viable only when telemetry is segregated onto a dedicated hostname or endpoint under administrative control and documented as optional.

The direct answers are:

- **Does Canvas log tab or app switching?** During supported quiz flows, it can record that its own quiz page stopped being viewed and later resumed. It cannot normally identify the destination tab, website, document, or application from Canvas-native browser code alone.
- **Does that prove cheating?** No. Instructure’s current documentation says quiz logs should not be used to validate academic integrity, and its page-view documentation says individual page views are best-effort data unsuitable as the sole basis for high-stakes conclusions.
- **Does Little Snitch already block this?** No. Little Snitch observes or controls outbound connections according to rules and lists; it does not automatically suppress Canvas activity records, and it cannot interpret an encrypted event body as “tab switch.”
- **Is there a trustworthy Canvas telemetry denylist?** None was found. Instructure publishes a changing connectivity allowlist, not a privacy denylist. General tracker lists may block a separate third-party analytics host, but they cannot remove first-party quiz events carried by Canvas’s functional traffic.
- **Are “Canvas stealth” extensions legitimate privacy tools?** The reviewed products primarily market assessment-log evasion and often AI answers or answer saving. Their broad page access, weak reproducibility, and policy exposure make them poor privacy choices. None was installed or executed.
- **Should we build our own?** Build an observation-only privacy inspector or teaching harness for synthetic/self-owned environments. Do not build a live graded-assessment event suppressor.

## What Canvas actually records

Canvas's published Classic Quizzes API defines a quiz-submission-events endpoint that stores an array of events captured during a quiz-taking session. Its examples include normal interaction events such as `question_answered` and `question_flagged`; the retrieval example includes `page_blurred` and `page_focused`. Instructure's open-source controller implements the same data model and accepts an array containing each event's type, data, and client timestamp.

This establishes several important facts:

- Focus changes are application-layer records, not a special network protocol.
- Multiple event types share the same event API and may be grouped in one request.
- The first-party Canvas application originates the records and sends them over the authenticated Canvas session.
- New Quizzes is a distinct service/LTI architecture, so behavior and domains can differ by quiz engine, institution, region, and release.
- Canvas documentation warns that quiz logs are designed to investigate quiz problems and provide interaction insight, not to prove cheating. A focus-loss marker has many benign explanations and should not be treated as conclusive academic-integrity evidence.

Primary evidence:

- [Canvas Quiz Submission Events API](https://developerdocs.instructure.com/services/canvas/resources/quiz_submission_events)
- [Instructure open-source quiz submission events controller](https://github.com/instructure/canvas-lms/blob/master/app/controllers/quizzes/quiz_submission_events_api_controller.rb)
- [Instructure Classic Quiz log guide](https://community.instructure.com/en/kb/articles/661037-unknown)
- [Instructure New Quizzes Moderate guide](https://community.instructure.com/en/kb/articles/661091-unknown)

## The four telemetry layers people commonly conflate

### 1. Ordinary Canvas page views and activity

Canvas can associate requests with a user, account, course, session, timestamp, requested Canvas URL, HTTP method/status, IP address, browser user-agent, and participation classification. Course Access Reports summarize content views, view counts, participations, and last access; appropriately permissioned administrators can access more detailed page-view exports. Instructure describes page-view data as a best-effort product generated from logs, with uncommon loss or duplication possible, and cautions against using individual records as high-stakes audit evidence.

This is server-side application evidence. Blocking third-party cookies does not prevent Canvas from recording the authenticated requests required to serve a course page, download, quiz, or submission.

Primary evidence:

- [Canvas Users API and PageView fields](https://developerdocs.instructure.com/services/canvas/resources/users)
- [Canvas web logs schema](https://developerdocs.instructure.com/services/dap/dataset/dataset-namespaces/dataset-canvaslogs)
- [Canvas Course Access Report guide](https://community.instructure.com/en/kb/articles/660982-how-do-i-view-the-course-access-report-for-an-individual-user)
- [Canvas Admin Page Views guide and accuracy warning](https://community.instructure.com/en/kb/articles/661560-how-do-i-view-the-page-views-for-a-user-in-an-account)

### 2. Classic Quiz attempt events

Classic Quizzes can create `page_blurred` and `page_focused` events as part of the quiz-attempt event stream. The instructor interface renders these as “Stopped viewing the Canvas quiz-taking page” and “Resumed.” The same stream also includes normal interaction events such as question views, answers, flags, and autosave-related activity.

A focus loss has a narrow meaning: Canvas’s page ceased to be the active viewed page. It does not identify the destination. Benign causes include another tab or window, an application switch, a system dialog, an accessibility tool, a password-manager interaction, a browser crash, or an accidental focus transition. Autosave and timing behavior can also make the sequence appear stranger than the user’s actual actions.

### 3. New Quizzes attempt and multi-session logs

New Quizzes also exposes attempt logs with start/completion times, elapsed event timing, stop/resume events, and potentially computer or answer details. Authorized users with the relevant permission may see client IP information. If the optional Detect Multiple Sessions setting is enabled, administrators can see session/browser/operating-system details for another browser or device associated with an attempt; instructors do not automatically receive that admin-only detail.

New Quizzes has also been in a 2026 presentation-architecture transition from a legacy iframe/LTI experience toward a more native Canvas presentation while LTI communication remains involved. That makes blanket extension claims such as “all Canvas quiz types” especially doubtful: Classic Quizzes, legacy New Quizzes, native-integrated New Quizzes, and institution-specific configurations are not one stable interception surface.

Primary evidence:

- [New Quizzes Moderate and attempt-log guide](https://community.instructure.com/en/kb/articles/661091-unknown)
- [New Quizzes multi-session admin guide](https://community.instructure.com/en/kb/articles/661470-how-do-i-view-multi-session-details-in-new-quizzes-as-an-admin)
- [Canvas release notes for the 2026 New Quizzes native integration](https://community.instructure.com/en/kb/articles/664347-canvas-release-notes-2026-03-21)

### 4. Third-party LTI and proctoring systems

Respondus, Honorlock, Proctorio, and similar tools are separate from Canvas-native logging. Depending on the product and approved configuration, they may use an LTI service, browser extension, dedicated/locked browser, webcam, microphone, screen capture, ID verification, or device-management controls. Their capabilities must be assessed from the exact exam instructions, permissions, institutional configuration, and vendor privacy terms. A claim about Canvas’s own focus events does not establish what a separately authorized proctor can observe.

UTSA’s public materials identify Honorlock as a Canvas-available proctoring tool. Its own privacy materials describe categories including identity/contact data, ID-card data, connection and computer/browser information, face/ID images, webcam recording, and exam/course information. Those are Honorlock capabilities and data practices—not proof that ordinary Canvas pages collect the same data.

Primary evidence:

- [Instructure guide to External Apps and LTI tools](https://community.instructure.com/t5/Canvas-Basics-Guide/What-are-External-Apps-LTI-Tools/ta-p/57)
- [UTSA Honorlock information](https://innovationtest.utsa.edu/tldt/faculty-resources/academic-technologies/digital-tools/honorlock/)
- [Honorlock Exam Taker Privacy Notice](https://honorlock.com/wp-content/uploads/2024/09/Honorlock-Exam-Taker-Privacy-Notice-0923222.pdf)

## What the browser signal means

The web platform exposes ordinary page-lifecycle and focus events. `visibilitychange` fires when a document becomes hidden or visible—for example after a tab switch, navigation, minimization, closing, or a mobile app switch—and the event is not cancelable. A separate `blur` event indicates lost focus. `navigator.sendBeacon()` can transmit a small asynchronous POST, often for analytics, when a page becomes hidden. These mechanisms explain how a page can detect a state change in its own document; they do not grant the page access to the contents of unrelated tabs.

The browser’s same-origin policy normally prevents an Instructure/Canvas page from reading a different-origin page’s DOM, storage, search text, or content. Therefore Canvas-native focus logs cannot establish “the user opened Google,” “the user read an AI answer,” or “the user viewed a particular document.” That would require another mechanism such as a privileged extension, locked browser, screen-capture grant, managed-device agent, or network/service evidence.

Primary evidence:

- [MDN `visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event)
- [MDN Window `blur`](https://developer.mozilla.org/en-US/docs/Web/API/Window/blur_event)
- [MDN `sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)
- [MDN same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy)

## Evidence interpretation matrix

| Evidence | Defensible conclusion | What it does not prove |
| --- | --- | --- |
| Canvas page-view/request record | A request associated with the account/session reached Canvas | Continuous attention, comprehension, exact reading time, or that the user initiated every request |
| Quiz answer/submission transaction | A recorded assessment action occurred | Why it occurred or whether assistance was authorized |
| `page_blurred` / “Stopped viewing” | The quiz page lost active focus/view state | Destination tab/app, destination content, motive, or cheating |
| `page_focused` / “Resumed” | The quiz page regained focus | What happened while it was unfocused |
| New Quizzes multi-session signal | Another browser/device session was associated with the attempt | Who physically used it or whether its use violated the instructions |
| User-agent string | The client supplied a browser/OS identifier | Tamper-proof device identity |
| IP address | The service observed a network egress address | Exact person, device, or precise physical location |
| No focus-loss events | No such event was recorded and retained | Proof that the page never lost focus or that the client was unmodified |
| Proctoring flag | A separately configured vendor detector generated a flag | Conclusive misconduct without context and human review |

The evidentiary rule is cumulative and contextual: quiz settings, transactions, timestamps, technical incidents, proctoring evidence, stated course rules, and the student’s explanation should be reviewed together. Instructure’s own documentation is unusually clear that quiz logs are diagnostic and should not be treated as a standalone cheating detector.

## Independent privacy evidence

Instructure’s current Canvas LMS cookie notice distinguishes necessary/functionality cookies from analytical/performance cookies. It documents collection such as browser type, operating system, IP address, domain, timestamps, product-analytics identifiers, account identifiers, page-view identifiers, session identifiers, and visited URL strings. It also warns that refusing necessary cookies can prevent Canvas from functioning as intended. [Canvas LMS Cookie Notice](https://www.instructure.com/policies/canvas-lms-cookie-notice)

SURF Vendor Compliance’s December 2025 Data Protection Impact Assessment is the strongest independent assessment found in this review. Its technical investigation described extensive logging across web access, authentication, user activity, administrative operations, page navigation, resource accesses, and system events. It found that page-view and participation data can be personal data when linked to an identifiable user. SURF identified three high and nine medium privacy risks, while also reporting agreed mitigations and that institutions could continue using Canvas with those measures. The planned November 2026 retest had not occurred as of this report’s 2026-09-12 cutoff, so mitigation completion should not be assumed yet. [SURF summary](https://www.surf.nl/en/news/instructure-enhances-privacy-features-in-canvas-lms-in-collaboration-with-surf) [Full Canvas DPIA](https://vendorcompliance.surf.nl/wp-content/uploads/2025/12/DPIA-on-Canvas-LMS.pdf)

This supports a legitimate privacy concern, but it also points toward the correct control plane: institutional configuration, data-protection review, retention, access control, consent/transparency, sub-processor governance, and optional analytics settings. A student-side firewall cannot undo server records created by normal authenticated use.

## Why same-origin telemetry is hard to separate

HTTPS encrypts the URL path, headers after the TLS handshake, request body, response body, cookies, and event payload. A conventional outbound firewall can usually attribute a flow to the browser and identify an IP address, port, and often a hostname obtained from DNS, the operating system, or TLS Server Name Indication. It cannot distinguish `page_blurred` from `question_answered` inside the encrypted request without terminating TLS or receiving URL metadata from the browser/OS.

HTTP/2 and HTTP/3 further weaken the intuitive idea that every action creates a separately identifiable connection: many requests to a host can share one long-lived encrypted connection. DNS is even coarser because it maps names to addresses and never sees paths, methods, bodies, or JavaScript events.

Canvas documents a broad, changing service surface: institution-specific Canvas domains, `*.instructure.com`, file/media domains, CloudFront, AWS storage, region-specific quiz API/LTI hosts, Learnosity, and other integrations. Instructure explicitly tells institutions to test firewalls because future domain changes can cause instability. Consequently, blocking a broad Canvas or Instructure hostname is much more likely to disable login, quiz loading, saving, media, files, or LTI tools than to isolate a privacy-only stream.

Primary evidence:

- [Little Snitch: how server names are determined](https://help.obdev.at/littlesnitch6/adv-server-names)
- [Canvas domain, email, and server management](https://community.instructure.com/en/kb/articles/485223-canvas-domain-email-and-server-management)
- [Canvas LTI launch overview](https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.lti_launch_overview)

## Control comparison

| Control | Actual useful granularity | Can isolate a Canvas focus event? | Legitimate value | Principal risk |
| --- | --- | --- | --- | --- |
| Little Snitch 6 | Process or process chain; direction; hostname/domain/IP/range; port/range; protocol; profile; allow/deny/ask | No, when it is inside first-party TLS. It explicitly does not intercept SSL/TLS. | Excellent outbound inventory, per-app policy, temporal profiles, connection history, broad tracker/malware lists | A Canvas-domain denial blocks core Canvas too; host identity can be ambiguous with shared IPs, encrypted SNI, CDNs, or reused connections |
| LuLu | Outgoing process; optional remote destination/address/domain; port; regular expression; profiles; host/IP lists | Generally no. It may receive a full URL for some Apple networking/WebKit flows, but hostname support varies by framework/browser and it does not provide semantic JSON-event filtering | Free/open-source outbound prompts and basic per-process/per-endpoint control | Browser/framework differences; remote lists outrank rules; broad list entries can cause silent availability failures |
| macOS application firewall | Primarily app/service control for unsolicited incoming connections | No | Protects exposed local services and incoming connectivity | Commonly mistaken for an outbound privacy firewall; does not solve browser-to-Canvas telemetry |
| Apple Network Extension content filter | Per-flow pass/block; a provider may request some inbound/outbound data and WebKit URL context | Not reliably under end-to-end TLS, and custom deployment requires special capability, signing, consent, and careful design | Appropriate for institution-managed safety policy, especially when destinations are intentionally segregated | TLS inspection/privacy hazards, broad breakage, privileged deployment, and institutional-policy concerns |
| Hosts file | Exact hostname-to-address override on one device | No | Small, static, transparent domain denial | No URL/path awareness; manual drift; wildcards are not native; easy to break SSO/CDNs |
| Pi-hole | DNS hostname/domain policy, optionally by client/group; query log | No | Network-wide blocking and DNS visibility on a self-managed network | Cannot see URL/event type; devices/apps can use other encrypted DNS; broad shared-domain breakage |
| NextDNS | Managed DNS blocklists, allow/deny lists, logs/analytics with retention/privacy controls | No | Roaming DNS policy and easier management than self-hosted DNS | Sends DNS decisions/logs to a third party depending on configuration; still hostname-only |
| uBlock Origin (Firefox is the upstream project's strongest-supported platform) | Browser request URL, source site, resource type, first/third party, static and dynamic URL filters; logger | Only if an event had a unique stable URL. It cannot distinguish event types or JSON objects sharing one request/endpoint | Best diagnostic visibility into browser resource requests; mature, reviewable filter ecosystem | Fine-grained blocking can still suppress functional first-party requests; scriptlets/advanced rules greatly increase fragility and trust burden |
| Safari/Firefox built-in tracking protection | Known cross-site trackers, third-party cookies/storage, fingerprinting and partitioning defenses | No for ordinary first-party Canvas activity | Low-maintenance protection against cross-site tracking; should remain enabled unless an approved LTI requires a scoped exception | Does not promise to suppress first-party analytics or authenticated LMS audit records; strict modes may affect LTI sign-in or embedded tools |

### Little Snitch in detail

Objective Development documents rules made from conditions including process, process owner, outgoing/incoming direction, server as domain/hostname/IP/range, protocol, remote port for outgoing flows, and optional profile. Little Snitch uses OS metadata, process-aware DNS observations, and protocol headers to infer a server name. It states directly that it does not intercept encrypted SSL/TLS; normally an unencrypted SNI hostname is enough for host matching, but encrypted SNI or ambiguous shared addresses can cause fallback to IP matching.

Accordingly, Little Snitch can answer useful questions such as "which browser process connected to which Canvas-related host, when, and how many bytes moved?" It cannot answer "did these encrypted bytes represent a tab switch?" Packet capture does not change that: encrypted application data remains encrypted unless the endpoint or an authorized test environment supplies decryption material. Little Snitch's documented traffic log consists of process, host/IP, protocol, port, connection/denial counts, and byte counts—not decrypted HTTP event semantics.

Primary evidence:

- [Little Snitch 6 rule concepts](https://help.obdev.at/littlesnitch6/concepts-rules)
- [Little Snitch 6 server-name resolution and TLS limitation](https://help.obdev.at/littlesnitch6/adv-server-names)
- [Little Snitch 6 traffic log fields](https://help.obdev.at/littlesnitch6/cmd-log-traffic)
- [Little Snitch 6 blocklists](https://help.obdev.at/littlesnitch6/concepts-blocklists)

### LuLu in detail

Objective-See describes LuLu as a free, open-source outgoing firewall. Rules can apply to a process generally or a remote endpoint and may specify address/domain, port, and a regular expression. Its list feature accepts newline-separated hosts/IPs from a local file or remote URL; remote lists refresh daily and list matches supersede ordinary rules, with the block list winning over the allow list.

There are two cautions. First, Objective-See documents a macOS limitation: hostname matching is available only when the OS exposes the host for particular networking frameworks; on browsers that do not use those frameworks, blocking may fall back to IP addresses. Second, even if WebKit supplies a full URL for a request, this metadata is neither a general TLS-decryption facility nor a semantic request-body filter. A Canvas event posted to a common authenticated endpoint is still not distinguishable by event type.

Official acquisition should be from Objective-See's product page, which publishes the current download and SHA-256, or from the linked official GitHub repository. No installation was performed for this research.

Primary evidence:

- [Objective-See LuLu product, rules, lists, limitations, download hash](https://objective-see.org/products/lulu.html)
- [Official LuLu source repository](https://github.com/objective-see/LuLu)

### macOS firewall and content filters

Apple's user-facing firewall prevents unwanted incoming connections and manages which local apps/services can receive them. It is not an outbound per-destination browser privacy firewall.

Apple's Network Extension content-filter APIs are more powerful: a filter receives flow objects and can pass, block, or request more data before deciding. The API requires the Network Extension capability and an app/system extension. That makes it an option for an authorized endpoint-security or institutional-control product, but not a shortcut to decrypting arbitrary TLS. A design that installs a local root certificate and performs TLS interception would create a new high-value trust anchor, expose educational content and credentials to the interceptor, and should not be pursued for this use case.

Primary evidence:

- [Apple: firewall settings on Mac](https://support.apple.com/guide/mac-help/mh11783/mac)
- [Apple: NEFilterDataProvider](https://developer.apple.com/documentation/NetworkExtension/NEFilterDataProvider)
- [Apple: Network Extension entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.networking.networkextension)

### DNS, hosts files, Pi-hole, and NextDNS

These all make hostname-level decisions. Pi-hole describes itself as a DNS sinkhole and exposes allow/deny domain management and query logs. NextDNS offers blocklists plus custom deny/allow lists and optional logs. They are effective against a tracker served from a distinct domain, including across applications, but ineffective against telemetry posted to the same Canvas hostname needed for course content. They also cannot distinguish two URL paths on one hostname.

The privacy tradeoff differs: Pi-hole keeps policy and logs on infrastructure the operator controls, while NextDNS receives DNS traffic and retains logs only according to the selected settings. NextDNS's privacy policy states that no data is logged by default unless a feature requires it and exposes retention/location controls; that is a service claim to evaluate against institutional requirements.

Primary evidence:

- [Pi-hole overview](https://docs.pi-hole.net/)
- [Pi-hole domain allow/deny management](https://docs.pi-hole.net/guides/misc/allowlist-denylist/)
- [NextDNS service features](https://nextdns.io/)
- [NextDNS privacy policy](https://nextdns.io/privacy)

### Browser protections and uBlock Origin

Safari's tracking prevention and Firefox Enhanced Tracking Protection primarily defend against cross-site/third-party tracking. Canvas is the first party while a student is on Canvas, so neither feature is designed to suppress ordinary authenticated Canvas audit events. They remain valuable for unrelated third-party trackers and can reduce cross-site cookie leakage, but LTI tools and embedded sign-ins may require carefully scoped compatibility exceptions.

uBlock Origin has substantially finer request-level filtering than DNS or a network firewall. Its documented static syntax supports hostname/path patterns, source-domain restrictions, first/third-party and resource-type conditions; its logger exposes request URLs. The project's own documentation warns that adding more filter lists increases breakage and that custom third-party lists are automatically updated. As of the research date, upstream states that full uBlock Origin works best on Firefox and that the Chrome Web Store version was removed as Chrome ended Manifest V2 support; Chromium users should not assume uBO Lite has identical capabilities.

Even full uBO is not a principled Canvas focus-event separator: URL filtering cannot inspect an event type in a JSON body or selectively remove one object from a batch. Preventing Canvas's event-listener JavaScript would be application modification, not network privacy filtering, and may disable unrelated quiz behavior. No such instructions are included here.

Primary evidence:

- [Safari: prevent cross-site tracking](https://support.apple.com/guide/safari/sfri40732/mac)
- [WebKit tracking-prevention architecture](https://webkit.org/tracking-prevention/)
- [Firefox: third-party trackers and Enhanced Tracking Protection](https://support.mozilla.org/en-US/kb/third-party-trackers)
- [Official uBlock Origin repository and current platform status](https://github.com/gorhill/uBlock)
- [uBlock Origin static-filter syntax](https://github.com/gorhill/uBlock/wiki/Static-filter-syntax)
- [uBlock Origin filter-list warnings](https://github.com/gorhill/uBlock/wiki/Dashboard:-Filter-lists)

## Canvas tool landscape and legitimacy review

The safest discovery order is: native Canvas feature, institution-approved Canvas App/LTI, identifiable open-source project with least privilege, then browser-store utility. Tools that ask for a school password directly, request access to every website, hide their source/backend, or market stealth and assessment bypass start at a severe trust disadvantage.

### Official and institution-managed tools

| Tool or family | What it does | Evidence and main risk | Assessment |
| --- | --- | --- | --- |
| [Canvas Student, Teacher, and Parent](https://www.instructure.com/canvas) | Official mobile access to courses, grades, submissions, messages, calendars, quizzes, grading, or parent observation, depending on role | Official Instructure distribution; normal full-account LMS access and Instructure/institution privacy terms apply | **Legitimate; preferred official client**. Obtain only through official Apple/Google listings reached from Instructure |
| Canvas calendar feed | Subscribes Apple Calendar, Google Calendar, Outlook, and other calendar clients to Canvas dates | The feed URL can expose course names, assignments, and due dates; treat it like a secret capability URL | **Legitimate native feature**; do not publish the URL |
| Native course/ePub/offline export | Exports course material where the user’s role permits it | Exported content can be copyrighted or sensitive; local protection becomes the user’s responsibility | **Preferred archive path** when available and permitted |
| Canvas REST API and OAuth developer keys | Supported automation, export, dashboards, and integrations | Personal tokens inherit the user’s authority; institution-issued scoped OAuth is safer than unscoped personal tokens | **Legitimate developer path** with least privilege and secure token handling |
| Canvas Apps / LTI marketplace | Institution-approved accessibility, media, assessment, content, analytics, and collaboration tools | An LTI may receive identity, role, course, roster, assignment, and grade data depending on scopes/services | **Best third-party discovery channel**, but certification/marketplace presence does not replace app-specific privacy and security review |
| Canvas Data 2 / DAP | Bulk institutional data for warehouses, dashboards, and research | Very broad student and course records plus privileged client credentials | **Legitimate institutional-admin tool only** |
| [Canvas LMS source](https://github.com/instructure/canvas-lms) | Official AGPLv3 codebase for research, development, and self-hosting | Self-hosting transfers security, mail, storage, upgrade, privacy, and availability duties to the operator | **Legitimate engineering/research source**, not a casual student utility |

Instructure’s Canvas Apps experience exposes placements, privacy information, accessibility information, terms, and certification badges, while only appropriately authorized administrators can manage installed tools. Instructure’s Edu App Center also says listed third parties are provided for convenience and must still be evaluated under their own terms and privacy policies. [Canvas Apps guide](https://community.instructure.com/en/kb/articles/661491-how-do-i-use-canvas-apps) [Edu App Center guidance](https://www.eduappcenter.com/tutorials/canvas) [Canvas Certified Integrations](https://www.instructure.com/resources/product-overviews/canvas-certified-integrations)

### Student-facing extensions and local utilities

| Tool | Main function | Current assurance signal | Principal concern | Disposition |
| --- | --- | --- | --- | --- |
| [BetterCampus / BetterCanvas](https://chromewebstore.google.com/detail/bettercampus-prev-betterc/cndibmoanboadcifjkjbdpjgfedanolh) | Dark mode, themes, dashboard, GPA, and to-do enhancements | Large, established store listing and public [repository](https://github.com/UseBetterCanvas/bettercanvas) | The reviewed public manifest used a very broad `https://*/*` content-script match, and the visible repository/store versions did not match during this review; the published build was not reproducible from that manifest alone | **Evaluate in a separate browser profile; restrict access to the exact Canvas hostname** |
| [Tasks for Canvas](https://chromewebstore.google.com/detail/tasks-for-canvas-%E2%80%93-now-su/kabafodfnabokkkddjbnkgbcbmipdlmb) | Better to-do list, progress, announcements, custom tasks, and some external synchronization | Large store listing and older [MIT source](https://github.com/UseBetterCanvas/canvas-task-extension) | Publisher/branding changed; the current store disclosure says it handles user activity while older language said no collection. Do not assume old source equals the current build | **Sandbox first; privacy clarification needed** |
| [Canvas LMS Mods Basic](https://chromewebstore.google.com/detail/canvas-lms-mods-basic/bnpdolbpbjiniodlbahddbnkollgojon) | Instructor/admin searches, reports, grade/rubric export, shortcuts, and sorting | Identifiable public [source](https://github.com/Code-with-Ski/Canvas-LMS-Mods) | Runs with the logged-in user’s authority and may expose rosters, submissions, SIS IDs, grades, or activity; custom Canvas domains can drive broad host permissions | **Institutional sandbox/security review only**, especially for admin accounts |
| [Canvas Course Downloader & Exporter](https://chromewebstore.google.com/detail/canvas-course-downloader/mmnmcnffbkcnhcjiidmdnaclpfeekiol) | Exports accessible files, pages, assignments, modules, discussions, grades, quizzes, and role-visible submissions | Public MIT [source](https://github.com/jasp-nerd/canvas-course-downloader) and store distribution | Sensitive bulk exports, broad content-script scope, downloads/storage/network permissions, and potential FERPA exposure for teachers/TAs | **Sandbox first; prefer native export; protect and minimize output** |
| Canvas Files Downloader | Batch-downloads attachments from several Canvas areas | Browser-store presence | Weaker provenance and no comparable reproducible-build assurance found | **Prefer native export or a better-documented open-source alternative** |
| [CanvasAPI](https://github.com/ucfopen/canvasapi) | University of Central Florida’s Python wrapper for Canvas REST APIs | Identifiable institutional provenance, MIT license, longstanding use | Can read or mutate as much as the supplied token permits; notebooks, source, logs, and shell history can leak tokens | **Reasonable for competent development** with a test account and least-privilege token |
| [canvas-grab](https://github.com/skyzh/canvas_grab) | API-token-based course-file synchronization | Public MIT source | README says it needs maintainers; owner no longer has Canvas access; some setup advice is unnecessarily broad | **Avoid for new deployments**; historical reference only |
| Canvas Downloader by BrkBuilds | Newer desktop downloader/synchronizer with conversion, media, transcription, and scheduling features | Public 2026 repository | Large attack/data surface and limited independent reputation: token storage, filesystem writes, LTI/media discovery, conversion, transcription, and scheduling | **Code-review and sandbox only** |
| Canvas MCP servers and AI learning-agent extensions | Let an AI client query courses, assignments, grades, files, or discussions | Several projects publish source and local/no-telemetry claims | Canvas data is still exposed to the AI runtime chosen by the user; some servers support writes; token storage and prompt injection from course content are major concerns | **Read-only sandbox only after code, scope, and AI-data-path review** |
| `CanvasBlocker` for Firefox | Alters HTML `<canvas>` and related browser APIs to resist fingerprinting | Well-known privacy-extension category | Name collision: it targets the HTML graphics API, not Instructure Canvas LMS | **Legitimate general privacy tool, irrelevant to Canvas quiz logging** |

For any browser extension touching Canvas, a separate browser profile is valuable because authenticated pages can contain grades, messages, assignment instructions, submissions, quiz content, and institutional identifiers. Chrome’s own extension documentation treats host and content-script permissions as sensitive and recommends optional/narrow permissions where possible. [Chrome permission guidance](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)

### Instructor, accessibility, and enterprise tools

| Tool | What it does | Assessment |
| --- | --- | --- |
| [UDOIT](https://github.com/ucfopen/UDOIT) / UDOIT Advantage | Scans course content for accessibility issues and supports remediation | **Legitimate institution-led evaluation**; course/API access is broad and automated checking cannot prove full accessibility |
| [Anthology Ally](https://www.anthology.com/material/ally-for-lms) | Accessibility scoring, alternative formats, instructor guidance, and reporting | **Established enterprise option**; requires contractual privacy, retention, and data-processing review |
| [Cidi Labs](https://cidilabs.com/) suite | Course design, lifecycle, cleanup, reporting, and related workflow tools | **Established Canvas-focused vendor**; tools that clean or change content require staged testing and rollback |
| [K16 Solutions](https://www.instructure.com/press-release/instructure-exclusive-strategic-partnership-k16-solutions) | LMS migration and archive services | **Institutional use only**; migration/archive scope can include nearly all course and student records |
| [Atomic Search / Atomic Author](https://support.atomicjolt.com/knowledgebase/canvas-integration-panel-) | Indexes/searches Canvas material and embeds content from repositories | **Institutional evaluation only**; review service-user access, indexing boundaries, data deletion, and retention |
| [Canvancement](https://github.com/jamesjonesmath/canvancement) and [CU Boulder Canvas userscripts](https://github.com/UCBoulder/canvas-userscripts) | Small scripts that fill UI/reporting gaps | **Script-specific sandbox review**; a userscript manager injects code into authenticated Canvas pages, so narrow `@match`, pinned versions, and manual code review matter |
| CanvasKit | Historical Cocoa library for iOS Canvas integrations | **Obsolete for new work**; official repository is end-of-life |

### “Hack,” answer-bot, and telemetry-evasion products

Current public listings and marketing were found for products including **Canvas Ninja, CanvasCrack, QuizCloak, CanvasHack, Phantom / Canvas Tab Switch Blocker**, and an unpacked project/article known as **canvas-blinders**. Their claims commonly include hiding tab switches, suppressing “stopped viewing” records, keeping logs “clean,” saving answers, or placing AI answers inside the quiz page.

The technically narrow claim is plausible: a sufficiently privileged extension can inject scripts into a page and may observe or modify some browser requests. The broad claims are not credible:

- Classic Quizzes, New Quizzes, and proctoring products do not share one stable implementation.
- Blocking one focus signal does not erase server-side page views, sessions, IPs, timestamps, answer transactions, or participation.
- One request may batch multiple event objects; URL filtering cannot remove only one JSON item.
- New Quizzes architecture and domains vary by rollout, region, institution, and integration.
- A locked browser, proctoring extension, screen capture, or managed device operates outside ordinary Canvas page code.
- A partial failure can interfere with autosave, timers, authentication, navigation, or final submission.
- Missing or malformed records may itself be anomalous, even though an anomaly is not proof of wrongdoing.

The larger concern is privilege. A tool that runs on an authenticated assessment page may be able to see quiz questions, choices, typed answers, course/enrollment data, user identifiers, and possibly session or authentication material depending on its permissions. Optional AI features can transmit exam content or an API key to an opaque backend. Store privacy declarations are developer-supplied, auto-updates can change code after installation, and direct CRX/unpacked downloads bypass normal store review and revocation channels.

These products were assessed only from public listings, public source where present, and browser-platform documentation. They were not downloaded, installed, reverse-engineered, or tested. There is no basis to claim every one is malware or a credential stealer; the defensible conclusion is narrower: their security assurance is insufficient for the sensitivity of the access they request, and their marketed purpose creates academic-integrity and acceptable-use exposure.

At UTSA, the current Student Code defines cheating to include unauthorized assistance or study aids, failure to follow test instructions, and attempts to obtain an unfair academic advantage. It also addresses circumventing university system/network security. The exact consequence depends on course instructions, intent, and process, but an assessment-record suppression tool is materially different from an ordinary tracker blocker. [UTSA Student Code of Conduct](https://catalog.utsa.edu/policies/administrativepoliciesandprocedures/studentcodeofconduct/)

### Legitimacy checklist for any newly discovered Canvas tool

1. Prefer a native feature or institution-approved LTI.
2. Verify publisher identity, official site, and the exact store/repository relationship.
3. Compare the distributed version with the public source and release tag; open source is useful only if the shipped artifact corresponds to it.
4. Inspect host permissions, content-script matches, network destinations, OAuth scopes, update URL, and whether the tool uses the existing Canvas session or asks for a token/password.
5. Reject any tool that asks for the institution password directly. A legitimate integration should redirect to the institution’s SSO/Canvas authorization flow or use an approved LTI/OAuth path.
6. Treat personal access tokens, session cookies, calendar-feed URLs, grades, submissions, messages, and quiz content as sensitive.
7. Use a fresh browser profile and restrict the extension to the exact institution Canvas hostname.
8. Confirm privacy policy, retention/deletion, sub-processors, license, security contact, maintenance activity, and incident history.
9. Start with a synthetic/test account. Do not experiment on a live graded assessment or an administrator account.
10. Do not infer safety from stars, ratings, “Featured,” “no data collected,” marketplace presence, or a privacy policy alone.

## Canvas-specific list findings

No authoritative, current, independently maintained "Canvas telemetry blocklist" was found. The authoritative Instructure list is the opposite: a connectivity/allowlist inventory for Canvas core, storage, media, New Quizzes, outcomes, and integrations. Its warning that domains can change and firewalls require testing makes it unsuitable as a denylist.

One old community repository contains an `instructure-unblock.txt` ad-blocker allowlist last labeled as working in February 2019. It is not a telemetry blocklist, is stale, and demonstrates that aggressive filters historically broke Canvas resources. It should not be treated as current security guidance.

General-purpose lists such as EasyPrivacy, uBlock's stock lists, Peter Lowe's list, OISD, HaGeZi, and StevenBlack may block distinct third-party advertising/tracker domains encountered on many sites. They are not Canvas-semantic lists and cannot classify first-party quiz-event payloads. Little Snitch's own picker criteria are sensible—at least a year of history, recent and frequent updates, evidence of removal, an active community, macOS relevance—but Objective Development disclaims affiliation and warns that every list has false positives.

### Download and list-source assessment

| Resource | Acquisition confidence | Appropriate use | Canvas-specific verdict |
| --- | --- | --- | --- |
| [Little Snitch](https://www.obdev.at/products/littlesnitch/index.html) and its built-in list picker | **High** when obtained from Objective Development | Polished outbound visibility, per-app/per-host rules, and a small number of curated general lists | Does not automatically block Canvas logging; no semantic event visibility |
| [LuLu](https://objective-see.org/products/lulu.html) | **High** from Objective-See’s official page or linked repository; the page publishes a release SHA-256 | Free/open-source outgoing connection control and host/IP lists | Does not identify a `page_blurred` object; Chrome hostname behavior has documented macOS framework limits |
| [uBlock Origin](https://github.com/gorhill/uBlock) and its stock lists | **High** from upstream-recommended distribution; full upstream support is strongest on Firefox | General browser tracker/ad/malware filtering and request diagnosis | Useful for separate third-party trackers, not a safe Canvas quiz-event suppressor |
| EasyPrivacy, uBO filters, and Peter Lowe’s list | **High to medium-high** as mature stock lists already selected by uBO | Low-maintenance general browser privacy | Not Canvas-semantic; keep stock defaults unless a concrete need justifies more |
| [HaGeZi DNS blocklists](https://github.com/hagezi/dns-blocklists) | **Medium-high**: public history, documented tiers/formats, issue process, mirrors, and GPL-3.0 licensing | Optional general DNS filtering after testing; the project itself warns that stronger tiers increase breakage | No special ability to separate Canvas activity events; broad lists can break SSO/LTI/media |
| OISD / StevenBlack and similar established hosts lists | **Medium**, list- and maintainer-specific | General DNS/hosts blocking after provenance and compatibility review | No path/body awareness; not a Canvas telemetry solution |
| Anonymous “Canvas telemetry” list, gist, paste, URL shortener, or direct CRX | **Low / unacceptable** | None on a school-authenticated profile | Avoid; no trustworthy maintained Canvas telemetry denylist was found |

uBlock Origin’s own guidance says the more lists a user enables, the greater the chance of page breakage, and not all lists are high quality. Its default mode already includes uBO lists, EasyList, EasyPrivacy, Peter Lowe’s list, and a malicious-URL list. Starting with that maintained default is safer than stacking redundant lists. [uBlock Origin blocking modes](https://github.com/gorhill/uBlock/wiki/Blocking-mode) [uBlock Origin filter-list guidance](https://github.com/gorhill/uBlock/wiki/Dashboard:-Filter-lists)

Little Snitch’s blocklist feature accepts hosts, domains, IP ranges, CIDR, and `.lsrules`; Objective Development permits third-party list URLs but explicitly treats those lists as independently maintained. Remote rule groups can be more powerful than plain blocklists, including allow rules, so they require greater publisher trust. [Little Snitch blocklists](https://help.obdev.at/littlesnitch6/concepts-blocklists) [Little Snitch rule groups](https://help.obdev.at/littlesnitch6/concepts-rulegroups)

### Import-safety standard

Treat a remote list as privileged availability policy, not as harmless text. A compromised maintainer, expired domain, redirected URL, or mistaken wildcard can deny access to login, saving, uploads, media, or quizzes. LuLu is particularly consequential because its lists supersede ordinary rules and remote lists refresh automatically.

Before any adoption outside graded work, require:

- A clearly identified maintainer, public repository, license, issue tracker, and changelog/history.
- Recent maintenance with evidence that obsolete entries are removed, not just appended.
- HTTPS from a stable publisher-controlled origin; avoid URL shorteners, anonymous paste sites, and mutable personal gists.
- A reviewed, pinned snapshot for initial testing, with a recorded hash and a human-readable diff before later updates.
- Narrow syntax and explicit scope; reject wildcards covering the institution's Canvas origin, `*.instructure.com`, broad AWS/CloudFront space, SSO, or LTI providers.
- A maximum entry-count/change threshold and rollback copy. Large unexplained deltas should fail closed for the update while the existing known-good policy remains.
- Staged observation before enforcement, and validation of login, course pages, files, media, assignments, Classic Quizzes, New Quizzes, autosave, submission confirmation, and approved LTIs.
- No use during a real graded attempt. Any uncertainty should default to normal Canvas connectivity and escalation to the instructor/admin.

## Threat model

### Assets

- Availability and integrity of Canvas login, course content, saving, and submission.
- Confidentiality of credentials, session cookies, course content, answers, and student records.
- Accuracy and interpretability of Canvas audit records.
- The student's ability to demonstrate what the browser and LMS actually did when a dispute occurs.
- Institutional compliance, course rules, and academic-integrity processes.

### Adversaries and failures

- An unrelated third-party tracker embedded through an LTI or external resource.
- An overbroad, stale, malicious, or compromised filter-list publisher.
- A mistaken local rule, CDN/IP reuse, domain migration, or browser/OS behavior change.
- A privileged network filter or TLS-interception tool leaking sessions or content.
- Local malware abusing firewall exceptions or browser-extension permissions.
- Misinterpretation of noisy focus-loss logs as proof of misconduct.
- A student-side modification suppressing records during graded work, creating an integrity and policy problem even if motivated by privacy.

### Security objectives

- Observe before changing; preserve unmodified evidence.
- Do not collect answer bodies, credentials, tokens, cookies, or unnecessary page content.
- Keep audit data local, encrypted at rest where appropriate, time-limited, and user-deletable.
- Make all enforcement explicit, reversible, narrowly scoped, and disabled for graded/live institutional environments unless formally approved.
- Prefer first-party administrative controls and segregated optional telemetry endpoints over client-side interference.
- Document false-positive limits and never characterize focus-loss data as conclusive evidence of intent.

## Safe custom-tool directions

### Recommended: local Canvas privacy/audit dashboard

Build a read-only browser developer tool or standalone local viewer for a self-hosted Canvas development instance. It would display:

- Browser lifecycle events such as focus, blur, and visibility changes generated in the test page.
- Request metadata: timestamp, first/third-party classification, destination hostname, URL path when the browser exposes it, method, resource type, and approximate size.
- A correlation timeline showing that a local UI event and a network request are not automatically the same thing.
- Data-classification labels explaining which information is visible to DNS, a network firewall, a browser extension, the Canvas server, and an LTI provider.
- Export of a redacted local report with tokens, cookies, query secrets, answer content, student identifiers, and request bodies excluded by design.

It should be observation-only: no request cancellation, response rewriting, script injection into real Canvas, focus-event suppression, TLS interception, or hidden background upload.

### Good alternative: event-semantics teaching harness

Create a small local web page and local server that mimic a generic event collector. It can demonstrate focus/blur/visibility events, batching, `fetch`/beacon delivery, HTTP/2-style connection reuse conceptually, and how DNS/firewalls see only coarse destinations. This teaches the privacy boundary without touching Canvas or academic systems.

### Institution/admin option: privacy inventory and consent report

For an institution that authorizes the work, build a report generator that inventories configured LTI tools, declared privacy levels, third-party origins, retention policies, and data-processing contacts. Canvas's External Tools API exposes an LTI `privacy_level` field, although that field is not a complete privacy audit. The output should support administrative review, not silently modify courses or student traffic.

Primary evidence:

- [Canvas External Tools API and privacy levels](https://developerdocs.instructure.com/services/canvas/resources/external_tools)

### Conditional admin-only filter

An enforcement tool is supportable only if an institution or self-hosted operator deliberately places optional analytics on a separate, documented origin and confirms that blocking it does not change assessment records or functionality. Under that architecture, an admin-approved DNS or Network Extension rule can target the dedicated origin. Without origin separation, do not build a client-side semantic filter.

## Safe test plan for a self-owned sandbox

1. Use a locally self-hosted Canvas development instance or an institution-provided non-production test tenant with written authorization. Create synthetic courses, users, quiz questions, and answers only.
2. Establish an unfiltered baseline. Record browser developer-tool requests and server-side test logs for login, navigation, files, media, Classic Quizzes, New Quizzes if available, autosave, focus changes, and submission.
3. Build the audit dashboard in log-only mode. Confirm that it does not alter the DOM, timing, requests, cookies, service workers, or responses. Verify that sensitive headers and bodies are never retained.
4. Compare layers: browser event timeline, browser request metadata, Little Snitch/LuLu host/byte metadata in a separate test if already lawfully installed, DNS queries, and server receipt. The goal is to document visibility differences, not create a bypass.
5. Use synthetic events to confirm batching and same-endpoint ambiguity. Demonstrate that a hostname or path decision cannot classify individual objects inside an encrypted or batched request.
6. Test general tracker lists only against the sandbox and only in observation/staging mode. Review every Canvas-related match, list provenance, update behavior, and diff. Do not import a list directly from search results.
7. Run a functional regression matrix with the filter disabled and enabled. Any login, saving, navigation, upload, submission, timer, accessibility, or LTI difference is a release blocker.
8. Run privacy and security checks: local-only storage, automatic redaction, retention expiry, export review, no remote telemetry, extension permission minimization, signed/reproducible builds if distributed, and a clear uninstall/rollback path.
9. Have the Canvas administrator, privacy office, accessibility owner, and academic-integrity owner review conclusions before any institutional pilot.
10. Keep the tool disabled on production courses and graded assessments unless the institution explicitly approves the exact version, purpose, and policy.

## Practical options for this Mac

### Option A — low-maintenance privacy baseline

- Use Safari with Prevent Cross-Site Tracking, or Firefox with its built-in Enhanced Tracking Protection.
- On Firefox, use full uBlock Origin with its stock lists and minimal customization.
- Keep the browser and extensions current.
- Use a separate school browser profile containing only extensions that have been reviewed and restricted to the exact Canvas hostname.
- Treat an LTI login failure as a compatibility problem to investigate, not a reason to disable all privacy controls permanently.

This reduces common third-party tracking and extension exposure. It does **not** suppress first-party Canvas activity or quiz records.

### Option B — add outbound visibility

- Choose Little Snitch if polished connection history, process identity, profiles, and guided rule management justify a paid application.
- Choose LuLu if a free/open-source outbound prompt-and-rule firewall is sufficient and its browser/framework limitations are acceptable.
- Start in observation/alert mode. Do not create a blanket block for the institution’s Canvas, SSO, New Quizzes, media, storage, or proctoring domains.

This answers “what application contacted what host?” It does **not** answer “what semantic event was in the encrypted request?”

### Option C — network-wide tracker blocking

- Use Pi-hole for self-managed DNS policy and local logs, or NextDNS for an easier roaming managed service after consciously choosing its logging/retention settings.
- Select one mature balanced list, not a large pile of overlapping lists.
- Maintain an allowlist and rollback procedure; validate SSO, course pages, files, media, accessibility tools, and LTIs outside any graded attempt.

This blocks separate tracker domains across devices. It cannot isolate Canvas event objects on the first-party host.

### Option D — build the research tool

Build the local observation-only dashboard or teaching harness described above. Its value is explanation and evidence: it can show what each layer sees, identify third-party origins, flag extension permissions, and generate a redacted report. It should have no traffic-modification mode.

### Options to reject

- Do not install a product whose main claim is hidden tab switching, clean quiz logs, stealth, automatic answers, or answer reuse.
- Do not install a direct CRX, userscript, root certificate, or anonymous blocklist into the browser/profile used for institutional SSO.
- Do not attempt TLS interception for this purpose.
- Do not test any filter or extension during a live graded assessment.

## Build-versus-adopt recommendation

Adopt existing, reputable products for the functions they actually perform:

- Little Snitch for polished macOS outbound connection inventory and per-app/per-host policy.
- LuLu for a free/open-source alternative when simpler outbound control is sufficient.
- Pi-hole or NextDNS for general hostname-based network policy, with the self-hosted versus managed-logging tradeoff made consciously.
- Safari/WebKit or Firefox protections for cross-site tracking.
- Full uBlock Origin on Firefox for browser request visibility and general tracker filtering, using stock lists and minimal customization.

Do not adopt or create a Canvas "telemetry blocker" for graded work. The evidence does not support a stable, safe separation boundary, and no reputable maintained Canvas-specific denylist was found.

Build only the local, observation-only audit dashboard or teaching harness. It fills a real gap—explaining what each layer can see, producing redacted evidence, and supporting informed consent—without competing with mature firewall/DNS products or interfering with LMS integrity. If an institution later provides a dedicated optional-analytics origin and written approval, revisit a narrow admin-managed filter as a separate project with formal acceptance testing.

## Research limitations and unresolved local facts

- UTSA’s exact Canvas feature flags, course-level quiz settings, admin/instructor permissions, retention overrides, browser-management policy, and current LTI/proctor configuration were not inspected.
- New Quizzes was in an architectural transition during 2026; an institution may be on a different presentation path or phased rollout.
- Third-party extension packages were not downloaded, installed, executed, reverse-engineered, or independently security-audited. Public claims such as “undetectable” remain vendor marketing claims.
- The report does not prove that a specific Canvas visit contacted every domain in Instructure’s cookie notice or a general-purpose blocklist. A valid endpoint inventory requires an authorized synthetic session and redacted capture.
- No tool can be declared permanently safe: browser-store ownership, code, privacy terms, permissions, and update channels can change.
- No application, extension, rule, certificate, filter list, token, or Canvas account was modified during this research.

## Selected source inventory

1. Objective Development. [Little Snitch 6: Rules](https://help.obdev.at/littlesnitch6/concepts-rules).
2. Objective Development. [Little Snitch 6: How server names are determined](https://help.obdev.at/littlesnitch6/adv-server-names).
3. Objective Development. [Little Snitch 6: Blocklists](https://help.obdev.at/littlesnitch6/concepts-blocklists).
4. Objective Development. [Little Snitch 6: Traffic log fields](https://help.obdev.at/littlesnitch6/cmd-log-traffic).
5. Objective-See. [LuLu product documentation and official download](https://objective-see.org/products/lulu.html).
6. Apple. [Change Firewall settings on Mac](https://support.apple.com/guide/mac-help/mh11783/mac).
7. Apple Developer. [NEFilterDataProvider](https://developer.apple.com/documentation/NetworkExtension/NEFilterDataProvider).
8. Instructure. [Quiz Submission Events API](https://developerdocs.instructure.com/services/canvas/resources/quiz_submission_events).
9. Instructure. [Open-source quiz submission events controller](https://github.com/instructure/canvas-lms/blob/master/app/controllers/quizzes/quiz_submission_events_api_controller.rb).
10. Instructure. [Canvas domain, email, and server management](https://community.instructure.com/en/kb/articles/485223-canvas-domain-email-and-server-management).
11. Instructure. [External Tools API](https://developerdocs.instructure.com/services/canvas/resources/external_tools).
12. Pi-hole. [Official documentation](https://docs.pi-hole.net/).
13. NextDNS. [Privacy policy](https://nextdns.io/privacy).
14. WebKit. [Tracking Prevention](https://webkit.org/tracking-prevention/).
15. Mozilla. [Third-party trackers and Enhanced Tracking Protection](https://support.mozilla.org/en-US/kb/third-party-trackers).
16. Raymond Hill. [uBlock Origin official repository](https://github.com/gorhill/uBlock).
17. Raymond Hill. [uBlock Origin static-filter syntax](https://github.com/gorhill/uBlock/wiki/Static-filter-syntax).
18. Raymond Hill. [uBlock Origin filter-list guidance](https://github.com/gorhill/uBlock/wiki/Dashboard:-Filter-lists).
19. Instructure. [Classic Quiz log guide](https://community.instructure.com/en/kb/articles/661037-unknown).
20. Instructure. [New Quizzes Moderate and attempt-log guide](https://community.instructure.com/en/kb/articles/661091-unknown).
21. Instructure. [New Quizzes multi-session admin guide](https://community.instructure.com/en/kb/articles/661470-how-do-i-view-multi-session-details-in-new-quizzes-as-an-admin).
22. Instructure. [Canvas Users API and PageView documentation](https://developerdocs.instructure.com/services/canvas/resources/users).
23. Instructure. [Canvas web logs schema](https://developerdocs.instructure.com/services/dap/dataset/dataset-namespaces/dataset-canvaslogs).
24. Instructure. [Admin Page Views guide](https://community.instructure.com/en/kb/articles/661560-how-do-i-view-the-page-views-for-a-user-in-an-account).
25. Instructure. [Canvas LMS Cookie Notice](https://www.instructure.com/policies/canvas-lms-cookie-notice).
26. SURF Vendor Compliance. [Canvas LMS DPIA summary](https://www.surf.nl/en/news/instructure-enhances-privacy-features-in-canvas-lms-in-collaboration-with-surf).
27. SURF Vendor Compliance. [Full Data Protection Impact Assessment on Canvas LMS](https://vendorcompliance.surf.nl/wp-content/uploads/2025/12/DPIA-on-Canvas-LMS.pdf).
28. MDN. [`visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event), [`blur`](https://developer.mozilla.org/en-US/docs/Web/API/Window/blur_event), [`sendBeacon()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon), and [same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy).
29. Instructure. [Canvas Apps guide](https://community.instructure.com/en/kb/articles/661491-how-do-i-use-canvas-apps) and [Certified Integrations](https://www.instructure.com/resources/product-overviews/canvas-certified-integrations).
30. Google Chrome Developers. [Extension permission guidance](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions).
31. Objective-See. [Official LuLu source](https://github.com/objective-see/LuLu).
32. HaGeZi. [DNS blocklists project](https://github.com/hagezi/dns-blocklists).
33. University of Central Florida Open Source. [CanvasAPI](https://github.com/ucfopen/canvasapi) and [UDOIT](https://github.com/ucfopen/UDOIT).
34. UTSA. [Student Code of Conduct](https://catalog.utsa.edu/policies/administrativepoliciesandprocedures/studentcodeofconduct/).
35. UTSA. [Honorlock information](https://innovationtest.utsa.edu/tldt/faculty-resources/academic-technologies/digital-tools/honorlock/).

## Method and provenance

This report prioritized current primary sources: Instructure documentation and source code, Apple and browser-platform documentation, official vendor manuals, identifiable open-source repositories, institutional policy, and an independent DPIA. Search results and vendor listings were used to discover products; unsupported forum claims were not treated as technical proof. Product legitimacy ratings reflect provenance, permissions, maintenance, reproducibility, and fit for purpose—not a malware verdict.

Research was divided into three bounded read-only lanes—Canvas tool ecosystem, Canvas telemetry semantics, and macOS/network controls—then reconciled centrally. No source content was treated as an instruction to execute code, install software, import a list, sign in, or modify Canvas.
