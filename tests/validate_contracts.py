#!/usr/bin/env python3
"""Deterministically validate Gate 1 JSON contracts with the standard library."""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = REPO_ROOT / "docs/contracts/metadata-record.schema.json"
INVARIANTS_PATH = REPO_ROOT / "docs/contracts/invariants.json"
PLAN_PATH = REPO_ROOT / "docs/testing/GATE_1_ACCEPTANCE_PLAN.md"
VALID_FIXTURE = REPO_ROOT / "tests/fixtures/metadata/valid-redacted.json"
INVALID_FIXTURE = REPO_ROOT / "tests/fixtures/metadata/invalid-forbidden-url.json"
AUDIT_EXPORT_SCHEMA_PATH = REPO_ROOT / "docs/contracts/audit-export.schema.json"
VALID_AUDIT_EXPORT_FIXTURE = REPO_ROOT / "tests/fixtures/audit-export/valid-audit-export.json"
INVALID_AUDIT_EXPORT_FIXTURE = REPO_ROOT / "tests/fixtures/audit-export/invalid-audit-export-url.json"

EXPECTED_EVENT_CLASSES = {
    "essential",
    "assessment",
    "authentication_sso",
    "autosave_submission",
    "security",
    "optional_separable",
    "unknown",
}
EXPECTED_FORBIDDEN_FIELDS = {
    "answer",
    "authorization",
    "body",
    "cookie",
    "courseContent",
    "credential",
    "fragment",
    "fullHistory",
    "grade",
    "header",
    "hostname",
    "ipAddress",
    "origin",
    "path",
    "query",
    "rawEvent",
    "requestId",
    "response",
    "studentIdentifier",
    "tabId",
    "url",
    "userAgent",
    "windowId",
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def validate(instance: Any, schema: dict[str, Any], path: str = "$") -> list[str]:
    """Validate the intentionally small JSON Schema vocabulary used by this gate."""
    errors: list[str] = []
    expected_type = schema.get("type")
    type_checks = {
        "object": lambda value: isinstance(value, dict),
        "array": lambda value: isinstance(value, list),
        "string": lambda value: isinstance(value, str),
        "integer": lambda value: isinstance(value, int) and not isinstance(value, bool),
        "boolean": lambda value: isinstance(value, bool),
    }
    if expected_type and not type_checks[expected_type](instance):
        return [f"{path}: expected {expected_type}"]

    if "const" in schema and instance != schema["const"]:
        errors.append(f"{path}: value does not equal const {schema['const']!r}")
    if "enum" in schema and instance not in schema["enum"]:
        errors.append(f"{path}: value is not in enum")

    if isinstance(instance, dict):
        properties = schema.get("properties", {})
        for required in schema.get("required", []):
            if required not in instance:
                errors.append(f"{path}: missing required property {required!r}")
        if schema.get("additionalProperties") is False:
            for key in instance.keys() - properties.keys():
                errors.append(f"{path}: additional property {key!r} is forbidden")
        for key, value in instance.items():
            if key in properties:
                errors.extend(validate(value, properties[key], f"{path}.{key}"))

    if isinstance(instance, str):
        if "maxLength" in schema and len(instance) > schema["maxLength"]:
            errors.append(f"{path}: string exceeds maxLength")
        if "pattern" in schema and re.fullmatch(schema["pattern"], instance) is None:
            errors.append(f"{path}: string does not match pattern")
        if schema.get("format") == "date-time":
            try:
                datetime.fromisoformat(instance.replace("Z", "+00:00"))
            except ValueError:
                errors.append(f"{path}: invalid date-time")
    return errors


def assert_closed_objects(schema: dict[str, Any], path: str = "$") -> None:
    if schema.get("type") == "object" and schema.get("additionalProperties") is not False:
        raise AssertionError(f"{path}: every record object must reject unknown properties")
    for name, child in schema.get("properties", {}).items():
        if isinstance(child, dict):
            assert_closed_objects(child, f"{path}.properties.{name}")


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def validate_record(instance: Any, schema: dict[str, Any]) -> list[str]:
    errors = validate(instance, schema)
    if errors:
        return errors
    observed = parse_time(instance["observedTimeBucket"])
    expires = parse_time(instance["retentionExpiresAtBucket"])
    retention_seconds = (expires - observed).total_seconds()
    if not 0 < retention_seconds <= 24 * 60 * 60:
        errors.append("$: retention deadline must be after observation and within 24 hours")
    return errors


def validate_audit_export(
    instance: Any, export_schema: dict[str, Any], record_schema: dict[str, Any]
) -> list[str]:
    errors = validate(instance, export_schema)
    if errors:
        return errors
    if not isinstance(instance, dict):
        return ["$: audit export must be an object"]
    records = instance.get("records", [])
    if not isinstance(records, list):
        return ["$.records: expected array"]
    if instance.get("recordCount") != len(records):
        errors.append("$: recordCount must match records length")
    if len(records) > 500:
        errors.append("$: records array exceeds maximum of 500 records")
    for index, record in enumerate(records):
        for record_error in validate_record(record, record_schema):
            errors.append(f"$.records[{index}]: {record_error}")
    return errors


def main() -> int:
    schema = load_json(SCHEMA_PATH)
    invariants = load_json(INVARIANTS_PATH)
    valid_fixture = load_json(VALID_FIXTURE)
    invalid_fixture = load_json(INVALID_FIXTURE)
    audit_schema = load_json(AUDIT_EXPORT_SCHEMA_PATH)
    valid_audit_fixture = load_json(VALID_AUDIT_EXPORT_FIXTURE)
    invalid_audit_fixture = load_json(INVALID_AUDIT_EXPORT_FIXTURE)

    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert_closed_objects(schema)
    assert set(schema["properties"]["eventClass"]["enum"]) == EXPECTED_EVENT_CLASSES
    policy = schema["x-cpg-contract"]
    assert policy["defaultRetentionHours"] == 24
    assert policy["maximumRetentionHours"] == 24
    assert policy["maximumRecords"] == 500
    assert policy["privateBrowsingPersistence"] is False
    assert policy["remoteTransmission"] is False
    assert set(policy["forbiddenFields"]) == EXPECTED_FORBIDDEN_FIELDS

    assert audit_schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert_closed_objects(audit_schema)
    audit_policy = audit_schema["x-cpg-contract"]
    assert audit_policy["defaultRetentionHours"] == 24
    assert audit_policy["maximumRetentionHours"] == 24
    assert audit_policy["maximumRecords"] == 500
    assert audit_policy["privateBrowsingPersistence"] is False
    assert audit_policy["remoteTransmission"] is False
    assert "enrolledOrigin" in audit_policy["forbiddenFields"]
    assert "enrolledOrigins" in audit_policy["forbiddenFields"]

    valid_errors = validate_record(valid_fixture, schema)
    assert not valid_errors, "valid fixture rejected: " + "; ".join(valid_errors)
    observed = parse_time(valid_fixture["observedTimeBucket"])
    expires = parse_time(valid_fixture["retentionExpiresAtBucket"])
    assert observed.minute % 15 == 0 and observed.second == 0
    assert expires.minute % 15 == 0 and expires.second == 0
    assert 0 < (expires - observed).total_seconds() <= 24 * 60 * 60

    invalid_errors = validate_record(invalid_fixture, schema)
    assert any("additional property 'url'" in error for error in invalid_errors)
    assert any("networkAction" in error and "const" in error for error in invalid_errors)

    excessive_retention = dict(valid_fixture)
    excessive_retention["retentionExpiresAtBucket"] = "2026-01-02T12:15:00Z"
    assert any("within 24 hours" in error for error in validate_record(excessive_retention, schema))

    unbucketed_time = dict(valid_fixture)
    unbucketed_time["observedTimeBucket"] = "2026-01-01T12:07:00Z"
    assert any("pattern" in error for error in validate_record(unbucketed_time, schema))

    valid_audit_errors = validate_audit_export(valid_audit_fixture, audit_schema, schema)
    assert not valid_audit_errors, "valid audit export fixture rejected: " + "; ".join(valid_audit_errors)

    invalid_audit_errors = validate_audit_export(invalid_audit_fixture, audit_schema, schema)
    assert any("additional property 'url'" in error for error in invalid_audit_errors)

    mismatched_count = dict(valid_audit_fixture)
    mismatched_count["recordCount"] = 99
    assert any("recordCount must match" in error for error in validate_audit_export(mismatched_count, audit_schema, schema))

    rows = invariants["invariants"]
    invariant_ids = [row["id"] for row in rows]
    assert len(invariant_ids) == len(set(invariant_ids))
    assert invariant_ids == [f"INV-{number:03d}" for number in range(1, 19)]
    plan = PLAN_PATH.read_text(encoding="utf-8")
    for row in rows:
        assert row["tests"], f"{row['id']} has no deterministic test"
        for test_id in row["tests"]:
            assert f"`{test_id}`" in plan, f"{test_id} missing from acceptance plan"

    print("Gate 1 metadata schema, fixtures, and invariant mapping passed")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, KeyError, TypeError, ValueError) as error:
        print(f"contract validation failed: {error}", file=sys.stderr)
        raise SystemExit(1)
