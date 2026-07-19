# domse.dev

Public source for [domse.dev](https://domse.dev/) and its two tools:

- `/ebike/` — E-Bike Scout for routes, GPX, maps, elevation and ride planning
- `/sport/` — local dumbbell routine with timer and progress tracking

The landing page is framework-free, works without JavaScript and uses progressive enhancement for the Homelab flow selector and privacy-friendly click-to-load video playback.

## Local preview

```bash
python3 -m http.server 8080
```

Open `http://127.0.0.1:8080/`.

## Verification

```bash
npm run test:landing
npm run test:all
```

Production deploys from `main` through the established automated release path.
