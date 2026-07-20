const out=[];
function rad(x){return x*Math.PI/180;}
function km(a,b){const dlat=rad(b.lat-a.lat),dlon=rad(b.lon-a.lon);const q=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;return 12742*Math.asin(Math.sqrt(q));}
function anchor(points,fraction,fallback){
 if(points.length<2)return points[0]??fallback;
 const lengths=[];let total=0;
 for(let i=1;i<points.length;i++){const d=km(points[i-1],points[i]);lengths.push(d);total+=d;}
 if(!(total>0))return points[Math.min(points.length-1,Math.floor((points.length-1)*fraction))]??fallback;
 const target=total*fraction;let traversed=0;
 for(let i=1;i<points.length;i++){const segment=lengths[i-1];if(traversed+segment>=target){const t=segment?Math.max(0,Math.min(1,(target-traversed)/segment)):0;return {lat:points[i-1].lat+(points[i].lat-points[i-1].lat)*t,lon:points[i-1].lon+(points[i].lon-points[i-1].lon)*t};}traversed+=segment;}
 return points[points.length-1]??fallback;
}
for(const [i,item] of $input.all().entries()){
 const c=item.json; let p=[]; try{p=JSON.parse(c.geometry_json)}catch{}
 p=p.filter(x=>Number.isFinite(Number(x?.lat))&&Number.isFinite(Number(x?.lon))).map(x=>({lat:Number(x.lat),lon:Number(x.lon)}));
 for(const fraction of [0.2,0.5,0.8]){const point=anchor(p,fraction,c.centroid);out.push({pairedItem:{item:i},json:{...c,image_anchor_lat:point.lat,image_anchor_lon:point.lon,image_anchor_fraction:fraction}});}
}
return out;
