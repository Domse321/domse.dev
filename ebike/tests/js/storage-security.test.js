'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const values = new Map();
global.localStorage = {
  getItem: key => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value))
};
const { StorageAndLog, MAX_IMPORT_BYTES } = require('../../js/storageAndLog.js');

function validEntry(overrides = {}) {
  return {
    id: 'log_12345_abcde', date: '2026-07-18', routeId: 'kluet-feierabendrunde',
    routeName: 'Klüt-Runde', durationMinutes: 95, batteryUsedPercent: 25,
    weather: 'Heiter', surfaceCondition: 'Trocken', rating: 5, notes: 'Gut',
    createdAt: '2026-07-18T10:00:00.000Z', ...overrides
  };
}

test('gültiger strikter Logbuch-Import wird gespeichert', () => {
  values.clear();
  assert.equal(StorageAndLog.importLogJson(JSON.stringify([validEntry()])), true);
  assert.deepEqual(StorageAndLog.getRideLog(), [validEntry()]);
});

test('Import weist XSS nicht nur aus Darstellungsgründen, sondern anhand des Schemas zurück', () => {
  values.clear();
  assert.equal(StorageAndLog.importLogJson(JSON.stringify([validEntry({ routeId: '<img-onerror-alert>' })])), false);
  assert.equal(StorageAndLog.importLogJson(JSON.stringify([validEntry({ rating: 99 })])), false);
  assert.equal(StorageAndLog.importLogJson(JSON.stringify([validEntry({ notes: 'x'.repeat(4001) })])), false);
  assert.equal(StorageAndLog.importLogJson(JSON.stringify([{ ...validEntry(), unexpected: true }])), false);
  assert.equal(values.size, 0);
});

test('Import begrenzt Struktur, Anzahl und Bytegröße', () => {
  assert.equal(StorageAndLog.importLogJson('{}'), false);
  assert.equal(StorageAndLog.importLogJson(JSON.stringify(new Array(1001).fill(validEntry()))), false);
  assert.equal(StorageAndLog.importLogJson(' '.repeat(MAX_IMPORT_BYTES + 1)), false);
});

test('korrupter localStorage-Inhalt gelangt nicht in die Darstellung', () => {
  values.set('domse_ebike_logbook_v1', JSON.stringify([validEntry(), validEntry({ id: 'bad', notes: '<img src=x onerror=alert(1)>' })]));
  assert.equal(StorageAndLog.getRideLog().length, 1);
});
