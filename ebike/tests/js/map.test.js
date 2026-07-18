import test from 'node:test';import assert from 'node:assert/strict';import {normalizeTrack,svgPoints} from '../../js/map.js';
test('track projection is deterministic and local',()=>assert.equal(svgPoints([[9,52],[9.1,52.1]]),'20.0,580.0 980.0,20.0'));
test('invalid points fail closed',()=>assert.throws(()=>normalizeTrack([[9,52],[999,52]]),/TRACK_COORDINATE_INVALID/));
