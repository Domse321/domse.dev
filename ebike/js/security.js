/** Security helpers shared by the static E-Bike frontend. */
(function (root) {
  'use strict';

  const ROUTE_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const DATA_FILE_RE = /^(?:gpx|tracks)\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:gpx|geojson)$/;
  const EXTERNAL_RULES = Object.freeze({
    gallery: { origin: 'https://upload.wikimedia.org', path: /^\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\// },
    commons: { origin: 'https://commons.wikimedia.org', path: /^\/wiki\/File:[^/]+$/ },
    license: {
      paths: new Map([
        ['https://creativecommons.org', /^\/(?:licenses\/(?:by|by-sa)\/(?:2\.0\/de|3\.0(?:\/de)?|4\.0)|publicdomain\/zero\/1\.0)(?:\/|\/deed\.[a-z]{2})?$/],
        ['https://commons.wikimedia.org', /^\/wiki\/Commons:Public_domain$/]
      ])
    },
    navigation: { origin: 'https://www.google.com', path: /^\/maps\//, allowSearch: true },
    komoot: { origin: 'https://www.komoot.com', path: /^\// },
    planner: { origin: 'https://brouter.de', path: /^\/brouter-web\//, allowHash: true }
  });

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function validRouteId(value) {
    return typeof value === 'string' && value.length <= 80 && ROUTE_ID_RE.test(value);
  }

  function safeRouteId(value, knownIds) {
    if (!validRouteId(value)) return null;
    if (knownIds && !knownIds.includes(value)) return null;
    return value;
  }

  function safeExternalUrl(value, purpose) {
    const rule = EXTERNAL_RULES[purpose];
    if (!rule || typeof value !== 'string' || value.length > 4096) return null;
    try {
      const url = new URL(value);
      const pathRule = rule.paths ? rule.paths.get(url.origin) : rule.path;
      const originAllowed = rule.paths ? Boolean(pathRule) : url.origin === rule.origin;
      if (url.protocol !== 'https:' || url.username || url.password || !originAllowed || !pathRule.test(url.pathname) ||
          (!rule.allowSearch && url.search) || (!rule.allowHash && url.hash)) return null;
      return url.href;
    } catch (_) {
      return null;
    }
  }

  function safeDataFile(value, expectedType) {
    if (typeof value !== 'string' || !DATA_FILE_RE.test(value)) return null;
    if (expectedType === 'gpx' && !value.startsWith('gpx/')) return null;
    if (expectedType === 'track' && !value.startsWith('tracks/')) return null;
    return value;
  }

  const MAX_CATALOG_NODES = 20000;
  const SAFE_KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,79}$/;

  function isPlainObject(value) {
    if (!value || Object.prototype.toString.call(value) !== '[object Object]') return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function hasSafeTree(value, state = { nodes: 0 }, depth = 0) {
    if (++state.nodes > MAX_CATALOG_NODES || depth > 8) return false;
    if (value === null || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'string') return value.length <= 4096 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
    if (Array.isArray(value)) return value.length <= 2000 && value.every(child => hasSafeTree(child, state, depth + 1));
    if (!isPlainObject(value) || Object.keys(value).length > 100) return false;
    return Object.entries(value).every(([key, child]) =>
      SAFE_KEY_RE.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key) && hasSafeTree(child, state, depth + 1));
  }

  function validateRouteCatalog(catalog) {
    if (!isPlainObject(catalog) || !hasSafeTree(catalog) || !Array.isArray(catalog.routes) || catalog.routes.length < 1 || catalog.routes.length > 500) return false;
    if (!isPlainObject(catalog.bike) || !isPlainObject(catalog.scoring_model) ||
        (catalog.future_ideas !== undefined && !Array.isArray(catalog.future_ideas)) ||
        (catalog.live_features !== undefined && !isPlainObject(catalog.live_features)) ||
        (catalog.route_modes !== undefined && !isPlainObject(catalog.route_modes))) return false;
    const ids = new Set();
    const allowedRouteFields = new Set([
      'battery', 'battery_model', 'best_for', 'bike_profile', 'decision_tags', 'difficulty',
      'distance_km', 'distance_note', 'duration', 'elevation_m', 'family_friendly', 'gallery',
      'gpx_file', 'highlights', 'id', 'komoot_link', 'maturity', 'name', 'nav_label',
      'navigation_link', 'next_actions', 'packing_hint', 'photo_note', 'planner_link', 'region',
      'ride_style', 'risk_notes', 'route_mode_note', 'score', 'scores', 'season', 'start_mode',
      'stats_confidence', 'status', 'surface', 'track_geojson_file', 'track_points',
      'track_source', 'traffic_profile', 'type', 'waypoints'
    ]);
    const stringFields = [
      'battery', 'best_for', 'bike_profile', 'difficulty', 'distance_note', 'duration',
      'maturity', 'nav_label', 'packing_hint', 'photo_note', 'region', 'ride_style',
      'route_mode_note', 'season', 'start_mode', 'stats_confidence', 'status', 'surface',
      'track_source', 'traffic_profile', 'type'
    ];
    const arrayFields = ['waypoints', 'highlights', 'risk_notes', 'next_actions', 'gallery', 'decision_tags'];
    const stringArrayFields = ['highlights', 'risk_notes', 'next_actions', 'decision_tags'];
    const objectFields = ['scores', 'battery_model'];
    const numericFields = ['distance_km', 'elevation_m', 'track_points', 'score'];
    for (const route of catalog.routes) {
      if (!isPlainObject(route) || !validRouteId(route.id) || ids.has(route.id) || typeof route.name !== 'string' || !route.name.trim()) return false;
      ids.add(route.id);
      if (Object.keys(route).some(field => !allowedRouteFields.has(field))) return false;
      if (stringFields.some(field => route[field] !== undefined && typeof route[field] !== 'string')) return false;
      if (route.family_friendly !== undefined && typeof route.family_friendly !== 'boolean') return false;
      if (!safeDataFile(route.gpx_file, 'gpx') || !safeDataFile(route.track_geojson_file, 'track')) return false;
      if (arrayFields.some(field => route[field] !== undefined && !Array.isArray(route[field]))) return false;
      if (stringArrayFields.some(field => (route[field] || []).some(value => typeof value !== 'string'))) return false;
      if (objectFields.some(field => route[field] !== undefined && !isPlainObject(route[field]))) return false;
      if (numericFields.some(field => !Number.isFinite(route[field]))) return false;
      if (!Array.isArray(route.waypoints) || route.waypoints.length > 1000 || !route.waypoints.every(waypoint =>
        isPlainObject(waypoint) && Number.isFinite(waypoint.lat) && waypoint.lat >= -90 && waypoint.lat <= 90 &&
        Number.isFinite(waypoint.lon) && waypoint.lon >= -180 && waypoint.lon <= 180 &&
        (waypoint.label === undefined || typeof waypoint.label === 'string'))) return false;
      if (route.scores && Object.values(route.scores).some(value => !Number.isFinite(value))) return false;
      if (route.battery_model && Object.entries(route.battery_model).some(([key, value]) =>
        !['eco', 'tour', 'emtb', 'turbo', 'reserve_percent', 'note'].includes(key) ||
        (key === 'note' ? typeof value !== 'string' : !Number.isFinite(value)))) return false;
      if ((route.gallery || []).some(image =>
        !isPlainObject(image) || Object.keys(image).some(key => !['artist', 'commons_url', 'height', 'license', 'license_url', 'mime', 'source', 'title', 'url', 'width'].includes(key)) ||
        !safeExternalUrl(image.url, 'gallery') ||
        (image.commons_url !== undefined && !safeExternalUrl(image.commons_url, 'commons')) ||
        (image.license_url !== undefined && !safeExternalUrl(image.license_url, 'license')) ||
        ['artist', 'commons_url', 'license', 'license_url', 'mime', 'source', 'title'].some(key => image[key] !== undefined && typeof image[key] !== 'string') ||
        ['width', 'height'].some(key => image[key] !== undefined && !Number.isFinite(image[key])))) return false;
      for (const [field, purpose] of [['navigation_link', 'navigation'], ['komoot_link', 'komoot'], ['planner_link', 'planner']]) {
        if (route[field] !== undefined && route[field] !== '' && !safeExternalUrl(route[field], purpose)) return false;
      }
    }
    return true;
  }

  const api = Object.freeze({ escapeHtml, validRouteId, safeRouteId, safeExternalUrl, safeDataFile, validateRouteCatalog });
  root.EbikeSecurity = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
