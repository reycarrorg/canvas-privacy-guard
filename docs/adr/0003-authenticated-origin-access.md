# ADR 0003: Authenticated Canvas-Origin Access

- Status: Implemented in source for review
- Decision date: 2026-09-13
- Installation on a normal browser profile: Not yet authorized
- Real assessment use: Prohibited
- Real optional-telemetry enforcement: No approved rules

## Context

The synthetic Gate 2 build could prove the lifecycle and minimization contracts, but its manifest could not be granted access to an authenticated hosted Canvas deployment. The user wants the extension to expose privacy-relevant activity across authenticated Canvas pages while ensuring that only genuinely optional, separately hosted telemetry can ever be blocked.

Those goals require two different trust decisions. Access to an authenticated Canvas origin lets the extension observe request metadata on sensitive pages. Blocking a destination additionally requires evidence that the destination is optional and technically separable from Canvas, authentication, accessibility, course content, assessments, saves, submissions, security, and support functions. Origin access does not prove optionality and must never authorize blocking by itself.

## Decision

The extension may request one exact user-selected hosted Canvas origin under `https://*.instructure.com/*` when the user opens the extension from that Canvas tab and approves the browser permission prompt.

The implementation:

- declares the hosted-Canvas pattern only as an optional host permission;
- uses `activeTab` only to identify the tab from which the user invoked the popup;
- requests and persists only the exact origin, such as `https://institution.instructure.com/*`;
- rejects unrelated websites, wildcard enrollment, HTTP, credentials in URLs, paths, queries, and fragments;
- remains inactive when the exact permission is missing or the enrolled origin is not open;
- removes the stored enrollment and asks the browser to revoke the exact permission when the user removes access;
- does not add a content script or inspect DOM content, cookies, headers, bodies, answers, grades, messages, files, or student identifiers;
- stores only the existing bounded categorical metadata; and
- records one minimized categorical assessment signal and then suspends observation when an assessment-like route is detected; malformed or unknown frame metadata suspends without storing it.

The active blocking-rule count remains zero. Authenticated-origin access does not change the `ALLOW` network-action invariant. A later rule still requires the complete rule-specific authorization record in ADR 0002, and the UI must display the exact active rule count.

## Why the wildcard appears only in optional permissions

Canvas institutions commonly use different `*.instructure.com` subdomains. A manifest must declare the broadest pattern from which a runtime permission may be requested, but the browser prompt and stored enrollment use only the exact current origin. The pattern is not placed in `host_permissions`, so installation alone does not grant standing access to every hosted Canvas tenant.

Custom institutional Canvas domains are deliberately not included in this revision. Supporting them would require a separate trust-on-first-use or institution-validation design. The user can continue to use the provider-hosted Canvas origin while that boundary is reviewed.

## Nonblocking and optionality invariant

The following are never optional blocking targets: same-origin Canvas requests; focus, blur, or visibility events; quizzes or assessments; answers; timers; saves, autosaves, submissions, confirmations, or receipts; login, logout, OAuth, sessions, or SSO; security or integrity controls; accessibility; LTI course functions; unknown requests; batched requests; and any destination whose purpose is uncertain.

An optional telemetry rule must be a locally pinned, exact, separately hosted destination with primary-source evidence, an expiry, a hash, regression tests, and an empty-rule rollback. No remote list, user-authored wildcard, classifier guess, path substring, request body, or live page content may create a blocking rule.

## Evidence boundary

This revision establishes source, manifest, and deterministic fake-browser evidence. The activity table exposes the coarse event class, privacy-signal/path class, destination class, resource type, and `ALLOW` action without retaining the URL or page data. It does not prove Firefox or Chromium runtime behavior, successful authentication, compatibility with a specific Canvas institution, complete third-party request visibility, or safe enforcement. Those claims require a packaged review build and a user-supervised, non-graded canary.
