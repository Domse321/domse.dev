#!/usr/bin/env python3
"""Erzeugt den kanonischen, inaktiven n8n-Workflowexport deterministisch."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

jobs_js = r'''const regions = [
  ['Hameln','Hameln'], ['Weserbergland','Weserbergland'], ['Süntel','Süntel'],
  ['Deister','Deister'], ['Ith','Ith'], ['Hils','Hils'],
  ['Ottensteiner Hochfläche','Ottensteiner Hochfläche'], ['Emmerthal','Emmerthal'],
  ['Hessisch Oldendorf','Hessisch Oldendorf'], ['Bad Pyrmont','Bad Pyrmont'],
  ['Coppenbrügge','Coppenbrügge']
];
const patterns = [
  {bikeType:'E-MTB', suffix:'E-MTB Tour Mountainbike Strecke GPX'},
  {bikeType:'E-Bike', suffix:'E-Bike Radtour Rundtour Strecke GPX'}
];
const runId = $execution.id;
const createdAt = $now.toISO();
const jobs = [];
for (const [region, place] of regions) {
  for (const pattern of patterns) {
    jobs.push({json:{runId, createdAt, region, bikeType:pattern.bikeType,
      query:`${place} ${pattern.suffix}`,
      searxngBaseUrl:'http://searxng.internal:8080'}});
  }
}
return jobs;'''

normalize_js = r'''const out = [];
const blockedHosts = ['facebook.com','instagram.com','pinterest.','youtube.com','amazon.'];
const routeHints = /(tour|route|rund|strecke|trail|radweg|gpx|komoot|outdooractive|bikemap|mountainbike|fahrrad)/i;
function parseHttpUrl(raw) {
  const value = String(raw ?? '').trim();
  const prefix = value.toLowerCase().startsWith('https://') ? 'https://' : (value.toLowerCase().startsWith('http://') ? 'http://' : null);
  if (!prefix) return null;
  const withoutScheme = value.slice(prefix.length);
  const boundary = withoutScheme.search(/[/?#]/);
  const rawHostname = boundary < 0 ? withoutScheme : withoutScheme.slice(0, boundary);
  const rawRemainder = boundary < 0 ? '' : withoutScheme.slice(boundary);
  if (!rawHostname || rawHostname.includes('@')) return null;
  const protocol = prefix.slice(0, -3);
  const hostname = rawHostname.toLowerCase().replace(/\.$/, '');
  let remainder = rawRemainder.split('#', 1)[0] || '/';
  const queryAt = remainder.indexOf('?');
  let path = queryAt >= 0 ? remainder.slice(0, queryAt) : remainder;
  const rawQuery = queryAt >= 0 ? remainder.slice(queryAt + 1) : '';
  path = (path || '/').replace(/\/$/, '') || '/';
  const query = rawQuery.split('&').filter(Boolean).filter(part => {
    const key = part.split('=', 1)[0];
    return !/^(utm_[^=]*|fbclid|gclid|ref|source)$/i.test(key);
  }).join('&');
  return {url:`${protocol}://${hostname}${path}${query ? `?${query}` : ''}`, hostname:hostname.replace(/^www\./,'')};
}
function plain(value) {
  return String(value ?? '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}
const jobs = $('Create Search Jobs').all();
for (const [inputIndex,item] of $input.all().entries()) {
  const pair = Array.isArray(item.pairedItem) ? item.pairedItem[0] : item.pairedItem;
  const job = jobs[pair?.item ?? inputIndex]?.json;
  const response = item.json.body ?? item.json;
  const results = Array.isArray(response.results) ? response.results : [];
  for (const hit of results.slice(0, 12)) {
    const parsedUrl = parseHttpUrl(hit.url);
    const title = plain(hit.title);
    const description = plain(hit.content ?? hit.description).slice(0, 700);
    if (!parsedUrl || !title || blockedHosts.some(h => parsedUrl.hostname.includes(h))) continue;
    if (!routeHints.test(`${title} ${description} ${parsedUrl.url}`)) continue;
    out.push({pairedItem:{item:inputIndex},json:{run_id:job.runId, discovered_at:job.createdAt,
      region:job.region, bike_type:job.bikeType, search_query:job.query,
      route_name:title.slice(0,240), description, source_url:parsedUrl.url,
      source_host:parsedUrl.hostname,
      searx_score:Number(hit.score ?? 0), engines:(hit.engines ?? []).join(',')}});
  }
}
return out;'''

dedupe_js = r'''function norm(value) { return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
function fnv1a(value) {
  let h = 0x811c9dc5;
  for (let i=0; i<value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h,0x01000193) >>> 0; }
  return h.toString(16).padStart(8,'0');
}
const seenUrl = new Set(), seenNameRegion = new Set(), out=[];
for (const [inputIndex,item] of $input.all().entries()) {
  const c=item.json;
  const urlKey=norm(c.source_url), nameRegion=`${norm(c.route_name)}|${norm(c.region)}`;
  if (seenUrl.has(urlKey) || seenNameRegion.has(nameRegion)) continue;
  seenUrl.add(urlKey); seenNameRegion.add(nameRegion);
  const text=norm(`${c.route_name} ${c.description}`);
  let score=30;
  if (/gpx|track|strecke/.test(text)) score+=18;
  if (/rundtour|rundweg|rundkurs/.test(text)) score+=10;
  if (/e bike|ebike|e mtb|emtb|pedelec/.test(text)) score+=14;
  if (text.includes(norm(c.region))) score+=12;
  if (/km|kilometer|hohenmeter|hm/.test(text)) score+=8;
  if (/komoot|outdooractive|bikemap|weserbergland/.test(c.source_host)) score+=5;
  if (c.description.length < 40) score-=8;
  score=Math.max(0,Math.min(100,score));
  const stableMaterial=`${urlKey}|${nameRegion}`;
  out.push({pairedItem:{item:inputIndex},json:{...c, stable_key:`route_${fnv1a(stableMaterial)}`, name_region_key:fnv1a(nameRegion), score,
    review_status:'offen', image_search_query:`${c.route_name} ${c.region} Landschaft`}});
}
return out.sort((a,b)=>b.json.score-a.json.score || a.json.stable_key.localeCompare(b.json.stable_key)).slice(0,40);'''

image_jobs_js = r'''const seen=new Set(); const out=[];
for (const [inputIndex,item] of $input.all().entries()) {
  const region=String(item.json.region ?? '').trim();
  if (!region || seen.has(region)) continue;
  seen.add(region);
  out.push({pairedItem:{item:inputIndex},json:{region,image_search_query:`${region} Niedersachsen`}});
}
return out.slice(0,12);'''

media_js = r'''const candidates=$('Dedupe and Score').all(); const jobs=$('Build Region Image Jobs').all(); const images=new Map();
for (const [inputIndex,item] of $input.all().entries()) {
  const pair = Array.isArray(item.pairedItem) ? item.pairedItem[0] : item.pairedItem;
  const job=jobs[pair?.item ?? inputIndex]?.json;
  let body=item.json.body ?? item.json.data ?? item.json;
  if (typeof body === 'string') {
    try { body=JSON.parse(body); } catch { body={}; }
  }
  const pages=Object.values(body?.query?.pages ?? {}).filter(p=>p.imageinfo?.length);
  pages.sort((a,b)=>(a.index??999)-(b.index??999));
  const page=pages[0]; const info=page?.imageinfo?.[0]; const ext=info?.extmetadata ?? {};
  images.set(job?.region,{image_title:page?.title ?? '', image_thumb_url:info?.thumburl ?? '', image_page_url:info?.descriptionurl ?? '',
    image_artist:String(ext.Artist?.value ?? '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,240),
    image_license:ext.LicenseShortName?.value ?? '', image_license_url:ext.LicenseUrl?.value ?? '', image_found:Boolean(info?.thumburl)});
}
return candidates.map((item,inputIndex)=>{
  const candidate=item.json; const image=images.get(candidate.region) ?? {};
  return {pairedItem:{item:inputIndex},json:{...candidate,
    image_title:image.image_title ?? '', image_thumb_url:image.image_thumb_url ?? '', image_page_url:image.image_page_url ?? '',
    image_artist:image.image_artist ?? '', image_license:image.image_license ?? '', image_license_url:image.image_license_url ?? '',
    image_found:Boolean(image.image_found), updated_at:$now.toISO()}};
});'''

row_js = r'''return $input.all().map(({json:c})=>({json:{
  stable_key:c.stable_key, name_region_key:c.name_region_key, route_name:c.route_name,
  region:c.region, bike_type:c.bike_type, description:c.description, source_url:c.source_url,
  source_host:c.source_host, score:c.score, review_status:c.review_status,
  image_title:c.image_title, image_thumb_url:c.image_thumb_url, image_page_url:c.image_page_url,
  image_artist:c.image_artist, image_license:c.image_license, image_license_url:c.image_license_url,
  search_query:c.search_query, discovered_at:c.discovered_at, updated_at:c.updated_at,
  run_id:c.run_id
}}));'''

summary_js = r'''const rows=$input.all().map(i=>i.json);
const byRegion={}; let withImage=0; let scoreSum=0;
for (const r of rows) { byRegion[r.region]=(byRegion[r.region]??0)+1; withImage+=r.image_thumb_url?1:0; scoreSum+=Number(r.score??0); }
return [{json:{status:'ok', publish_performed:false, target:'Data Table: ebike_route_research',
  persisted_or_updated:rows.length, images_found:withImage,
  average_score:rows.length?Math.round(scoreSum/rows.length):0,
  regions:byRegion, finished_at:$now.toISO(), message:'Recherche gespeichert; ausschließlich manuelle Prüfung, keine Website-Veröffentlichung.'}}];'''

nodes = [
 {"id":"manual","name":"Manual Trigger","type":"n8n-nodes-base.manualTrigger","typeVersion":1,"position":[0,220],"parameters":{}},
 {"id":"weekly","name":"Weekly Sunday 07:00","type":"n8n-nodes-base.scheduleTrigger","typeVersion":1.3,"position":[0,420],"parameters":{"rule":{"interval":[{"field":"weeks","weeksInterval":1,"triggerAtDay":[0],"triggerAtHour":7,"triggerAtMinute":0}]}}},
 {"id":"jobs","name":"Create Search Jobs","type":"n8n-nodes-base.code","typeVersion":2,"position":[240,320],"parameters":{"mode":"runOnceForAllItems","language":"javaScript","jsCode":jobs_js}},
 {"id":"searx","name":"Search SearXNG Routes","type":"n8n-nodes-base.httpRequest","typeVersion":4.4,"position":[480,320],"parameters":{"method":"GET","url":"={{ $json.searxngBaseUrl + '/search' }}","sendQuery":True,"queryParameters":{"parameters":[{"name":"q","value":"={{ $json.query }}"},{"name":"format","value":"json"},{"name":"language","value":"de-DE"},{"name":"safesearch","value":"1"},{"name":"categories","value":"general"},{"name":"engines","value":"bing"}]},"options":{"timeout":20000,"batching":{"batch":{"batchSize":1,"batchInterval":2000}},"response":{"response":{"responseFormat":"json"}}}}},
 {"id":"normalize","name":"Normalize SearXNG Results","type":"n8n-nodes-base.code","typeVersion":2,"position":[720,320],"parameters":{"mode":"runOnceForAllItems","language":"javaScript","jsCode":normalize_js}},
 {"id":"dedupe","name":"Dedupe and Score","type":"n8n-nodes-base.code","typeVersion":2,"position":[960,320],"parameters":{"mode":"runOnceForAllItems","language":"javaScript","jsCode":dedupe_js}},
 {"id":"image-jobs","name":"Build Region Image Jobs","type":"n8n-nodes-base.code","typeVersion":2,"position":[1160,320],"parameters":{"mode":"runOnceForAllItems","language":"javaScript","jsCode":image_jobs_js}},
 {"id":"commons","name":"Search Wikimedia Commons Images","type":"n8n-nodes-base.httpRequest","typeVersion":4.4,"position":[1360,320],"parameters":{"method":"GET","url":"https://commons.wikimedia.org/w/api.php","sendHeaders":True,"headerParameters":{"parameters":[{"name":"User-Agent","value":"PrivateEbikeResearch/1.0 (n8n; personal route research)"}]},"sendQuery":True,"queryParameters":{"parameters":[{"name":"action","value":"query"},{"name":"format","value":"json"},{"name":"generator","value":"search"},{"name":"gsrnamespace","value":"6"},{"name":"gsrlimit","value":"1"},{"name":"gsrsearch","value":"={{ $json.image_search_query }}"},{"name":"prop","value":"imageinfo"},{"name":"iiprop","value":"url|extmetadata"},{"name":"iiurlwidth","value":"1200"},{"name":"origin","value":"*"}]},"options":{"timeout":20000,"batching":{"batch":{"batchSize":1,"batchInterval":3000}},"response":{"response":{"responseFormat":"text","neverError":True}}}}},
 {"id":"media","name":"Attach Best Commons Image","type":"n8n-nodes-base.code","typeVersion":2,"position":[1560,320],"parameters":{"mode":"runOnceForAllItems","language":"javaScript","jsCode":media_js}},
 {"id":"rows","name":"Build Review Rows","type":"n8n-nodes-base.code","typeVersion":2,"position":[1760,320],"parameters":{"mode":"runOnceForAllItems","language":"javaScript","jsCode":row_js}},
 {"id":"upsert","name":"Upsert Review Data Table","type":"n8n-nodes-base.dataTable","typeVersion":1.1,"position":[1960,320],"parameters":{"resource":"row","operation":"upsert","dataTableId":{"mode":"name","value":"ebike_route_research"},"matchType":"allConditions","filters":{"conditions":[{"keyName":"stable_key","condition":"eq","keyValue":"={{ $json.stable_key }}"}]},"columns":{"mappingMode":"defineBelow","value":{"stable_key":"={{ $json.stable_key }}","name_region_key":"={{ $json.name_region_key }}","route_name":"={{ $json.route_name }}","region":"={{ $json.region }}","bike_type":"={{ $json.bike_type }}","description":"={{ $json.description }}","source_url":"={{ $json.source_url }}","source_host":"={{ $json.source_host }}","score":"={{ $json.score }}","review_status":"={{ $json.review_status }}","image_title":"={{ $json.image_title }}","image_thumb_url":"={{ $json.image_thumb_url }}","image_page_url":"={{ $json.image_page_url }}","image_artist":"={{ $json.image_artist }}","image_license":"={{ $json.image_license }}","image_license_url":"={{ $json.image_license_url }}","search_query":"={{ $json.search_query }}","discovered_at":"={{ $json.discovered_at }}","updated_at":"={{ $json.updated_at }}","run_id":"={{ $json.run_id }}"},"matchingColumns":[],"schema":[]},"options":{}}},
 {"id":"summary","name":"Final Run Summary","type":"n8n-nodes-base.code","typeVersion":2,"position":[2160,320],"parameters":{"mode":"runOnceForAllItems","language":"javaScript","jsCode":summary_js}}
]
chain=['Create Search Jobs','Search SearXNG Routes','Normalize SearXNG Results','Dedupe and Score','Build Region Image Jobs','Search Wikimedia Commons Images','Attach Best Commons Image','Build Review Rows','Upsert Review Data Table','Final Run Summary']
connections={"Manual Trigger":{"main":[[{"node":chain[0],"type":"main","index":0}]]},"Weekly Sunday 07:00":{"main":[[{"node":chain[0],"type":"main","index":0}]]}}
for a,b in zip(chain,chain[1:]): connections[a]={"main":[[{"node":b,"type":"main","index":0}]]}
workflow={"name":"E-Bike Routenrecherche · Hameln & Umgebung (inactive)","active":False,"settings":{"executionOrder":"v1","timezone":"Europe/Berlin","saveDataErrorExecution":"all","saveDataSuccessExecution":"none","saveManualExecutions":True},"nodes":nodes,"connections":connections,"pinData":{},"meta":{"templateCredsSetupCompleted":True},"tags":[]}
(ROOT/'ebike-research.workflow.json').write_text(json.dumps(workflow,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Legacy-Dateiname absichtlich ebenfalls mit dem echten Workflow belegen.
(ROOT/'ebike-candidate.workflow.json').write_text(json.dumps(workflow,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f"geschrieben: {len(nodes)} Nodes, {len(connections)} Verbindungsquellen")
