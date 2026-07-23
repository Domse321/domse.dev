const routes=$('Gate Score and Fair Limit').all();
const jobs=$('Build Track-near Image Jobs').all();
const byRelation=new Map();
const commonsByRelation=new Map();
const expectedByRelation=new Map();
for(const {json:job} of jobs){const key=Number(job.relation_id);expectedByRelation.set(key,(expectedByRelation.get(key)??0)+1);}
const allow=/^(?:cc0(?: 1\.0)?|public domain|pd|cc by(?:-sa)?(?: [1-4]\.0)?)$/i;
const raster=new Set(['image/jpeg','image/png','image/webp']);
const badTitle=/(^|[ _-])(map|karte|wappen|coat[ _-]?of[ _-]?arms|diagram|logo|schild|wegweiser|haltestelle|bushaltestelle|busstop|wegekreuz|wegkreuz|bildstock|shrine|informationstafel|informationtafel|tafel|luftbild|landschaftsschutzgebiet(?:nds)?|orthophoto|dop20|scan|kriegsgraber(?:statte)?|friedhof|cemetery|grab|memorial|denkmaltafel)([ _.-]|$)/i;
const stop=new Set(['rund','ueber','über','unter','durch','tour','route','radroute','naturpark','basisring','alte','bahnlinie','the','und','der','die','das','den','von','zum','zur']);
function plain(v){return String(v??'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();}
function fold(v){return plain(v).toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9äöüß]+/g,' ');}
function tokens(v){return [...new Set(fold(v).split(/\s+/).filter(t=>t.length>=4&&!stop.has(t)))];}
function safeUrl(value,hosts){const match=String(value??'').match(/^https:\/\/([^\/?#]+)(?:[\/?#]|$)/i);if(!match)return false;const authority=match[1].toLowerCase();return !authority.includes('@')&&!authority.includes(':')&&hosts.has(authority);}
function rad(x){return x*Math.PI/180;}
function km(a,b){const q=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lon-a.lon)/2)**2;return 12742*Math.asin(Math.sqrt(q));}
for(const [i,item] of $input.all().entries()){
 const pair=Array.isArray(item.pairedItem)?item.pairedItem[0]:item.pairedItem;
 const job=jobs[pair?.item??i]?.json??{};
 const relationKey=Number(job.relation_id),status=Number(item.json.statusCode??item.json.error?.status??item.json.error?.statusCode??0);
 const statuses=commonsByRelation.get(relationKey)??[];statuses.push({fraction:Number(job.image_anchor_fraction??0),status:Number.isFinite(status)?status:0,ok:status>=200&&status<300});commonsByRelation.set(relationKey,statuses);
 if(!(status>=200&&status<300))continue;
 let body=item.json.body??item.json.data??item.json;
 if(typeof body==='string'){try{body=JSON.parse(body)}catch{body={}}}
 const anchorLat=Number(job.image_anchor_lat),anchorLon=Number(job.image_anchor_lon);
 if(!Number.isFinite(anchorLat)||!Number.isFinite(anchorLon)||anchorLat < -90||anchorLat > 90||anchorLon < -180||anchorLon > 180)continue;
 const routeTokens=tokens(`${job.route_name??''} ${job.region??''}`);
 for(const page of Object.values(body?.query?.pages??{})){
  const info=page.imageinfo?.[0],ext=info?.extmetadata??{},mime=String(info?.mime??'').toLowerCase(),title=String(page.title??''),license=plain(ext.LicenseShortName?.value),coord=page.coordinates?.[0];
  const titleForGate=fold(title.replace(/^file:/i,'')); const width=Number(info?.width??0),height=Number(info?.height??0),lat=Number(coord?.lat),lon=Number(coord?.lon);
  if(!info||info.mediatype!=='BITMAP'||!raster.has(mime)||!allow.test(license)||badTitle.test(titleForGate)||/(?:^|\D)(?:18|19)\d{2}(?:\D|$)/.test(titleForGate)||/\.(svg|pdf|wav|ogg|tiff?)$/i.test(title)||!Number.isFinite(width)||!Number.isFinite(height)||!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180||width<1200||height<600||width/height<1.2||width/height>1.9)continue;
  const distance=km({lat:anchorLat,lon:anchorLon},{lat,lon});
  if(!Number.isFinite(distance)||distance>5)continue;
  const creator=plain(ext.Artist?.value).slice(0,300),licenseUrl=String(ext.LicenseUrl?.value??'').trim(),thumbUrl=String(info.thumburl??'').trim(),pageUrl=String(info.descriptionurl??'').trim();
  if(/^cc by/i.test(license)&&(!creator||!licenseUrl||!thumbUrl||!pageUrl))continue;
  if(!safeUrl(thumbUrl,new Set(['upload.wikimedia.org']))||!safeUrl(pageUrl,new Set(['commons.wikimedia.org']))||(licenseUrl&&!safeUrl(licenseUrl,new Set(['creativecommons.org','commons.wikimedia.org']))))continue;
  const searchable=fold(`${title} ${ext.ImageDescription?.value??''} ${ext.Categories?.value??''}`);
  const tokenMatches=routeTokens.filter(token=>searchable.includes(token)).length;
  const scenicWords=new Set(['wald','forest','berge','aussicht','panorama','weser','fluss','river','tal','valley','weg','trail','landschaft','landscape','nature','natur','heide','wiese','meadow','see','lake']);
  const scenicMatches=searchable.split(/\s+/).filter(word=>scenicWords.has(word)||word.startsWith('landschaft')||word.startsWith('panorama')).length;
  if(scenicMatches===0)continue;
  const relevanceScore=tokenMatches*30+Math.min(18,scenicMatches*3)-Math.min(15,distance*2);
  const candidate={image_title:title,image_thumb_url:thumbUrl,image_creator:creator,image_license:license,image_license_url:licenseUrl,image_page_url:pageUrl,image_distance_km:Number(distance.toFixed(3)),image_mime:mime,image_anchor_fraction:Number(job.image_anchor_fraction??0.5),image_relevance_score:Number(relevanceScore.toFixed(2)),image_token_matches:tokenMatches};
  const key=Number(job.relation_id),list=byRelation.get(key)??[];list.push(candidate);byRelation.set(key,list);
 }
}
const usedPrimaryPages=new Set();
return routes.map((item,i)=>{
 const route=item.json,all=byRelation.get(Number(route.relation_id))??[],chosen=[],seen=new Set();
 const commonsStatuses=commonsByRelation.get(Number(route.relation_id))??[];
 const commonsPartial=commonsStatuses.length!==(expectedByRelation.get(Number(route.relation_id))??0)||commonsStatuses.some(entry=>!entry.ok);
 for(const fraction of [0.2,0.5,0.8]){
  const best=all.filter(image=>Math.abs(image.image_anchor_fraction-fraction)<0.01&&!seen.has(image.image_page_url)).sort((a,b)=>b.image_relevance_score-a.image_relevance_score||a.image_distance_km-b.image_distance_km)[0];
  if(best){chosen.push(best);seen.add(best.image_page_url);}
 }
 for(const image of all.sort((a,b)=>b.image_relevance_score-a.image_relevance_score||a.image_distance_km-b.image_distance_km)){
  if(!seen.has(image.image_page_url)){chosen.push(image);seen.add(image.image_page_url);}
 }
 chosen.sort((a,b)=>b.image_relevance_score-a.image_relevance_score||a.image_distance_km-b.image_distance_km);
 const best=chosen.find(image=>!usedPrimaryPages.has(image.image_page_url))??{};
 if(best.image_page_url)usedPrimaryPages.add(best.image_page_url);
 const ordered=(best.image_page_url?[best,...chosen.filter(image=>image.image_page_url!==best.image_page_url)]:chosen).slice(0,3);
 return {pairedItem:{item:i},json:{...route,...best,image_candidates_json:JSON.stringify(ordered),image_candidate_count:ordered.length,image_found:Boolean(best.image_page_url),image_partial_failure:commonsPartial||!best.image_page_url,commons_http_statuses:commonsStatuses,observed_at:$now.toISO()}};
});
