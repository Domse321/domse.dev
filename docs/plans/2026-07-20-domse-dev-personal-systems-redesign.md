# domse.dev Personal Systems Redesign — Implementation Plan

> **For Hermes:** Use subagent-driven-development discipline with one integration owner. Parallel agents review design, UX and technical risk; shared landing files are edited only by the integrator.

**Goal:** Replace the generic glassmorphism landing page with a distinctive, personal, production-ready “Personal Systems / Werkstattjournal” experience that presents Domse’s real tools, Homelab, code and media clearly on desktop and mobile.

**Architecture:** Keep the site framework-free and progressively enhanced. The complete experience lives in semantic HTML and works without JavaScript; CSS provides the editorial dark design system; JavaScript only adds safe project interactions, a concrete Homelab flow selector and click-to-load YouTube playback. No external API or third-party player is required for first paint.

**Tech Stack:** HTML5, CSS custom properties, SVG, vanilla JavaScript, Node’s built-in test runner, Python static validation and Playwright for user-flow verification.

---

## Product principles

1. Personal and concrete, not corporate or “AI dashboard”.
2. E-Bike and Sport are the two primary products and the only global navigation links.
3. Brand/logo links to `/` on `/`, `/ebike/` and `/sport/`.
4. E-Bike remains untouched except for the incorrect brand target `#/` → `/`.
5. Core content is visible and navigable without JavaScript.
6. No internal IPs, tokens, private routes or security-posture copy.
7. No YouTube request before an explicit play action.
8. No external API response rendered through `innerHTML`.
9. Mobile is a first-class layout at 320/360/390/430 px and 200% text.
10. Verification prioritizes real clicks and visible effects over abstract test counts.

## Information architecture

1. Compact global header: brand + E-Bike + Sport.
2. Personal hero: one clear statement, product actions, original systems graphic.
3. Project Switchboard: large E-Bike and Sport modules with meaningful micro-interactions.
4. Build Log: real recent work, concise and chronological.
5. Homelab stories: “Veröffentlichen”, “Automatisieren”, “Betreiben” as user-facing flows.
6. Media reel: local previews; privacy-friendly video modal loaded only on click.
7. Curated code: three real repositories with useful descriptions, no live API dump.
8. Compact social/footer close.

## Scope and file ownership

### Landing integration owner

- Replace: `index.html`
- Replace: `assets/site.css`
- Replace: `assets/site.js`
- Add: `assets/landing/*`
- Add: `tests/landing.test.js`
- Add: `scripts/validate-landing.py`
- Update: `package.json`
- Update: `README.md`

### Protected subpages

- Modify only `ebike/index.html`: brand `href="#/"` → `href="/"`, add accessible home label.
- Verify only `sport/index.html`: existing brand `href="/"` remains unchanged.
- No other `ebike/**` or `sport/**` changes.

## Task 1: Baseline and regression contract

**Objective:** Capture protected scope and write tests that initially fail for the old landing page.

1. Record base SHA `8856db6` and protected subpage hashes.
2. Add tests for:
   - exactly one H1;
   - canonical/OG metadata;
   - only E-Bike and Sport in global nav;
   - all three brand links target `/`;
   - no old `domse.dev-2.0`, fake live status, terminal block or GitHub API dependency;
   - static curated product/repository/media content;
   - safe video ID validation and modal behavior;
   - no initial YouTube iframe.
3. Run tests and confirm the redesign-specific assertions fail.

## Task 2: Semantic landing structure

**Objective:** Build the full no-JavaScript product experience.

1. Replace old duplicated hero/strip/overview with the new hierarchy.
2. Add skip link, canonical, Open Graph, Twitter and JSON-LD metadata.
3. Add two primary project modules with inline SVG visualizations.
4. Add factual build-log entries.
5. Add three Homelab flow panels with a complete static fallback.
6. Add three media previews and direct YouTube fallback links.
7. Add three curated public repositories.
8. Add compact footer and social links.

## Task 3: Design system

**Objective:** Implement a distinctive editorial-technical visual language.

1. Consolidate CSS into tokens, base, layout, components, interaction states and responsive sections.
2. Use near-black, warm paper, amber and cyan only; remove violet/green status theatre.
3. Use strong editorial typography with system-first font stack and no external font dependency.
4. Use open composition, sharp grid lines and controlled surfaces instead of a card wall.
5. Keep all touch targets ≥44 px and add strong `:focus-visible` styles.
6. Make animation progressive, short and nonessential; respect reduced motion.
7. Ensure mobile header stays one row and ≤72 px.

## Task 4: Progressive interactions

**Objective:** Add useful, safe behavior without hiding core content.

1. Project modules react to pointer/focus without requiring hover.
2. Homelab flow selector updates selected panel with full tab semantics and keyboard arrows.
3. Video buttons validate allowlisted IDs, then create a `youtube-nocookie.com` iframe on click.
4. Modal traps meaningful focus, closes via button/backdrop/Escape and restores focus.
5. Add no-JS-safe default states.
6. Do not fetch GitHub or any third-party API.

## Task 5: Media and sharing assets

**Objective:** Improve first paint and share presentation.

1. Save local optimized video preview images.
2. Create a local 1200×630 Open Graph preview.
3. Add favicon/SVG mark.
4. Set image dimensions/aspect ratios to prevent layout shift.
5. Keep initial first-party transfer modest and verify no initial YouTube requests.

## Task 6: Subpage return path

**Objective:** Make both tool logos return to the main landing page.

1. Change only `ebike/index.html` brand target from `#/` to `/`.
2. Add `aria-label="Zur domse.dev Startseite"`.
3. Verify the E-Bike router does not intercept the link.
4. Verify Sport already links to `/`.
5. Diff `ebike/**` and `sport/**` against base to prove no other changes.

## Task 7: Practical product verification

**Objective:** Exercise every important behavior like a real visitor.

1. Serve the repository locally.
2. Desktop 1440×900:
   - inspect hero and page rhythm;
   - activate both project links;
   - switch all Homelab flows;
   - open/close each video via button, Escape and backdrop;
   - verify social/repository links.
3. Mobile 320×568, 360×800, 390×844, 430×932:
   - brand and both nav links remain visible;
   - no horizontal overflow;
   - project actions, flow selector and video controls are tappable;
   - modal stays within viewport.
4. Repeat representative 390 px flow at 200% text.
5. Keyboard-only pass: skip link, nav, products, flow tabs, media modal.
6. Reduced-motion pass.
7. Confirm no console errors or failed first-party resources.
8. Confirm zero YouTube requests before play and expected nocookie request after play.

## Task 8: Independent review and revision

**Objective:** Catch visual or functional misses before release.

1. Run independent spec review against the exact candidate SHA/tree.
2. Run independent visual/UX review on desktop and mobile screenshots.
3. Run code/security review of HTML/CSS/JS and release diff.
4. Fix every critical/important issue.
5. Repeat practical tests after fixes, not only unit tests.

## Task 9: Release

**Objective:** Publish one verified, reversible release.

1. Run Node, Python, HTML, JS syntax, diff and secret checks.
2. Confirm only intended E-Bike line and no Sport files changed.
3. Commit with neutral release message.
4. Push through the configured repository deployment identity without documenting credentials or local secret paths.
5. Trigger the established production deployment path.
6. Verify deployed revision and repository SHA match.
7. Verify public `/`, `/ebike/`, `/sport/`, all cache-coupled assets and headers.
8. Repeat live browser smoke, console, mobile screenshot and logo-return tests.
9. Verify separately managed E-Bike runtime data remains available after release.

## Release acceptance criteria

- Landing page looks deliberately art-directed, not like generic glassmorphism.
- H1 and one primary action are visible in the 390×844 first viewport.
- Header is one row and remains usable at 320 px and 200% text.
- Global nav contains only E-Bike and Sport.
- Logo click from E-Bike and Sport returns to `https://domse.dev/`.
- E-Bike has no unrelated diff and its full product gate still passes.
- Every important new control was clicked and its visible effect observed.
- No page content depends on JavaScript, GitHub API or an initial YouTube load.
- No console errors, first-party 4xx/5xx, horizontal overflow or hidden content.
- Public production SHA matches the committed SHA.
