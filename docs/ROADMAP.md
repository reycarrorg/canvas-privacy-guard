# Development Roadmap

## Gate 0 — Research and reuse

- Compare runtime platforms.
- Inspect reusable upstream projects and licenses.
- Define Canvas origin recognition and automatic lifecycle behavior.
- Define a safe test environment.
- Complete ADR 0001.

Exit evidence: cited report, reuse matrix, selected platform, documented rejected alternatives, and unresolved-confirmation list.

## Gate 1 — Threat model and contracts

- Map data flows and trust boundaries.
- Define optional, essential, assessment, security, and unknown event classes.
- Specify local storage and redaction rules.
- Specify fail-safe behavior and emergency disablement.
- Define acceptance tests before implementation.

Exit evidence: reviewed threat model, event-classification contract, and executable test plan.

## Gate 2 — Observation prototype

- Implement Canvas-only activation and deactivation.
- Show local state and classified destinations without modifying traffic.
- Validate that no credentials, answers, course content, or identifiers enter logs.

Exit evidence: deterministic tests plus synthetic runtime demonstration.

## Gate 3 — Optional-analytics minimization prototype

- Add enforcement only for optional traffic proven to be separate from core Canvas functions.
- Preserve essential behavior and show every active rule.
- Refuse to alter assessment event streams or unknown same-origin payloads.

Exit evidence: regression suite, fault injection, and synthetic Canvas acceptance results.

## Gate 4 — User-supervised testing

- Package a review build.
- Perform a non-graded canary with explicit user participation.
- Record actual compatibility and unresolved institutional questions.

Exit evidence: user-observed test results. This gate does not authorize graded-assessment use.

## Gate 5 — Public release candidate

- Complete security review and dependency provenance.
- Document supported browsers, Canvas deployments, and limitations.
- Produce reproducible packages and checksums where applicable.

Exit evidence: reviewed release candidate. Publishing the repository does not itself establish that a release is ready for real-world use.

