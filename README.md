# domse.dev

Dies ist die persönliche Website von Domse321.

Die Seite bündelt Gaming, Content, kleine Code-Projekte und persönliche Links an einem Ort. Sie ist bewusst als eigene Portfolio-/Profilseite gebaut und läuft öffentlich unter:

```text
https://domse.dev
```

## Inhalt

- persönlicher Einstieg mit Gaming-/Creator-Fokus
- Steam-Profilbereich mit Lieblingsspielen und Status-Optik
- Content- und Social-Links
- kleine Skript-/Projektsektion
- KI-gestützte Spiel-Challenges und Tech-Stack-Texte über einen serverseitigen Proxy

## Technik

- React
- Vite
- Tailwind CSS
- lucide-react Icons
- eigener Node-Server für statische Dateien und den `/api/gemini` Proxy
- Deployment über self-hosted GitHub Actions Runner
- Hosting hinter Nginx Proxy Manager und Cloudflare Tunnel

## Medien

Die statischen Bilder und Videos liegen gesammelt unter:

```text
public/assets/
```

So bleibt das Projekt übersichtlich und die Website kann ihre Medien direkt aus dem eigenen Build ausliefern.

## Deployment

Änderungen auf `main` werden automatisch gebaut und auf `https://domse.dev` veröffentlicht.

Der produktive Build landet auf dem Server unter:

```text
/srv/domse-dev-site
```

Die Website wird über den domse.dev-Serverprozess ausgeliefert; sensible API-Schlüssel bleiben serverseitig und werden nicht im Frontend veröffentlicht.
