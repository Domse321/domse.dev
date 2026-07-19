/**
 * app.js
 * Main entry point and orchestrator for the Domse E-Bike Trail & Sport App.
 * Manages state, routing, dynamic views, and integrates local modules.
 */

const _SvgMapEngine = (typeof window !== 'undefined' && window.SvgMapEngine) || (typeof global !== 'undefined' && global.SvgMapEngine) || (typeof SvgMapEngine !== 'undefined' ? SvgMapEngine : {});
const _ScoringAndBattery = (typeof window !== 'undefined' && window.ScoringAndBattery) || (typeof global !== 'undefined' && global.ScoringAndBattery) || (typeof ScoringAndBattery !== 'undefined' ? ScoringAndBattery : {});
const _StorageAndLog = (typeof window !== 'undefined' && window.StorageAndLog) || (typeof global !== 'undefined' && global.StorageAndLog) || (typeof StorageAndLog !== 'undefined' ? StorageAndLog : {});
const _Security = (typeof window !== 'undefined' && window.EbikeSecurity) || (typeof globalThis !== 'undefined' && globalThis.EbikeSecurity) || {};
const h = value => _Security.escapeHtml(value);

// Application State
const AppState = {
  allRoutes: [],
  bikeInfo: null,
  scoringModel: null,
  activeFilter: {
    mood: 'alle',       // 'alle', 'feierabend', 'kurz', 'halbtag', 'tagestour'
    bikeProfile: 'alle',// 'alle', 'mtb', 'ebike'
    difficulty: 'alle', // 'alle', 'leicht', 'mittel', 'sportlich'
    search: '',
    sort: 'score_desc',
    showOnlyFavs: false
  },
  currentRouteId: null,
  currentTab: 'ebike', // 'ebike' | 'sport'
  theme: (typeof localStorage !== 'undefined' && localStorage.getItem('domse_theme_v1')) || 'light',
  visibleCardCount: 6  // Critique (3): curated initial set
};

const ImageViewerState = {
  items: [],
  index: 0,
  scale: 1,
  panX: 0,
  panY: 0,
  pointers: new Map(),
  dragOrigin: null,
  pinchDistance: 0,
  pinchScale: 1,
  transformAnimation: null,
  previousFocus: null
};

// Initialize Application
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    setupHeaderEvents();
    setupMobileDockEvents();
    setupModalEvents();
    setupImageViewerEvents();

    if (!await loadRoutesData()) return;

    // Listen to storage/log updates
    _StorageAndLog.subscribe('favorites', updateHeaderCounters);
    _StorageAndLog.subscribe('compare', updateHeaderCounters);
    updateHeaderCounters();

    // Route hash listener
    window.addEventListener('hashchange', handleHashRouting);
    handleHashRouting();
  });
}

/**
 * Initializes visual theme (daylight or alpenglow dark mode).
 */
function initTheme() {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', AppState.theme);
  const toggleBtn = document.getElementById('btnToggleTheme');
  if (toggleBtn) {
    const svg = AppState.theme === 'dark'
      ? '<svg class="icon-theme" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/></svg>'
      : '<svg class="icon-theme" viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>';
    toggleBtn.innerHTML = svg;
  }
}

function toggleTheme() {
  AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('domse_theme_v1', AppState.theme);
  }
  initTheme();
}

/**
 * Loads data/routes.json and initializes routes array.
 */
async function loadRoutesData() {
  try {
    const resp = await fetch('data/routes.json');
    if (!resp.ok) throw new Error('Could not load routes.json');
    const data = await resp.json();
    if (!_Security.validateRouteCatalog(data)) throw new Error('Invalid route catalog');
    AppState.allRoutes = data.routes;
    AppState.bikeInfo = data.bike || null;
    AppState.scoringModel = data.scoring_model || null;
    return true;
  } catch (err) {
    console.error('Error loading routes data:', err);
    const mainEl = document.getElementById('appMain');
    if (mainEl) {
      mainEl.innerHTML = `
        <div class="error-notice-card data-load-error">
          <h3>Fehler beim Laden der Streckendaten</h3>
          <p>Bitte überprüfe, ob die App über einen lokalen Webserver (z.B. python3 -m http.server) gestartet wurde und data/routes.json vorhanden ist.</p>
        </div>
      `;
    }
    return false;
  }
}

/**
 * Header counter updates for compare list and favorites.
 */
function updateHeaderCounters() {
  if (typeof document === 'undefined') return;
  const compareCount = _StorageAndLog.getCompareList().length;
  const favCount = _StorageAndLog.getFavorites().length;

  const comparePill = document.getElementById('compareCountPill');
  const favPill = document.getElementById('favCountPill');

  if (comparePill) comparePill.textContent = compareCount;
  if (favPill) favPill.textContent = favCount;
}

/**
 * Sets up global header events (Nav links, Compare pill, Fav pill, Theme toggle).
 */
function setupHeaderEvents() {
  if (typeof document === 'undefined') return;
  document.getElementById('btnToggleTheme')?.addEventListener('click', toggleTheme);

  document.getElementById('btnOpenCompare')?.addEventListener('click', () => {
    openCompareModal();
  });

  document.getElementById('btnFilterFavs')?.addEventListener('click', () => {
    AppState.activeFilter.showOnlyFavs = !AppState.activeFilter.showOnlyFavs;
    const btn = document.getElementById('btnFilterFavs');
    if (btn) btn.classList.toggle('favorite-filter-active', AppState.activeFilter.showOnlyFavs);
    if (window.location.hash.startsWith('#/tour/') || window.location.hash.includes('sport')) {
      window.location.hash = '#/ebike';
    } else {
      renderEbikeExplorerView();
    }
  });
}

/**
 * Sets up mobile bottom dock event handlers (Rule 7).
 */
function setupMobileDockEvents() {
  if (typeof document === 'undefined') return;
  const dockBtns = document.querySelectorAll('#mobileDock .dock-btn');
  dockBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      dockBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (target === 'spontan') {
        window.location.hash = '#/ebike';
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 50);
      } else if (target === 'ebike') {
        window.location.hash = '#/ebike';
      } else if (target === 'compare') {
        openCompareModal();
      } else if (target === 'sport') {
        window.location.hash = '#/sport';
      }
    });
  });
}

function closeCompareModal() {
  if (typeof document === 'undefined') return;
  document.getElementById('compareModalOverlay')?.classList.remove('open');
  document.body.classList.remove('modal-open');
}

/**
 * Sets up comparison modal events.
 */
function setupModalEvents() {
  if (typeof document === 'undefined') return;
  const overlay = document.getElementById('compareModalOverlay');
  document.getElementById('btnCloseCompare')?.addEventListener('click', closeCompareModal);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeCompareModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay?.classList.contains('open')) closeCompareModal();
  });
}

function clampImageViewerScale(value) {
  return Math.min(5, Math.max(1, Number(value) || 1));
}

function applyImageViewerTransform() {
  if (typeof document === 'undefined') return;
  const image = document.getElementById('imageViewerImage');
  const stage = document.getElementById('imageViewerStage');
  const canvas = stage?.querySelector('.image-viewer-canvas');
  if (!image || !stage || !canvas) return;

  ImageViewerState.scale = clampImageViewerScale(ImageViewerState.scale);
  if (ImageViewerState.scale === 1) {
    ImageViewerState.panX = 0;
    ImageViewerState.panY = 0;
  } else {
    const maxX = canvas.clientWidth * (ImageViewerState.scale - 1) / 2;
    const maxY = canvas.clientHeight * (ImageViewerState.scale - 1) / 2;
    ImageViewerState.panX = Math.max(-maxX, Math.min(maxX, ImageViewerState.panX));
    ImageViewerState.panY = Math.max(-maxY, Math.min(maxY, ImageViewerState.panY));
  }

  const transform = `translate3d(${ImageViewerState.panX}px, ${ImageViewerState.panY}px, 0) scale(${ImageViewerState.scale})`;
  ImageViewerState.transformAnimation?.cancel();
  ImageViewerState.transformAnimation = image.animate(
    [{ transform }, { transform }],
    { duration: 1, fill: 'forwards' }
  );
  image.classList.toggle('is-zoomed', ImageViewerState.scale > 1);
  stage.dataset.zoom = ImageViewerState.scale.toFixed(2);
  stage.dataset.panX = Math.round(ImageViewerState.panX).toString();
  stage.dataset.panY = Math.round(ImageViewerState.panY).toString();
  const output = document.getElementById('imageViewerZoom');
  if (output) output.textContent = `${Math.round(ImageViewerState.scale * 100)} %`;
}

function setImageViewerScale(nextScale) {
  ImageViewerState.scale = clampImageViewerScale(nextScale);
  applyImageViewerTransform();
}

function resetImageViewerTransform() {
  ImageViewerState.scale = 1;
  ImageViewerState.panX = 0;
  ImageViewerState.panY = 0;
  applyImageViewerTransform();
}

function renderImageViewerItem() {
  if (typeof document === 'undefined' || ImageViewerState.items.length === 0) return;
  const item = ImageViewerState.items[ImageViewerState.index];
  const image = document.getElementById('imageViewerImage');
  const title = document.getElementById('imageViewerTitle');
  const counter = document.getElementById('imageViewerCounter');
  const previous = document.getElementById('btnImageViewerPrev');
  const next = document.getElementById('btnImageViewerNext');
  if (!image || !title || !counter) return;

  resetImageViewerTransform();
  title.textContent = item.title;
  counter.textContent = `Bild ${ImageViewerState.index + 1} von ${ImageViewerState.items.length}`;
  image.alt = item.title;
  image.classList.add('is-loading');
  image.classList.remove('is-error');
  image.src = item.safeUrl;
  const single = ImageViewerState.items.length < 2;
  if (previous) previous.hidden = single;
  if (next) next.hidden = single;
}

function openImageViewer(items, index, opener) {
  if (typeof document === 'undefined' || !Array.isArray(items) || items.length === 0) return;
  const overlay = document.getElementById('imageViewerOverlay');
  if (!overlay) return;
  ImageViewerState.items = items.map(item => ({ safeUrl: item.safeUrl, title: String(item.title || 'Tourenbild') }));
  ImageViewerState.index = Math.max(0, Math.min(ImageViewerState.items.length - 1, Number(index) || 0));
  ImageViewerState.previousFocus = opener || document.activeElement;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  renderImageViewerItem();
  document.getElementById('btnImageViewerClose')?.focus();
}

function closeImageViewer() {
  if (typeof document === 'undefined') return;
  const overlay = document.getElementById('imageViewerOverlay');
  if (!overlay?.classList.contains('open')) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  ImageViewerState.pointers.clear();
  if (!document.getElementById('compareModalOverlay')?.classList.contains('open')) document.body.classList.remove('modal-open');
  ImageViewerState.previousFocus?.focus?.();
}

function moveImageViewer(step) {
  if (ImageViewerState.items.length < 2) return;
  ImageViewerState.index = (ImageViewerState.index + step + ImageViewerState.items.length) % ImageViewerState.items.length;
  renderImageViewerItem();
}

function pointerDistance(points) {
  const [first, second] = points;
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function setupImageViewerEvents() {
  if (typeof document === 'undefined') return;
  const overlay = document.getElementById('imageViewerOverlay');
  const stage = document.getElementById('imageViewerStage');
  const image = document.getElementById('imageViewerImage');
  if (!overlay || !stage || !image) return;

  document.getElementById('btnImageViewerClose')?.addEventListener('click', closeImageViewer);
  document.getElementById('btnImageViewerPrev')?.addEventListener('click', () => moveImageViewer(-1));
  document.getElementById('btnImageViewerNext')?.addEventListener('click', () => moveImageViewer(1));
  document.getElementById('btnImageZoomIn')?.addEventListener('click', () => setImageViewerScale(ImageViewerState.scale + 0.5));
  document.getElementById('btnImageZoomOut')?.addEventListener('click', () => setImageViewerScale(ImageViewerState.scale - 0.5));
  document.getElementById('btnImageZoomReset')?.addEventListener('click', resetImageViewerTransform);
  image.addEventListener('load', () => image.classList.remove('is-loading'));
  image.addEventListener('error', () => {
    image.classList.remove('is-loading');
    image.classList.add('is-error');
  });
  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeImageViewer();
  });
  stage.addEventListener('wheel', event => {
    if (!overlay.classList.contains('open')) return;
    event.preventDefault();
    setImageViewerScale(ImageViewerState.scale + (event.deltaY < 0 ? 0.25 : -0.25));
  }, { passive: false });
  stage.addEventListener('dblclick', event => {
    if (event.target.closest('button')) return;
    setImageViewerScale(ImageViewerState.scale > 1 ? 1 : 2);
  });
  stage.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;
    stage.setPointerCapture?.(event.pointerId);
    ImageViewerState.pointers.set(event.pointerId, event);
    if (ImageViewerState.pointers.size === 1) {
      ImageViewerState.dragOrigin = { x: event.clientX - ImageViewerState.panX, y: event.clientY - ImageViewerState.panY };
    } else if (ImageViewerState.pointers.size === 2) {
      ImageViewerState.pinchDistance = pointerDistance([...ImageViewerState.pointers.values()]);
      ImageViewerState.pinchScale = ImageViewerState.scale;
    }
  });
  stage.addEventListener('pointermove', event => {
    if (!ImageViewerState.pointers.has(event.pointerId)) return;
    event.preventDefault();
    ImageViewerState.pointers.set(event.pointerId, event);
    const points = [...ImageViewerState.pointers.values()];
    if (points.length === 2 && ImageViewerState.pinchDistance > 0) {
      setImageViewerScale(ImageViewerState.pinchScale * pointerDistance(points) / ImageViewerState.pinchDistance);
    } else if (points.length === 1 && ImageViewerState.scale > 1 && ImageViewerState.dragOrigin) {
      ImageViewerState.panX = event.clientX - ImageViewerState.dragOrigin.x;
      ImageViewerState.panY = event.clientY - ImageViewerState.dragOrigin.y;
      applyImageViewerTransform();
    }
  });
  const releasePointer = event => {
    ImageViewerState.pointers.delete(event.pointerId);
    if (ImageViewerState.pointers.size === 1) {
      const remaining = [...ImageViewerState.pointers.values()][0];
      ImageViewerState.dragOrigin = { x: remaining.clientX - ImageViewerState.panX, y: remaining.clientY - ImageViewerState.panY };
    } else if (ImageViewerState.pointers.size === 0) {
      ImageViewerState.dragOrigin = null;
      ImageViewerState.pinchDistance = 0;
    }
  };
  stage.addEventListener('pointerup', releasePointer);
  stage.addEventListener('pointercancel', releasePointer);
  document.addEventListener('keydown', event => {
    if (!overlay.classList.contains('open')) return;
    if (event.key === 'Escape') closeImageViewer();
    else if (event.key === 'ArrowLeft') moveImageViewer(-1);
    else if (event.key === 'ArrowRight') moveImageViewer(1);
    else if (event.key === '+' || event.key === '=') setImageViewerScale(ImageViewerState.scale + 0.5);
    else if (event.key === '-') setImageViewerScale(ImageViewerState.scale - 0.5);
    else if (event.key === '0') resetImageViewerTransform();
  });
}

/**
 * Router handling via URL hash changes.
 */
function handleHashRouting() {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash || '#/ebike';
  const navEbike = document.getElementById('navEbike');
  const navSport = document.getElementById('navSport');

  if (hash.startsWith('#/tour/')) {
    cardTrackLoadController?.abort();
    let encodedId = hash.slice('#/tour/'.length);
    try { encodedId = decodeURIComponent(encodedId); } catch (_) { encodedId = ''; }
    const routeId = _Security.safeRouteId(encodedId.trim(), AppState.allRoutes.map(route => route.id));
    if (!routeId) {
      AppState.currentRouteId = null;
      renderUnknownRouteView();
      return;
    }
    AppState.currentRouteId = routeId;
    if (navEbike) navEbike.classList.add('active');
    if (navSport) navSport.classList.remove('active');
    renderTourDetailView(routeId);
  } else if (hash.startsWith('#/sport')) {
    cardTrackLoadController?.abort();
    AppState.currentRouteId = null;
    AppState.currentTab = 'sport';
    if (navEbike) navEbike.classList.remove('active');
    if (navSport) navSport.classList.add('active');
    updateMobileDockActive('sport');
    renderSportAndLogView();
  } else {
    // Default E-Bike Explorer
    AppState.currentRouteId = null;
    AppState.currentTab = 'ebike';
    if (navEbike) navEbike.classList.add('active');
    if (navSport) navSport.classList.remove('active');
    updateMobileDockActive('ebike');
    renderEbikeExplorerView();
  }
}

function renderUnknownRouteView() {
  const main = document.getElementById('appMain');
  if (!main) return;
  main.replaceChildren();
  const card = document.createElement('div');
  card.className = 'error-notice-card route-not-found';
  const title = document.createElement('h3');
  title.textContent = 'Tour nicht gefunden.';
  const back = document.createElement('a');
  back.href = '#/ebike';
  back.className = 'btn-toolbar-main route-not-found-back';
  back.textContent = '← Zurück zur Tourenübersicht';
  card.append(title, back);
  main.append(card);
}

function updateMobileDockActive(tab) {
  if (typeof document === 'undefined') return;
  const dockBtns = document.querySelectorAll('#mobileDock .dock-btn');
  dockBtns.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-target') === tab);
  });
}

/**
 * Picks a featured tour for the hero section — top-scoring route with imagery.
 */
function pickFeaturedTour() {
  const withGallery = AppState.allRoutes.filter(r => r.gallery && r.gallery.length > 0);
  if (withGallery.length === 0) return AppState.allRoutes[0] || null;
  withGallery.sort((a, b) => _ScoringAndBattery.computeScore(b) - _ScoringAndBattery.computeScore(a));
  return withGallery[0];
}

/**
 * Generates a mini SVG track preview for route cards — Critique (4).
 */
function renderCardTrackSvg(route) {
  const trackFile = _Security.safeDataFile(route.track_geojson_file || `tracks/${h(route.id)}.geojson`, 'track');
  if (!trackFile) return '';
  // Returns a placeholder that will be lazily loaded
  return `<div class="card-track-poster" data-track="${h(trackFile)}" data-route-id="${h(route.id)}">
    <svg class="card-track-svg" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="cbg_${h(route.id)}" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stop-color="#1e4431" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="#0e1a13" stop-opacity="0.95"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#cbg_${h(route.id)})"/>
      <text x="200" y="115" text-anchor="middle" fill="#2d5a41" font-size="11" font-weight="600" letter-spacing="3">STRECKENKARTE</text>
    </svg>
  </div>`;
}

/**
 * Lazily loads track previews for visible cards — Critique (4).
 */
let cardTrackLoadController = null;

async function lazyLoadCardTracks(signal) {
  const posters = document.querySelectorAll('.card-track-poster[data-track]');
  for (const poster of posters) {
    const trackFile = poster.getAttribute('data-track');
    const routeId = poster.getAttribute('data-route-id');
    const safeTrack = _Security.safeDataFile(trackFile, 'track');
    if (!safeTrack || poster.classList.contains('loaded')) continue;
    poster.classList.add('loaded');

    try {
      const geoJson = await _SvgMapEngine.fetchTrack(safeTrack, { signal, purpose: 'preview' });
      if (signal?.aborted || !poster.isConnected) return;
      if (!geoJson) continue;
      const coords = _SvgMapEngine.getCoordinates(geoJson);
      if (!coords || coords.length < 2) continue;

      const width = 400, height = 220;
      const proj = _SvgMapEngine.computeBoundsAndScale(coords, width, height, 30);
      if (!proj) continue;
      const trackPath = _SvgMapEngine.generateSvgPath(coords, proj);
      const topo = _SvgMapEngine.generateTopoBackground(width, height);

      poster.querySelector('.card-track-svg').innerHTML = `
        <defs>
          <radialGradient id="cbg_${h(routeId)}" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stop-color="#1e4431" stop-opacity="0.6"/>
            <stop offset="100%" stop-color="#0e1a13" stop-opacity="0.95"/>
          </radialGradient>
          <filter id="cglow_${h(routeId)}" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#cbg_${h(routeId)})"/>
        <g opacity="0.5">${topo}</g>
        <path d="${trackPath}" fill="none" stroke="#000" stroke-opacity="0.4" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${trackPath}" fill="none" stroke="#ff6b35" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" filter="url(#cglow_${h(routeId)})"/>
      `;
    } catch (e) {
      // silently continue
    }
  }
}

/* =========================================================================
 * VIEW 1: E-BIKE EXPLORER WITH IMMERSIVE HERO & CURATED CARDS
 * ========================================================================= */
function renderEbikeExplorerView() {
  if (typeof document === 'undefined') return;
  const main = document.getElementById('appMain');
  if (!main) return;
  cardTrackLoadController?.abort();
  cardTrackLoadController = new AbortController();
  const cardTrackSignal = cardTrackLoadController.signal;

  // Filter routes using ScoringAndBattery
  let routes = _ScoringAndBattery.filterRoutes(AppState.allRoutes, AppState.activeFilter);
  if (AppState.activeFilter.showOnlyFavs) {
    const favs = _StorageAndLog.getFavorites();
    routes = routes.filter(r => favs.includes(r.id));
  }

  // Critique (3): curated set with load-more
  const hasActiveFilter = AppState.activeFilter.mood !== 'alle' ||
    AppState.activeFilter.bikeProfile !== 'alle' ||
    AppState.activeFilter.difficulty !== 'alle' ||
    AppState.activeFilter.search.trim() !== '' ||
    AppState.activeFilter.showOnlyFavs;
  const showAll = hasActiveFilter;
  const visibleCount = showAll ? routes.length : Math.min(AppState.visibleCardCount, routes.length);
  const visibleRoutes = routes.slice(0, visibleCount);
  const hasMore = visibleCount < routes.length;

  // Critique (2): Immersive hero with featured tour
  const featured = pickFeaturedTour();
  const featuredImg = featured && featured.gallery && featured.gallery.length > 0 ? _Security.safeExternalUrl(featured.gallery[0].url, 'gallery') : '';
  const featuredScore = featured ? _ScoringAndBattery.computeScore(featured) : 0;

  const html = `
    <!-- Critique (2): Immersive editorial hero with featured-tour action -->
    <section class="hero-immersive">
      <div class="hero-image-layer">
        ${featuredImg ? `<img src="${h(featuredImg)}" alt="${h(featured ? featured.name : '')}" class="hero-bg-img" loading="eager">` : ''}
        <div class="hero-overlay"></div>
      </div>
      <div class="hero-content-layer">
        <div class="hero-text-block">
          <span class="hero-eyebrow">Weserbergland Trail Archiv</span>
          <h1 class="hero-title">Entdecke 30 E-Bike &amp; Trail Strecken</h1>
          <p class="hero-subtitle">Von der schnellen Feierabendrunde am Klüt bis zur epischen Deister-Tagestour — dein persönliches Streckenbuch für Hameln und Umgebung.</p>
        </div>
        ${featured ? `
        <div class="hero-featured-card">
          <span class="hero-featured-label">Empfohlene Tour</span>
          <h2 class="hero-featured-name">${h(featured.name)}</h2>
          <div class="hero-featured-stats">
            <span>${h(featured.distance_km)} km</span>
            <span class="stat-sep">·</span>
            <span>▲ ${h(featured.elevation_m)} hm</span>
            <span class="stat-sep">·</span>
            <span>${h(featured.duration || '2–3 h')}</span>
            <span class="stat-sep">·</span>
            <span>★ ${featuredScore}</span>
          </div>
          <a href="#/tour/${h(featured.id)}" class="hero-featured-btn">Tour öffnen →</a>
        </div>
        ` : ''}
      </div>
    </section>

    <!-- Bike Profile Toggle -->
    <div class="profile-switcher-wrap">
      <div class="bike-profile-switcher" role="group" aria-label="Fahrrad-Profil Auswahl">
        <button class="profile-tab-btn ${AppState.activeFilter.bikeProfile === 'alle' ? 'active' : ''}" data-profile="alle">
          <span>Alle Strecken</span>
        </button>
        <button class="profile-tab-btn ${AppState.activeFilter.bikeProfile === 'mtb' ? 'active' : ''}" data-profile="mtb">
          <span>E-MTB / Trail</span>
        </button>
        <button class="profile-tab-btn ${AppState.activeFilter.bikeProfile === 'ebike' ? 'active' : ''}" data-profile="ebike">
          <span>E-Bike / Genuss</span>
        </button>
      </div>
    </div>

    <!-- 4 Spontaneous Decision Cards -->
    <div class="mood-cards-grid">
      <div class="mood-decision-card ${AppState.activeFilter.mood === 'alle' ? 'active' : ''}" data-mood="alle">
        <div>
          <div class="mood-icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
          <h3 class="mood-title">Alle 30 Touren</h3>
          <p class="mood-desc">Das komplette Tourenarchiv vom Klütturm über den Süntel bis zum Deister.</p>
        </div>
        <span class="mood-badge">30 Strecken</span>
      </div>

      <div class="mood-decision-card ${AppState.activeFilter.mood === 'feierabend' ? 'active' : ''}" data-mood="feierabend">
        <div>
          <div class="mood-icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div>
          <h3 class="mood-title">Spontan / Feierabend</h3>
          <p class="mood-desc">Schneller 1,5–2 h Reset direkt ab Haustür. Aussicht, Klütturm & knackige Trails.</p>
        </div>
        <span class="mood-badge">Ab Zuhause · ca. 20 km</span>
      </div>

      <div class="mood-decision-card ${AppState.activeFilter.mood === 'halbtag' ? 'active' : ''}" data-mood="halbtag">
        <div>
          <div class="mood-icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg></div>
          <h3 class="mood-title">Halbtagestour & Genuss</h3>
          <p class="mood-desc">3–4 h Waldabenteuer, Felskanten auf dem Hohenstein und herrliche Panorama-Blicke.</p>
        </div>
        <span class="mood-badge">Mittlere Ausdauer · 30–50 km</span>
      </div>

      <div class="mood-decision-card ${AppState.activeFilter.mood === 'tagestour' ? 'active' : ''}" data-mood="tagestour">
        <div>
          <div class="mood-icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/></svg></div>
          <h3 class="mood-title">Tagestour & Wochenende</h3>
          <p class="mood-desc">Epische Schleifen entlang der Weser und über den Ith-Höhenzug für den vollen Akku.</p>
        </div>
        <span class="mood-badge">Maximale Reichweite · > 55 km</span>
      </div>
    </div>

    <!-- Toolbar: Counters, Search, and Sort -->
    <section class="routes-toolbar">
      <div class="toolbar-left">
        <span class="routes-counter-title">${routes.length} ${routes.length === 1 ? 'Tour gefunden' : 'Touren gefunden'}</span>
        <div class="filter-chip-group">
          <button class="filter-chip ${AppState.activeFilter.difficulty === 'alle' ? 'active' : ''}" data-diff="alle">Alle</button>
          <button class="filter-chip ${AppState.activeFilter.difficulty === 'leicht' ? 'active' : ''}" data-diff="leicht"><span class="diff-dot diff-easy"></span> Leicht</button>
          <button class="filter-chip ${AppState.activeFilter.difficulty === 'mittel' ? 'active' : ''}" data-diff="mittel"><span class="diff-dot diff-mid"></span> Mittel</button>
          <button class="filter-chip ${AppState.activeFilter.difficulty === 'sportlich' ? 'active' : ''}" data-diff="sportlich"><span class="diff-dot diff-hard"></span> Sportlich</button>
        </div>
      </div>
      <div class="toolbar-right">
        <div class="search-input-box">
          <svg class="search-icon-svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
          <input type="text" class="search-input" id="routeSearchInput" placeholder="Tour, Region, Highlight..." value="${h(AppState.activeFilter.search)}">
        </div>
        <select class="sort-select" id="routeSortSelect">
          <option value="score_desc" ${AppState.activeFilter.sort === 'score_desc' ? 'selected' : ''}>Score (Höchste zuerst)</option>
          <option value="dist_asc" ${AppState.activeFilter.sort === 'dist_asc' ? 'selected' : ''}>Distanz (Kürzeste zuerst)</option>
          <option value="dist_desc" ${AppState.activeFilter.sort === 'dist_desc' ? 'selected' : ''}>Distanz (Längste zuerst)</option>
          <option value="elev_desc" ${AppState.activeFilter.sort === 'elev_desc' ? 'selected' : ''}>Höhenmeter (Meiste zuerst)</option>
        </select>
      </div>
    </section>

    <!-- Route Cards Grid — Critique (3): curated first set -->
    <section class="route-card-grid">
      ${visibleRoutes.map(r => renderRouteCard(r)).join('')}
    </section>

    ${hasMore ? `
    <div class="load-more-container">
      <button class="btn-load-more" id="btnLoadMore">
        ${routes.length - visibleCount} weitere Touren anzeigen
        <svg class="icon-sm" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
      </button>
    </div>
    ` : ''}
  `;

  main.innerHTML = html;
  attachExplorerEvents();

  // Critique (4): lazy load track previews for visible cards
  requestAnimationFrame(() => {
    if (!cardTrackSignal.aborted) lazyLoadCardTracks(cardTrackSignal);
  });
}

/**
 * Renders an individual route card for the explorer grid.
 * Critique (4): use real track/topography posters, robust image fallbacks.
 * Critique (5): reduce emoji-as-icon visual language.
 */
function renderRouteCard(r) {
  const score = _ScoringAndBattery.computeScore(r);
  const isFav = _StorageAndLog.isFavorite(r.id);
  const isComp = _StorageAndLog.isInCompare(r.id);

  const firstImg = (r.gallery && r.gallery.length > 0) ? _Security.safeExternalUrl(r.gallery[0].url, 'gallery') : '';

  return `
    <article class="route-card">
      <div class="card-media-wrapper">
        ${firstImg ? `
          <img src="${h(firstImg)}" class="card-img" alt="${h(r.name)}" loading="lazy">
          <div class="card-track-fallback">
            ${renderCardTrackSvg(r)}
          </div>
        ` : `
          ${renderCardTrackSvg(r)}
        `}
        <span class="card-type-tag">${h(r.type || 'E-Bike Runde')}</span>
        <span class="card-score-badge"><span class="score-star">★</span> ${score}</span>
      </div>

      <div class="card-content">
        <span class="card-region-subtitle">${h(r.region || 'Hameln / Weserbergland')}</span>
        <h3 class="card-title"><a href="#/tour/${h(r.id)}">${h(r.name)}</a></h3>
        <p class="card-best-for">${h(r.best_for || r.surface || '')}</p>

        <div class="card-kpi-row">
          <div>
            <span class="kpi-unit">DISTANZ</span>
            <span class="kpi-value">${h(r.distance_km)} km</span>
          </div>
          <div>
            <span class="kpi-unit">HÖHENMETER</span>
            <span class="kpi-value">▲ ${h(r.elevation_m)} hm</span>
          </div>
          <div>
            <span class="kpi-unit">DAUER</span>
            <span class="kpi-value">${h(r.duration || '2 h')}</span>
          </div>
        </div>

        <div class="card-actions-footer">
          <a href="#/tour/${h(r.id)}" class="btn-card-explore">Tour öffnen →</a>
          <button class="btn-card-icon ${isFav ? 'is-favorite' : ''}" data-fav-id="${h(r.id)}" title="${isFav ? 'Aus Favoriten entfernen' : 'Als Favorit speichern'}">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          </button>
          <button class="btn-card-icon ${isComp ? 'is-compare' : ''}" data-comp-id="${h(r.id)}" title="${isComp ? 'Aus Vergleich entfernen' : 'Zum Vergleich hinzufügen'}">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          </button>
        </div>
      </div>
    </article>
  `;
}

/**
 * Attaches event listeners for explorer controls.
 */
function attachExplorerEvents() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.mood-decision-card').forEach(card => {
    card.addEventListener('click', () => {
      AppState.activeFilter.mood = card.getAttribute('data-mood');
      AppState.visibleCardCount = 6; // reset on filter change
      renderEbikeExplorerView();
    });
  });

  document.querySelectorAll('.profile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.activeFilter.bikeProfile = btn.getAttribute('data-profile');
      AppState.visibleCardCount = 6;
      renderEbikeExplorerView();
    });
  });

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      AppState.activeFilter.difficulty = chip.getAttribute('data-diff');
      AppState.visibleCardCount = 6;
      renderEbikeExplorerView();
    });
  });

  const searchInput = document.getElementById('routeSearchInput');
  searchInput?.addEventListener('input', (e) => {
    AppState.activeFilter.search = e.target.value;
    renderEbikeExplorerView();
    const replacement = document.getElementById('routeSearchInput');
    if (replacement) {
      replacement.focus({ preventScroll: true });
      const cursor = replacement.value.length;
      replacement.setSelectionRange(cursor, cursor);
    }
  });

  const sortSelect = document.getElementById('routeSortSelect');
  sortSelect?.addEventListener('change', (e) => {
    AppState.activeFilter.sort = e.target.value;
    renderEbikeExplorerView();
  });

  document.querySelectorAll('[data-fav-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _StorageAndLog.toggleFavorite(btn.getAttribute('data-fav-id'));
      renderEbikeExplorerView();
    });
  });

  document.querySelectorAll('[data-comp-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _StorageAndLog.toggleCompare(btn.getAttribute('data-comp-id'));
      renderEbikeExplorerView();
    });
  });

  document.querySelectorAll('.card-img').forEach(image => {
    image.addEventListener('error', () => {
      image.classList.add('image-load-failed');
      image.nextElementSibling?.classList.add('is-visible');
    }, { once: true });
  });

  // Critique (3): Load-more button
  document.getElementById('btnLoadMore')?.addEventListener('click', () => {
    AppState.visibleCardCount = AppState.allRoutes.length; // show all
    renderEbikeExplorerView();
  });
}

/* =========================================================================
 * VIEW 2: LARGE EDITORIAL TOUR MAGAZINE VIEW
 * Critique (6): map and elevation appear earlier; no huge empty left column.
 * Critique (1): no visible source/license/provider captions.
 * Critique (5): reduced emoji usage.
 * ========================================================================= */
async function renderTourDetailView(routeId) {
  if (typeof document === 'undefined') return;
  const main = document.getElementById('appMain');
  if (!main) return;

  const route = AppState.allRoutes.find(r => r.id === routeId);
  if (!route) {
    renderUnknownRouteView();
    return;
  }

  const score = _ScoringAndBattery.computeScore(route);
  const isFav = _StorageAndLog.isFavorite(route.id);
  const isComp = _StorageAndLog.isInCompare(route.id);

  const html = `
    <section class="tour-detail-magazine">
      <a href="#/ebike" class="detail-nav-back">← Zurück zur Tourenübersicht</a>

      <!-- Detail Hero Header -->
      <header class="detail-hero-banner">
        <div class="detail-meta-tags">
          <span class="detail-tag primary">${h(route.type || 'E-Bike Tour')}</span>
          <span class="detail-tag">${h(route.region || 'Hameln')}</span>
          <span class="detail-tag amber">★ ${score} / 100</span>
          <span class="detail-tag">${h(route.difficulty || 'mittel')}</span>
          <span class="detail-tag">Start: ${h(route.start_mode || 'ab Haustür')}</span>
        </div>

        <h1 class="detail-title">${h(route.name)}</h1>
        <p class="detail-best-for">${h(route.best_for || route.surface || '')}</p>

        <!-- Action Toolbar right at top -->
        <div class="detail-action-toolbar">
          ${_Security.safeDataFile(route.gpx_file, 'gpx') ? `<a href="data/${h(_Security.safeDataFile(route.gpx_file, 'gpx'))}" download class="btn-toolbar-main" title="GPX Datei für Offline-Navigation herunterladen">
            GPX herunterladen
          </a>` : ''}
          ${_Security.safeExternalUrl(route.navigation_link, 'navigation') ? `
            <a href="${h(_Security.safeExternalUrl(route.navigation_link, 'navigation'))}" target="_blank" rel="noopener noreferrer" class="btn-toolbar-secondary" title="Google Maps Navigation ab Standort starten">
              Navigation starten
            </a>
          ` : ''}
          ${_Security.safeExternalUrl(route.komoot_link, 'komoot') ? `
            <a href="${h(_Security.safeExternalUrl(route.komoot_link, 'komoot'))}" target="_blank" rel="noopener noreferrer" class="btn-toolbar-pill" title="In Komoot öffnen">
              Komoot
            </a>
          ` : ''}
          ${_Security.safeExternalUrl(route.planner_link, 'planner') ? `
            <a href="${h(_Security.safeExternalUrl(route.planner_link, 'planner'))}" target="_blank" rel="noopener noreferrer" class="btn-toolbar-pill" title="Im BRouter Streckenplaner öffnen">
              BRouter
            </a>
          ` : ''}
          <button class="btn-toolbar-pill ${isFav ? 'is-favorite' : ''}" id="btnDetailFav" data-id="${h(route.id)}">
            ★ ${isFav ? 'Gespeichert' : 'Favorit'}
          </button>
          <button class="btn-toolbar-pill ${isComp ? 'is-compare' : ''}" id="btnDetailComp" data-id="${h(route.id)}">
            ${isComp ? 'Im Vergleich' : 'Vergleichen'}
          </button>
          <button class="btn-toolbar-pill" id="btnQuickLog" data-id="${h(route.id)}" data-name="${h(route.name)}">
            Ins Fahrtenbuch
          </button>
        </div>
      </header>

      <!-- Critique (6): Map and Elevation appear FIRST, full width -->
      <div class="detail-map-full">
        <div class="section-box">
          <h3 class="section-title">
            <svg class="icon-section" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
            Interaktive Streckenkarte <small class="map-point-count">(${h(route.track_points || '')} Punkte)</small>
          </h3>
          <div id="detailMapContainer" class="svg-map-wrapper">
            <div class="map-loading">Strecke wird geladen...</div>
          </div>
          <p class="map-hint-text">Mausrad oder Gesten zum Zoomen · Ziehen zum Verschieben</p>
        </div>

        <div class="section-box">
          <div id="detailProfileContainer"></div>
        </div>
      </div>

      <!-- Critique (6): After map, 2-column grid for sidebar content (no empty left col) -->
      <div class="detail-content-grid">
        <!-- Gallery — Critique (1): no visible source captions -->
        <div class="detail-gallery-col">
          <section class="gallery-showcase-box" id="galleryOrPosterContainer">
            <!-- Rendered by JS below -->
          </section>

          <!-- Route Specifications -->
          <div class="section-box">
            <h3 class="section-title">
              <svg class="icon-section" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Strecken- & Fahrtdetails
            </h3>
            <div class="route-spec-list">
              <div><strong>Fahrrad-Profil:</strong> ${h(route.bike_profile || 'MTB / E-MTB')} (${h(route.ride_style || 'mtb')})</div>
              <div><strong>Empfohlene Saison:</strong> ${h(route.season || 'ganzjährig')}</div>
              <div><strong>Untergrund-Mix:</strong> ${h(route.surface || 'Asphalt, Schotter, Waldwege')}</div>
              <div><strong>Verkehrsbelastung:</strong> ${h(route.traffic_profile || 'gering / waldwege')}</div>
              ${route.packing_hint ? `<div><strong>Packliste / Tipp:</strong> ${h(route.packing_hint)}</div>` : ''}
              ${route.risk_notes && route.risk_notes.length > 0 ? `
                <div class="route-risk-notes">
                  <strong>Strecken-Hinweise:</strong>
                  <ul>
                    ${route.risk_notes.map(rn => `<li>${h(rn)}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Right Column: Highlights, Scoring, Battery -->
        <div class="detail-sidebar-section">
          <!-- Highlights -->
          ${route.highlights && route.highlights.length > 0 ? `
            <div class="section-box">
              <h3 class="section-title">
                <svg class="icon-section" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Highlights & Höhepunkte
              </h3>
              <ul class="highlights-list">
                ${route.highlights.map(highlight => `
                  <li class="highlight-item"><span class="hi-bullet">✦</span> <span>${h(highlight)}</span></li>
                `).join('')}
              </ul>
            </div>
          ` : ''}

          <!-- Domse Score Breakdown -->
          ${_ScoringAndBattery.renderScoreBreakdown(route)}

          <!-- Battery Calculator -->
          ${_ScoringAndBattery.renderBatteryCalculator(route)}

          <!-- Weather Section -->
          <div class="weather-advisory-box">
            <svg class="icon-section" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>
            <div>
              <strong class="weather-title">Wetterdaten & Streckenzustand</strong>
              <span>Live-Wetterwerte sind offline nicht verfügbar. Prüfe vor Fahrtantritt die aktuelle regionale Wettervorhersage für Hameln & Weserbergland.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  main.innerHTML = html;

  document.getElementById('btnDetailFav')?.addEventListener('click', () => {
    _StorageAndLog.toggleFavorite(route.id);
    renderTourDetailView(route.id);
  });

  document.getElementById('btnDetailComp')?.addEventListener('click', () => {
    _StorageAndLog.toggleCompare(route.id);
    renderTourDetailView(route.id);
  });

  document.getElementById('btnQuickLog')?.addEventListener('click', () => {
    window.location.hash = '#/sport';
    setTimeout(() => {
      const select = document.getElementById('logRouteSelect');
      if (select) select.value = route.id;
      window.scrollTo({ top: document.getElementById('logFormSection')?.offsetTop - 80 || 0, behavior: 'smooth' });
    }, 150);
  });

  // Load and render GeoJSON Track Map & Gallery/Topo Poster
  const safeTrack = _Security.safeDataFile(route.track_geojson_file || `tracks/${h(route.id)}.geojson`, 'track');
  const geoJson = safeTrack ? await _SvgMapEngine.fetchTrack(safeTrack) : null;

  // Critique (1): Gallery without source/license captions
  const galleryContainer = document.getElementById('galleryOrPosterContainer');
  if (galleryContainer) {
    const safeGallery = (route.gallery || [])
      .map(image => ({ ...image, safeUrl: _Security.safeExternalUrl(image.url, 'gallery') }))
      .filter(image => image.safeUrl);
    if (safeGallery.length > 0) {
      galleryContainer.innerHTML = `
        <div class="gallery-grid">
          ${safeGallery.map((img, index) => `
            <button class="gallery-item gallery-open" type="button" data-gallery-index="${index}" aria-label="${h(img.title || route.name)} groß ansehen">
              <img src="${h(img.safeUrl)}" class="gallery-img" alt="${h(img.title || route.name)}" loading="lazy">
              <span class="gallery-caption">
                <span>${h(img.title || route.name)}</span>
                <span class="gallery-open-hint" aria-hidden="true">Vergrößern</span>
              </span>
            </button>
          `).join('')}
        </div>
      `;
      galleryContainer.querySelectorAll('.gallery-img').forEach(image => {
        image.addEventListener('error', () => image.closest('.gallery-item')?.remove(), { once: true });
      });
      galleryContainer.querySelectorAll('[data-gallery-index]').forEach(button => {
        button.addEventListener('click', () => openImageViewer(safeGallery, Number(button.dataset.galleryIndex), button));
      });
    } else {
      _SvgMapEngine.renderTopoPoster(galleryContainer, geoJson, route);
    }
  }

  const mapContainer = document.getElementById('detailMapContainer');
  const profileContainer = document.getElementById('detailProfileContainer');

  if (mapContainer && profileContainer && geoJson) {
    _SvgMapEngine.renderTrackMap(mapContainer, geoJson, route);
    _SvgMapEngine.renderElevationProfile(profileContainer, geoJson, route);
  }
}

/* =========================================================================
 * VIEW 3: SPORT & RIDE LOG (FAHRTENBUCH) VIEW (Rule 6 & 11)
 * ========================================================================= */
function renderSportAndLogView() {
  if (typeof document === 'undefined') return;
  const main = document.getElementById('appMain');
  if (!main) return;

  const logEntries = _StorageAndLog.getRideLog();
  const totalRides = logEntries.length;
  const totalKm = logEntries.reduce((acc, it) => {
    const r = AppState.allRoutes.find(x => x.id === it.routeId);
    return acc + (r ? r.distance_km : 20);
  }, 0);
  const totalDuration = logEntries.reduce((acc, it) => acc + (Number(it.durationMinutes) || 0), 0);
  const avgDurationHours = totalRides > 0 ? (totalDuration / totalRides / 60).toFixed(1) : '0';

  const html = `
    <section class="sport-archive-header">
      <h1 class="detail-title">Persönliches E-Bike Fahrtenbuch & Statistik</h1>
      <p class="detail-best-for">Dokumentiere deine gefahrenen Runden, verfolge deinen realen Akkuverbrauch und bewahre deine Trail-Eindrücke lokal im Browser.</p>

      <!-- Statistics KPI Bar -->
      <div class="card-kpi-row sport-kpi-row">
        <div>
          <span class="kpi-unit">ABGESCHLOSSENE TOUREN</span>
          <span class="kpi-value kpi-rides">${totalRides}</span>
        </div>
        <div>
          <span class="kpi-unit">GESAMTDISTANZ</span>
          <span class="kpi-value kpi-distance">${totalKm.toFixed(1)} km</span>
        </div>
        <div>
          <span class="kpi-unit">GESAMTZEIT IM SATTEL</span>
          <span class="kpi-value kpi-duration">${Math.round(totalDuration / 60)} h ${totalDuration % 60} min</span>
        </div>
        <div>
          <span class="kpi-unit">DURCHSCHNITT PRO FAHRT</span>
          <span class="kpi-value kpi-average">${avgDurationHours} h</span>
        </div>
      </div>
    </section>

    <!-- 2-Column Layout: Form & History List -->
    <section class="log-grid-layout">
      <!-- Left: New Ride Log Form -->
      <div class="log-form-box" id="logFormSection">
        <h3 class="section-title">
          <svg class="icon-section" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Neue Fahrt eintragen
        </h3>
        <form id="formAddRideLog" class="log-entry-form">
          <div class="form-group">
            <label class="form-label">Datum der Fahrt</label>
            <input type="date" class="form-input" id="logDate" value="${new Date().toISOString().split('T')[0]}" required>
          </div>

          <div class="form-group">
            <label class="form-label">Gefahrene Strecke auswählen</label>
            <select class="form-select" id="logRouteSelect">
              ${AppState.allRoutes.map(r => `<option value="${h(r.id)}">${h(r.name)} (${h(r.distance_km)} km)</option>`).join('')}
            </select>
          </div>

          <div class="form-two-columns">
            <div class="form-group">
              <label class="form-label">Gefahrene Zeit (min)</label>
              <input type="number" class="form-input" id="logDuration" placeholder="z.B. 105" value="95" min="1" required>
            </div>
            <div class="form-group">
              <label class="form-label">Akku verbraucht (%)</label>
              <input type="number" class="form-input" id="logBattery" placeholder="z.B. 28" value="25" min="1" max="100" required>
            </div>
          </div>

          <div class="form-two-columns">
            <div class="form-group">
              <label class="form-label">Wetterkonditionen</label>
              <input type="text" class="form-input" id="logWeather" placeholder="z.B. Sonnenschein, 20°C" value="Heiter & angenehm">
            </div>
            <div class="form-group">
              <label class="form-label">Bewertung (1–5 Sterne)</label>
              <select class="form-select" id="logRating">
                <option value="5">★★★★★ Episch</option>
                <option value="4">★★★★☆ Sehr gut</option>
                <option value="3">★★★☆☆ Gut</option>
                <option value="2">★★☆☆☆ Mäßig</option>
                <option value="1">★☆☆☆☆ Schwer / Nass</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Persönliche Notiz & Trail-Zustand</label>
            <textarea class="form-textarea" id="logNotes" rows="3" placeholder="Zustand der Waldwege, Wurzeln trocken, tolle Sicht am Klütturm..."></textarea>
          </div>

          <button type="submit" class="btn-submit-log log-submit">Eintrag speichern</button>
        </form>
      </div>

      <!-- Right: Logbook History Table / Cards -->
      <div class="log-history-column">
        <div class="log-history-header">
          <h3 class="section-title log-history-title">Bisherige Fahrten (${logEntries.length})</h3>
          <div class="log-import-export">
            <button class="btn-toolbar-pill" id="btnExportLog" title="Logbuch als JSON Backup sichern">Export</button>
            <label class="btn-toolbar-pill import-label" title="JSON Backup importieren">
              Import
              <input type="file" id="fileImportLog" accept=".json" class="visually-hidden-file">
            </label>
          </div>
        </div>

        ${logEntries.length === 0 ? `
          <div class="section-box log-empty-state">
            Noch keine Fahrten im Logbuch eingetragen. Starte jetzt und dokumentiere deine E-Bike Touren!
          </div>
        ` : `
          <div class="logbook-entries-list">
            ${logEntries.map(entry => `
              <article class="log-entry-card">
                <div class="log-entry-info">
                  <h4 class="log-entry-route"><a href="#/tour/${h(entry.routeId)}">${h(entry.routeName)}</a></h4>
                  <div class="log-entry-date">${h(entry.date)} · Bewertung: ${'★'.repeat(entry.rating || 5)}</div>
                  <div class="log-entry-stats">
                    <span>${h(entry.durationMinutes)} min</span>
                    <span>${h(entry.batteryUsedPercent)}% Akku</span>
                    <span>${h(entry.weather || 'Trocken')}</span>
                  </div>
                  ${entry.notes ? `<p class="log-entry-notes">„${h(entry.notes)}“</p>` : ''}
                </div>
                <button class="btn-delete-log" data-delete-log="${h(entry.id)}" title="Eintrag löschen">✕</button>
              </article>
            `).join('')}
          </div>
        `}
      </div>
    </section>
  `;

  main.innerHTML = html;

  document.getElementById('formAddRideLog')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const routeId = document.getElementById('logRouteSelect')?.value || 'kluet-feierabendrunde';
    const routeObj = AppState.allRoutes.find(r => r.id === routeId);

    _StorageAndLog.addRideLogEntry({
      date: document.getElementById('logDate')?.value,
      routeId: routeId,
      routeName: routeObj ? routeObj.name : routeId,
      durationMinutes: document.getElementById('logDuration')?.value,
      batteryUsedPercent: document.getElementById('logBattery')?.value,
      weather: document.getElementById('logWeather')?.value,
      rating: document.getElementById('logRating')?.value,
      notes: document.getElementById('logNotes')?.value
    });

    renderSportAndLogView();
  });

  document.querySelectorAll('[data-delete-log]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Diesen Logbuch-Eintrag wirklich löschen?')) {
        _StorageAndLog.deleteRideLogEntry(btn.getAttribute('data-delete-log'));
        renderSportAndLogView();
      }
    });
  });

  document.getElementById('btnExportLog')?.addEventListener('click', () => {
    _StorageAndLog.exportLogJson();
  });

  document.getElementById('fileImportLog')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert('Die Importdatei ist zu groß (maximal 1 MiB).');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    let finished = false;
    const cleanup = () => {
      if (finished) return false;
      finished = true;
      e.target.value = '';
      reader.onload = reader.onerror = reader.onabort = null;
      return true;
    };
    reader.onload = (evt) => {
      let imported = false;
      try {
        imported = _StorageAndLog.importLogJson(evt.target.result);
      } catch (_) {
        imported = false;
      } finally {
        if (!cleanup()) return;
      }
      if (imported) {
        alert('Logbuch fehlerfrei importiert!');
        renderSportAndLogView();
      } else {
        alert('Fehler beim Importieren der JSON-Datei.');
      }
    };
    reader.onerror = () => {
      if (cleanup()) alert('Die Importdatei konnte nicht gelesen werden.');
    };
    reader.onabort = () => {
      if (cleanup()) alert('Das Lesen der Importdatei wurde abgebrochen.');
    };
    try {
      reader.readAsText(file);
    } catch (_) {
      if (cleanup()) alert('Die Importdatei konnte nicht gelesen werden.');
    }
  });
}

/* =========================================================================
 * VIEW 4: TOUR COMPARISON MODAL (Rule 6)
 * ========================================================================= */
function openCompareModal() {
  if (typeof document === 'undefined') return;
  const overlay = document.getElementById('compareModalOverlay');
  const container = document.getElementById('compareContentContainer');
  if (!overlay || !container) return;

  const compareIds = _StorageAndLog.getCompareList();
  const routesToCompare = AppState.allRoutes.filter(r => compareIds.includes(r.id));

  if (routesToCompare.length === 0) {
    container.innerHTML = `
      <div class="compare-empty-state">
        <p class="compare-empty-title">Du hast noch keine Touren zum Vergleich ausgewählt.</p>
        <p class="compare-empty-help">Klicke bei einer Tour auf das Vergleich-Symbol um sie in den Direktvergleich zu legen.</p>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="compare-clear-row">
        <button class="btn-toolbar-pill" id="btnClearCompareBtn">Vergleichsliste leeren</button>
      </div>
      <div class="compare-grid-table">
        ${routesToCompare.map(r => {
          const score = _ScoringAndBattery.computeScore(r);
          return `
            <div class="compare-col">
              <div>
                <span class="card-region-subtitle">${h(r.region)}</span>
                <h4 class="compare-route-title"><a href="#/tour/${h(r.id)}">${h(r.name)}</a></h4>
                <span class="score-badge-large compare-score">★ ${score} Pkt.</span>
              </div>

              <div class="compare-stats">
                <div><strong>Distanz:</strong> ${h(r.distance_km)} km</div>
                <div><strong>Höhenmeter:</strong> ▲ ${h(r.elevation_m)} hm</div>
                <div><strong>Dauer:</strong> ${h(r.duration || 'ca. 2 h')}</div>
                <div><strong>Schwierigkeit:</strong> ${h(r.difficulty)}</div>
                <div><strong>Akku-Modell:</strong> ca. ${h(r.battery_model?.emtb || 45)}% (eMTB Modus)</div>
                <div><strong>Ruhe/Verkehr:</strong> ${h(r.scores?.low_traffic || 80)} Pkt.</div>
                <div><strong>Natur/Schönheit:</strong> ${h(r.scores?.scenery || 80)} Pkt.</div>
                <div><strong>Trail-Anteil:</strong> ${h(r.scores?.trail || 70)} Pkt.</div>
                <div><strong>Aussichtspunkte:</strong> ${h(r.scores?.viewpoints || 80)} Pkt.</div>
                <div><strong>Untergrund:</strong> <small>${h(r.surface)}</small></div>
              </div>

              <div class="compare-actions">
                <a href="#/tour/${h(r.id)}" class="btn-card-explore compare-open">Öffnen →</a>
                <button class="btn-card-icon" data-rm-compare="${h(r.id)}" title="Aus Vergleich entfernen">✕</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    document.getElementById('btnClearCompareBtn')?.addEventListener('click', () => {
      _StorageAndLog.clearCompare();
      openCompareModal();
    });

    document.querySelectorAll('[data-rm-compare]').forEach(btn => {
      btn.addEventListener('click', () => {
        _StorageAndLog.toggleCompare(btn.getAttribute('data-rm-compare'));
        openCompareModal();
      });
    });

    document.querySelectorAll('.compare-open').forEach(link => {
      link.addEventListener('click', closeCompareModal);
    });
  }

  overlay.classList.add('open');
  document.body.classList.add('modal-open');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AppState, loadRoutesData, renderCardTrackSvg, renderEbikeExplorerView, renderTourDetailView, renderSportAndLogView };
}
