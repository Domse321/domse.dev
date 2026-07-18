import test from 'node:test';import assert from 'node:assert/strict';import {nextIndex} from '../../js/media.js';
test('lightbox navigation wraps in both directions',()=>{assert.equal(nextIndex(0,3,1),1);assert.equal(nextIndex(2,3,1),0);assert.equal(nextIndex(0,3,-1),2)});
test('lightbox rejects empty media collections at integration boundary',()=>assert.equal(nextIndex(0,0,1),-1));
