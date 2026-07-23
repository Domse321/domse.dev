#!/usr/bin/env python3
"""Fail-closed-Validator für den E-Bike-OSM-Evidenzworkflow V2."""
import json, pathlib, sys

OVERPASS="https://overpass.kumi.systems/api/interpreter"
ALLOWED={OVERPASS,"https://commons.wikimedia.org/w/api.php"}
REQUIRED={"Manual Trigger","Sunday 05:00 Monthly Check","Allow First Sunday Only","Build Overpass Discovery","Discover Named OSM Relations",
 "Normalize Relation Discovery","Discovery Has Candidates","Build Relation Geometry Jobs","Fetch Real Relation Geometry","Gate Score and Fair Limit",
 "Gate Has Accepted Candidates","Build Track-near Image Jobs","Commons Track-near Raster Search","Select Licensed Raster Photos","Require Licensed Route Image","Image Gate Has Candidates",
 "Build Machine Evidence Rows","Upsert Machine Evidence V2","Final Quality Summary"}
FORBIDDEN=("webhook","respondtowebhook","executecommand","ssh","ftp","git","email","gmail","wordpress")
EXPECTED_SCHEDULE={'field':'weeks','weeksInterval':1,'triggerAtDay':[0],'triggerAtHour':5,'triggerAtMinute':0}
EXPECTED_GATE="const berlin = $now.setZone('Europe/Berlin');\nif (berlin.weekday !== 7 || berlin.day > 7) return [];\nreturn $input.all();\n"

def main_targets(connections, source):
    try: return connections[source]['main']
    except (KeyError,TypeError): return None

def validate(path):
    w=json.loads(pathlib.Path(path).read_text(encoding='utf-8')); errors=[]; nodes=w.get('nodes',[]); names={n.get('name') for n in nodes}
    if w.get('active') is not False: errors.append('WORKFLOW_MUST_BE_INACTIVE')
    if w.get('settings',{}).get('timezone')!='Europe/Berlin': errors.append('TIMEZONE_INVALID')
    if not REQUIRED<=names: errors.append('REQUIRED_NODES_MISSING')
    schedules=[n for n in nodes if n.get('type')=='n8n-nodes-base.scheduleTrigger']
    if len(schedules)!=1: errors.append('EXACTLY_ONE_SCHEDULE_REQUIRED')
    try:
        r=schedules[0]['parameters']['rule']['interval'][0]
        if r!=EXPECTED_SCHEDULE: errors.append('SCHEDULE_INVALID')
    except (IndexError,KeyError,TypeError): errors.append('SCHEDULE_INVALID')
    gates=[n for n in nodes if n.get('name')=='Allow First Sunday Only']
    if len(gates)!=1 or gates[0].get('type')!='n8n-nodes-base.code' or gates[0].get('disabled') is True or gates[0].get('parameters',{}).get('jsCode')!=EXPECTED_GATE:
        errors.append('FIRST_SUNDAY_GATE_INVALID')
    connections=w.get('connections',{})
    expected_schedule=[[{'node':'Allow First Sunday Only','type':'main','index':0}]]
    expected_gate=[[{'node':'Build Overpass Discovery','type':'main','index':0}]]
    expected_manual=[[{'node':'Build Overpass Discovery','type':'main','index':0}]]
    if main_targets(connections,'Sunday 05:00 Monthly Check')!=expected_schedule: errors.append('SCHEDULE_GATE_CONNECTION_INVALID')
    if main_targets(connections,'Allow First Sunday Only')!=expected_gate: errors.append('GATE_DISCOVERY_CONNECTION_INVALID')
    if main_targets(connections,'Manual Trigger')!=expected_manual: errors.append('MANUAL_BYPASS_CONNECTION_INVALID')
    if main_targets(connections,'Select Licensed Raster Photos')!=[[{'node':'Require Licensed Route Image','type':'main','index':0}]]: errors.append('IMAGE_GATE_INPUT_INVALID')
    if main_targets(connections,'Require Licensed Route Image')!=[[{'node':'Image Gate Has Candidates','type':'main','index':0}]]: errors.append('IMAGE_GATE_IF_INVALID')
    if main_targets(connections,'Image Gate Has Candidates')!=[[{'node':'Build Machine Evidence Rows','type':'main','index':0}],[{'node':'Final Quality Summary','type':'main','index':0}]]: errors.append('IMAGE_GATE_OUTPUT_INVALID')
    inbound=set()
    for source, outputs in connections.items():
        for stream in outputs.get('main',[]) if isinstance(outputs,dict) else []:
            if any(edge.get('node')=='Build Overpass Discovery' for edge in stream): inbound.add(source)
    if inbound!={'Manual Trigger','Allow First Sunday Only'}: errors.append('DISCOVERY_INBOUND_INVALID')
    http=[n for n in nodes if n.get('type')=='n8n-nodes-base.httpRequest']
    if len(http)!=3: errors.append('EXACTLY_THREE_ACQUISITION_HTTP_NODES_REQUIRED')
    if sum(n.get('parameters',{}).get('url')==OVERPASS for n in http)!=2: errors.append('TWO_OVERPASS_STAGES_REQUIRED')
    for n in nodes:
        typ=n.get('type','').lower(); text=json.dumps(n,ensure_ascii=False).lower()
        if any(x in typ for x in FORBIDDEN): errors.append('PUBLISH_OR_SIDE_EFFECT_NODE_DENIED')
        if any(x in text for x in ('authorization: bearer','x-n8n-api-key','private key','password=')): errors.append('EMBEDDED_SECRET_DENIED')
        if n.get('type')=='n8n-nodes-base.httpRequest':
            if n.get('parameters',{}).get('url') not in ALLOWED: errors.append('HTTP_TARGET_DENIED')
            if not n.get('retryOnFail') or n.get('maxTries',0)<3: errors.append('HTTP_RETRY_REQUIRED')
            if n.get('onError')!='continueRegularOutput': errors.append('HTTP_PARTIAL_FAILURE_REQUIRED')
            if not n.get('parameters',{}).get('options',{}).get('timeout'): errors.append('HTTP_TIMEOUT_REQUIRED')
            if not n.get('parameters',{}).get('options',{}).get('response',{}).get('response',{}).get('fullResponse'): errors.append('HTTP_FULL_RESPONSE_REQUIRED')
    all_text=json.dumps(w,ensure_ascii=False).lower()
    markers=('out geom','osm_relation_','too_few_points','outside_search_bbox','not_plausible_loop','evidence_json',
             'generator","value":"geosearch','bitmap','svg|pdf|wav|ogg','ebike_route_evidence_v2','publish_performed:false',
             'discovery_empty_or_failed','all_candidates_rejected','no_route_with_required_image','rejected_without_required_image')
    compact=all_text.replace(' ','')
    for marker in markers:
        if marker.replace(' ','') not in compact: errors.append('V2_MARKER_MISSING:'+marker)
    up=[n for n in nodes if n.get('type')=='n8n-nodes-base.dataTable']
    if len(up)!=1 or up[0].get('parameters',{}).get('operation')!='upsert': errors.append('ONE_EVIDENCE_UPSERT_REQUIRED')
    else:
        p=up[0]['parameters']; mapping=p.get('columns',{}).get('value',{})
        if p.get('dataTableId',{}).get('value')!='ebike_route_evidence_v2': errors.append('EVIDENCE_TABLE_INVALID')
        if any(x in mapping for x in ('review_status','first_seen')): errors.append('HUMAN_REVIEW_FIELDS_FORBIDDEN')
        if not any(c.get('keyName')=='stable_key' for c in p.get('filters',{}).get('conditions',[])): errors.append('STABLE_KEY_MATCH_REQUIRED')
    targets={e.get('node') for output in connections.values() for streams in output.values() for stream in streams for e in stream}
    if not targets<=names: errors.append('CONNECTION_TARGET_MISSING')
    return sorted(set(errors))

def main():
    if len(sys.argv)!=2: print('Aufruf: validate_workflow.py WORKFLOW.json',file=sys.stderr); return 2
    errors=validate(sys.argv[1])
    if errors: print('\n'.join(errors),file=sys.stderr); return 1
    print('OK V2: inaktiv; Manual + erster Sonntag 05:00; OSM-Discovery/Geometrie; harte Gates; Commons-Raster-Allowlist; separate Evidence-Tabelle; kein Publishing')
    return 0
if __name__=='__main__': raise SystemExit(main())
