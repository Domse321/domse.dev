/**
 * svgMapEngine.js
 * Proprietary SVG Topography & Track Engine without external dependencies.
 * Renders GeoJSON tracks, elevation charts, interactive zoom/pan maps, and topographic art compositions.
 */

const SvgMapEngine = {
  escape(value) {
    const security = (typeof globalThis !== 'undefined' && globalThis.EbikeSecurity) || {};
    return security.escapeHtml ? security.escapeHtml(value) : String(value == null ? '' : value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
  },
  /**
   * Cleans private residential address strings according to Rule 12.
   */
  sanitizeWaypointLabel(label) {
    if (!label) return 'Wegpunkt';
    if (/\b\d{5}\b/.test(label) || /\b(?:zuhause|haustür|home)\b/i.test(label) || /\b\d{1,4}[a-z]?\b/i.test(label)) {
      return 'Start / Ziel: Hameln';
    }
    return label;
  },

  /**
   * Fetches and parses a local GeoJSON track file.
   */
  async fetchTrack(trackFile) {
    try {
      const security = (typeof globalThis !== 'undefined' && globalThis.EbikeSecurity) || {};
      const safeFile = security.safeDataFile ? security.safeDataFile(trackFile, 'track') : (/^tracks\/[a-z0-9]+(?:-[a-z0-9]+)*\.geojson$/.test(trackFile) ? trackFile : null);
      if (!safeFile) return null;
      const resp = await fetch('data/' + safeFile);
      if (!resp.ok) throw new Error('Track not found: ' + trackFile);
      const geoJson = await resp.json();
      return this.getCoordinates(geoJson).length >= 2 ? geoJson : null;
    } catch (err) {
      console.error('Error fetching track:', err);
      return null;
    }
  },

  /**
   * Extracts coordinate array [lon, lat, ele] from GeoJSON.
   */
  getCoordinates(geoJson) {
    if (!geoJson) return [];
    if (geoJson.type === 'FeatureCollection' && geoJson.features && geoJson.features.length > 0) {
      for (const feat of geoJson.features) {
        if (feat.geometry && feat.geometry.type === 'LineString') {
          return this.validCoordinates(feat.geometry.coordinates) ? feat.geometry.coordinates : [];
        }
      }
    } else if (geoJson.type === 'LineString') {
      return this.validCoordinates(geoJson.coordinates) ? geoJson.coordinates : [];
    }
    return [];
  },

  validCoordinates(coords) {
    return Array.isArray(coords) && coords.length >= 2 && coords.length <= 100000 && coords.every(point =>
      Array.isArray(point) && point.length >= 2 && point.length <= 3 && point.every(value => Number.isFinite(value)));
  },

  /**
   * Computes bounding box and coordinate projection parameters.
   */
  computeBoundsAndScale(coords, width, height, padding = 40) {
    if (!this.validCoordinates(coords) || ![width, height, padding].every(Number.isFinite) || width <= 0 || height <= 0 || padding < 0) return null;
    let minLon = Infinity, maxLon = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;
    let minEle = Infinity, maxEle = -Infinity;

    for (const pt of coords) {
      if (pt[0] < minLon) minLon = pt[0];
      if (pt[0] > maxLon) maxLon = pt[0];
      if (pt[1] < minLat) minLat = pt[1];
      if (pt[1] > maxLat) maxLat = pt[1];
      if (pt[2] !== undefined && pt[2] !== null) {
        if (pt[2] < minEle) minEle = pt[2];
        if (pt[2] > maxEle) maxEle = pt[2];
      }
    }

    if (minEle === Infinity) { minEle = 0; maxEle = 300; }
    if (minEle === maxEle) { maxEle = minEle + 100; }

    // Account for spherical mercator aspect ratio correction at ~52° lat (Hameln)
    const latRad = ((minLat + maxLat) / 2) * (Math.PI / 180);
    const cosLat = Math.cos(latRad);

    const lonDiff = (maxLon - minLon) * cosLat;
    const latDiff = maxLat - minLat;

    const scaleX = (width - padding * 2) / (lonDiff || 0.01);
    const scaleY = (height - padding * 2) / (latDiff || 0.01);
    const scale = Math.min(scaleX, scaleY);

    const centerX = width / 2;
    const centerY = height / 2;
    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;

    return {
      minLon, maxLon, minLat, maxLat, minEle, maxEle,
      cosLat, scale, centerX, centerY, centerLon, centerLat,
      project(lon, lat) {
        const x = centerX + (lon - centerLon) * cosLat * scale;
        const y = centerY - (lat - centerLat) * scale;
        return [x, y];
      }
    };
  },

  /**
   * Generates SVG path string from coordinates.
   */
  generateSvgPath(coords, proj) {
    if (!this.validCoordinates(coords) || !proj || typeof proj.project !== 'function') return '';
    return coords.map((pt, i) => {
      const [x, y] = proj.project(pt[0], pt[1]);
      return Number.isFinite(x) && Number.isFinite(y) ? `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}` : '';
    }).join(' ');
  },

  /**
   * Generates procedural topographic contour art for backgrounds.
   */
  generateTopoBackground(width, height) {
    const lines = [];
    const step = 45;
    for (let r = 50; r < Math.max(width, height) * 1.5; r += step) {
      const cx = width * 0.45;
      const cy = height * 0.52;
      const rx = r * 1.15;
      const ry = r * 0.85;
      lines.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="currentColor" stroke-opacity="0.06" stroke-width="1.5" stroke-dasharray="12 6" transform="rotate(-15 ${cx} ${cy})" />`);
    }
    return lines.join('');
  },

  /**
   * Renders full interactive track map inside a container.
   */
  renderTrackMap(container, geoJson, route, onHoverPoint) {
    if (!container) return;
    const coords = this.getCoordinates(geoJson);
    if (!coords.length) {
      container.innerHTML = `<div class="empty-map-notice">Keine Track-Koordinaten verfügbar</div>`;
      return;
    }

    const width = 800;
    const height = 500;
    const proj = this.computeBoundsAndScale(coords, width, height, 50);
    const trackPath = this.generateSvgPath(coords, proj);

    // Waypoints markers
    let waypointsSvg = '';
    if (route.waypoints && Array.isArray(route.waypoints)) {
      route.waypoints.forEach((wp, idx) => {
        if (Number.isFinite(wp.lat) && Number.isFinite(wp.lon)) {
          const [x, y] = proj.project(wp.lon, wp.lat);
          const isStart = idx === 0;
          const isEnd = idx === route.waypoints.length - 1;
          const label = this.escape(this.sanitizeWaypointLabel(wp.label || `Wegpunkt ${idx + 1}`));
          const color = isStart ? '#10b981' : isEnd ? '#f43f5e' : '#f3a712';
          const symbol = isStart ? 'S' : isEnd ? 'Z' : idx;

          waypointsSvg += `
            <g class="wp-marker" transform="translate(${x}, ${y})" data-label="${label}">
              <circle r="12" fill="${color}" stroke="#ffffff" stroke-width="2.5" />
              <text y="4" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="700">${symbol}</text>
            </g>
          `;
        }
      });
    }

    // Direction arrows along the path
    let arrowsSvg = '';
    const numArrows = Math.min(10, Math.floor(coords.length / 40));
    for (let i = 1; i <= numArrows; i++) {
      const idx = Math.floor((i * coords.length) / (numArrows + 1));
      const pt = coords[idx];
      const ptNext = coords[Math.min(idx + 5, coords.length - 1)];
      const [x1, y1] = proj.project(pt[0], pt[1]);
      const [x2, y2] = proj.project(ptNext[0], ptNext[1]);
      const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
      arrowsSvg += `
        <polygon points="-5,-4 6,0 -5,4" fill="#f3a712" transform="translate(${x1}, ${y1}) rotate(${angle})" stroke="#1c3829" stroke-width="1" />
      `;
    }

    const svgHtml = `
      <div class="svg-map-wrapper">
        <div class="svg-map-controls">
          <button class="map-ctrl-btn btn-zoom-in" title="Vergrößern">+</button>
          <button class="map-ctrl-btn btn-zoom-out" title="Verkleinern">−</button>
          <button class="map-ctrl-btn btn-map-reset" title="Ansicht zurücksetzen">⊕</button>
          <button class="map-ctrl-btn btn-fullscreen" title="Vollbildmodus">⤢</button>
          <span class="map-scale-badge">${this.escape(route.distance_km)} km • ${this.escape(route.elevation_m)} hm</span>
        </div>
        <svg class="interactive-topo-map" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
          <defs>
            <radialGradient id="mapBgGrad_${this.escape(route.id)}" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stop-color="var(--map-bg-inner, #244835)" stop-opacity="0.4" />
              <stop offset="100%" stop-color="var(--map-bg-outer, #14281d)" stop-opacity="0.9" />
            </radialGradient>
            <filter id="glow_${this.escape(route.id)}" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <rect width="100%" height="100%" fill="url(#mapBgGrad_${this.escape(route.id)})" rx="16" />
          <g class="topo-bg-lines">${this.generateTopoBackground(width, height)}</g>

          <g class="topo-transform-group" transform="matrix(1 0 0 1 0 0)">
            <!-- Shadow/Glow Path -->
            <path d="${trackPath}" fill="none" stroke="#000000" stroke-opacity="0.4" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
            <!-- Main Track Path -->
            <path d="${trackPath}" fill="none" stroke="#ff6b35" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow_${this.escape(route.id)})" />
            <!-- Direction Arrows -->
            <g class="track-arrows">${arrowsSvg}</g>
            <!-- Waypoints -->
            <g class="track-waypoints">${waypointsSvg}</g>
            <!-- Interactive Cursor Dot -->
            <circle class="hover-cursor-dot interaction-marker-hidden" r="7" fill="#ffffff" stroke="#ff6b35" stroke-width="3" />
          </g>
        </svg>
        <div class="map-tooltip interaction-marker-hidden"></div>
      </div>
    `;

    container.innerHTML = svgHtml;
    this.attachMapInteractivity(container, coords, proj, onHoverPoint);
  },

  /**
   * Attaches pan, zoom, and waypoint hover listeners to the rendered map.
   */
  attachMapInteractivity(container, coords, proj, onHoverPoint) {
    const svg = container.querySelector('.interactive-topo-map');
    const transformGroup = container.querySelector('.topo-transform-group');
    const tooltip = container.querySelector('.map-tooltip');
    const cursorDot = container.querySelector('.hover-cursor-dot');
    if (!svg || !transformGroup) return;

    let scale = 1, panX = 0, panY = 0;
    let isDragging = false, startX = 0, startY = 0;

    const updateTransform = () => {
      transformGroup.setAttribute('transform', `matrix(${scale} 0 0 ${scale} ${panX} ${panY})`);
    };

    container.querySelector('.btn-zoom-in')?.addEventListener('click', () => {
      scale = Math.min(5, scale * 1.3);
      updateTransform();
    });

    container.querySelector('.btn-zoom-out')?.addEventListener('click', () => {
      scale = Math.max(0.5, scale / 1.3);
      updateTransform();
    });

    container.querySelector('.btn-map-reset')?.addEventListener('click', () => {
      scale = 1; panX = 0; panY = 0;
      updateTransform();
    });

    container.querySelector('.btn-fullscreen')?.addEventListener('click', () => {
      const wrapper = container.querySelector('.svg-map-wrapper');
      if (!document.fullscreenElement) {
        wrapper.requestFullscreen?.() || wrapper.webkitRequestFullscreen?.();
      } else {
        document.exitFullscreen?.() || document.webkitExitFullscreen?.();
      }
    });

    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newScale = Math.max(0.5, Math.min(5, scale * zoomFactor));
      panX = (panX - 400) * (newScale / scale) + 400;
      panY = (panY - 250) * (newScale / scale) + 250;
      scale = newScale;
      updateTransform();
    });

    svg.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      svg.classList.add('is-dragging');
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging) {
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        updateTransform();
      }
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        svg.classList.remove('is-dragging');
      }
    });

    // Waypoint hover tooltip
    container.querySelectorAll('.wp-marker').forEach(marker => {
      marker.addEventListener('mouseenter', (e) => {
        const label = marker.getAttribute('data-label');
        if (!label) return;
        tooltip.textContent = label;
        tooltip.classList.remove('interaction-marker-hidden');
      });
      marker.addEventListener('mouseleave', () => {
        tooltip.classList.add('interaction-marker-hidden');
      });
    });

    // Track path hover sync
    svg.addEventListener('mousemove', (e) => {
      if (isDragging || !coords.length) return;
      const rect = svg.getBoundingClientRect();
      const mouseSvgX = ((e.clientX - rect.left) * (800 / rect.width) - panX) / scale;
      const mouseSvgY = ((e.clientY - rect.top) * (500 / rect.height) - panY) / scale;

      let closestPt = null;
      let minDist = Infinity;
      let closestIdx = 0;

      for (let i = 0; i < coords.length; i += 2) {
        const [px, py] = proj.project(coords[i][0], coords[i][1]);
        const d = (px - mouseSvgX) ** 2 + (py - mouseSvgY) ** 2;
        if (d < minDist) {
          minDist = d;
          closestPt = [px, py];
          closestIdx = i;
        }
      }

      if (closestPt && minDist < 900) {
        cursorDot.setAttribute('cx', closestPt[0]);
        cursorDot.setAttribute('cy', closestPt[1]);
        cursorDot.classList.remove('interaction-marker-hidden');
        if (typeof onHoverPoint === 'function') {
          onHoverPoint(coords[closestIdx], closestIdx, coords.length);
        }
      } else {
        cursorDot.classList.add('interaction-marker-hidden');
        if (typeof onHoverPoint === 'function') {
          onHoverPoint(null);
        }
      }
    });
  },

  /**
   * Renders the elevation profile SVG chart.
   */
  renderElevationProfile(container, geoJson, route, onHoverIndex) {
    if (!container) return;
    const coords = this.getCoordinates(geoJson);
    if (!coords || coords.length < 2) {
      container.innerHTML = `<div class="empty-profile-notice">Höhenprofil wird geladen...</div>`;
      return;
    }

    const width = 800;
    const height = 180;
    const padding = { top: 25, right: 30, bottom: 30, left: 50 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const distances = [0];
    let totalDist = 0;
    let minEle = Infinity, maxEle = -Infinity;

    for (let i = 0; i < coords.length; i++) {
      const ele = coords[i][2] || 0;
      if (ele < minEle) minEle = ele;
      if (ele > maxEle) maxEle = ele;
      if (i > 0) {
        const dx = (coords[i][0] - coords[i - 1][0]) * Math.cos(((coords[i][1] + coords[i - 1][1]) / 2) * (Math.PI / 180)) * 111.32;
        const dy = (coords[i][1] - coords[i - 1][1]) * 111.32;
        totalDist += Math.sqrt(dx * dx + dy * dy);
        distances.push(totalDist);
      }
    }

    if (minEle === Infinity) { minEle = 0; maxEle = 300; }
    if (maxEle - minEle < 40) { maxEle = minEle + 40; }

    const points = coords.map((pt, i) => {
      const x = padding.left + (distances[i] / (totalDist || 1)) * plotW;
      const ele = pt[2] || minEle;
      const y = padding.top + plotH - ((ele - minEle) / (maxEle - minEle || 1)) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const linePoints = points.join(' ');
    const areaPoints = `${padding.left},${padding.top + plotH} ${linePoints} ${padding.left + plotW},${padding.top + plotH}`;

    let gridSvg = '';
    const eleSteps = 4;
    for (let s = 0; s <= eleSteps; s++) {
      const eleVal = Math.round(minEle + ((maxEle - minEle) / eleSteps) * s);
      const y = padding.top + plotH - (s / eleSteps) * plotH;
      gridSvg += `
        <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="currentColor" stroke-opacity="0.1" stroke-dasharray="4 4" />
        <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="currentColor" opacity="0.7">${eleVal} m</text>
      `;
    }

    const html = `
      <div class="elevation-chart-wrapper">
        <div class="elevation-header">
          <span class="ele-title">Höhenprofil</span>
          <span class="ele-stats">▲ ${this.escape(route.elevation_m)} hm • Tiefster Punkt: ${Math.round(minEle)} m • Höchster Punkt: ${Math.round(maxEle)} m</span>
        </div>
        <svg class="elevation-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
          <defs>
            <linearGradient id="eleGrad_${this.escape(route.id)}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ff6b35" stop-opacity="0.5" />
              <stop offset="100%" stop-color="#ff6b35" stop-opacity="0.05" />
            </linearGradient>
          </defs>
          ${gridSvg}
          <polygon points="${areaPoints}" fill="url(#eleGrad_${this.escape(route.id)})" />
          <polyline points="${linePoints}" fill="none" stroke="#ff6b35" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          <line class="ele-hover-line interaction-marker-hidden" x1="0" y1="${padding.top}" x2="0" y2="${padding.top + plotH}" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="3 3" />
          <circle class="ele-hover-dot interaction-marker-hidden" r="5" fill="#ff6b35" stroke="#ffffff" stroke-width="2" />
        </svg>
        <div class="ele-axis-x">
          <span>0 km</span>
          <span>${(totalDist / 2).toFixed(1)} km</span>
          <span>${this.escape(route.distance_km)} km</span>
        </div>
      </div>
    `;

    container.innerHTML = html;

    const svg = container.querySelector('.elevation-svg');
    const hoverLine = container.querySelector('.ele-hover-line');
    const hoverDot = container.querySelector('.ele-hover-dot');

    svg?.addEventListener('mousemove', (e) => {
      const rect = svg.getBoundingClientRect();
      const relX = (e.clientX - rect.left) * (width / rect.width);
      const ratio = Math.max(0, Math.min(1, (relX - padding.left) / plotW));
      const targetDist = ratio * totalDist;

      let idx = 0;
      for (let i = 0; i < distances.length; i++) {
        if (distances[i] >= targetDist) { idx = i; break; }
      }

      const [ptX, ptY] = points[idx].split(',').map(Number);
      hoverLine.setAttribute('x1', ptX);
      hoverLine.setAttribute('x2', ptX);
      hoverLine.classList.remove('interaction-marker-hidden');
      hoverDot.setAttribute('cx', ptX);
      hoverDot.setAttribute('cy', ptY);
      hoverDot.classList.remove('interaction-marker-hidden');

      if (typeof onHoverIndex === 'function') {
        onHoverIndex(coords[idx], idx, coords.length);
      }
    });

    svg?.addEventListener('mouseleave', () => {
      hoverLine.classList.add('interaction-marker-hidden');
      hoverDot.classList.add('interaction-marker-hidden');
      if (typeof onHoverIndex === 'function') {
        onHoverIndex(null);
      }
    });
  },

  /**
   * Generates a high-quality local CSS/SVG Map Composition for routes without photos.
   */
  renderTopoPoster(container, geoJson, route) {
    if (!container) return;
    const coords = this.getCoordinates(geoJson);
    const width = 1000;
    const height = 450;
    const proj = this.computeBoundsAndScale(coords, width, height, 60);
    const trackPath = proj ? this.generateSvgPath(coords, proj) : '';

    const score = route.scores ? Math.round(
      (route.scores.scenery * 0.25) +
      (route.scores.trail * 0.18) +
      (route.scores.low_traffic * 0.17) +
      (route.scores.emtb_fun * 0.16) +
      (route.scores.viewpoints * 0.12) +
      (route.scores.loop_quality * 0.07) +
      ((route.scores.surface_confidence || 80) * 0.05)
    ) : Math.round(route.score || 80);

    const html = `
      <div class="topo-poster-card">
        <svg class="topo-poster-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="posterGrad_${this.escape(route.id)}" cx="70%" cy="40%" r="80%">
              <stop offset="0%" stop-color="#1e4431" />
              <stop offset="60%" stop-color="#14281d" />
              <stop offset="100%" stop-color="#0e1a13" />
            </radialGradient>
            <filter id="posterGlow_${this.escape(route.id)}" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <pattern id="gridPattern_${this.escape(route.id)}" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" stroke-opacity="0.05" stroke-width="1" />
            </pattern>
          </defs>

          <rect width="100%" height="100%" fill="url(#posterGrad_${this.escape(route.id)})" />
          <rect width="100%" height="100%" fill="url(#gridPattern_${this.escape(route.id)})" />
          <g class="topo-lines-art">${this.generateTopoBackground(width, height)}</g>

          <!-- Track Art -->
          ${trackPath ? `
            <path d="${trackPath}" fill="none" stroke="#000000" stroke-opacity="0.5" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />
            <path d="${trackPath}" fill="none" stroke="#ff6b35" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#posterGlow_${this.escape(route.id)})" />
          ` : ''}

          <!-- Editorial Overlay Badge -->
          <g transform="translate(40, 50)">
            <rect width="320" height="150" rx="12" fill="#14281d" fill-opacity="0.85" stroke="#2d5a41" stroke-width="1.5" />
            <text x="24" y="38" fill="#ff6b35" font-size="12" font-weight="700" letter-spacing="2">TOPOGRAFISCHE TRAIL-KOMPOSITION</text>
            <text x="24" y="68" fill="#ffffff" font-size="20" font-weight="800">${this.escape(route.name)}</text>
            <text x="24" y="94" fill="#e8e4dc" font-size="14" opacity="0.8">${this.escape(route.region)}</text>
            <text x="24" y="125" fill="#10b981" font-size="14" font-weight="600">${this.escape(route.distance_km)} km · ▲ ${this.escape(route.elevation_m)} hm · Score ${this.escape(score)}</text>
          </g>
        </svg>
        <div class="poster-footer-note">
          <span>Echte Streckengrafik aus GeoJSON-Topografie</span>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }
};

if (typeof window !== 'undefined') window.SvgMapEngine = SvgMapEngine;
if (typeof module !== 'undefined' && module.exports) module.exports = { SvgMapEngine };
