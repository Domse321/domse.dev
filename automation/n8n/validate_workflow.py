#!/usr/bin/env python3
"""Statischer Fail-closed-Validator für den E-Bike-Rechercheworkflow."""
import json
import pathlib
import sys

ALLOWED_EXTERNAL = {
    "http://searxng.internal:8080/search",
    "https://commons.wikimedia.org/w/api.php",
}
FORBIDDEN_NODE_TERMS = ("webhook", "respondtowebhook", "executecommand", "ssh", "ftp", "git", "email", "gmail", "wordpress")
REQUIRED_NAMES = {
    "Manual Trigger", "Weekly Sunday 07:00", "Create Search Jobs", "Search SearXNG Routes",
    "Normalize SearXNG Results", "Dedupe and Score", "Build Region Image Jobs", "Search Wikimedia Commons Images",
    "Attach Best Commons Image", "Build Review Rows", "Upsert Review Data Table", "Final Run Summary",
}

def validate(path):
    workflow = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    errors = []
    nodes = workflow.get("nodes", [])
    names = {n.get("name") for n in nodes}
    if workflow.get("active") is not False: errors.append("WORKFLOW_MUST_BE_INACTIVE")
    if workflow.get("settings", {}).get("timezone") != "Europe/Berlin": errors.append("TIMEZONE_INVALID")
    if not REQUIRED_NAMES <= names: errors.append("REQUIRED_NODES_MISSING")
    triggers = {n["type"] for n in nodes if n["type"].endswith("Trigger") or "Trigger" in n.get("name", "")}
    if "n8n-nodes-base.manualTrigger" not in triggers: errors.append("MANUAL_TRIGGER_REQUIRED")
    schedules = [n for n in nodes if n["type"] == "n8n-nodes-base.scheduleTrigger"]
    try:
        rule = schedules[0]["parameters"]["rule"]["interval"][0]
        if not (rule["field"] == "weeks" and rule["weeksInterval"] == 1 and rule["triggerAtDay"] == [0] and rule["triggerAtHour"] == 7 and rule["triggerAtMinute"] == 0):
            errors.append("SCHEDULE_INVALID")
    except (IndexError, KeyError, TypeError): errors.append("SCHEDULE_INVALID")
    http_nodes = [n for n in nodes if n["type"] == "n8n-nodes-base.httpRequest"]
    if len(http_nodes) != 2: errors.append("EXACTLY_TWO_ACQUISITION_HTTP_NODES_REQUIRED")
    for node in nodes:
        node_type = node.get("type", "").lower()
        if any(term in node_type for term in FORBIDDEN_NODE_TERMS): errors.append("PUBLISH_OR_SIDE_EFFECT_NODE_DENIED")
        text = json.dumps(node, ensure_ascii=False).lower()
        if any(term in text for term in ("authorization: bearer", "x-n8n-api-key", "private key", "password=")):
            errors.append("EMBEDDED_SECRET_DENIED")
        if node.get("type") == "n8n-nodes-base.httpRequest":
            url = node.get("parameters", {}).get("url", "")
            if node["name"] == "Search SearXNG Routes":
                if "searxngbaseurl" not in text or "format" not in text or "json" not in text: errors.append("SEARXNG_CONFIG_INVALID")
            elif url not in ALLOWED_EXTERNAL: errors.append("HTTP_TARGET_DENIED")
    upserts = [n for n in nodes if n["type"] == "n8n-nodes-base.dataTable"]
    if len(upserts) != 1 or upserts[0].get("parameters", {}).get("operation") != "upsert": errors.append("DATA_TABLE_UPSERT_REQUIRED")
    else:
        p = upserts[0]["parameters"]
        if p.get("dataTableId", {}).get("value") != "ebike_route_research": errors.append("DATA_TABLE_TARGET_INVALID")
        conditions = p.get("filters", {}).get("conditions", [])
        if not any(c.get("keyName") == "stable_key" for c in conditions): errors.append("STABLE_KEY_MATCH_REQUIRED")
    all_text = json.dumps(workflow, ensure_ascii=False).lower()
    if "needs_review" in all_text: errors.append("PLACEHOLDER_STATUS_DENIED")
    if "publish_performed:false" not in all_text.replace(" ", ""): errors.append("NO_PUBLISH_SUMMARY_FLAG_REQUIRED")
    targets = {e.get("node") for output in workflow.get("connections", {}).values() for streams in output.values() for stream in streams for e in stream}
    if not targets <= names: errors.append("CONNECTION_TARGET_MISSING")
    return sorted(set(errors))

def main():
    if len(sys.argv) != 2:
        print("Aufruf: validate_workflow.py WORKFLOW.json", file=sys.stderr); return 2
    errors = validate(sys.argv[1])
    if errors:
        print("\n".join(errors), file=sys.stderr); return 1
    print("OK: inaktiv; manuell + Sonntag 07:00 Europe/Berlin; 2 echte Acquisition-HTTP-Nodes; Data-Table-Upsert; kein Publishing")
    return 0

if __name__ == "__main__": raise SystemExit(main())
