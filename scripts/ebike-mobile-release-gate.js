#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PRIVATE_REQUIRED = process.env.REQUIRE_PRIVATE_EBIKE_DATA === '1';
const HAS_PRIVATE_DATA = fs.existsSync(path.join(ROOT, 'ebike/data/routes.json'));
const EVIDENCE_PATH = process.env.EBIKE_MOBILE_EVIDENCE || '/tmp/ebike-mobile-release-evidence.json';
const MIN_TOUCH_TARGET = 44;
const MATRIX = [
  { id: 'portrait-320', width: 320, height: 568, zoom: 1, orientation: 'portrait' },
  { id: 'portrait-360', width: 360, height: 800, zoom: 1, orientation: 'portrait' },
  { id: 'portrait-390', width: 390, height: 844, zoom: 1, orientation: 'portrait' },
  { id: 'portrait-430', width: 430, height: 932, zoom: 1, orientation: 'portrait' },
  { id: 'zoom-125', width: 390, height: 844, zoom: 1.25, orientation: 'portrait' },
  { id: 'zoom-200', width: 390, height: 844, zoom: 2, orientation: 'portrait' },
  { id: 'landscape-320', width: 568, height: 320, zoom: 1, orientation: 'landscape' },
  { id: 'landscape-390', width: 844, height: 390, zoom: 1, orientation: 'landscape' },
];

function loadPlaywright() {
  const candidates = [process.env.EBIKE_PLAYWRIGHT_MODULE, 'playwright'].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  return null;
}

const playwright = loadPlaywright();
if (!playwright) {
  if (PRIVATE_REQUIRED) {
    console.error('FAIL: Playwright is required by the private E-Bike deployment gate but is not installed');
    process.exit(2);
  }
  console.log('SKIP: optional Playwright mobile/interactions gate (not installed in public checkout)');
  process.exit(0);
}
if (PRIVATE_REQUIRED && !HAS_PRIVATE_DATA) {
  console.error('FAIL: private E-Bike data is required but ebike/data/routes.json is missing');
  process.exit(2);
}

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.gpx', 'application/gpx+xml; charset=utf-8'], ['.geojson', 'application/geo+json; charset=utf-8'],
  ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
]);

function startServer() {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://local').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    let file = path.resolve(ROOT, relative);
    if (!file.startsWith(`${ROOT}${path.sep}`)) {
      response.writeHead(403).end('forbidden'); return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (error, body) => {
      if (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('not found'); return; }
      response.writeHead(200, { 'Content-Type': MIME.get(path.extname(file)) || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(body);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function attachRuntimeEvidence(page, baseUrl) {
  const evidence = { console: [], pageerror: [], requestfailed: [], httpErrors: [] };
  page.on('console', message => {
    if (message.type() === 'error') evidence.console.push({ type: message.type(), text: message.text() });
  });
  page.on('pageerror', error => evidence.pageerror.push(error.message));
  page.on('requestfailed', request => {
    evidence.requestfailed.push({ url: request.url(), method: request.method(), error: request.failure()?.errorText || 'unknown' });
  });
  page.on('response', response => {
    if (response.status() >= 400) evidence.httpErrors.push({ url: response.url(), status: response.status() });
  });
  evidence.blocking = () => ({
    console: evidence.console,
    pageerror: evidence.pageerror,
    requestfailed: evidence.requestfailed.filter(item => item.url.startsWith(baseUrl)),
    httpErrors: evidence.httpErrors.filter(item => item.url.startsWith(baseUrl)),
  });
  return evidence;
}

async function inspectPage(page) {
  return page.evaluate(minimum => {
    const visible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const describe = element => {
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName.toLowerCase(), id: element.id || null,
        className: typeof element.className === 'string' ? element.className : null,
        text: (element.innerText || element.getAttribute('aria-label') || element.title || '').trim().slice(0, 100),
        width: Math.round(rect.width * 10) / 10, height: Math.round(rect.height * 10) / 10,
      };
    };
    const targets = [...document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, label[for]')].filter(visible);
    const title = document.querySelector('.detail-title');
    const titleRect = title?.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    return {
      dimensions: {
        viewportWidth,
        visualViewportWidth: window.visualViewport?.width || viewportWidth,
        scrollWidth: document.documentElement.scrollWidth,
      },
      horizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 1,
      touchTargets: { total: targets.length, failures: targets.filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width + 0.5 < minimum || rect.height + 0.5 < minimum;
      }).map(describe) },
      detailTitle: title ? {
        text: title.textContent.trim(),
        clientWidth: title.clientWidth, scrollWidth: title.scrollWidth,
        whiteSpace: getComputedStyle(title).whiteSpace,
        overflowWrap: getComputedStyle(title).overflowWrap,
        withinViewport: titleRect.left >= -1 && titleRect.right <= viewportWidth + 1,
        reflows: title.scrollWidth <= title.clientWidth + 1 && getComputedStyle(title).whiteSpace !== 'nowrap',
      } : null,
      inventory: {
        button: document.querySelectorAll('button').length,
        form: document.querySelectorAll('form').length,
        navigation: document.querySelectorAll('nav, a[href]').length,
        inputs: document.querySelectorAll('input, select, textarea').length,
      },
    };
  }, MIN_TOUCH_TARGET);
}

function scenarioFailures(id, kind, audit, runtime) {
  const failures = [];
  if (audit.inventory.button === 0 || audit.inventory.navigation === 0) failures.push(`${id}/${kind}: button/navigation inventory is empty`);
  if (audit.horizontalOverflow) failures.push(`${id}/${kind}: horizontal overflow (${audit.dimensions.scrollWidth}>${audit.dimensions.viewportWidth})`);
  if (audit.touchTargets.failures.length) failures.push(`${id}/${kind}: ${audit.touchTargets.failures.length}/${audit.touchTargets.total} touch targets below ${MIN_TOUCH_TARGET}px`);
  if (kind === 'detail' && (!audit.detailTitle || !audit.detailTitle.reflows || !audit.detailTitle.withinViewport)) {
    failures.push(`${id}/${kind}: detail title does not reflow inside viewport`);
  }
  for (const [channel, items] of Object.entries(runtime.blocking())) {
    if (items.length) failures.push(`${id}/${kind}: ${items.length} blocking ${channel} event(s)`);
  }
  return failures;
}

async function exerciseTrustedInteractions(page) {
  const result = { click: false, keyboardEnter: false, keyboardSpace: false, inventory: {} };
  const compare = page.locator('#btnOpenCompare');
  await compare.click();
  result.click = await page.locator('#compareModalOverlay.open').isVisible();
  const close = page.locator('#btnCloseCompare');
  await close.focus();
  await close.press('Enter');
  result.keyboardEnter = !(await page.locator('#compareModalOverlay.open').isVisible());
  const theme = page.locator('#btnToggleTheme');
  await theme.focus();
  await theme.press('Space');
  result.keyboardSpace = (await page.locator('html').getAttribute('data-theme')) === 'dark';

  await page.locator('#mobileDock .dock-btn').nth(3).press('Enter');
  await page.waitForSelector('form');
  result.inventory.sport = await inspectPage(page);
  if (result.inventory.sport.inventory.form === 0 || result.inventory.sport.inventory.inputs === 0) {
    throw new Error('sport/log form inventory is empty');
  }
  await page.locator('#logoLink').click();
  if (HAS_PRIVATE_DATA) await page.waitForSelector('.route-card');
  return result;
}

(async () => {
  const server = await startServer();
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const browser = await playwright.chromium.launch({ headless: true });
  const report = {
    generatedAt: new Date().toISOString(),
    contract: { minimumTouchTarget: MIN_TOUCH_TARGET, privateRequired: PRIVATE_REQUIRED, privateDataPresent: HAS_PRIVATE_DATA, interactionPolicy: 'Playwright locator click/press only; no forced or synthetic DOM events' },
    matrix: [], interactions: null, failures: [], summary: {},
  };
  try {
    for (const config of MATRIX) {
      const context = await browser.newContext({ viewport: { width: config.width, height: config.height }, deviceScaleFactor: 1, hasTouch: true });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: config.zoom });
      const runtime = attachRuntimeEvidence(page, baseUrl);
      await page.goto(`${baseUrl}/ebike/`, { waitUntil: 'domcontentloaded' });
      if (HAS_PRIVATE_DATA) await page.waitForSelector('.route-card');
      else await page.waitForSelector('.data-load-error');
      const home = await inspectPage(page);
      const homeFailures = scenarioFailures(config.id, 'home', home, runtime);
      const item = { config, home, detail: null, runtime: null, failures: [...homeFailures] };
      if (HAS_PRIVATE_DATA) {
        await page.locator('.route-card a[href*="#/tour/"]').first().click();
        await page.waitForSelector('.detail-title');
        const detail = await inspectPage(page);
        item.detail = detail;
        item.failures.push(...scenarioFailures(config.id, 'detail', detail, runtime));
      }
      item.runtime = { console: runtime.console, pageerror: runtime.pageerror, requestfailed: runtime.requestfailed, httpErrors: runtime.httpErrors };
      report.failures.push(...item.failures);
      report.matrix.push(item);
      await context.close();
    }

    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await context.newPage();
    const runtime = attachRuntimeEvidence(page, baseUrl);
    await page.goto(`${baseUrl}/ebike/`, { waitUntil: 'domcontentloaded' });
    if (HAS_PRIVATE_DATA) await page.waitForSelector('.route-card');
    else await page.waitForSelector('.data-load-error');
    report.interactions = await exerciseTrustedInteractions(page);
    if (!report.interactions.click || !report.interactions.keyboardEnter || !report.interactions.keyboardSpace) {
      report.failures.push('trusted click/keyboard interaction assertions failed');
    }
    const interactionBlocking = runtime.blocking();
    if (Object.values(interactionBlocking).some(items => items.length)) report.failures.push('interaction run emitted blocking console/network evidence');
    report.interactions.runtime = { console: runtime.console, pageerror: runtime.pageerror, requestfailed: runtime.requestfailed, httpErrors: runtime.httpErrors };
    await context.close();
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }

  report.summary = {
    configurations: MATRIX.length,
    auditedPages: report.matrix.reduce((sum, item) => sum + 1 + Number(Boolean(item.detail)), 0),
    auditedTouchTargets: report.matrix.reduce((sum, item) => sum + item.home.touchTargets.total + (item.detail?.touchTargets.total || 0), 0),
    touchTargetFailures: report.matrix.reduce((sum, item) => sum + item.home.touchTargets.failures.length + (item.detail?.touchTargets.failures.length || 0), 0),
    failureCount: report.failures.length,
  };
  fs.mkdirSync(path.dirname(EVIDENCE_PATH), { recursive: true });
  fs.writeFileSync(EVIDENCE_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`evidence: ${EVIDENCE_PATH}`);
  console.log(`mobile gate: ${report.summary.configurations} configurations, ${report.summary.auditedPages} pages, ${report.summary.auditedTouchTargets} touch targets, ${report.summary.failureCount} failures`);
  if (report.failures.length) {
    for (const failure of report.failures) console.error(`FAIL: ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('ok: E-Bike mobile/interactions release gate passed');
  }
})().catch(error => {
  console.error(`FAIL: mobile release gate crashed: ${error.stack || error}`);
  process.exitCode = 1;
});
