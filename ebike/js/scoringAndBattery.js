/**
 * scoringAndBattery.js
 * Handles Domse's custom E-MTB scoring formulas, battery estimation models, and route filtering logic.
 */

const ScoringAndBattery = {
  escape(value) {
    const security = (typeof globalThis !== 'undefined' && globalThis.EbikeSecurity) || {};
    return security.escapeHtml ? security.escapeHtml(value) : String(value == null ? '' : value).replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  },
  /**
   * Computes exact composite Domse E-MTB score from scores object according to formula:
   * 0.25 Scenery + 0.18 Trail + 0.17 LowTraffic + 0.16 eMTBFun + 0.12 Viewpoints + 0.07 LoopQuality + 0.05 SurfaceConfidence
   */
  computeScore(route) {
    if (route.scores) {
      const s = route.scores;
      const val = (s.scenery || 0) * 0.25 +
                  (s.trail || 0) * 0.18 +
                  (s.low_traffic || 0) * 0.17 +
                  (s.emtb_fun || 0) * 0.16 +
                  (s.viewpoints || 0) * 0.12 +
                  (s.loop_quality || 0) * 0.07 +
                  ((s.surface_confidence || 80) * 0.05);
      return Math.round(val * 10) / 10;
    }
    return route.score || 80;
  },

  /**
   * Renders the score breakdown bars with editorial styling.
   */
  renderScoreBreakdown(route) {
    const s = route.scores || {};
    const items = [
      { key: 'scenery', label: 'Natur & Schönheit', val: s.scenery || 80, weight: '25%' },
      { key: 'trail', label: 'Trail & Waldweg', val: s.trail || 70, weight: '18%' },
      { key: 'traffic', label: 'Wenig Verkehr / Ruhe', val: s.low_traffic || 80, weight: '17%' },
      { key: 'emtb', label: 'E-MTB Spaßfaktor', val: s.emtb_fun || 75, weight: '16%' },
      { key: 'views', label: 'Aussicht & Highlights', val: s.viewpoints || 80, weight: '12%' },
      { key: 'loop', label: 'Rundkursqualität', val: s.loop_quality || 85, weight: '7%' },
      { key: 'confidence', label: 'Datenvertrauen', val: s.surface_confidence || 80, weight: '5%' }
    ];

    const total = this.computeScore(route);

    return `
      <div class="score-breakdown-card">
        <div class="score-breakdown-header">
          <div>
            <span class="score-label-sub">Domse E-MTB Schönheits- / Spaßscore</span>
            <h4 class="score-formula-title">Gewichteter Gesamteindruck</h4>
          </div>
          <div class="score-badge-large">
            <span class="score-number">${total}</span>
            <span class="score-max">/ 100</span>
          </div>
        </div>
        <div class="score-bars-list">
          ${items.map(it => `
            <div class="score-bar-row">
              <div class="score-bar-info">
                <span class="score-item-name"><span class="score-color-dot score-color-${it.key}"></span>${it.label} <small>(${it.weight})</small></span>
                <span class="score-item-val">${it.val} Pkt.</span>
              </div>
              <progress class="score-bar-progress score-color-${it.key}" max="100" value="${Math.max(0, Math.min(100, Number(it.val) || 0))}"></progress>
            </div>
          `).join('')}
        </div>
        <p class="score-formula-footnote">
          Formel: 0.25 Natur + 0.18 Trail + 0.17 Ruhe + 0.16 E-MTB + 0.12 Aussicht + 0.07 Rundkurs + 0.05 Vertrauen
        </p>
      </div>
    `;
  },

  /**
   * Renders battery calculation estimates for Bergamont Revox Sport 10.
   */
  renderBatteryCalculator(route) {
    const bm = route.battery_model || {
      eco: Math.round(route.distance_km * 0.75),
      tour: Math.round(route.distance_km * 0.95),
      emtb: Math.round(route.distance_km * 1.25),
      turbo: Math.round(route.distance_km * 1.6),
      reserve_percent: 15
    };

    return `
      <div class="battery-calc-card">
        <div class="battery-calc-header">
          <div>
            <h4 class="battery-title">Akku-Verbrauchsschätzung</h4>
            <span class="battery-subtitle">Bergamont Revox Sport 10 (${this.escape(route.bike_profile || 'MTB/E-MTB')})</span>
          </div>
        </div>
        <div class="battery-modes-grid">
          <div class="battery-mode-item mode-eco">
            <span class="mode-name">Eco</span>
            <span class="mode-percent">ca. ${bm.eco}%</span>
            <progress class="battery-progress mode-eco-progress" max="100" value="${Math.max(0, Math.min(100, Number(bm.eco) || 0))}"></progress>
          </div>
          <div class="battery-mode-item mode-tour">
            <span class="mode-name">Tour</span>
            <span class="mode-percent">ca. ${bm.tour}%</span>
            <progress class="battery-progress mode-tour-progress" max="100" value="${Math.max(0, Math.min(100, Number(bm.tour) || 0))}"></progress>
          </div>
          <div class="battery-mode-item mode-emtb">
            <span class="mode-name">eMTB</span>
            <span class="mode-percent">ca. ${bm.emtb}%</span>
            <progress class="battery-progress mode-emtb-progress" max="100" value="${Math.max(0, Math.min(100, Number(bm.emtb) || 0))}"></progress>
          </div>
          <div class="battery-mode-item mode-turbo">
            <span class="mode-name">Turbo</span>
            <span class="mode-percent">ca. ${bm.turbo}%</span>
            <progress class="battery-progress mode-turbo-progress" max="100" value="${Math.max(0, Math.min(100, Number(bm.turbo) || 0))}"></progress>
          </div>
        </div>
        <div class="battery-footer-note">
          <span>${this.escape(bm.note || 'Planwert für Bosch-/Shimano E-MTB; Kälte, Reifendruck und Untergrund beeinflussen den realen Verbrauch.')} Reserve-Empfehlung: min. ${this.escape(bm.reserve_percent || 15)}%</span>
        </div>
      </div>
    `;
  },

  /**
   * Filters and sorts routes based on current active criteria.
   */
  filterRoutes(routes, criteria) {
    if (!routes || !Array.isArray(routes)) return [];

    return routes.filter(r => {
      // 1. Spontaneous / Time mood filter
      if (criteria.mood && criteria.mood !== 'alle') {
        const typeStr = (r.type || '').toLowerCase();
        const tags = (r.decision_tags || []).join(' ').toLowerCase();
        const dur = (r.duration || '').toLowerCase();

        if (criteria.mood === 'feierabend') {
          const isMatch = typeStr.includes('feierabend') || tags.includes('kurzes zeitfenster') || dur.includes('1,') || r.distance_km <= 25;
          if (!isMatch) return false;
        } else if (criteria.mood === 'kurz') {
          const isMatch = typeStr.includes('kurz') || r.distance_km <= 32 || dur.includes('2,');
          if (!isMatch) return false;
        } else if (criteria.mood === 'halbtag') {
          const isMatch = typeStr.includes('halbtag') || typeStr.includes('wochenend') || (r.distance_km > 30 && r.distance_km <= 55);
          if (!isMatch) return false;
        } else if (criteria.mood === 'tagestour') {
          const isMatch = typeStr.includes('tagestour') || r.distance_km > 55;
          if (!isMatch) return false;
        }
      }

      // 2. Bike Profile filter (MTB/E-MTB vs normales E-Bike)
      if (criteria.bikeProfile && criteria.bikeProfile !== 'alle') {
        const style = (r.ride_style || '').toLowerCase();
        const profile = (r.bike_profile || '').toLowerCase();

        if (criteria.bikeProfile === 'mtb') {
          const isMtb = style === 'mtb' || style === 'sport' || profile.includes('mtb');
          if (!isMtb) return false;
        } else if (criteria.bikeProfile === 'ebike') {
          const isEbike = style === 'ebike' || style === 'tour' || profile.includes('normales') || profile.includes('trekking');
          if (!isEbike) return false;
        }
      }

      // 3. Difficulty filter
      if (criteria.difficulty && criteria.difficulty !== 'alle') {
        const diff = (r.difficulty || '').toLowerCase();
        if (!diff.includes(criteria.difficulty.toLowerCase())) return false;
      }

      // 4. Search text filter
      if (criteria.search) {
        const q = criteria.search.toLowerCase().trim();
        const nameMatch = (r.name || '').toLowerCase().includes(q);
        const regMatch = (r.region || '').toLowerCase().includes(q);
        const bestMatch = (r.best_for || '').toLowerCase().includes(q);
        const hiMatch = (r.highlights || []).some(h => h.toLowerCase().includes(q));
        if (!nameMatch && !regMatch && !bestMatch && !hiMatch) return false;
      }

      return true;
    }).sort((a, b) => {
      if (criteria.sort === 'score_desc') {
        return this.computeScore(b) - this.computeScore(a);
      } else if (criteria.sort === 'dist_asc') {
        return a.distance_km - b.distance_km;
      } else if (criteria.sort === 'dist_desc') {
        return b.distance_km - a.distance_km;
      } else if (criteria.sort === 'elev_desc') {
        return b.elevation_m - a.elevation_m;
      }
      return this.computeScore(b) - this.computeScore(a);
    });
  }
};

if (typeof window !== 'undefined') window.ScoringAndBattery = ScoringAndBattery;
if (typeof module !== 'undefined' && module.exports) module.exports = { ScoringAndBattery };
