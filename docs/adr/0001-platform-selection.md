# ADR 0001: Runtime Platform

- Status: Researching
- Decision date: Pending

## Context

The product must activate only while Canvas is in use, classify optional telemetry at sufficient granularity, minimize permissions, preserve essential Canvas functions, and stop when Canvas is no longer active.

## Decision

Pending completion of the platform and reuse research.

## Required comparison

Browser extension, Safari Web Extension/native wrapper, native macOS application, CLI/script, local proxy, DNS/firewall configuration, userscript/content blocker, and hybrid extension/native companion.

## Non-negotiable constraints

- No falsification or manufacture of assessment events.
- No credential or course-content collection.
- No TLS-interception root certificate for normal operation.
- No real graded-assessment testing during research or prototyping.
- No remote telemetry from this product.
- No broad always-on permissions without a documented technical necessity.

## Consequences

Production traffic-altering code remains blocked until this record is accepted with evidence.

