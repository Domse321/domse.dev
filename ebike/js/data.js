const ROUTE_FIELDS=new Set(['id','name','region','rideStyle','status','distanceKm','elevationM','durationMinutes','difficulty','surface','bestFor','season','highlights','riskNotes','score','trafficProfile','familyFriendly','source','presentation','publicTrack','gpxFile','geojsonFile','navigationUrl','plannerUrl','recommended','waypoints']);
const ID=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUSES=new Set(['candidate','reviewed','ridden','retired']);
const STYLES=new Set(['mtb','tour']);
const CATALOG_FIELDS=new Set(['schemaVersion','generatedFrom','routes']);
const SOURCE_FIELDS=new Set(['legacyStatus','migratedFrom']);
function plainObject(value){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype}
function string(value,label,max=512){if(typeof value!=='string'||!value.trim()||[...value].length>max)throw new TypeError(`${label} invalid`);return value.trim()}
function strings(value,label,max=30){if(!Array.isArray(value)||value.length>max)throw new TypeError(`${label} invalid`);return value.map((item,index)=>string(item,`${label}[${index}]`))}
function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child)}return value}
export function normalizeRoute(input){
  if(!plainObject(input))throw new TypeError('route invalid');
  for(const key of Object.keys(input))if(!ROUTE_FIELDS.has(key))throw new TypeError(`unknown route field: ${key}`);
  for(const field of ['surface','source'])if(!(field in input))throw new TypeError(`${field} required`);
  const id=string(input.id,'id',96);if(!ID.test(id)||['__proto__','prototype','constructor'].includes(id))throw new TypeError('id invalid');
  if(!STYLES.has(input.rideStyle)||!STATUSES.has(input.status))throw new TypeError('route enum invalid');
  if(!Number.isFinite(input.distanceKm)||input.distanceKm<=0||!Number.isFinite(input.elevationM)||input.elevationM<0)throw new TypeError('route metrics invalid');
  if(!Array.isArray(input.durationMinutes)||input.durationMinutes.length!==2||input.durationMinutes.some(n=>!Number.isInteger(n)||n<1)||input.durationMinutes[0]>input.durationMinutes[1])throw new TypeError('duration invalid');
  if(!plainObject(input.presentation)||!['track_only','local_media'].includes(input.presentation.mode)||typeof input.presentation.reason!=='string')throw new TypeError('presentation invalid');
  if(input.status==='candidate')for(const field of ['gpxFile','geojsonFile','navigationUrl','plannerUrl','recommended','waypoints'])if(field in input)throw new TypeError(`candidate route cannot expose ${field}`);
  if(input.status==='candidate'&&input.publicTrack!==null)throw new TypeError('candidate public track must be null');
  if(!plainObject(input.source)||Object.keys(input.source).some(key=>!SOURCE_FIELDS.has(key))||Object.keys(input.source).length!==SOURCE_FIELDS.size)throw new TypeError('source invalid');
  const surface=strings(input.surface,'surface');if(!surface.length)throw new TypeError('surface invalid');
  const route={id,name:string(input.name,'name'),region:string(input.region,'region'),rideStyle:input.rideStyle,status:input.status,distanceKm:input.distanceKm,elevationM:input.elevationM,durationMinutes:[...input.durationMinutes],difficulty:string(input.difficulty,'difficulty'),surface,bestFor:string(input.bestFor,'bestFor'),season:string(input.season,'season'),highlights:strings(input.highlights,'highlights'),riskNotes:strings(input.riskNotes,'riskNotes'),score:Number.isFinite(input.score)?input.score:0,trafficProfile:string(input.trafficProfile||'nicht bewertet','trafficProfile'),familyFriendly:Boolean(input.familyFriendly),source:{legacyStatus:string(input.source.legacyStatus,'legacyStatus'),migratedFrom:string(input.source.migratedFrom,'migratedFrom')},presentation:{mode:input.presentation.mode,reason:string(input.presentation.reason,'presentation.reason')},publicTrack:input.publicTrack};
  return deepFreeze(route);
}
export function normalizeCatalog(input,{expectedCount=null}={}){if(!plainObject(input)||input.schemaVersion!=='1.0.0'||!Array.isArray(input.routes))throw new TypeError('catalog schema invalid');for(const key of Object.keys(input))if(!CATALOG_FIELDS.has(key))throw new TypeError(`unknown catalog field: ${key}`);const routes=input.routes.map(normalizeRoute);const ids=new Set(routes.map(r=>r.id));if(ids.size!==routes.length)throw new TypeError('duplicate route id');if(expectedCount!==null&&routes.length!==expectedCount)throw new TypeError(`inventory must contain ${expectedCount} routes`);return deepFreeze({schemaVersion:'1.0.0',generatedFrom:string(input.generatedFrom,'generatedFrom'),routes})}
