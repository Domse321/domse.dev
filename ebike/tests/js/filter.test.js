import test from 'node:test';
import assert from 'node:assert/strict';
import { MODE_ORDER, filterRoutes, selectFocus } from '../../js/filter.js';
const routes=[
{id:'m1',name:'Wald',region:'Hameln',bestFor:'Wald',highlights:[],rideStyle:'mtb',difficulty:'mittel',surface:['Waldweg'],durationMinutes:[60,90],status:'reviewed',score:90},
{id:'t1',name:'Weser',region:'Hameln',bestFor:'Fluss',highlights:[],rideStyle:'tour',difficulty:'leicht',surface:['Asphalt'],durationMinutes:[90,120],status:'reviewed',score:80},
{id:'c1',name:'Kandidat',region:'Hameln',bestFor:'Prüfung',highlights:[],rideStyle:'mtb',difficulty:'schwer',surface:['Trail'],durationMinutes:[120,180],status:'candidate',score:70}];
test('mode order and default put MTB first',()=>assert.deepEqual(MODE_ORDER,['mtb','tour','all']));
test('standard results exclude candidates',()=>assert.deepEqual(filterRoutes(routes,{mode:'mtb'}).map(r=>r.id),['m1']));
test('candidate view is explicit and filterable',()=>assert.deepEqual(filterRoutes(routes,{mode:'mtb',includeCandidates:true}).map(r=>r.id),['m1','c1']));
test('time difficulty surface and search combine',()=>assert.deepEqual(filterRoutes(routes,{mode:'all',maxMinutes:130,difficulty:'leicht',surface:'Asphalt',query:'wes'}).map(r=>r.id),['t1']));
test('focus remains or falls back deterministically',()=>{assert.equal(selectFocus(routes,'t1').id,'t1');assert.equal(selectFocus(routes,'gone').id,'m1');assert.equal(selectFocus([],null),null)});
