#!/usr/bin/env python3
"""Gate 2 privacy, supply-chain, local-path, and misuse policy checks."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
GATE2_PATHS = [
    ROOT / "extension",
    ROOT / "tests/gate2",
    ROOT / "docs/testing/GATE_2_SYNTHETIC_EVIDENCE.md",
]


def files_below(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    return sorted(candidate for candidate in path.rglob("*") if candidate.is_file())


def fail(message: str) -> None:
    raise AssertionError(message)


def main() -> int:
    files = [candidate for path in GATE2_PATHS for candidate in files_below(path)]
    for candidate in files:
        if candidate.is_symlink():
            fail(f"Gate 2 symlink is not allowed: {candidate.relative_to(ROOT)}")
        if b"\x00" in candidate.read_bytes():
            fail(f"Gate 2 binary file is not allowed: {candidate.relative_to(ROOT)}")

    corpus = "\n".join(candidate.read_text(encoding="utf-8") for candidate in files)
    executable = "\n".join(
        candidate.read_text(encoding="utf-8")
        for candidate in files_below(ROOT / "extension")
        if candidate.suffix in {".mjs", ".html", ".css", ".json"}
    )

    forbidden_patterns = {
        "private key material": r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
        "GitHub token": r"\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b",
        "AWS access key": r"\bAKIA[A-Z0-9]{16}\b",
        "user-local macOS path": r"/Users/[^/\s]+/",
        "user-local Windows path": r"(?i)\b[A-Z]:\\Users\\[^\\\s]+\\",
        "real UTSA domain": r"(?i)\b(?:utsa\.edu|my\.utsa\.edu)\b",
        "prohibited implementation license": r"(?i)\b(?:GNU (?:AFFERO )?GENERAL PUBLIC LICENSE|Mozilla Public License)\b",
    }
    for label, pattern in forbidden_patterns.items():
        if re.search(pattern, corpus):
            fail(f"{label} found in Gate 2 artifacts")

    for token in (
        "webNavigation",
        "webRequestBlocking",
        "declarativeNetRequest",
        "filterResponseData",
        "onBeforeSendHeaders",
        "onHeadersReceived",
        "nativeMessaging",
        "proxy.settings",
        "document.cookie",
        "innerHTML",
        "eval(",
        "new Function(",
    ):
        if token in executable:
            fail(f"prohibited executable capability found: {token}")

    for candidate in files_below(ROOT / "extension"):
        text = candidate.read_text(encoding="utf-8")
        for match in re.finditer(r"https?://[^\s\"'`<>]+", text):
            if (
                ".test.invalid" not in match.group(0)
                and match.group(0) != "https://*.instructure.com/*"
            ):
                fail(f"remote endpoint found in {candidate.relative_to(ROOT)}")

    dependency_names = {
        "package.json",
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "bun.lock",
        "deno.lock",
        "requirements.txt",
        "Pipfile",
        "poetry.lock",
        "Cargo.toml",
        "Cargo.lock",
    }
    dependency_files = [
        path.relative_to(ROOT)
        for path in ROOT.rglob("*")
        if ".git" not in path.parts and path.is_file() and path.name in dependency_names
    ]
    if dependency_files:
        fail(f"unreviewed dependency manifests or locks found: {dependency_files}")

    for manifest_name in ("manifest.firefox.json", "manifest.chromium.json"):
        manifest = json.loads((ROOT / "extension" / manifest_name).read_text(encoding="utf-8"))
        if manifest["permissions"] != ["activeTab", "alarms", "storage", "webRequest"]:
            fail(f"unexpected permissions in {manifest_name}")
        if manifest["host_permissions"] != [
            "https://canvas.test.invalid/*",
            "https://optional.test.invalid/*",
        ]:
            fail(f"unexpected host permissions in {manifest_name}")
        if manifest.get("optional_host_permissions") != ["https://*.instructure.com/*"]:
            fail(f"unexpected optional host permissions in {manifest_name}")

    notice = (ROOT / "NOTICE").read_text(encoding="utf-8")
    if "Required Notice: Copyright © 2026 Rolando Carreon. All rights reserved." not in notice:
        fail("required notice changed or missing")
    license_text = (ROOT / "LICENSE.md").read_text(encoding="utf-8")
    if "PolyForm Noncommercial License 1.0.0" not in license_text:
        fail("PolyForm Noncommercial license changed or missing")

    print("Gate 2 privacy, supply-chain, local-path, and misuse policy scans passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
