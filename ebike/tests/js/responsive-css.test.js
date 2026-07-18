import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync(new URL('../../style.css',import.meta.url),'utf8');
const render=fs.readFileSync(new URL('../../js/render.js',import.meta.url),'utf8');

test('map contour decoration stays inside its clipped map stage footprint',()=>{
  assert.match(render,/className:'track-stage'[\s\S]*className:'map-contours'/);
  const rule=css.match(/\.map-contours\{([^}]*)\}/)?.[1];
  assert.ok(rule,'missing .map-contours rule');
  assert.match(rule,/(?:^|;)inset:0(?:;|$)/);
  assert.doesNotMatch(rule,/(?:^|;)(?:inset|top|right|bottom|left):-/);
});

test('small-screen hero heading keeps a viewport-relative large-text cap',()=>{
  assert.match(css,/@media \(max-width:390px\)\{[\s\S]*?\.hero h1\{font-size:clamp\(/);
  assert.doesNotMatch(css,/@media \(max-width:390px\)\{[\s\S]*?\.hero h1\{font-size:2\.8rem\}/);
});