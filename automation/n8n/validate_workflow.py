#!/usr/bin/env python3
"""Validate the inactive, side-effect-free E-Bike n8n export."""
import json
import pathlib
import sys
FORBIDDEN_TYPES=('httpRequest','sendEmail','gmail','git','ssh','ftp','executeCommand','readWriteFile')
def validate(path):
    workflow=json.loads(pathlib.Path(path).read_text(encoding='utf-8')); errors=[]
    if workflow.get('active') is not False: errors.append('WORKFLOW_MUST_BE_INACTIVE')
    nodes=workflow.get('nodes',[])
    if not any(node.get('type')=='n8n-nodes-base.manualTrigger' for node in nodes): errors.append('MANUAL_TRIGGER_REQUIRED')
    for node in nodes:
        if any(term.lower() in node.get('type','').lower() for term in FORBIDDEN_TYPES): errors.append('SIDE_EFFECT_NODE_DENIED')
        text=json.dumps(node)
        if any(term in text.lower() for term in ('authorization: bearer','x-n8n-api-key','private key')): errors.append('EMBEDDED_SECRET_DENIED')
    names={node.get('name') for node in nodes}; targets={edge.get('node') for outputs in workflow.get('connections',{}).values() for streams in outputs.values() for stream in streams for edge in stream}
    if not targets<=names: errors.append('CONNECTION_TARGET_MISSING')
    return sorted(set(errors))
def main():
    errors=validate(sys.argv[1]);
    if errors: print('\n'.join(errors),file=sys.stderr); return 1
    print('ok: inactive workflow; manual trigger; no external side-effect nodes'); return 0
if __name__=='__main__': raise SystemExit(main())
