#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/scaffold-target.py target-effect '{}' '{"effect": "^3.10.0"}'
python3 scripts/scaffold-target.py target-rest
python3 scripts/scaffold-target.py target-service
python3 scripts/scaffold-target.py target-orpc
python3 scripts/scaffold-target.py target-graphql
python3 scripts/scaffold-target.py target-pgtap
python3 scripts/scaffold-target.py target-rls
python3 scripts/scaffold-target.py target-pgmq
