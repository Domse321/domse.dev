const bbox = {south:51.70, west:8.45, north:52.62, east:10.25};
const query = `[out:json][timeout:50];relation["route"~"^(bicycle|mtb)$"]["name"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});out tags center;`;
return [{json:{run_id:String($execution.id), observed_at:$now.toISO(), bbox, overpass_query:query}}];
