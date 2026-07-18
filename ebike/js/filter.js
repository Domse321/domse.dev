export const MODE_ORDER=Object.freeze(['mtb','tour','all']);
function text(route){return [route.name,route.region,route.bestFor,...(route.surface||[]),...(route.highlights||[])].join(' ').toLocaleLowerCase('de')}
export function filterRoutes(routes,{mode='mtb',query='',maxMinutes=Infinity,difficulty='',surface='',includeCandidates=false}={}){
  const needle=String(query).trim().toLocaleLowerCase('de');
  return routes.filter(route=>(mode==='all'||route.rideStyle===mode)&&(includeCandidates||route.status==='reviewed'||route.status==='ridden')&&(!needle||text(route).includes(needle))&&route.durationMinutes[1]<=Number(maxMinutes||Infinity)&&(!difficulty||route.difficulty===difficulty)&&(!surface||route.surface.includes(surface))).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'de'));
}
export function selectFocus(routes,currentId){return routes.find(route=>route.id===currentId)||routes[0]||null}
