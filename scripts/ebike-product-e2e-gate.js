#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.EBIKE_PRODUCT_EVIDENCE || '/tmp/ebike-product-e2e';
const PLAYWRIGHT_MODULE = process.env.EBIKE_PLAYWRIGHT_MODULE || 'playwright';
const REMOTE_BASE_URL = String(process.env.EBIKE_BASE_URL || '').replace(/\/+$/, '');
const EXPECTED_HOST = String(process.env.EBIKE_EXPECTED_HOST || '');
const HEADERS_FILE = String(process.env.EBIKE_HTTP_HEADERS_FILE || '');
const RELEASE_ID = String(process.env.EBIKE_RELEASE_ID || '');
const PUBLIC_TARGET = process.env.EBIKE_PUBLIC_TARGET === '1';
const playwright = require(PLAYWRIGHT_MODULE);

const MATRIX = [
  { id: 'mobile-320', width: 320, height: 568, textScale: 1 },
  { id: 'mobile-390', width: 390, height: 844, textScale: 1 },
  { id: 'landscape-844', width: 844, height: 390, textScale: 1 },
  { id: 'tablet-768', width: 768, height: 1024, textScale: 1 },
  { id: 'desktop-1440', width: 1440, height: 900, textScale: 1 },
  { id: 'mobile-390-text125', width: 390, height: 844, textScale: 1.25 },
  { id: 'mobile-390-text200', width: 390, height: 844, textScale: 2 },
  { id: 'desktop-1440-text200', width: 1440, height: 900, textScale: 2 },
];

const EXPECTED_FUNCTION_IDS = [
  'theme', 'profile-E-MTB / Trail', 'profile-E-Bike / Genuss',
  'mood-Alle 30 Touren', 'mood-Spontan / Feierabend', 'mood-Halbtagestour & Genuss', 'mood-Tagestour & Wochenende',
  'filter-Leicht', 'filter-Mittel', 'filter-Sportlich', 'search-continuous',
  'sort-score_desc', 'sort-dist_asc', 'sort-dist_desc', 'sort-elev_desc', 'load-more',
  'favorite', 'favorite-filter', 'compare-empty-open-close', 'compare-remove', 'compare-open-route',
  'map-plus', 'map-minus', 'map-pinch', 'map-drag', 'map-fit', 'map-fullscreen',
  'gallery-open', 'gallery-zoom-button', 'gallery-pinch', 'gallery-next', 'gallery-close',
  'detail-favorite', 'detail-compare', 'gpx-download',
  'external-Navigation starten', 'external-Komoot', 'external-BRouter', 'quick-log-preselect',
  'log-save', 'log-export', 'log-delete-both-paths', 'log-import-valid', 'log-import-invalid',
  'dock-spontan', 'dock-ebike', 'dock-sport', 'dock-compare',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function startServer() {
  const mime = new Map([
    ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
    ['.gpx', 'application/gpx+xml'], ['.geojson', 'application/geo+json'],
    ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.svg', 'image/svg+xml'],
  ]);
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://local').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    let file = path.resolve(ROOT, relative);
    if (!file.startsWith(`${ROOT}${path.sep}`)) return response.writeHead(403).end('forbidden');
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (error, body) => {
      if (error) return response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('not found');
      response.writeHead(200, { 'Content-Type': mime.get(path.extname(file)) || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(body);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function remoteConfig() {
  if (!REMOTE_BASE_URL) return { baseUrl: '', headers: {} };
  const target = new URL(REMOTE_BASE_URL);
  if (target.protocol !== 'https:' || target.hostname !== EXPECTED_HOST || !RELEASE_ID) throw new Error('remote target is not safely bound');
  if (PUBLIC_TARGET) {
    if (HEADERS_FILE) throw new Error('public target must not receive Access credentials');
    return { baseUrl: target.origin, headers: {} };
  }
  const stat = fs.statSync(HEADERS_FILE);
  if ((stat.mode & 0o077) !== 0) throw new Error('credential file permissions are unsafe');
  const credential = JSON.parse(fs.readFileSync(HEADERS_FILE, 'utf8'));
  if (!credential.client_id || !credential.client_secret) throw new Error('credential schema invalid');
  return { baseUrl: target.origin, headers: { 'CF-Access-Client-Id': credential.client_id, 'CF-Access-Client-Secret': credential.client_secret } };
}

async function bindHeaders(context, baseUrl, headers) {
  if (!Object.keys(headers).length) return;
  const origin = new URL(baseUrl).origin;
  await context.route('**/*', async route => {
    const request = route.request();
    if (new URL(request.url()).origin !== origin) return route.continue();
    try {
      const response = await route.fetch({
        headers: { ...request.headers(), ...headers },
        maxRedirects: 0,
      });
      return route.fulfill({ response });
    } catch (error) {
      if (/Target page, context or browser has been closed/.test(String(error?.message))) return;
      throw new Error(`authenticated target request failed: ${request.method()} ${request.url()} (${error?.name || 'Error'})`);
    }
  });
}

function watch(page, baseUrl, remote = false) {
  const expectedOrigin = new URL(baseUrl).origin;
  const evidence = { pageErrors: [], consoleErrors: [], expectedEdgeCspErrors: [], requestFailures: [], expectedPreviewAborts: [], httpErrors: [], unexpectedDialogs: [] };
  const isTarget = value => { try { return new URL(value).origin === expectedOrigin; } catch { return false; } };
  page.on('pageerror', error => evidence.pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    const isKnownEdgeCspNoise = remote
      && /^Refused to execute inline script because it violates the following Content Security Policy directive: "script-src 'self'(?: https:\/\/challenges\.cloudflare\.com)?"\./.test(text)
      && text.includes("Either the 'unsafe-inline' keyword, a hash ('sha256-");
    if (isKnownEdgeCspNoise) evidence.expectedEdgeCspErrors.push(text);
    else evidence.consoleErrors.push(text);
  });
  page.on('requestfailed', request => {
    const error = request.failure()?.errorText || 'unknown';
    const url = request.url();
    const parsed = new URL(url);
    const isKnownPreviewAbort = isTarget(url)
      && error === 'net::ERR_ABORTED'
      && request.method() === 'GET'
      && request.resourceType() === 'fetch'
      && /^\/ebike\/data\/tracks\/[a-z0-9]+(?:-[a-z0-9]+)*\.geojson$/.test(parsed.pathname)
      && parsed.searchParams.get('purpose') === 'preview';
    if (isKnownPreviewAbort) {
      evidence.expectedPreviewAborts.push({ url, error });
      return;
    }
    if (isTarget(url)) evidence.requestFailures.push({ url, error });
  });
  page.on('response', response => {
    if (isTarget(response.url()) && response.status() >= 400) evidence.httpErrors.push({ url: response.url(), status: response.status() });
  });
  return evidence;
}

async function layout(page) {
  return page.evaluate(() => {
    const previousX = window.scrollX;
    window.scrollTo({ left: document.documentElement.scrollWidth, behavior: 'instant' });
    const maxHorizontalScroll = window.scrollX;
    window.scrollTo({ left: previousX, behavior: 'instant' });
    return {
    viewport: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    maxHorizontalScroll,
    offenders: [...document.querySelectorAll('body *')].map(element => {
      const rect = element.getBoundingClientRect();
      const intentionalOverflowSurface = element.classList.contains('leaflet-tile')
        || (element.tagName === 'svg' && element.classList.contains('leaflet-zoom-animated'))
        || (element.id === 'imageViewerImage' && element.closest('#imageViewerOverlay.open'));
      return { selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${element.classList.length ? `.${[...element.classList].slice(0, 3).join('.')}` : ''}`, left: rect.left, right: rect.right, width: rect.width, intentionalOverflowSurface };
    }).filter(item => !item.intentionalOverflowSurface && item.width > 0 && (item.left < -1 || item.right > document.documentElement.clientWidth + 1)).slice(0, 12),
    };
  });
}

async function screenshot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function openHome(page, baseUrl, remote) {
  const query = remote ? `?release=${encodeURIComponent(RELEASE_ID)}` : '';
  await page.goto(`${baseUrl}/ebike/${query}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.route-card').first().waitFor();
  await page.waitForLoadState('networkidle');
}

async function representative(browser, baseUrl, headers, remote) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, acceptDownloads: true, locale: 'de-DE' });
  await bindHeaders(context, baseUrl, headers);
  const page = await context.newPage();
  const runtime = watch(page, baseUrl, remote);
  const functions = [];
  const record = async (id, action, effect) => {
    await action();
    await effect();
    functions.push({ id, status: 'PASS' });
  };
  const dialogs = [];
  let expectedDialog = null;
  page.on('dialog', async dialog => {
    const pending = expectedDialog;
    expectedDialog = null;
    if (!pending) {
      runtime.unexpectedDialogs.push(dialog.message());
      await dialog.dismiss();
      return;
    }
    try {
      assert(pending.pattern.test(dialog.message()), `unexpected dialog text: ${dialog.message()}`);
      dialogs.push(dialog.message());
      if (pending.action === 'dismiss') await dialog.dismiss();
      else await dialog.accept();
      pending.resolve(dialog.message());
    } catch (error) {
      await dialog.dismiss().catch(() => {});
      pending.reject(error);
    }
  });
  const expectDialog = async (pattern, action, trigger) => {
    assert(!expectedDialog, 'dialog expectation already pending');
    const received = new Promise((resolve, reject) => { expectedDialog = { pattern, action, resolve, reject }; });
    await trigger();
    return Promise.race([received, new Promise((_, reject) => setTimeout(() => reject(new Error(`dialog timeout: ${pattern}`)), 3000))]);
  };
  await openHome(page, baseUrl, remote);

  await record('theme', () => page.locator('#btnToggleTheme').click(), async () => assert(await page.locator('html').getAttribute('data-theme') === 'dark', 'theme did not change'));
  for (const label of ['E-MTB / Trail', 'E-Bike / Genuss']) {
    await record(`profile-${label}`, () => page.getByRole('button', { name: label, exact: true }).click(), async () => assert((await page.getByRole('button', { name: label, exact: true }).getAttribute('class')).includes('active'), `profile ${label} inactive`));
  }
  for (const button of await page.locator('.mood-decision-card').all()) {
    const title = (await button.locator('.mood-title').innerText()).trim();
    if (/^Alle /.test(title)) await page.locator('.mood-decision-card').nth(1).click();
    await record(`mood-${title}`, () => button.click(), async () => assert((await button.getAttribute('class')).includes('active'), `mood ${title} inactive`));
  }
  for (const label of ['Leicht', 'Mittel', 'Sportlich']) {
    await record(`filter-${label}`, () => page.getByRole('button', { name: label, exact: true }).click(), async () => assert((await page.getByRole('button', { name: label, exact: true }).getAttribute('class')).includes('active'), `filter ${label} inactive`));
  }
  await page.getByRole('button', { name: 'Alle', exact: true }).click();
  await record('search-continuous', async () => { const input = page.locator('#routeSearchInput'); await input.click(); await input.pressSequentially('Hameln', { delay: 20 }); }, async () => { assert(await page.locator('#routeSearchInput').inputValue() === 'Hameln', 'search value lost'); assert(await page.evaluate(() => document.activeElement?.id) === 'routeSearchInput', 'search focus lost'); });
  await page.locator('#routeSearchInput').fill('');
  for (const value of await page.locator('#routeSortSelect option').evaluateAll(options => options.map(option => option.value))) {
    const alternate = value === 'dist_asc' ? 'dist_desc' : 'dist_asc';
    await page.locator('#routeSortSelect').selectOption(alternate);
    await record(`sort-${value}`, () => page.locator('#routeSortSelect').selectOption(value), async () => {
      const rows = await page.locator('.route-card').evaluateAll(cards => cards.map(card => ({
        score: Number(card.querySelector('.card-score-badge')?.textContent.replace(/[^0-9.]/g, '')),
        distance: Number(card.querySelectorAll('.kpi-value')[0]?.textContent.replace(/[^0-9.,]/g, '').replace(',', '.')),
        elevation: Number(card.querySelectorAll('.kpi-value')[1]?.textContent.replace(/[^0-9.,]/g, '').replace(',', '.')),
      })));
      const key = value.startsWith('dist_') ? 'distance' : value === 'elev_desc' ? 'elevation' : 'score';
      const direction = value === 'dist_asc' ? 1 : -1;
      assert(await page.locator('#routeSortSelect').inputValue() === value, `sort ${value} lost`);
      assert(rows.every((row, index) => index === 0 || direction * (rows[index - 1][key] - row[key]) <= 0), `sort ${value} is not monotonic`);
    });
  }
  await openHome(page, baseUrl, remote);
  await record('load-more', async () => { page._cardsBefore = await page.locator('.route-card').count(); await page.getByRole('button', { name: /weitere Touren/i }).click(); }, async () => assert(await page.locator('.route-card').count() > page._cardsBefore, 'load more no effect'));
  await record('favorite', () => page.locator('[data-fav-id]').first().click(), async () => assert(await page.locator('#favCountPill').innerText() === '1', 'favorite count wrong'));
  await record('favorite-filter', () => page.locator('#btnFilterFavs').click(), async () => assert(await page.locator('.route-card').count() === 1, 'favorite filter no effect'));
  await page.locator('#btnFilterFavs').click();
  await record('compare-empty-open-close', async () => { await page.locator('#btnOpenCompare').click(); assert((await page.locator('#compareModalOverlay').getAttribute('class')).includes('open'), 'empty modal not open'); await page.locator('#btnCloseCompare').click(); }, async () => assert(!(await page.locator('#compareModalOverlay').getAttribute('class')).includes('open'), 'empty modal did not close'));
  for (let index = 0; index < 4; index += 1) await page.locator('[data-comp-id]').nth(index).click();
  await expectDialog(/vier|4/i, 'accept', () => page.locator('[data-comp-id]').nth(4).click());
  await page.locator('#btnOpenCompare').click();
  await record('compare-remove', () => page.locator('[data-rm-compare]').first().click(), async () => assert(await page.locator('.compare-col').count() === 3, 'compare remove no effect'));
  await record('compare-open-route', () => page.locator('.compare-open').first().click(), async () => { assert(page.url().includes('#/tour/'), 'compare route did not open'); assert(!(await page.locator('#compareModalOverlay').getAttribute('class')).includes('open'), 'compare modal remained open'); });

  const routeId = page.url().split('#/tour/')[1];
  await page.locator('.leaflet-map[data-map-ready="true"]').waitFor();
  const map = page.locator('.leaflet-map');
  const zoom = async () => Number(await map.getAttribute('data-map-zoom'));
  const initialZoom = await zoom();
  await record('map-plus', async () => {
    await page.locator('.leaflet-control-zoom-in').click();
    await page.waitForFunction(before => Number(document.querySelector('.leaflet-map')?.getAttribute('data-map-zoom')) > before, initialZoom);
  }, async () => assert(await zoom() > initialZoom, 'map plus no effect'));
  await record('map-minus', async () => {
    await page.locator('.leaflet-control-zoom-out').click();
    await page.waitForFunction(before => Number(document.querySelector('.leaflet-map')?.getAttribute('data-map-zoom')) === before, initialZoom);
  }, async () => assert(await zoom() === initialZoom, 'map minus no effect'));
  const box = await map.boundingBox();
  const cdp = await context.newCDPSession(page);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 35, y }, { x: x + 35, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 85, y }, { x: x + 85, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(350);
  assert(await zoom() > initialZoom, 'pinch no effect'); functions.push({ id: 'map-pinch', status: 'PASS' });
  const centerBefore = await map.getAttribute('data-map-center');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 70, y: y + 30 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(350);
  assert(await map.getAttribute('data-map-center') !== centerBefore, 'map drag no effect'); functions.push({ id: 'map-drag', status: 'PASS' });
  await record('map-fit', async () => {
    await page.locator('.btn-map-fit').click();
    await page.waitForFunction(before => Number(document.querySelector('.leaflet-map')?.getAttribute('data-map-zoom')) === before, initialZoom);
  }, async () => assert(await zoom() === initialZoom, 'map fit no effect'));
  await record('map-fullscreen', async () => {
    await page.locator('.btn-map-fullscreen').click();
    await page.waitForFunction(() => Boolean(document.fullscreenElement));
  }, async () => assert(await page.evaluate(() => Boolean(document.fullscreenElement)), 'fullscreen did not open'));
  await page.locator('.btn-map-fullscreen').click();
  await page.waitForFunction(() => !document.fullscreenElement);
  const galleryButtons = page.locator('[data-gallery-index]');
  assert(await galleryButtons.count() > 1, 'gallery inventory too small for viewer controls');
  await record('gallery-open', () => galleryButtons.first().click(), async () => {
    assert((await page.locator('#imageViewerOverlay').getAttribute('class')).includes('open'), 'gallery viewer did not open');
    await page.waitForFunction(() => {
      const image = document.getElementById('imageViewerImage');
      return Boolean(image?.complete && image.naturalWidth > 0);
    });
  });
  await record('gallery-zoom-button', () => page.locator('#btnImageZoomIn').click(), async () => {
    assert(Number(await page.locator('#imageViewerStage').getAttribute('data-zoom')) > 1, 'gallery zoom button had no effect');
  });
  await page.locator('#btnImageZoomReset').click();
  const imageStage = page.locator('#imageViewerStage');
  const imageBox = await imageStage.boundingBox();
  const imageX = imageBox.x + imageBox.width / 2, imageY = imageBox.y + imageBox.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: imageX - 30, y: imageY }, { x: imageX + 30, y: imageY }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: imageX - 90, y: imageY }, { x: imageX + 90, y: imageY }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  assert(Number(await imageStage.getAttribute('data-zoom')) > 1, 'gallery pinch had no effect'); functions.push({ id: 'gallery-pinch', status: 'PASS' });
  const firstImageUrl = await page.locator('#imageViewerImage').getAttribute('src');
  await record('gallery-next', () => page.locator('#btnImageViewerNext').click(), async () => {
    await page.waitForFunction(before => {
      const image = document.getElementById('imageViewerImage');
      return Boolean(image?.complete && image.naturalWidth > 0 && image.getAttribute('src') !== before);
    }, firstImageUrl);
  });
  await record('gallery-close', () => page.locator('#btnImageViewerClose').click(), async () => {
    assert(!(await page.locator('#imageViewerOverlay').getAttribute('class')).includes('open'), 'gallery viewer did not close');
  });
  await record('detail-favorite', () => page.locator('#btnDetailFav').click(), async () => assert(/Gespeichert/.test(await page.locator('#btnDetailFav').innerText()), 'detail favorite no effect'));
  await record('detail-compare', async () => {
    page._detailCompareBefore = await page.locator('#btnDetailComp').innerText();
    page._compareCountBefore = await page.locator('#compareCountPill').innerText();
    await page.locator('#btnDetailComp').click();
  }, async () => {
    assert(await page.locator('#btnDetailComp').innerText() !== page._detailCompareBefore, 'detail compare label did not change');
    assert(await page.locator('#compareCountPill').innerText() !== page._compareCountBefore, 'detail compare count did not change');
  });
  const download = (await Promise.all([page.waitForEvent('download'), page.getByText('GPX herunterladen', { exact: true }).click()]))[0];
  assert((await download.suggestedFilename()).endsWith('.gpx') && await download.failure() === null, 'GPX download failed'); functions.push({ id: 'gpx-download', status: 'PASS' });
  for (const label of ['Navigation starten', 'Komoot', 'BRouter']) {
    const link = page.getByText(label, { exact: true });
    const href = await link.getAttribute('href');
    assert(href && /^https:\/\//.test(href), `${label} target invalid`);
    const requestUrl = new URL(href); requestUrl.hash = '';
    await context.route(requestUrl.href, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Navigation target</title>' }), { times: 1 });
    const popupPromise = context.waitForEvent('page');
    await link.click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    assert(popup.url() === href, `${label} click opened wrong target`);
    await popup.close();
    functions.push({ id: `external-${label}`, status: 'PASS' });
  }
  await page.locator('#btnQuickLog').click();
  await page.waitForFunction(expected => document.getElementById('logRouteSelect')?.value === expected, routeId);
  functions.push({ id: 'quick-log-preselect', status: 'PASS' });

  const submit = page.locator('#formAddRideLog button[type="submit"]');
  await page.locator('#logDate').fill(''); await submit.click(); assert(await page.locator('#logDate').evaluate(element => !element.checkValidity()), 'date validation missing');
  await page.locator('#logDate').fill('2026-07-19'); await page.locator('#logDuration').fill('87'); await page.locator('#logBattery').fill('31'); await page.locator('#logWeather').fill('Trocken'); await page.locator('#logNotes').fill('Produkt-E2E-Test'); await submit.click();
  assert(await page.locator('.log-entry-card').count() === 1, 'log save failed'); functions.push({ id: 'log-save', status: 'PASS' });
  const exportDownload = (await Promise.all([page.waitForEvent('download'), page.locator('#btnExportLog').click()]))[0];
  assert((await exportDownload.suggestedFilename()).endsWith('.json') && await exportDownload.failure() === null, 'log export failed'); functions.push({ id: 'log-export', status: 'PASS' });
  await expectDialog(/löschen/i, 'dismiss', () => page.locator('.btn-delete-log').click()); assert(await page.locator('.log-entry-card').count() === 1, 'delete cancel failed');
  await expectDialog(/löschen/i, 'accept', () => page.locator('.btn-delete-log').click()); assert(await page.locator('.log-entry-card').count() === 0, 'delete confirm failed'); functions.push({ id: 'log-delete-both-paths', status: 'PASS' });
  const validImport = [{ id: 'log_import_1', date: '2026-07-18', routeId: 'kluet-feierabendrunde', routeName: 'Klüt-Feierabendrunde', durationMinutes: 75, batteryUsedPercent: 28, weather: 'Trocken', surfaceCondition: 'Trocken', rating: 5, notes: 'Importtest', createdAt: '2026-07-18T12:00:00Z' }];
  await expectDialog(/fehlerfrei/i, 'accept', () => page.locator('#fileImportLog').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(validImport)) }));
  assert(await page.locator('.log-entry-card').count() === 1, 'valid import failed'); functions.push({ id: 'log-import-valid', status: 'PASS' });
  await expectDialog(/Fehler/i, 'accept', () => page.locator('#fileImportLog').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{bad') }));
  assert(await page.locator('.log-entry-card').count() === 1, 'invalid import changed data'); functions.push({ id: 'log-import-invalid', status: 'PASS' });

  await openHome(page, baseUrl, remote);
  for (const [target, expected] of [['spontan', '#/ebike'], ['ebike', '#/ebike'], ['sport', '#/sport']]) {
    await page.locator(`#mobileDock [data-target="${target}"]`).click(); await page.waitForTimeout(80); assert(page.url().includes(expected), `dock ${target} failed`); functions.push({ id: `dock-${target}`, status: 'PASS' });
  }
  await page.locator('#mobileDock [data-target="compare"]').click(); assert((await page.locator('#compareModalOverlay').getAttribute('class')).includes('open'), 'dock compare failed'); await page.locator('#btnCloseCompare').click(); functions.push({ id: 'dock-compare', status: 'PASS' });
  await page.waitForLoadState('networkidle');

  const block = { ...runtime, layout: await layout(page) };
  await page.waitForLoadState('networkidle').catch(() => {});
  await context.unrouteAll({ behavior: 'wait' });
  await context.close();
  return { functions, blocking: block };
}

async function visualMatrix(browser, baseUrl, headers, remote) {
  const output = [];
  for (const config of MATRIX) {
    const context = await browser.newContext({ viewport: { width: config.width, height: config.height }, hasTouch: config.width <= 844, locale: 'de-DE' });
    await bindHeaders(context, baseUrl, headers);
    if (config.textScale !== 1) {
      await context.route(`${baseUrl}/ebike/__e2e-textscale.css*`, route => route.fulfill({
        status: 200,
        contentType: 'text/css; charset=utf-8',
        body: `html { font-size: ${16 * config.textScale}px !important; }`,
      }));
    }
    const page = await context.newPage();
    const runtime = watch(page, baseUrl, remote);
    await openHome(page, baseUrl, remote);
    if (config.textScale !== 1) {
      await page.evaluate(scale => new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `/ebike/__e2e-textscale.css?scale=${scale}`;
        link.onload = resolve;
        link.onerror = reject;
        document.head.append(link);
      }), config.textScale);
    }
    const states = [];
    const capture = async (state, anchor) => {
      if (!anchor) await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
      else {
        await page.locator(anchor).scrollIntoViewIfNeeded();
        await page.evaluate(selector => {
          const element = document.querySelector(selector);
          const header = document.querySelector('.app-header');
          if (!element) return;
          const safeTop = (header?.getBoundingClientRect().height || 0) + 8;
          window.scrollBy({ top: element.getBoundingClientRect().top - safeTop, behavior: 'instant' });
        }, anchor);
      }
      await page.waitForTimeout(100);
      const geometry = await layout(page);
      const image = await screenshot(page, `${config.id}-${state}`);
      states.push({ state, geometry, image });
    };
    await capture('home');
    await page.locator('#btnOpenCompare').click(); await capture('compare-empty', '#compareModalOverlay'); await page.locator('#btnCloseCompare').click();
    await page.locator('.route-card a[href*="#/tour/"]').first().click(); await page.locator('.leaflet-map[data-map-ready="true"]').waitFor(); await capture('detail-map', '.leaflet-map-shell');
    if (await page.locator('[data-gallery-index]').count()) {
      await page.locator('[data-gallery-index]').first().click();
      await page.locator('#imageViewerImage').waitFor({ state: 'visible' });
      await page.locator('#btnImageZoomIn').click();
      await capture('image-viewer', '#imageViewerOverlay');
      await page.locator('#btnImageViewerClose').click();
    }
    await page.locator('#btnQuickLog').click(); await page.locator('#formAddRideLog').waitFor(); await capture('log-form', '#logFormSection');
    await page.locator('#logDuration').fill('87'); await page.locator('#logBattery').fill('31'); await page.locator('#logNotes').fill('Probefahrt dokumentiert'); await page.locator('#formAddRideLog button[type="submit"]').click(); await capture('log-saved', '.log-entry-card');
    output.push({ config, states, runtime });
    await page.waitForLoadState('networkidle').catch(() => {});
    await context.unrouteAll({ behavior: 'wait' });
    await context.close();
  }
  return output;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const remote = remoteConfig();
  const server = remote.baseUrl ? null : await startServer();
  const address = server?.address();
  const baseUrl = remote.baseUrl || `http://127.0.0.1:${address.port}`;
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const result = {
      schema: 1,
      target: remote.baseUrl ? 'bound-live-target' : 'immutable-local-build',
      startedAt: new Date().toISOString(),
      representative: await representative(browser, baseUrl, remote.headers, Boolean(remote.baseUrl)),
      matrix: await visualMatrix(browser, baseUrl, remote.headers, Boolean(remote.baseUrl)),
    };
    result.finishedAt = new Date().toISOString();
    const blockers = [];
    const functionIds = result.representative.functions.map(item => item.id);
    const duplicateIds = functionIds.filter((id, index) => functionIds.indexOf(id) !== index);
    if (duplicateIds.length || JSON.stringify([...functionIds].sort()) !== JSON.stringify([...EXPECTED_FUNCTION_IDS].sort())) blockers.push('critical function inventory mismatch');
    const runtimeHasErrors = runtime => runtime.pageErrors.length || runtime.consoleErrors.length || runtime.requestFailures.length || runtime.httpErrors.length || runtime.unexpectedDialogs.length;
    const layoutHasOverflow = geometry => geometry.scrollWidth !== geometry.viewport || geometry.maxHorizontalScroll > 1 || geometry.offenders.length > 0;
    if (runtimeHasErrors(result.representative.blocking)) blockers.push('representative runtime errors');
    if (layoutHasOverflow(result.representative.blocking.layout)) blockers.push('representative overflow');
    for (const item of result.matrix) {
      if (runtimeHasErrors(item.runtime)) blockers.push(`${item.config.id} runtime errors`);
      for (const state of item.states) if (layoutHasOverflow(state.geometry)) blockers.push(`${item.config.id}/${state.state} overflow`);
    }
    result.blockers = blockers;
    result.status = blockers.length ? 'FAIL' : 'PASS';
    fs.writeFileSync(path.join(OUT, 'evidence.json'), JSON.stringify(result, null, 2));
    console.log(`${result.status}: ${result.representative.functions.length} real product functions; ${result.matrix.length} visual configurations; ${blockers.length} blockers`);
    if (blockers.length) process.exitCode = 1;
  } finally {
    await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(`FAIL: ${error.stack || error.message}`); process.exit(1); });
