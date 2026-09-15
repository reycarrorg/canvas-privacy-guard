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
  docs/research/platform-and-reuse-deep-dive.md
  docs/research/reuse-matrix.md
  docs/adr/0001-platform-selection.md
  docs/adr/0002-enforcement-authorization-boundary.md
  docs/adr/0003-authenticated-origin-access.md
  docs/adr/0004-local-audit-export.md
  docs/security/THREAT_MODEL.md
  docs/architecture/DATA_FLOW.md
  docs/contracts/EVENT_CLASSIFICATION.md
  docs/contracts/ACTIVATION_STATE_MACHINE.md
  docs/contracts/METADATA_AND_RETENTION.md
  docs/contracts/metadata-record.schema.json
  docs/contracts/audit-export.schema.json
  docs/contracts/invariants.json
  docs/testing/GATE_1_ACCEPTANCE_PLAN.md
  docs/testing/GATE_2_SYNTHETIC_EVIDENCE.md
  extension/manifest.firefox.json
  extension/manifest.chromium.json
  extension/shared/reducer.mjs
  extension/shared/classifier.mjs
  extension/shared/audit-export.mjs
  extension/shared/browser-adapter.mjs
  extension/ui/popup.html
  tests/check_markdown_links.py
  tests/check_gate2_policy.py
  tests/validate_contracts.py
  tests/run_gate2.sh
  tests/gate2/synthetic-harness.mjs
  tests/gate2/popup.test.mjs
)

for required_file in "${required_files[@]}"; do
  test -s "$repo_root/$required_file" || {
    echo "missing or empty required file: $required_file" >&2
    exit 1
  }
done

grep -Fq "Gate 2 authenticated-origin preview review" "$repo_root/README.md"
grep -Fq "No production version is currently supported" "$repo_root/SECURITY.md"
grep -Fq "Required Notice: Copyright © 2026 Rolando Carreon" "$repo_root/NOTICE"
grep -Fq "standards-based cross-browser WebExtension architecture" "$repo_root/docs/adr/0001-platform-selection.md"
grep -Fq "source-available, not OSI-open-source" "$repo_root/docs/adr/0001-platform-selection.md"
grep -Fq '`ASSESSMENT_SAFE`' "$repo_root/docs/research/platform-and-reuse-deep-dive.md"
grep -Fq "No dependency was added" "$repo_root/docs/research/reuse-matrix.md"
grep -Fq "Safe clean-room reimplementation" "$repo_root/docs/research/reuse-matrix.md"
grep -Fq 'networkAction(event, state) = ALLOW' "$repo_root/docs/contracts/EVENT_CLASSIFICATION.md"
grep -Fq '"const": "ALLOW"' "$repo_root/docs/contracts/metadata-record.schema.json"
grep -Fq "Gate 2 network enforcement: Prohibited" "$repo_root/docs/adr/0002-enforcement-authorization-boundary.md"

if find "$repo_root" -type f \
  \( -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name '.env' \) \
  -not -path "$repo_root/.git/*" | grep -q .; then
  echo "potential credential material found in repository" >&2
  exit 1
fi

python3 "$repo_root/tests/check_markdown_links.py"
python3 "$repo_root/tests/validate_contracts.py"
python3 "$repo_root/tests/check_gate2_policy.py"
"${CPG_NODE:-node}" --test "$repo_root/tests/gate2"/*.test.mjs

echo "repository policy checks passed"
