'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const security = require('../../js/security.js');
globalThis.EbikeSecurity = security;
const { SvgMapEngine } = require('../../js/svgMapEngine.js');
const { ScoringAndBattery } = require('../../js/scoringAndBattery.js');

function route(overrides = {}) {
  return {
    id: 'safe-route',
    name: '<img src=x onerror=alert(1)>',
    gpx_file: 'gpx/safe-route.gpx',
    track_geojson_file: 'tracks/safe-route.geojson',
    distance_km: 10, elevation_m: 20, track_points: 2, score: 50,
    waypoints: [{ lat: 52.1, lon: 9.3, label: '<script>alert(x)</script>' }],
    highlights: ['<b>highlight</b>'], risk_notes: [], next_actions: [], decision_tags: [],
    scores: {}, battery_model: {}, gallery: [],
    ...overrides
  };
}

function catalog(routes = [route()]) {
  return { bike: {}, scoring_model: {}, routes };
}

test('runtime catalog accepts markup only as data and rejects any invalid route atomically', () => {
  assert.equal(security.validateRouteCatalog(catalog()), true);
  assert.equal(security.validateRouteCatalog(catalog([route(), route()])), false, 'duplicate IDs');
  assert.equal(security.validateRouteCatalog(catalog([route(), route({ id: 'other', track_geojson_file: '../private.geojson' })])), false);
  assert.equal(security.validateRouteCatalog(catalog([route({ gallery: [{ url: 'https://evil.example/a.jpg' }] })])), false);
  assert.equal(security.validateRouteCatalog(catalog([route({ waypoints: [{ lat: Infinity, lon: 9.3 }] })])), false);
  assert.equal(security.validateRouteCatalog(catalog([route({ scores: [] })])), false);
  assert.equal(security.validateRouteCatalog(catalog([route({ name: 'x'.repeat(4097) })])), false);
  assert.equal(security.validateRouteCatalog(catalog([route({ type: 42 })])), false);
  assert.equal(security.validateRouteCatalog(catalog([route({ unexpected_field: 'nope' })])), false);
  assert.equal(security.validateRouteCatalog(catalog([route({ battery_model: { note: 42 } })])), false);
});

test('track fetch rejects traversal before issuing a request', async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return { ok: true, json: async () => ({}) }; };
  assert.equal(await SvgMapEngine.fetchTrack('../private.geojson'), null);
  assert.equal(called, false);
});

test('GeoJSON SVG geometry rejects non-finite and non-numeric coordinates', () => {
  for (const bad of [
    [[9, 52], [NaN, 53]],
    [[9, 52], ['9.1', 53]],
    [[9, 52], [Infinity, 53]],
    [[9, 52], [9.1, 53, 100, 7]]
  ]) {
    assert.deepEqual(SvgMapEngine.getCoordinates({ type: 'LineString', coordinates: bad }), []);
    assert.equal(SvgMapEngine.computeBoundsAndScale(bad, 400, 200), null);
  }
});

test('catalog and waypoint text is escaped in generated SVG markup', () => {
  const container = { innerHTML: '', querySelector() { return null; } };
  const hostile = route({ distance_km: 10, elevation_m: 20, region: '<svg/onload=1>' });
  SvgMapEngine.renderTrackMap(container, { type: 'LineString', coordinates: [[9, 52, 100], [9.1, 52.1, 110]] }, hostile);
  assert.match(container.innerHTML, /&lt;script&gt;alert\(x\)&lt;\/script&gt;/);
  assert.doesNotMatch(container.innerHTML, /<script>/);
  SvgMapEngine.renderTopoPoster(container, { type: 'LineString', coordinates: [[9, 52], [9.1, 52.1]] }, hostile);
  assert.match(container.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(container.innerHTML, /&lt;svg\/onload=1&gt;/);
});

test('waypoint redaction is generic', () => {
  assert.equal(SvgMapEngine.sanitizeWaypointLabel('Musterweg 12'), 'Start / Ziel: Hameln');
});

test('battery markup escapes catalog strings', () => {
  const html = ScoringAndBattery.renderBatteryCalculator(route({
    bike_profile: '<img src=x onerror=alert(1)>',
    battery_model: { eco: 10, tour: 20, emtb: 30, turbo: 40, reserve_percent: 15, note: '<svg/onload=alert(1)>' }
  }));
  assert.doesNotMatch(html, /<img|<svg\/onload/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;svg\/onload/);
});
