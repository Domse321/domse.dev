import test from 'node:test';
import assert from 'node:assert/strict';
import { safeLocalAsset, safeText } from '../../js/dom.js';
import { normalizeMediaItems } from '../../js/media.js';
test('safe text preserves text without producing markup',()=>assert.equal(safeText('<img src=x onerror=1>'),'<img src=x onerror=1>'));
test('only local ebike assets are accepted',()=>{assert.equal(safeLocalAsset('assets/routes/a.webp'),'/ebike/assets/routes/a.webp');for(const url of ['https://evil.test/a','javascript:alert(1)','data:text/html,x','../secret','//evil.test'])assert.equal(safeLocalAsset(url),null)});
test('encoded traversal and encoded separators cannot escape route assets',()=>{for(const value of ['assets/routes/%2e%2e/secret.webp','assets/routes/%2E%2E%2Fsecret.webp','assets/routes/a%2f..%2fsecret.webp','assets/routes/a.webp?redirect=https://evil.test'])assert.equal(safeLocalAsset(value),null)});
test('lightbox media sources are normalized before DOM assignment',()=>{const item={src:'assets/routes/a.webp',alt:'A',title:'A',author:'Domse',license:'own'};assert.equal(normalizeMediaItems([item])[0].src,'/ebike/assets/routes/a.webp');for(const src of ['https://evil.test/a.webp','assets/routes/%2e%2e/secret.webp'])assert.throws(()=>normalizeMediaItems([{...item,src}]),/media source invalid/i);});
