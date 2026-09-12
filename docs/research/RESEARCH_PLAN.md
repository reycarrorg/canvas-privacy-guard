# Research and Platform-Selection Plan

## Decision to make

Choose the smallest maintainable platform capable of recognizing Canvas activity, inspecting relevant browser behavior at sufficient granularity, minimizing only optional telemetry, and stopping cleanly when Canvas is no longer in use.

## Platforms to compare

| Candidate | Questions requiring evidence |
| --- | --- |
| Browser extension using WebExtensions | Can host permissions and content scripts scope activation to institution-specific Canvas origins? Can it classify requests without broad access or fragile page monkey-patching? What differs across Firefox, Chromium, and Safari? |
| Safari Web Extension packaged in a macOS app | Does packaging materially improve lifecycle, native controls, or distribution? What signing and App Store constraints apply? |
| Native macOS application | Can it detect relevant browser tabs without invasive accessibility permissions? Would Network Extension privileges or TLS visibility be required? |
| CLI or local script | Can it reliably follow browser/session lifecycle without requiring the user to keep a terminal open? Is it supportable for nontechnical users? |
| Local proxy | Would useful classification require TLS interception, certificate installation, or exposure of credentials and course content? If so, reject it for normal use. |
| DNS or outbound firewall rules | Are optional analytics segregated by stable hostname, or would blocking also break core Canvas functionality? |
| Userscript/content blocker configuration | Is it sufficiently reviewable and narrow, and can it avoid modifying assessment event streams? |
| Hybrid extension plus optional native companion | Does the added complexity unlock a concrete requirement that a browser-only implementation cannot satisfy? |

## Reuse survey

Research must inspect source, maintenance history, releases, security posture, permissions, and license compatibility—not merely project descriptions. Candidate classes include:

- Canvas LMS upstream source and documented APIs/events;
- mature WebExtension filtering and request-observation projects;
- browser privacy tools and tracker-classification datasets;
- Objective-See LuLu and other open-source macOS network monitors;
- reproducible browser automation or measurement frameworks for synthetic testing;
- local Canvas development/sandbox tooling;
- declarative request filtering, content-script lifecycle, and origin-detection libraries;
- privacy-label, policy, and audit-reporting frameworks.

Projects marketed as hiding quiz activity, providing answers, or defeating proctoring may be documented as risk evidence but must not be incorporated as dependencies or implementation templates.

## Required research outputs

1. A weighted platform comparison with privacy, granularity, lifecycle, permissions, portability, maintenance, distribution, and failure-risk criteria.
2. A reuse matrix naming exact repositories, upstream owners, license, current maintenance evidence, useful components, unsafe components, and adopt/fork/reference/reject disposition.
3. A proposed activation state machine covering Canvas tab discovery, recognized-origin enrollment, active/inactive transitions, multiple windows, private browsing, SSO domains, and browser termination.
4. A proposed test environment that does not rely on live graded work.
5. Architecture Decision Record 0001 with the recommendation and rejected alternatives.
6. A list of facts that require user or institutional confirmation before real-account testing.

## Source standard

Prefer official browser-platform documentation, official Instructure documentation and source, upstream repositories, source licenses, signed releases, maintainers' security policies, and reproducible code inspection. Search results, store listings, and marketing claims are discovery leads rather than proof.

