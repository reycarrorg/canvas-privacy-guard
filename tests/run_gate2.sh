#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node_command="${CPG_NODE:-node}"

"$node_command" --test "$repo_root/tests/gate2"/*.test.mjs
"$node_command" "$repo_root/tests/gate2/synthetic-harness.mjs"
