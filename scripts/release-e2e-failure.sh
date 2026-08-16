#!/usr/bin/env bash
set -uo pipefail
gh-omar run view 31945419284 --repo omar-dulaimi/supawatch --log-failed 2>/dev/null |
  awk 'index($0, "E2E FAILED") || index($0, "TIMED OUT") || index($0, "error TS") || index($0, "npm error") || index($0, "Cannot find")' | head -10
