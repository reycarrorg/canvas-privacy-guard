#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

required_files=(
  README.md
  LICENSE.md
  NOTICE
  SECURITY.md
  CONTRIBUTING.md
  docs/PROJECT_CHARTER.md
  docs/ROADMAP.md
  docs/research/RESEARCH_PLAN.md
  docs/research/canvas-tools-telemetry-and-network-controls.md
  docs/adr/0001-platform-selection.md
)

for required_file in "${required_files[@]}"; do
  test -s "$repo_root/$required_file" || {
    echo "missing or empty required file: $required_file" >&2
    exit 1
  }
done

grep -Fq "Research gate" "$repo_root/README.md"
grep -Fq "No production version is currently supported" "$repo_root/SECURITY.md"
grep -Fq "Required Notice: Copyright © 2026 Rolando Carreon" "$repo_root/NOTICE"

if find "$repo_root" -type f \
  \( -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name '.env' \) \
  -not -path "$repo_root/.git/*" | grep -q .; then
  echo "potential credential material found in repository" >&2
  exit 1
fi

echo "repository policy checks passed"

