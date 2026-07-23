const items=$input.all();
function present(value){return typeof value==='string'&&value.trim().length>0;}
function ready(row){
 return row.image_found===true&&present(row.image_title)&&present(row.image_thumb_url)&&present(row.image_page_url)&&present(row.image_license)&&present(row.image_license_url)&&Number.isFinite(Number(row.image_distance_km))&&Number(row.image_distance_km)<=5;
}
const accepted=items.filter(item=>ready(item.json));
if(accepted.length)return accepted;
return [{json:{pipeline_signal:'NO_ROUTE_WITH_REQUIRED_IMAGE',image_rejected_count:items.length,observed_at:$now.toISO()}}];
