'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
globalThis.EbikeSecurity = require('../../js/security.js');
const { AppState, loadRoutesData, renderCardTrackSvg } = require('../../app.js');

function validCatalog() {
  return {
    bike: {}, scoring_model: {}, routes: [{
      id: 'safe-route', name: 'Safe', gpx_file: 'gpx/safe-route.gpx',
      track_geojson_file: 'tracks/safe-route.geojson', distance_km: 10, elevation_m: 20,
      track_points: 2, score: 50, waypoints: [], gallery: [],
      highlights: [], risk_notes: [], next_actions: [], decision_tags: [], scores: {}, battery_model: {}
    }]
  };
}

test('loadRoutesData reports failure, preserves prior state, and keeps its error notice', async () => {
  const prior = [{ id: 'prior-route' }];
  AppState.allRoutes = prior;
  const main = { innerHTML: '' };
  globalThis.document = { getElementById: id => id === 'appMain' ? main : null };
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ ...validCatalog(), routes: [{ ...validCatalog().routes[0], id: 'BAD' }] }) });
  assert.equal(await loadRoutesData(), false);
  assert.equal(AppState.allRoutes, prior);
  assert.match(main.innerHTML, /data-load-error/);
});

test('loadRoutesData assigns state only after complete validation', async () => {
  const data = validCatalog();
  globalThis.fetch = async () => ({ ok: true, json: async () => data });
  assert.equal(await loadRoutesData(), true);
  assert.equal(AppState.allRoutes, data.routes);
});

test('card preview refuses a traversal track path', () => {
  assert.equal(renderCardTrackSvg({ id: 'safe-route', track_geojson_file: '../private.geojson' }), '');
});
