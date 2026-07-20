const source = $('Build Overpass Discovery').first().json;
const input = $input.first().json;
let body = input.body ?? input.data ?? input;
if (typeof body === 'string') { try { body=JSON.parse(body); } catch { body={}; } }
const status = Number(input.statusCode ?? 0);
const elements = Array.isArray(body.elements) ? body.elements : [];
const out=[]; const seen=new Set();
function rank(tags, center) {
  let score=0;
  const lat=Number(center?.lat), lon=Number(center?.lon);
  if(Number.isFinite(lat)&&Number.isFinite(lon)) {
    if(lat>=51.85&&lat<=52.45&&lon>=8.95&&lon<=10.05) score+=25;
    if(lat>=52.00&&lat<=52.32&&lon>=9.15&&lon<=9.75) score+=15;
  }
  if(String(tags.route).toLowerCase()==='mtb') score+=20;
  if(/^(?:lcn|rcn|ncn|icn)$/i.test(String(tags.network??''))) score+=10;
  if(String(tags.distance??'').trim()) score+=10;
  if(/^(?:yes|true|1)$/i.test(String(tags.roundtrip??''))) score+=10;
  if(/mtb|mountainbike|rad|bike|runde|weser|deister|süntel|ith|hils/i.test(`${tags.name??''} ${tags.description??''}`)) score+=10;
  return score;
}
for (const e of elements) {
  const tags=e.tags ?? {}; const id=Number(e.id); const route=String(tags.route ?? '').toLowerCase();
  const name=String(tags.name ?? '').trim();
  if (e.type !== 'relation' || !Number.isSafeInteger(id) || id <= 0 || !name || !['bicycle','mtb'].includes(route) || seen.has(id)) continue;
  seen.add(id);
  out.push({json:{...source, relation_id:id, stable_key:`osm_relation_${id}`, route_name:name.slice(0,240), route_tag:route, discovery_tags:tags, discovery_center:e.center??null, discovery_rank_score:rank(tags,e.center), discovery_ok:status>=200&&status<300, discovery_http_status:status}});
}
if (!out.length) return [{json:{...source, pipeline_signal:'DISCOVERY_EMPTY_OR_FAILED', discovery_ok:false, discovery_http_status:status}}];
return out.sort((a,b)=>b.json.discovery_rank_score-a.json.discovery_rank_score||a.json.route_name.localeCompare(b.json.route_name,'de')||a.json.relation_id-b.json.relation_id).slice(0,250);
