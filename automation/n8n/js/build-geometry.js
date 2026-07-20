const candidates=$input.all().map(item=>item.json).filter(item=>Number.isSafeInteger(Number(item.relation_id))&&Number(item.relation_id)>0);
const out=[];
for(let offset=0;offset<candidates.length;offset+=20){
 const batch=candidates.slice(offset,offset+20); const ids=batch.map(item=>Number(item.relation_id));
 out.push({json:{relation_ids:ids,geometry_query:`[out:json][timeout:90];relation(id:${ids.join(',')});out geom;`}});
}
return out;
