'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

test('gallery thumbnails are real accessible image-viewer buttons', () => {
  assert.match(app, /<button class="gallery-item gallery-open" type="button" data-gallery-index=/);
  assert.match(app, /aria-label="\$\{h\(img\.title \|\| route\.name\)\} groß ansehen"/);
  assert.match(app, /openImageViewer\(safeGallery, Number\(button\.dataset\.galleryIndex\), button\)/);
});

test('image viewer exposes labelled controls and modal semantics', () => {
  for (const id of ['imageViewerOverlay', 'imageViewerImage', 'btnImageViewerClose', 'btnImageViewerPrev', 'btnImageViewerNext', 'btnImageZoomOut', 'btnImageZoomIn', 'btnImageZoomReset']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(html, /aria-hidden="true"/);
});

test('zoom is bounded and supports wheel, pinch, drag and keyboard', () => {
  assert.match(app, /Math\.min\(5, Math\.max\(1,/);
  assert.match(app, /addEventListener\('wheel'/);
  assert.match(app, /pointerDistance/);
  assert.match(app, /addEventListener\('pointermove'/);
  assert.match(app, /event\.key === '\+'/);
  assert.match(app, /event\.key === 'ArrowRight'/);
  assert.match(css, /\.image-viewer-stage\s*\{[^}]*touch-action:\s*none;/s);
  assert.match(css, /\.image-viewer-control,[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;/);
});

test('viewer keeps external image URLs behind the existing gallery allowlist', () => {
  assert.match(app, /safeUrl: _Security\.safeExternalUrl\(image\.url, 'gallery'\)/);
  assert.match(app, /ImageViewerState\.items = items\.map\(item => \(\{ safeUrl: item\.safeUrl,/);
  assert.doesNotMatch(app, /openImageViewer\(route\.gallery/);
});
