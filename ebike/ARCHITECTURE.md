# Architektur

## Laufzeit

Die Seite ist statisch und nutzt ES-Module ohne Framework. `app.js` orchestriert die Oberfläche; fachliche Logik liegt in kleinen testbaren Modulen unter `ebike/js/`.

- `data.js`: strikte Katalognormalisierung und unveränderliche Daten.
- `filter.js`: Modus-, Zeit-, Schwierigkeits-, Oberflächen- und Suchfilter.
- `battery.js`: dokumentiertes Akku- und Zeitmodell.
- `storage.js`: versionierter, begrenzter, atomarer Browserimport.
- `dom.js`/`render.js`: DOM-Konstruktion ausschließlich mit `createElement`/`textContent`.
- `map.js`/`media.js`: lokale Trackprojektion und zukünftige barrierefreie Lightbox.

## Datenmodell

`routes.json` ist Schema 1.0. Statusfolge: `candidate` → `reviewed` → `ridden`; `retired` bleibt historisch. Technische Validierung promoted nie automatisch. Kandidaten haben `publicTrack: null` und `presentation.mode: track_only`.

## Netzwerk

Im Kernfluss wird ausschließlich `/ebike/routes.json` vom gleichen Origin geladen. Es gibt keine Wetter-, Karten-, Medien-, Analyse- oder Trackingrequests.

## n8n

`automation/n8n/ebike-candidate.workflow.json` ist ein inaktiver, manuell ausgelöster Export ohne Publish-, Git-, Mail-, Fetch- oder Credentialpfad. Lokale Fixtures und Python-Standardbibliothek prüfen Struktur, Quellenprovenienz, Tracks, Medienlizenz und Duplikatmarker. Produktiver Import/Activation ist nicht Teil dieses Releases.
