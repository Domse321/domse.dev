import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCatalog, normalizeRoute } from '../../js/data.js';

const base={id:'route-1',name:'Route 1',region:'Hameln',rideStyle:'mtb',status:'candidate',distanceKm:12.5,elevationM:220,durationMinutes:[60,90],difficulty:'mittel',surface:['Waldweg'],bestFor:'Prüfung',season:'nicht bewertet',highlights:[],riskNotes:[],score:70,trafficProfile:'nicht bewertet',familyFriendly:false,source:{legacyStatus:'Entwurf',migratedFrom:'0.5.0'},presentation:{mode:'track_only',reason:'Kein freigegebener öffentlicher Track'},publicTrack:null};

test('normalizes exactly valid candidate data immutably',()=>{const source={schemaVersion:'1.0.0',generatedFrom:'0.5.0',routes:[base]};const result=normalizeCatalog(source);assert.equal(result.routes[0].id,'route-1');assert.notEqual(result,source);assert.throws(()=>result.routes.push(base));});
test('candidate rejects download navigation and recommendation fields',()=>{for(const field of ['gpxFile','geojsonFile','navigationUrl','recommended'])assert.throws(()=>normalizeRoute({...base,[field]:field==='recommended'?true:'x'}),/candidate/i);});
test('rejects unknown and unsafe route fields',()=>{assert.throws(()=>normalizeRoute({...base,script:'<script>'}),/unknown/i);assert.throws(()=>normalizeRoute({...base,id:'__proto__'}),/id/i);});
test('catalog rejects duplicate ids and wrong inventory size when required',()=>{assert.throws(()=>normalizeCatalog({schemaVersion:'1.0.0',generatedFrom:'0.5.0',routes:[base,base]}),/duplicate/i);});
test('route requires surface and source instead of inventing defaults',()=>{for(const field of ['surface','source']){const value={...base};delete value[field];assert.throws(()=>normalizeRoute(value),new RegExp(field,'i'));}});
test('catalog rejects unknown root fields',()=>assert.throws(()=>normalizeCatalog({schemaVersion:'1.0.0',generatedFrom:'0.5.0',routes:[base],unexpected:true}),/unknown catalog field/i));
