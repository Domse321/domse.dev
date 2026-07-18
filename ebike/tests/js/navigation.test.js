import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const catalog=JSON.parse(fs.readFileSync(new URL('../../routes.json',import.meta.url)));
test('candidate inventory exposes no navigation or downloads',()=>{for(const route of catalog.routes){assert.equal(route.status,'candidate');assert.equal(route.publicTrack,null);for(const field of ['navigationUrl','gpxFile','geojsonFile'])assert.equal(field in route,false)}});
