#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

PYTHON=${PYTHON:-/usr/bin/python3}
NODE=${NODE:-node}

"$PYTHON" -c 'import json, pathlib, re, unittest, urllib.parse, xml.etree.ElementTree'

"$NODE" --check ebike/app.js
"$NODE" --check ebike/js/security.js
"$NODE" --check ebike/js/storageAndLog.js
"$NODE" --check ebike/js/scoringAndBattery.js
"$NODE" --check ebike/js/svgMapEngine.js
"$NODE" --test ebike/tests/js/*.test.js

"$PYTHON" -m unittest discover -s ebike/tests -p 'test_*.py' -v
"$NODE" scripts/ebike-mobile-release-gate.js
if [[ -f ebike/data/routes.json ]]; then
  "$PYTHON" ebike/validate_static.py
elif [[ "${REQUIRE_PRIVATE_EBIKE_DATA:-0}" == "1" ]]; then
  printf '%s\n' 'error: private E-Bike runtime data is required but missing' >&2
  exit 1
else
  printf '%s\n' 'skip: private route/track validation (data intentionally absent from public checkout)'
fi

"$PYTHON" -m unittest discover -s automation/n8n/tests -p 'test_*.py' -v
"$PYTHON" automation/n8n/validate_workflow.py automation/n8n/ebike-research.workflow.json
"$PYTHON" automation/n8n/validate_workflow.py automation/n8n/ebike-candidate.workflow.json

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git diff --check
else
  printf '%s\n' 'skip: git diff check (archive checkout has no Git metadata)'
fi
printf '%s\n' 'ok: E-Bike release gates passed'
