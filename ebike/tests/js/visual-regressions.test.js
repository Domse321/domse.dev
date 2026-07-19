'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const mapEngine = fs.readFileSync(path.join(ROOT, 'js/svgMapEngine.js'), 'utf8');

test('tile requests use an OSM-compatible referrer policy', () => {
  assert.match(html, /<meta name="referrer" content="strict-origin-when-cross-origin">/);
  assert.doesNotMatch(html, /<meta name="referrer" content="no-referrer">/);
});

test('dark mood badges define explicit readable foreground and surface colors', () => {
  assert.match(css, /\[data-theme="dark"\]\s+\.mood-badge\s*\{[^}]*color:\s*#bdf5d5;[^}]*background:\s*#183b2a;/s);
});

test('map controls stay reachable below the sticky header', () => {
  assert.match(mapEngine, /zoomControl:\s*false/);
  assert.match(mapEngine, /L\.control\.zoom\(\{ position: 'bottomleft' \}\)\.addTo\(map\)/);
  assert.match(css, /\.route-map-actions\s*\{[^}]*top:\s*auto;[^}]*bottom:\s*2rem;/s);
});

test('elevation SVG keeps a matching aspect ratio instead of stretching text and strokes', () => {
  assert.match(mapEngine, /const width = Math\.max\(320, Math\.round\(container\.getBoundingClientRect\(\)\.width \|\| 800\)\);/);
  assert.match(mapEngine, /preserveAspectRatio="xMidYMid meet"/);
  assert.doesNotMatch(mapEngine, /class="elevation-svg"[^>]*preserveAspectRatio="none"/);
  assert.match(css, /\.elevation-svg\s*\{[^}]*height:\s*auto;/s);
});
