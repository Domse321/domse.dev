#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PYTHON=/usr/bin/python3
test "$($PYTHON -c 'import platform; print(platform.python_version())')" = '3.11.2' || { echo PYTHON_RUNTIME_MISMATCH >&2; exit 1; }
$PYTHON -c 'import http.client, ipaddress, json, ssl, socket, xml.etree.ElementTree'
node --check ebike/app.js
node --test ebike/tests/js/*.test.js
$PYTHON -m unittest discover -s ebike/tests -p 'test_*.py' -v
$PYTHON ebike/validate_routes.py
$PYTHON ebike/tools/privacy_scan.py ebike/config/public-route-approvals.json
$PYTHON -m unittest discover -s automation/n8n/tests -p 'test_*.py' -v
$PYTHON automation/n8n/validate_workflow.py automation/n8n/ebike-candidate.workflow.json
$PYTHON automation/n8n/validate_candidate.py automation/n8n/fixtures/manual-candidate.json --allowlist automation/n8n/config/allowlist.json >/dev/null
if grep -R -nE 'innerHTML|insertAdjacentHTML|eval\(' ebike/app.js ebike/js; then echo UNSAFE_DOM_API >&2; exit 1; fi
if grep -R -nE 'https?://' ebike/index.html ebike/app.js ebike/js ebike/routes.json; then echo EXTERNAL_BROWSER_URL >&2; exit 1; fi
git diff --check
echo 'ok: local E-Bike release gates passed'
