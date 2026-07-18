/** Local persistence for favourites, comparison and the personal ride log. */
'use strict';

const KEYS = Object.freeze({
  FAVORITES: 'domse_ebike_favorites_v1',
  COMPARE: 'domse_ebike_compare_v1',
  LOGBOOK: 'domse_ebike_logbook_v1'
});
const MAX_IMPORT_BYTES = 1024 * 1024;
const MAX_LOG_ENTRIES = 1000;
const ROUTE_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ENTRY_ID_RE = /^log_[a-zA-Z0-9_]{1,80}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ENTRY_KEYS = new Set(['id', 'date', 'routeId', 'routeName', 'durationMinutes', 'batteryUsedPercent', 'weather', 'surfaceCondition', 'rating', 'notes', 'createdAt']);

function boundedString(value, max, fallback = '') {
  return typeof value === 'string' && value.length <= max ? value : fallback;
}

function normaliseLogEntry(entry, strict = false) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  if (strict && Object.keys(entry).some(key => !ENTRY_KEYS.has(key))) return null;
  const duration = Number(entry.durationMinutes);
  const battery = Number(entry.batteryUsedPercent);
  const rating = Number(entry.rating);
  const createdAt = boundedString(entry.createdAt, 40);
  if (!ENTRY_ID_RE.test(entry.id || '') || !DATE_RE.test(entry.date || '') ||
      typeof entry.routeId !== 'string' || entry.routeId.length > 80 || !ROUTE_ID_RE.test(entry.routeId) ||
      typeof entry.routeName !== 'string' || !entry.routeName.length || entry.routeName.length > 160 ||
      !Number.isInteger(duration) || duration < 1 || duration > 1440 ||
      !Number.isInteger(battery) || battery < 0 || battery > 100 ||
      !Number.isInteger(rating) || rating < 1 || rating > 5 ||
      typeof entry.notes !== 'string' || entry.notes.length > 4000 ||
      typeof entry.weather !== 'string' || entry.weather.length > 200 ||
      typeof entry.surfaceCondition !== 'string' || entry.surfaceCondition.length > 200 ||
      !createdAt || Number.isNaN(Date.parse(createdAt))) return null;
  return {
    id: entry.id, date: entry.date, routeId: entry.routeId, routeName: entry.routeName,
    durationMinutes: duration, batteryUsedPercent: battery,
    weather: entry.weather, surfaceCondition: entry.surfaceCondition, rating,
    notes: entry.notes, createdAt: new Date(createdAt).toISOString()
  };
}

function readIdList(key, maximum) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? [...new Set(parsed.filter(id => typeof id === 'string' && id.length <= 80 && ROUTE_ID_RE.test(id)))].slice(0, maximum) : [];
  } catch (_) { return []; }
}

const StorageAndLog = {
  getFavorites() { return readIdList(KEYS.FAVORITES, 500); },
  isFavorite(routeId) { return this.getFavorites().includes(routeId); },
  toggleFavorite(routeId) {
    if (typeof routeId !== 'string' || !ROUTE_ID_RE.test(routeId)) return false;
    const list = this.getFavorites();
    const index = list.indexOf(routeId);
    const added = index < 0;
    if (added) list.push(routeId); else list.splice(index, 1);
    try { localStorage.setItem(KEYS.FAVORITES, JSON.stringify(list)); } catch (_) {}
    this.notifyChange('favorites', { routeId, added, list });
    return added;
  },

  getCompareList() { return readIdList(KEYS.COMPARE, 4); },
  isInCompare(routeId) { return this.getCompareList().includes(routeId); },
  toggleCompare(routeId) {
    if (typeof routeId !== 'string' || !ROUTE_ID_RE.test(routeId)) return false;
    const list = this.getCompareList();
    const index = list.indexOf(routeId);
    const added = index < 0;
    if (added && list.length >= 4) { alert('Du kannst maximal 4 Touren gleichzeitig im Vergleich gegenüberstellen!'); return false; }
    if (added) list.push(routeId); else list.splice(index, 1);
    try { localStorage.setItem(KEYS.COMPARE, JSON.stringify(list)); } catch (_) {}
    this.notifyChange('compare', { routeId, added, list });
    return added;
  },
  clearCompare() {
    try { localStorage.setItem(KEYS.COMPARE, '[]'); } catch (_) {}
    this.notifyChange('compare', { list: [] });
  },

  getRideLog() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEYS.LOGBOOK) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(0, MAX_LOG_ENTRIES).map(item => normaliseLogEntry(item)).filter(Boolean);
    } catch (_) { return []; }
  },
  addRideLogEntry(entry) {
    const now = new Date();
    const candidate = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date: DATE_RE.test(entry.date || '') ? entry.date : now.toISOString().slice(0, 10),
      routeId: ROUTE_ID_RE.test(entry.routeId || '') ? entry.routeId : 'kluet-feierabendrunde',
      routeName: boundedString(entry.routeName, 160, 'Klüt-Feierabendrunde'),
      durationMinutes: Math.max(1, Math.min(1440, Math.round(Number(entry.durationMinutes) || 90))),
      batteryUsedPercent: Math.max(0, Math.min(100, Math.round(Number(entry.batteryUsedPercent) || 25))),
      weather: boundedString(entry.weather, 200, 'Sonnig, 18°C'),
      surfaceCondition: boundedString(entry.surfaceCondition, 200, 'Trocken & griffig'),
      rating: Math.max(1, Math.min(5, Math.round(Number(entry.rating) || 5))),
      notes: boundedString(entry.notes, 4000), createdAt: now.toISOString()
    };
    const newEntry = normaliseLogEntry(candidate);
    const log = [newEntry, ...this.getRideLog()].slice(0, MAX_LOG_ENTRIES);
    try { localStorage.setItem(KEYS.LOGBOOK, JSON.stringify(log)); } catch (_) {}
    this.notifyChange('logbook', { entry: newEntry, list: log });
    return newEntry;
  },
  deleteRideLogEntry(entryId) {
    const log = this.getRideLog().filter(item => item.id !== entryId);
    try { localStorage.setItem(KEYS.LOGBOOK, JSON.stringify(log)); } catch (_) {}
    this.notifyChange('logbook', { list: log });
  },
  exportLogJson() {
    const blob = new Blob([JSON.stringify(this.getRideLog(), null, 2)], { type: 'application/json' });
    const anchor = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    anchor.href = objectUrl;
    anchor.download = `domse_fahrtenbuch_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(objectUrl);
  },
  importLogJson(jsonString) {
    if (typeof jsonString !== 'string' || new TextEncoder().encode(jsonString).length > MAX_IMPORT_BYTES) return false;
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed) || parsed.length > MAX_LOG_ENTRIES) return false;
      const validated = parsed.map(entry => normaliseLogEntry(entry, true));
      if (validated.some(entry => entry === null)) return false;
      localStorage.setItem(KEYS.LOGBOOK, JSON.stringify(validated));
      this.notifyChange('logbook', { list: validated });
      return true;
    } catch (_) { return false; }
  },
  listeners: { favorites: [], compare: [], logbook: [] },
  subscribe(type, callback) { if (this.listeners[type] && typeof callback === 'function') this.listeners[type].push(callback); },
  notifyChange(type, data) { (this.listeners[type] || []).forEach(callback => { try { callback(data); } catch (_) {} }); }
};

if (typeof window !== 'undefined') window.StorageAndLog = StorageAndLog;
if (typeof module !== 'undefined' && module.exports) module.exports = { StorageAndLog, normaliseLogEntry, MAX_IMPORT_BYTES, MAX_LOG_ENTRIES };
