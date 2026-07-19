#!/usr/bin/env node
'use strict';

const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const base = (process.env.LANDING_BASE_URL || 'http://127.0.0.1:18777').replace(/\/$/, '');
const artifacts = process.env.LANDING_ARTIFACTS || '/tmp/domse-landing-gate';
fs.mkdirSync(artifacts, { recursive: true });

function check(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const configurations = [
    { name: 'desktop', width: 1440, height: 900, text: 100 },
    { name: 'tablet', width: 768, height: 1024, text: 100 },
    { name: 'mobile-320', width: 320, height: 568, text: 100 },
    { name: 'mobile-360', width: 360, height: 800, text: 100 },
    { name: 'mobile-390', width: 390, height: 844, text: 100 },
    { name: 'mobile-430', width: 430, height: 932, text: 100 },
    { name: 'mobile-390-text-200', width: 390, height: 844, text: 200 }
  ];

  try {
    for (const config of configurations) {
      const context = await browser.newContext({ viewport: { width: config.width, height: config.height }, reducedMotion: config.name === 'tablet' ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const failedFirstParty = [];
      const youtubeRequests = [];

      page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('requestfailed', (request) => {
        if (request.url().startsWith(base)) failedFirstParty.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`);
      });
      page.on('request', (request) => {
        if (/youtube|googlevideo|doubleclick/i.test(request.url())) youtubeRequests.push(request.url());
      });

      await page.goto(`${base}/`, { waitUntil: 'networkidle' });
      if (config.text !== 100) await page.evaluate((value) => { document.documentElement.style.fontSize = `${value}%`; }, config.text);
      await page.waitForTimeout(150);

      const geometry = await page.evaluate(() => {
        const header = document.querySelector('.global-header').getBoundingClientRect();
        const h1 = document.querySelector('h1').getBoundingClientRect();
        const primary = document.querySelector('.hero-actions .button-primary').getBoundingClientRect();
        const controls = [...document.querySelectorAll('.global-header a, .hero-actions a, .project-card, .flow-tabs button, .reel-play, .video-close, .video-modal-actions a, .video-modal-actions button, .footer-links a, .footer-bottom a')]
          .filter((element) => getComputedStyle(element).display !== 'none' && element.getClientRects().length > 0)
          .map((element) => ({ label: element.getAttribute('aria-label') || element.textContent.trim().slice(0, 50), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
        const images = [...document.images].map((image) => ({ src: image.getAttribute('src'), complete: image.complete, naturalWidth: image.naturalWidth }));
        const componentOverflow = [...document.querySelectorAll('.system-note, .project-card, .flow-panel, .reel-card, .code-list > a, .site-footer')]
          .filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
          .map((element) => element.className);
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          headerHeight: header.height,
          h1Top: h1.top,
          h1Bottom: h1.bottom,
          primaryBottom: primary.bottom,
          controls,
          images,
          componentOverflow
        };
      });

      check(geometry.scrollWidth <= geometry.clientWidth + 1, `${config.name}: horizontal overflow ${geometry.scrollWidth}/${geometry.clientWidth}`);
      check(geometry.componentOverflow.length === 0, `${config.name}: internal component overflow: ${geometry.componentOverflow.join(', ')}`);
      check(geometry.h1Top >= 0 && geometry.h1Bottom <= config.height, `${config.name}: H1 not visible in first viewport`);
      if (config.name === 'mobile-390') check(geometry.primaryBottom <= config.height, `${config.name}: primary action not visible in first viewport`);
      if (config.width <= 430 && config.text === 100) check(geometry.headerHeight <= 72, `${config.name}: mobile header too tall (${geometry.headerHeight}px)`);
      for (const control of geometry.controls) {
        check(control.height >= 43.5, `${config.name}: touch target too short: ${control.label} (${control.height}px)`);
      }
      check(youtubeRequests.length === 0, `${config.name}: YouTube contacted before explicit play`);
      check(failedFirstParty.length === 0, `${config.name}: first-party request failed: ${failedFirstParty.join(', ')}`);
      check(pageErrors.length === 0, `${config.name}: page errors: ${pageErrors.join(', ')}`);
      check(consoleErrors.length === 0, `${config.name}: console errors: ${consoleErrors.join(', ')}`);

      await page.locator('[data-flow="automate"]').click();
      check(await page.locator('#flow-automate').isVisible(), `${config.name}: automation panel did not become visible`);
      check(!(await page.locator('#flow-publish').isVisible()), `${config.name}: previous flow panel stayed visible`);
      await page.locator('[data-flow="automate"]').press('ArrowRight');
      check(await page.locator('#flow-operate').isVisible(), `${config.name}: keyboard flow selection failed`);

      const play = page.locator('[data-video-id="i3xdJkqxBK8"]');
      await play.scrollIntoViewIfNeeded();
      await play.click();
      await page.waitForSelector('#videoPlayer iframe');
      check((await page.locator('#videoPlayer iframe').getAttribute('src')).startsWith('https://www.youtube-nocookie.com/embed/i3xdJkqxBK8'), `${config.name}: wrong video iframe URL`);
      check(await page.locator('#videoPlayer iframe').getAttribute('tabindex') === '-1', `${config.name}: cross-origin iframe is keyboard focusable`);
      check(await page.locator('#videoModal').isVisible(), `${config.name}: video modal not visible`);
      await page.locator('.video-close').press('Tab');
      check(await page.locator('#videoPlaybackToggle').evaluate((element) => document.activeElement === element), `${config.name}: focus did not enter custom playback control`);
      await page.locator('#videoPlaybackToggle').press('Enter');
      check(await page.locator('#videoPlaybackToggle').textContent() === 'Weiter abspielen', `${config.name}: pause control did not update`);
      await page.keyboard.press('Escape');
      check(!(await page.locator('#videoModal').isVisible()), `${config.name}: Escape did not close modal`);
      check(await play.evaluate((element) => document.activeElement === element), `${config.name}: video focus was not restored`);

      if (config.name === 'desktop' || config.name === 'mobile-390') {
        await page.screenshot({ path: path.join(artifacts, `${config.name}.png`), fullPage: true });
      }
      results.push({ config: config.name, overflow: false, headerHeight: Math.round(geometry.headerHeight), interactions: ['flow-click', 'flow-keyboard', 'video-open', 'video-escape'] });
      await context.close();
    }

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    await page.locator('a[aria-label="E-Bike Scout öffnen"]').click();
    await page.waitForURL(/\/ebike\//);
    check(await page.locator('#logoLink').getAttribute('href') === '/', 'E-Bike logo href is not /');
    await page.locator('#logoLink').click();
    await page.waitForURL((url) => url.pathname === '/');
    await page.locator('a[aria-label="Domse Sportplan öffnen"]').click();
    await page.waitForURL(/\/sport\//);
    check(await page.locator('.brand').getAttribute('href') === '/', 'Sport logo href is not /');
    await page.locator('.brand').click();
    await page.waitForURL((url) => url.pathname === '/');
    results.push({ config: 'cross-page-navigation', interactions: ['landing-to-ebike', 'ebike-logo-home', 'landing-to-sport', 'sport-logo-home'] });
    await context.close();

    console.log(JSON.stringify({ status: 'PASS', base, configurations: results }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`LANDING_GATE_FAIL: ${error.message}`);
  process.exit(1);
});
