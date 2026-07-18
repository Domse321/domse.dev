'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const security = require('../../js/security.js');

test('escapeHtml neutralisiert Text und Attribut-Kontexte', () => {
  assert.equal(security.escapeHtml(`<img src=x onerror="alert('x')">&`), '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;');
});

test('Hash-Routen-IDs müssen syntaktisch gültig und bekannt sein', () => {
  const known = ['kluet-feierabendrunde'];
  assert.equal(security.safeRouteId('kluet-feierabendrunde', known), 'kluet-feierabendrunde');
  assert.equal(security.safeRouteId('<img-onerror>', known), null);
  assert.equal(security.safeRouteId('nicht-bekannt', known), null);
});

test('externe URLs sind auf Zweck, HTTPS, Host und Pfad begrenzt', () => {
  assert.ok(security.safeExternalUrl('https://upload.wikimedia.org/wikipedia/commons/a/a.jpg', 'gallery'));
  assert.ok(security.safeExternalUrl('https://www.google.com/maps/dir/?api=1', 'navigation'));
  assert.ok(security.safeExternalUrl('https://www.komoot.com/search/foo', 'komoot'));
  assert.ok(security.safeExternalUrl('https://brouter.de/brouter-web/#map=1', 'planner'));
  for (const bad of ['javascript:alert(1)', 'https://upload.wikimedia.org.evil.test/wikipedia/commons/a.jpg', 'http://upload.wikimedia.org/wikipedia/commons/a.jpg', 'https://user@upload.wikimedia.org/wikipedia/commons/a.jpg']) {
    assert.equal(security.safeExternalUrl(bad, 'gallery'), null);
  }
  assert.equal(security.safeExternalUrl('https://upload.wikimedia.org/wikipedia/commons/a.jpg', 'navigation'), null);
});

test('lokale Datendateien verhindern Traversal und Typwechsel', () => {
  assert.equal(security.safeDataFile('gpx/test-route.gpx', 'gpx'), 'gpx/test-route.gpx');
  assert.equal(security.safeDataFile('tracks/test-route.geojson', 'track'), 'tracks/test-route.geojson');
  assert.equal(security.safeDataFile('../secret.gpx', 'gpx'), null);
});
