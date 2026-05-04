# domse.dev

Personal portfolio website for Domse321.

The site combines gaming/content highlights, a Steam-style profile section, small code/project cards, and a lightweight AI-backed interaction layer through the server-side `/api/gemini` proxy.

## Live site

```text
https://domse.dev
```

## Tech stack

- React
- Vite
- Tailwind CSS
- lucide-react icons
- Server-side Gemini proxy for AI interactions

## Local development

```bash
npm install
npm run build
npm run preview
```

For development with a live Vite server, run:

```bash
npx vite --host 127.0.0.1
```

## Assets

Static media files are stored under:

```text
public/assets/
```

Vite serves these files from `/assets/...` in the browser.

## Deployment

Deployments are handled from this repository. The production version is served at `https://domse.dev`.
