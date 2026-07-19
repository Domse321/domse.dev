const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/site.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'assets/site.js'), 'utf8');
const ebike = fs.readFileSync(path.join(root, 'ebike/index.html'), 'utf8');
const sport = fs.readFileSync(path.join(root, 'sport/index.html'), 'utf8');

function count(pattern, text) {
  return [...text.matchAll(pattern)].length;
}

test('landing has one semantic H1 and complete sharing metadata', () => {
  assert.equal(count(/<h1\b/gi, html), 1);
  assert.match(html, /<link rel="canonical" href="https:\/\/domse\.dev\/">/);
  assert.match(html, /property="og:image" content="https:\/\/domse\.dev\/assets\/landing\/og-domse\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.ok(fs.existsSync(path.join(root, 'assets/landing/og-domse.png')));
  assert.ok(fs.existsSync(path.join(root, 'assets/landing/favicon.svg')));
});

test('global navigation is intentionally limited to E-Bike and Sport', () => {
  const nav = html.match(/<nav class="global-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.equal(count(/<a\b/gi, nav), 2);
  assert.match(nav, /href="\/ebike\/"[^>]*>E-Bike<\/a>/);
  assert.match(nav, /href="\/sport\/"[^>]*>Sport<\/a>/);
});

test('all three brand links return to the domse.dev homepage', () => {
  assert.match(html, /class="global-brand" href="\/" aria-label="Zur domse\.dev Startseite"/);
  assert.match(ebike, /href="\/" class="brand-logo" id="logoLink"[^>]*aria-label="Zur domse\.dev Startseite"/);
  assert.match(sport, /class="brand" href="\/" aria-label="Zur domse\.dev Startseite"/);
  assert.doesNotMatch(ebike, /id="logoLink"[^>]*href="#\/"/);
});

test('core landing content is static and not dependent on GitHub or YouTube', () => {
  for (const name of ['E-Bike Scout', 'Sportplan', 'domse.dev', 'Rust Scrap Calculator', 'Hyper-V VM Inventory']) {
    assert.match(html, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(html, /<iframe\b/i);
  assert.doesNotMatch(js, /api\.github\.com|\bfetch\s*\(/);
  assert.doesNotMatch(js, /\.innerHTML\s*=/);
});

test('old generic status theatre and renamed repository copy are gone', () => {
  assert.doesNotMatch(html, /Offizielle Projektzentrale|domse\.dev live|serve --domain|Repos werden geladen/i);
  assert.doesNotMatch(html + js, /domse\.dev-2\.0/);
  assert.doesNotMatch(css, /conic-gradient|animation:\s*(float|spin|pulse)/i);
});

test('video player is explicit, allowlisted and privacy enhanced', () => {
  assert.equal(count(/data-video-id=/g, html), 3);
  assert.match(html, /<dialog class="video-modal"/);
  assert.match(html, /id="videoPlaybackToggle"/);
  assert.match(js, /const allowedVideos = new Map/);
  assert.match(js, /youtube-nocookie\.com\/embed/);
  assert.match(js, /encodeURIComponent\(id\)/);
  assert.match(js, /frame\.tabIndex = -1/);
  assert.match(js, /player\.replaceChildren\(frame\)/);
});

test('Homelab selector has complete tab semantics and keyboard behavior', () => {
  assert.equal(count(/role="tab"/g, html), 3);
  assert.equal(count(/role="tabpanel"/g, html), 3);
  assert.match(js, /ArrowRight/);
  assert.match(js, /ArrowLeft/);
  assert.match(js, /aria-selected/);
  assert.match(js, /panel\.hidden = !active/);
});

test('local media assets have fixed dimensions and exist', () => {
  for (const name of ['the-script.jpg', 'manhunt.jpg', 'rust-harbor.jpg']) {
    assert.ok(fs.existsSync(path.join(root, 'assets/landing', name)), name);
  }
  assert.equal(count(/<img[^>]+width="1280"[^>]+height="720"/g, html), 3);
});

test('design includes visible focus, reduced motion and mobile safeguards', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /min-width:\s*320px/);
  assert.match(css, /min-height:\s*44px/);
});
