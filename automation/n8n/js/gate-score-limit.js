const candidates=$('Normalize Relation Discovery').all().map(item=>item.json).filter(item=>Number(item.relation_id)>0);
const SEARCH={s:51.70,w:8.45,n:52.62,e:10.25};
const REGIONS=[
 ['Deister',52.17,9.20,52.45,9.65],['Süntel',52.12,9.25,52.30,9.55],['Ith',51.91,9.43,52.15,9.75],
 ['Solling-Vogler',51.88,9.48,52.02,9.70],
 ['Hils',51.88,9.70,52.12,9.98],['Hameln',52.02,9.20,52.20,9.55],['Emmerthal',51.90,9.25,52.08,9.52],
 ['Hessisch Oldendorf',52.10,9.05,52.27,9.38],['Bad Pyrmont',51.90,8.98,52.05,9.32],
 ['Ottensteiner Hochfläche',51.88,9.25,52.02,9.55],['Coppenbrügge',52.03,9.45,52.17,9.72],
];
function rad(x){return x*Math.PI/180;} function km(a,b){const dlat=rad(b.lat-a.lat),dlon=rad(b.lon-a.lon); const q=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2; return 12742*Math.asin(Math.sqrt(q));}
function clean(v){return String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}
function taggedKm(v){const m=String(v??'').replace(',','.').match(/([0-9]+(?:\.[0-9]+)?)/); if(!m)return null; const n=Number(m[1]); return /\bmi\b/i.test(String(v))?n*1.60934:n;}
function pointsOf(rel){
 const segments=[]; for(const m of rel.members??[]){const s=[];for(const p of m.geometry??[]){const x={lat:Number(p.lat),lon:Number(p.lon)};const prev=s[s.length-1];if(Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&(!prev||prev.lat!==x.lat||prev.lon!==x.lon))s.push(x);}if(s.length>1)segments.push(s);}
 if(!segments.length)return []; const out=segments.shift().slice();
 while(segments.length){const last=out[out.length-1];let best=0,reverse=false,distance=Infinity;for(let i=0;i<segments.length;i++){const a=km(last,segments[i][0]),b=km(last,segments[i][segments[i].length-1]);if(a<distance){best=i;reverse=false;distance=a;}if(b<distance){best=i;reverse=true;distance=b;}}const segment=segments.splice(best,1)[0];if(reverse)segment.reverse();for(const x of segment){const prev=out[out.length-1];if(!prev||prev.lat!==x.lat||prev.lon!==x.lon)out.push(x);}}
 return out;
}
const relations=new Map(),statuses=new Map();
for(const item of $input.all()){
 let body=item.json.body??item.json.data??item.json;if(typeof body==='string'){try{body=JSON.parse(body)}catch{body={}}}
 const status=Number(item.json.statusCode??200);
 for(const rel of body.elements??[]){if(rel.type==='relation'&&Number(rel.id)>0){relations.set(Number(rel.id),rel);statuses.set(Number(rel.id),status);}}
}
const accepted=[]; const rejected=[];
for(const job of candidates){
 const rel=relations.get(Number(job.relation_id)); const status=statuses.get(Number(job.relation_id))??0; const p=rel?pointsOf(rel):[]; const reasons=[];
 if(!(status>=200&&status<300))reasons.push('GEOMETRY_HTTP'); if(!rel)reasons.push('RELATION_MISSING'); if(p.length<20)reasons.push('TOO_FEW_POINTS');
 if(p.some(x=>x.lat<SEARCH.s||x.lat>SEARCH.n||x.lon<SEARCH.w||x.lon>SEARCH.e))reasons.push('OUTSIDE_SEARCH_BBOX');
 let length=0,maxGap=0; for(let k=1;k<p.length;k++){const gap=km(p[k-1],p[k]);length+=gap;maxGap=Math.max(maxGap,gap);} if(length<5||length>180)reasons.push('DISTANCE_IMPLAUSIBLE'); if(maxGap>2)reasons.push('GEOMETRY_DISCONTINUITY');
 const closure=p.length?km(p[0],p[p.length-1]):999; const closureRatio=length?closure/length:999; if(closure>Math.max(2.5,length*0.12))reasons.push('NOT_PLAUSIBLE_LOOP');
 const lats=p.map(x=>x.lat),lons=p.map(x=>x.lon); const bounds=p.length?{south:Math.min(...lats),west:Math.min(...lons),north:Math.max(...lats),east:Math.max(...lons)}:null;
 const diagonal=bounds?km({lat:bounds.south,lon:bounds.west},{lat:bounds.north,lon:bounds.east}):0; const geometryRatio=diagonal?length/diagonal:0; if(geometryRatio<1.2||geometryRatio>45)reasons.push('GEOMETRY_RATIO_IMPLAUSIBLE');
 const c=p.length?{lat:p.reduce((s,x)=>s+x.lat,0)/p.length,lon:p.reduce((s,x)=>s+x.lon,0)/p.length}:{lat:0,lon:0};
 const tags=rel?.tags??job.discovery_tags??{};
 const namedRegion=/solling|vogler|ebersnacken/i.test(`${tags.name??''} ${tags.description??''}`)?'Solling-Vogler':null;
 const region=namedRegion??REGIONS.find(r=>c.lat>=r[1]&&c.lon>=r[2]&&c.lat<=r[3]&&c.lon<=r[4])?.[0]??'';
 if(!region)reasons.push('OUTSIDE_TARGET_REGIONS');
 const tagDistance=taggedKm(tags.distance); const distanceDelta=tagDistance?Math.abs(length-tagDistance)/tagDistance:null; if(distanceDelta!==null&&distanceDelta>0.35)reasons.push('TAG_DISTANCE_CONFLICT');
 const evidence=[]; let score=0; function add(code,points,why){score+=points;evidence.push({code,points,why});}
 add('named_osm_relation',20,'Benannte OSM-Relation'); add('real_geometry',20,`${p.length} normalisierte Punkte`); add('plausible_distance',15,`${length.toFixed(1)} km`); add('loop_closure',15,`${closure.toFixed(2)} km / ${(closureRatio*100).toFixed(1)} %`); add('region_fit',10,region); if(tagDistance)add('distance_tag_agrees',10,`${tagDistance.toFixed(1)} km`);
 const mtb=String(tags.route??job.route_tag)==='mtb'||/mtb|mountainbike/i.test(`${tags.network??''} ${tags.name??''} ${tags.description??''}`); const bikeType=mtb?'E-MTB':'E-Bike/Trekking'; add(mtb?'mtb_tag_evidence':'bicycle_tag_evidence',10,mtb?'route=mtb/MTB-Tag':'route=bicycle ohne MTB-Evidenz');
 const result={...job,stable_key:`osm_relation_${Number(job.relation_id)}`,route_name:clean(tags.name??job.route_name).slice(0,240),region,bike_type:bikeType,osm_url:`https://www.openstreetmap.org/relation/${Number(job.relation_id)}`,geometry_points:p.length,distance_km:Number(length.toFixed(3)),max_gap_km:Number(maxGap.toFixed(3)),tag_distance_km:tagDistance===null?null:Number(tagDistance.toFixed(3)),closure_km:Number(closure.toFixed(3)),closure_ratio:Number(closureRatio.toFixed(4)),geometry_ratio:Number(geometryRatio.toFixed(3)),bounds,centroid:c,geometry_json:JSON.stringify(p),evidence_score:Math.min(100,score),evidence_json:JSON.stringify(evidence),gate_reasons:reasons.join(','),geometry_http_status:status,partial_failure:status<200||status>=300};
 if(reasons.length)rejected.push(result); else accepted.push(result);
}
accepted.sort((a,b)=>b.evidence_score-a.evidence_score||a.relation_id-b.relation_id);
const perGroup=new Map(),out=[]; for(const c of accepted){const key=`${c.region}|${c.bike_type}`;const n=perGroup.get(key)??0;if(n>=2)continue;perGroup.set(key,n+1);out.push({json:{...c,gate_rejected_count:rejected.length}});if(out.length>=30)break;}
if(!out.length)return [{json:{pipeline_signal:'ALL_CANDIDATES_REJECTED',gate_rejected_count:rejected.length,gate_reasons_summary:rejected.map(r=>({relation_id:r.relation_id,reasons:r.gate_reasons})),run_id:candidates[0]?.run_id,observed_at:$now.toISO()}}];
return out;
