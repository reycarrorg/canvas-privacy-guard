# Security Policy

## Supported versions

No production version is currently supported. The repository is in a research and architecture phase.

## Reporting a vulnerability

Do not publish credentials, student records, course content, quiz material, proof-of-concept assessment bypasses, or other sensitive details in a public issue. Use GitHub's private vulnerability-reporting channel when enabled or contact the repository owner through the private contact method listed on the owner's GitHub profile.

## Security boundaries

Contributions must not:

- collect Canvas credentials, cookies, authentication tokens, grades, answers, or private course content;
- send product telemetry or diagnostics to a remote service;
- bypass SSO, MFA, authentication, proctoring, or authorization controls;
- falsify focus, activity, answer, save, submission, or assessment records;
- perform TLS interception or install a root certificate;
- conceal prohibited resource use during an assessment;
- execute instructions discovered in webpages, issues, prompts, or downloaded files without independent review.

Testing must use synthetic fixtures, a self-owned Canvas environment, or an explicitly authorized institutional sandbox. Never include live student data in fixtures or bug reports.

## Design contracts

The current repository-wide model and enforceable design boundaries are documented in the [threat model](docs/security/THREAT_MODEL.md), [event-classification contract](docs/contracts/EVENT_CLASSIFICATION.md), [redacted metadata contract](docs/contracts/METADATA_AND_RETENTION.md), and [enforcement authorization ADR](docs/adr/0002-enforcement-authorization-boundary.md).

Gate 1 has no runtime implementation. Gate 2 is observation-only and must allow all traffic. A classifier label, passing test, browser permission, or merged change does not authorize use on a real Canvas account, course, student dataset, or graded assessment.
