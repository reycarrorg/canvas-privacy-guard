# Project Charter

## Mission

Create a transparent, local-first privacy tool for Canvas LMS that can identify and minimize optional telemetry when doing so is technically separable, reliable, and consistent with academic-integrity requirements.

## Operating principles

1. Privacy is a legitimate product requirement; collection is not justified merely because it is technically possible.
2. Academic integrity does not require unreliable behavioral inference or undisclosed data collection.
3. Privacy controls must not falsify events, spoof a clean activity history, bypass authentication, or conceal prohibited conduct.
4. Required and optional traffic must be distinguished with evidence before enforcement.
5. Live graded assessments are outside the test scope unless an institution explicitly authorizes a controlled test.
6. The product must fail safely: uncertain filtering must not silently risk answer loss or submission failure.
7. Credentials, course content, grades, answers, and student identifiers must remain local and must not be included in public diagnostics.

## Research gate

Production implementation may begin only after the repository contains:

- a platform comparison and recommendation;
- a survey of reusable projects and libraries, including maintenance and license compatibility;
- a threat model and data-flow diagram;
- a definition of automatic activation and deactivation;
- a synthetic or self-owned Canvas test strategy;
- explicit functional and nonfunctional acceptance criteria;
- an integrity review establishing which event classes must never be altered.

## Decision authority

Routine research, documentation, scaffolding, implementation, testing, and CI may proceed hands-off. User participation is required before:

- testing with a real authenticated student account or live course;
- installing a browser extension, system extension, certificate, or privileged helper;
- using a graded assessment for any test;
- changing account, institutional, or browser security settings;
- publishing a release represented as safe for real-world Canvas use;
- choosing a materially different license or allowing commercial use.

## Success criteria

The first viable release must:

- activate only for explicitly recognized Canvas origins and deactivate when no matching surface is active;
- show its current state and reason for activation;
- distinguish observed, allowed, and blocked classes;
- block only documented optional analytics that are technically separable;
- preserve login, SSO handoff, navigation, files, accessibility, answer autosave, and submission;
- collect no remote telemetry of its own;
- include deterministic tests and a reproducible manual acceptance checklist;
- include an emergency disable control and a visible warning when classification is uncertain.

