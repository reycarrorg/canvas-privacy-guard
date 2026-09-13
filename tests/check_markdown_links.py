#!/usr/bin/env python3
"""Check that repository-local Markdown links resolve to existing files."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote


REPO_ROOT = Path(__file__).resolve().parent.parent
LINK_PATTERN = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
SKIPPED_PREFIXES = ("#", "http://", "https://", "mailto:")


def local_target(document: Path, raw_target: str) -> Path | None:
    target = raw_target.strip().strip("<>")
    if not target or target.startswith(SKIPPED_PREFIXES):
        return None

    target = unquote(target.split("#", 1)[0])
    if not target:
        return None
    return (document.parent / target).resolve()


def main() -> int:
    failures: list[str] = []
    for document in sorted(REPO_ROOT.rglob("*.md")):
        if ".git" in document.parts:
            continue
        text = document.read_text(encoding="utf-8")
        for raw_target in LINK_PATTERN.findall(text):
            target = local_target(document, raw_target)
            if target is None:
                continue
            try:
                target.relative_to(REPO_ROOT)
            except ValueError:
                failures.append(
                    f"{document.relative_to(REPO_ROOT)}: local link escapes repository: {raw_target}"
                )
                continue
            if not target.exists():
                failures.append(
                    f"{document.relative_to(REPO_ROOT)}: missing local link target: {raw_target}"
                )

    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1

    print("repository-local Markdown links passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
