#!/usr/bin/env python3
"""Erzeugt den kanonischen, inaktiven n8n-2.20.9-Workflow V2 deterministisch."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
JS = ROOT / "js"

def code(name: str) -> str:
    return (JS / name).read_text(encoding="utf-8")

def node(node_id, name, node_type, version, x, parameters, **extra):
    return {"id": node_id, "name": name, "type": node_type, "typeVersion": version,
            "position": [x, 320], "parameters": parameters, **extra}

def code_node(node_id, name, script, x):
    return node(node_id, name, "n8n-nodes-base.code", 2, x,
                {"mode":"runOnceForAllItems", "language":"javaScript", "jsCode":code(script)})

def has_stable_key_if(node_id, name, x):
    return node(node_id,name,"n8n-nodes-base.if",2.3,x,{"options":{},"conditions":{
        "options":{"version":2,"leftValue":"","caseSensitive":True,"typeValidation":"strict"},
        "combinator":"and","conditions":[{"id":node_id+"-condition","operator":{"type":"boolean","operation":"true","singleValue":True},
        "leftValue":"={{ Boolean($json.stable_key) }}","rightValue":""}]}})

def http_common(timeout, interval):
    return {"timeout":timeout, "batching":{"batch":{"batchSize":1,"batchInterval":interval}},
            "response":{"response":{"responseFormat":"json","neverError":False,"fullResponse":True}}}

overpass_headers={"parameters":[
    {"name":"User-Agent","value":"domse-ebike-evidence-v2/2.0 (private research; contact via domse.dev)"},
    {"name":"Accept","value":"application/json"},
    {"name":"Accept-Encoding","value":"identity"},
]}

def overpass(node_id, name, expression, x):
    return node(node_id,name,"n8n-nodes-base.httpRequest",4.4,x,{
        "method":"GET","url":"https://z.overpass-api.de/api/interpreter","sendHeaders":True,
        "headerParameters":overpass_headers,"sendQuery":True,
        "queryParameters":{"parameters":[{"name":"data","value":expression}]},
        "options":http_common(60000,2500)
    }, retryOnFail=True, maxTries=4, waitBetweenTries=30000, onError="continueRegularOutput")

nodes=[
    node("manual","Manual Trigger","n8n-nodes-base.manualTrigger",1,0,{}),
    node("monthly-sunday","Sunday 05:00 Monthly Check","n8n-nodes-base.scheduleTrigger",1.3,0,
         {"rule":{"interval":[{"field":"weeks","weeksInterval":1,"triggerAtDay":[0],"triggerAtHour":5,"triggerAtMinute":0}]}}),
    code_node("first-sunday-gate","Allow First Sunday Only","first-sunday-gate.js",110),
    code_node("discovery-query","Build Overpass Discovery","build-discovery.js",220),
    overpass("discover","Discover Named OSM Relations","={{ $json.overpass_query }}",440),
    code_node("normalize-discovery","Normalize Relation Discovery","normalize-discovery.js",660),
    has_stable_key_if("discovery-if","Discovery Has Candidates",880),
    code_node("geometry-jobs","Build Relation Geometry Jobs","build-geometry.js",1100),
    overpass("geometry","Fetch Real Relation Geometry","={{ $json.geometry_query }}",1320),
    code_node("gate","Gate Score and Fair Limit","gate-score-limit.js",1540),
    has_stable_key_if("gate-if","Gate Has Accepted Candidates",1760),
    code_node("image-jobs","Build Track-near Image Jobs","build-image-jobs.js",1980),
    node("commons","Commons Track-near Raster Search","n8n-nodes-base.httpRequest",4.4,2200,{
        "method":"GET","url":"https://commons.wikimedia.org/w/api.php","sendHeaders":True,
        "headerParameters":{"parameters":[
            {"name":"User-Agent","value":"domse-ebike-evidence-v2/2.0 (private research; contact via domse.dev)"},
            {"name":"Accept-Encoding","value":"identity"}
        ]},
        "sendQuery":True,"queryParameters":{"parameters":[
            {"name":"action","value":"query"},{"name":"format","value":"json"},{"name":"generator","value":"geosearch"},
            {"name":"ggscoord","value":"={{ $json.image_anchor_lat + '|' + $json.image_anchor_lon }}"},
            {"name":"ggsradius","value":"10000"},{"name":"ggslimit","value":"10"},{"name":"ggsnamespace","value":"6"},
            {"name":"prop","value":"imageinfo|coordinates"},{"name":"iiprop","value":"url|extmetadata|mime|mediatype"},
            {"name":"iiurlwidth","value":"1600"},{"name":"origin","value":"*"}
        ]},"options":http_common(30000,1500)
    },retryOnFail=True,maxTries=4,waitBetweenTries=30000,onError="continueRegularOutput"),
    code_node("select-images","Select Licensed Raster Photos","select-images.js",2420),
    code_node("rows","Build Machine Evidence Rows","build-evidence-rows.js",2640),
]

mapping={field:f"={{{{ $json.{field} }}}}" for field in [
    "stable_key","osm_relation_id","route_name","region","bike_type","osm_url","geometry_json","geometry_points",
    "distance_km","max_gap_km","tag_distance_km","closure_km","closure_ratio","geometry_ratio","bounds_json","evidence_score",
    "evidence_json","gate_reasons","image_title","image_thumb_url","image_creator","image_license","image_license_url",
    "image_page_url","image_distance_km","image_candidates_json","partial_failure","http_status_json","observed_at","run_id"
]}
nodes += [
    node("upsert","Upsert Machine Evidence V2","n8n-nodes-base.dataTable",1.1,2860,{
        "resource":"row","operation":"upsert","dataTableId":{"mode":"name","value":"ebike_route_evidence_v2"},
        "matchType":"allConditions","filters":{"conditions":[{"keyName":"stable_key","condition":"eq","keyValue":"={{ $json.stable_key }}"}]},
        "columns":{"mappingMode":"defineBelow","value":mapping,"matchingColumns":[],"schema":[]},"options":{}
    }),
    code_node("summary","Final Quality Summary","summary.js",3080),
]
connections={
    "Manual Trigger":{"main":[[{"node":"Build Overpass Discovery","type":"main","index":0}]]},
    "Sunday 05:00 Monthly Check":{"main":[[{"node":"Allow First Sunday Only","type":"main","index":0}]]},
    "Allow First Sunday Only":{"main":[[{"node":"Build Overpass Discovery","type":"main","index":0}]]},
    "Build Overpass Discovery":{"main":[[{"node":"Discover Named OSM Relations","type":"main","index":0}]]},
    "Discover Named OSM Relations":{"main":[[{"node":"Normalize Relation Discovery","type":"main","index":0}]]},
    "Normalize Relation Discovery":{"main":[[{"node":"Discovery Has Candidates","type":"main","index":0}]]},
    "Discovery Has Candidates":{"main":[
        [{"node":"Build Relation Geometry Jobs","type":"main","index":0}],
        [{"node":"Final Quality Summary","type":"main","index":0}]]},
    "Build Relation Geometry Jobs":{"main":[[{"node":"Fetch Real Relation Geometry","type":"main","index":0}]]},
    "Fetch Real Relation Geometry":{"main":[[{"node":"Gate Score and Fair Limit","type":"main","index":0}]]},
    "Gate Score and Fair Limit":{"main":[[{"node":"Gate Has Accepted Candidates","type":"main","index":0}]]},
    "Gate Has Accepted Candidates":{"main":[
        [{"node":"Build Track-near Image Jobs","type":"main","index":0}],
        [{"node":"Final Quality Summary","type":"main","index":0}]]},
    "Build Track-near Image Jobs":{"main":[[{"node":"Commons Track-near Raster Search","type":"main","index":0}]]},
    "Commons Track-near Raster Search":{"main":[[{"node":"Select Licensed Raster Photos","type":"main","index":0}]]},
    "Select Licensed Raster Photos":{"main":[[{"node":"Build Machine Evidence Rows","type":"main","index":0}]]},
    "Build Machine Evidence Rows":{"main":[[{"node":"Upsert Machine Evidence V2","type":"main","index":0}]]},
    "Upsert Machine Evidence V2":{"main":[[{"node":"Final Quality Summary","type":"main","index":0}]]},
}
workflow={
    "name":"E-Bike OSM-Evidenzrecherche Weserbergland V2","active":False,
    "settings":{"executionOrder":"v1","timezone":"Europe/Berlin","saveDataErrorExecution":"all",
                "saveDataSuccessExecution":"none","saveManualExecutions":True,"executionTimeout":900},
    "nodes":nodes,"connections":connections,"pinData":{},"meta":{"templateCredsSetupCompleted":True},"tags":[]
}
text=json.dumps(workflow,ensure_ascii=False,indent=2)+"\n"
(ROOT/"ebike-research.workflow.json").write_text(text,encoding="utf-8")
(ROOT/"ebike-candidate.workflow.json").write_text(text,encoding="utf-8")
print(f"geschrieben: {len(nodes)} Nodes, {len(connections)} Verbindungsquellen")
