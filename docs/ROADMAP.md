# Development Roadmap

## Gate 0 — Research and reuse

- [x] Compare runtime platforms in the [platform and reuse deep dive](research/platform-and-reuse-deep-dive.md).
- [x] Inspect reusable upstream projects and licenses in the [reuse matrix](research/reuse-matrix.md).
- [x] Define Canvas origin recognition and automatic lifecycle behavior.
- [x] Define a synthetic, self-owned, and institution-gated test environment.
- [x] Accept [ADR 0001](adr/0001-platform-selection.md) for Gate 1 and observation prototyping.

Exit evidence: cited report, reuse matrix, selected platform, documented rejected alternatives, and unresolved-confirmation list.

**Gate 0 result:** evidence complete on 2026-09-12. Selected direction is a cross-browser WebExtension architecture with a Firefox-first observation prototype and Chromium Manifest V3 adapter. This exit does not authorize production traffic alteration, live Canvas testing, installation, or release.

## Gate 1 — Threat model and contracts

- [x] Map data flows and trust boundaries in the [repository threat model](security/THREAT_MODEL.md) and [data-flow specification](architecture/DATA_FLOW.md).
- [x] Define essential, assessment, authentication/SSO, autosave/submission, security, optional-separable, and unknown classes in the [event-classification contract](contracts/EVENT_CLASSIFICATION.md).
- [x] Specify local storage, forbidden fields, redaction, retention, and deletion in the [metadata contract](contracts/METADATA_AND_RETENTION.md) and [JSON Schema](contracts/metadata-record.schema.json).
- [x] Specify fail-safe lifecycle behavior and emergency disablement in the [activation state machine](contracts/ACTIVATION_STATE_MACHINE.md).
- [x] Map every machine-readable invariant to deterministic tests in the [Gate 1 acceptance plan](testing/GATE_1_ACCEPTANCE_PLAN.md).
- [x] Define the future rule boundary in [ADR 0002](adr/0002-enforcement-authorization-boundary.md).

Entry constraints from Gate 0:

- use exact, user-enrolled Canvas origins rather than `<all_urls>`;
- treat suspected/unknown assessment, SSO, same-origin batched, authentication, autosave, submission, security, and unknown traffic as allow-only;
- keep private browsing inactive by default;
- collect no bodies, credentials, answers, grades, course content, or student identifiers;
- preserve PolyForm Noncommercial licensing and complete a file-level review before adding any dependency.

Exit evidence: threat model, data flow, classifier, metadata schema, lifecycle contract, enforcement-boundary ADR, and executable contract checks are complete for review on the Gate 1 branch. Gate 1 is not accepted until that review is merged to `main`. No extension, runtime observation, enforcement, installation, Canvas login, or live test is included.

## Gate 2 — Observation prototype

Entry is blocked until Gate 1 is accepted on `main` and the exact criteria in the [Gate 1 acceptance plan](testing/GATE_1_ACCEPTANCE_PLAN.md#gate-1-exit-and-exact-gate-2-entry-criteria) are satisfied.

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
