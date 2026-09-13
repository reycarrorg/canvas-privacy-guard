# ADR 0001: Runtime Platform

- Status: Accepted for Gate 1 and observation prototyping
- Decision date: 2026-09-12
- Traffic-altering implementation: Not authorized by this decision

## Context

The product must activate only while Canvas is in use, classify optional telemetry at sufficient granularity, minimize permissions, preserve essential Canvas functions, and stop when Canvas is no longer active.

## Decision

Use a **standards-based cross-browser WebExtension architecture with a Firefox-first observation prototype**.

The design will keep a browser-neutral lifecycle reducer, redacted request-metadata schema, rule model, and accessible UI in shared code. Browser adapters will isolate Firefox, Chromium Manifest V3, and later Safari differences.

Implementation sequence:

1. Firefox observation-only prototype with exact, user-enrolled optional Canvas origin permission.
2. Chromium Manifest V3 adapter and parity tests, using an event-driven service worker and no assumption of persistent in-memory state.
3. Safari Web Extension port only after the shared behavior is stable and signing/distribution is separately authorized.
4. No native companion unless a later ADR proves a concrete browser-only capability gap.

This ADR does **not** approve production enforcement. Gate 1 must first define the threat model, data flows, redaction schema, event-classification contract, and “never alter” classes. Gate 2 remains observation-only. A future rule may block only an institutionally accepted, technically separate optional third-party request class. Assessment, authentication, autosave, submission, security, same-origin batched, and unknown traffic must be allowed.

## Required comparison

Browser extension, Safari Web Extension/native wrapper, native macOS application, CLI/script, local proxy, DNS/firewall configuration, userscript/content blocker, and hybrid extension/native companion.

The full weighted comparison and evidence are in [Platform and Reuse Deep Dive](../research/platform-and-reuse-deep-dive.md). The project-level licensing and maintenance survey is in [Reuse Matrix](../research/reuse-matrix.md).

## Non-negotiable constraints

- No falsification or manufacture of assessment events.
- No credential or course-content collection.
- No TLS-interception root certificate for normal operation.
- No real graded-assessment testing during research or prototyping.
- No remote telemetry from this product.
- No broad always-on permissions without a documented technical necessity.

## Consequences

### Positive

- Exact browser origins, tabs, windows, frames, and navigation can drive automatic activation without OS-wide monitoring or TLS interception.
- Firefox provides a capable research surface while Chromium Manifest V3 defines a conservative portability floor for any future URL-level rule.
- The shared core can later be packaged for Safari without making a native application the primary control plane.
- State is visible and reconstructable after browser/runtime restart.

### Costs and constraints

- Firefox, Chromium, and Safari require separate lifecycle, permission, private-browsing, packaging, and runtime tests.
- Institution custom domains and SSO transitions require explicit enrollment and confirmation; broad `*.instructure.com` or `<all_urls>` access is not accepted.
- Same-origin or batched Canvas traffic cannot be treated as optional based on URL alone.
- Safari distribution adds Apple signing, container, review/notarization, and profile/private-mode verification.

### Required safe behavior

- Exact-origin optional permissions; no `<all_urls>`.
- No cookies, history, debugger, proxy, native-messaging, screen-capture, clipboard, or accessibility permission.
- Private browsing inactive by default at the product layer.
- Suspected or unknown assessment state dominates to a visible allow-all mode across that browser context.
- Any inconsistent permission, tab map, classifier result, or rule state clears enforcement and visibly allows traffic.
- No request/response bodies, credentials, answers, grades, course content, or student identifiers in storage or diagnostics.

## Rejected alternatives

| Alternative | Reason rejected or deferred |
| --- | --- |
| Firefox-only product | Best first research target, but insufficient portability as the final architecture |
| Chromium MV3-only product | Viable but DNR and service-worker lifecycle should not define the entire shared design |
| Safari-first/native wrapper | Additional signing/packaging cost without a unique early capability; defer as a port |
| Native macOS app | Requires automation/accessibility or Network Extension scope to discover browser/network state; not portable |
| CLI/script | Appropriate for tests and tooling, not reliable automatic end-user lifecycle or accessible state |
| Userscript/content blocker alone | Cannot safely classify same-origin batched semantics; page interception is fragile and integrity-sensitive |
| DNS/firewall | Host/process granularity cannot isolate application-layer Canvas events or tab lifecycle |
| Local proxy | Useful HTTPS inspection requires a trusted interception CA and exposes sensitive authenticated content |
| Hybrid extension/native companion | Adds IPC, install, signing, update, and privilege complexity without a proven requirement |

## Confidence and unknowns

Confidence is **high** that a browser extension is the smallest appropriate control plane and that TLS interception, DNS/firewall, native-only, and userscript approaches should not be the product runtime. Confidence is **medium** that the proposed shared core will achieve the desired Firefox/Chromium parity until synthetic prototypes run. Confidence is **low** for any institution-specific filtering rule until an authorized test tenant and a documented optional, separate endpoint exist.

Unresolved gates include exact institution origins and SSO behavior; Classic/New Quizzes routes and rollout; browser/device-management policy; private-browsing requirements; accessibility acceptance; optional endpoint ownership and purpose; test-tenant authorization; and institutional privacy, security, academic-integrity, and Canvas-admin approval.

## Reuse decision

- Adopt later, pinned: WXT (MIT) for scaffolding and Playwright (Apache-2.0) for synthetic tests.
- Evaluate conditionally: Ghostery adblocker (MPL-2.0) as a separable parser/matcher only if Gate 1 proves the need and file-level obligations are preserved.
- Reference only: Canvas LMS, uBlock Origin, Privacy Badger, AdGuard, LuLu, OpenWPM, HaGeZi, browser samples, and Canvancement.
- Reject: mitmproxy/TLS interception and products/scripts marketed for answers, proctoring bypass, focus hiding, stealth, or clean-log fabrication.

The project remains copyright © 2026 Rolando Carreon under PolyForm Noncommercial 1.0.0 and must be described as **source-available, not OSI-open-source** unless the owner later approves a license change. No upstream code was copied for this ADR.
