const routes=$('Gate Score and Fair Limit').all();
const jobs=$('Build Track-near Image Jobs').all();
const byRelation=new Map();
const allow=/^(?:cc0(?: 1\.0)?|public domain|pd|cc by(?:-sa)?(?: [1-4]\.0)?)$/i;
const raster=new Set(['image/jpeg','image/png','image/webp']);
const badTitle=/(^|[ _-])(map|karte|wappen|coat[ _-]?of[ _-]?arms|diagram|logo|schild|informationstafel|tafel|luftbild|orthophoto|dop20|scan)([ _.-]|$)/i;
const stop=new Set(['rund','ueber','über','unter','durch','tour','route','radroute','naturpark','basisring','alte','bahnlinie','the','und','der','die','das','den','von','zum','zur']);
function plain(v){return String(v??'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();}
function fold(v){return plain(v).toLocaleLowerCase('de').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9äöüß]+/g,' ');}
function tokens(v){return [...new Set(fold(v).split(/\s+/).filter(t=>t.length>=4&&!stop.has(t)))];}
function rad(x){return x*Math.PI/180;}
function km(a,b){const q=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lon-a.lon)/2)**2;return 12742*Math.asin(Math.sqrt(q));}
for(const [i,item] of $input.all().entries()){
 const pair=Array.isArray(item.pairedItem)?item.pairedItem[0]:item.pairedItem;
 const job=jobs[pair?.item??i]?.json??{};
 let body=item.json.body??item.json.data??item.json;
 if(typeof body==='string'){try{body=JSON.parse(body)}catch{body={}}}
 const routeTokens=tokens(`${job.route_name??''} ${job.region??''}`);
 for(const page of Object.values(body?.query?.pages??{})){
  const info=page.imageinfo?.[0],ext=info?.extmetadata??{},mime=String(info?.mime??'').toLowerCase(),title=String(page.title??''),license=plain(ext.LicenseShortName?.value),coord=page.coordinates?.[0];
  if(!info||info.mediatype!=='BITMAP'||!raster.has(mime)||!allow.test(license)||badTitle.test(title)||/\.(svg|pdf|wav|ogg|tiff?)$/i.test(title)||!coord)continue;
  const distance=km({lat:job.image_anchor_lat,lon:job.image_anchor_lon},{lat:Number(coord.lat),lon:Number(coord.lon)});
  if(distance>12)continue;
  const creator=plain(ext.Artist?.value).slice(0,300),licenseUrl=String(ext.LicenseUrl?.value??'').trim(),thumbUrl=String(info.thumburl??'').trim(),pageUrl=String(info.descriptionurl??'').trim();
  if(/^cc by/i.test(license)&&(!creator||!licenseUrl||!thumbUrl||!pageUrl))continue;
  if(!thumbUrl||!pageUrl)continue;
  const searchable=fold(`${title} ${ext.ImageDescription?.value??''} ${ext.Categories?.value??''}`);
  const tokenMatches=routeTokens.filter(token=>searchable.includes(token)).length;
  const scenicMatches=(searchable.match(/wald|forest|berg|aussicht|panorama|weser|fluss|tal|weg|trail|landschaft|nature|natur/g)||[]).length;
  const relevanceScore=tokenMatches*30+Math.min(15,scenicMatches*3)-Math.min(12,distance);
  const candidate={image_title:title,image_thumb_url:thumbUrl,image_creator:creator,image_license:license,image_license_url:licenseUrl,image_page_url:pageUrl,image_distance_km:Number(distance.toFixed(3)),image_mime:mime,image_anchor_fraction:Number(job.image_anchor_fraction??0.5),image_relevance_score:Number(relevanceScore.toFixed(2)),image_token_matches:tokenMatches};
  const key=Number(job.relation_id),list=byRelation.get(key)??[];list.push(candidate);byRelation.set(key,list);
 }
}
return routes.map((item,i)=>{
 const route=item.json,all=byRelation.get(Number(route.relation_id))??[],chosen=[],seen=new Set();
 for(const fraction of [0.2,0.5,0.8]){
  const best=all.filter(image=>Math.abs(image.image_anchor_fraction-fraction)<0.01&&!seen.has(image.image_page_url)).sort((a,b)=>b.image_relevance_score-a.image_relevance_score||a.image_distance_km-b.image_distance_km)[0];
  if(best){chosen.push(best);seen.add(best.image_page_url);}
 }
 for(const image of all.sort((a,b)=>b.image_relevance_score-a.image_relevance_score||a.image_distance_km-b.image_distance_km)){
  if(!seen.has(image.image_page_url)){chosen.push(image);seen.add(image.image_page_url);}if(chosen.length===3)break;
 }
 chosen.sort((a,b)=>b.image_relevance_score-a.image_relevance_score||a.image_distance_km-b.image_distance_km);
 const unique=chosen.slice(0,3),best=unique[0]??{};
 return {pairedItem:{item:i},json:{...route,...best,image_candidates_json:JSON.stringify(unique),image_candidate_count:unique.length,image_found:unique.length>0,image_partial_failure:unique.length===0,observed_at:$now.toISO()}};
});
