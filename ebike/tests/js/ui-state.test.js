import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseRideRoute } from '../../js/ui-state.js';

test('ride-log selection survives unrelated renders',()=>{
  const routes=[{id:'focused'},{id:'manually-selected'}];
  assert.equal(chooseRideRoute('manually-selected',routes,'focused'),'manually-selected');
});

test('ride-log selection falls back only when it is absent',()=>{
  const routes=[{id:'focused'}];
  assert.equal(chooseRideRoute('',routes,'focused'),'focused');
  assert.equal(chooseRideRoute('removed',routes,'focused'),'focused');
});