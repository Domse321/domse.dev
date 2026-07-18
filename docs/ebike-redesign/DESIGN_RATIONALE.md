# Design Rationale: Private E-Bike Tour App für Domse

## 1. Vision & Editorial Identity
Das Ziel dieser Web-App ist es, eine drastische visuelle und konzeptionelle Abkehr von herkömmlichen SaaS-Dashboards, administrativen Datenbank-Ansichten oder generischen KI-Generaten zu schaffen. Die App für Domse (`test.domse.dev/ebike/`) ist als **hochwertiges, digitales Outdoor-Magazin kombiniert mit präzisem Trail-Navigationswerkzeug und persönlichem Fahrtenarchiv** konzipiert.

### Warum kein generisches Dashboard?
Bisherige Entwürfe scheiterten an einer kühl-technischen Anmutung: graue Karten, monotone Tabellenraster, bürokratische Statusmeldungen („Review“, „Freigabe“, „Kandidat“) und ein Fokus auf Datensatzverwaltung statt auf die Vorfreude aufs Fahren. Die neue Architektur stellt das **Erlebnis, die Topografie, die Bildkraft und die sofortige Entscheidungsfindung** in den Mittelpunkt.

---

## 2. Visuelle Designsprache & Farbwelt
Statt eines sterilen Dark Modes oder flachen Weißrasts nutzt die App ein **natürliches, topografisch inspiriertes Farbsystem**:
- **Forest & Pine (`#1c3829`, `#14281d`, `#2d5a41`)**: Vermittelt die Wald- und Naturatmosphäre des Weserberglands, Süntels und Deisters.
- **Warm Stone & Birch (`#f4f1ea`, `#e6e1d6`, `#2b2d2f`)**: Editorial-Hintergründe für maximale Lesbarkeit, kontrastreiche Typografie und edle Haptik.
- **Electric Trail Amber (`#ff6b35`, `#f3a712`)**: Dynamische Akzentfarbe für Höhenprofile, aktive Tracks, spontane Call-to-Actions und E-MTB-Faktor.
- **Topografische Texturen**: Subtile Höhenlinien- und Kartografiemuster (als reine CSS-/SVG-Generierung) schaffen Tiefe ohne Ladezeit.

---

## 3. Die spontane visuelle Entscheidung (Einstieg nach Maß)
Gemäß Produktbrief (Anforderung 2) beginnt die App nicht mit einer langweiligen Filterleiste, sondern mit dem **„Adventure Mood & Time Selector“**:
1. **⚡ Heute Spontan / Feierabendrunde**: Für den schnellen Reset nach Feierabend (1,5–2 h, direkt ab Haustür).
2. **🌲 Kurze Runde & Halbtagestour**: Kompakte Waldabenteuer und aussichtsreiche 3–4 Stunden Routen.
3. **🏔️ Tagestour / Wochenende**: Epische Bögen ins Weserbergland mit maximalem Naturerlebnis.
4. **Bike-Profil-Umschalter**: Sofortiges Umschalten zwischen **E-MTB / Trail** (Fokus auf Wurzelpassagen, Waldwege und Abenteuer) und **Normalem E-Bike / Genuss** (Asphalt, Schotter, glatte Wege, geringe Verkehrsbelastung).

---

## 4. Echte Track-Darstellung via Custom SVG Topo Engine (ohne externe Bibliotheken)
 Da externe Kartenbibliotheken (wie Leaflet oder OpenLayers) und externe Frameworks verboten sind, wurde eine **proprietäre, performante SVG Topography & Track Engine (`js/svgMapEngine.js`)** entwickelt:
- **Direktes GeoJSON-Parsing**: Die Engine liest die Koordinatenreihen (`[lon, lat, ele]`) direkt aus den 30 lokalen `data/tracks/*.geojson`-Dateien.
- **Interaktiver Zoom & Pan**: Volle Unterstützung für Maus-Drag, Mausrad-Zoom, Touch-Pinch und Pan im SVG-ViewBox-Raum inkl. Vollbildmodus.
- **Topografisches Rendering**: Generierung von kartografischen Hintergrund-Gittern, Wegpunkt-Markern (A/B-Start/Ziel) und dynamischem Höhenfarbverlauf entlang der Strecke.
- **Privatsphären-Schutz**: Private Wohn- und Hauskoordinaten werden in der UI-Anzeige automatisch in allgemeine Wegpunkte („Start/Ziel Hameln“) anonymisiert. Der genaue Streckenverlauf bleibt ausschließlich im ignorierten privaten Runtime-Datensatz und wird nur hinter Cloudflare Access bereitgestellt.

---

## 5. Galerie-Nutzung & Topografische Kunst-Platzhalter
- Alle 30 Routen und sämtliche **88 Galerie-URLs** aus `routes.json` fließen nahtlos in die bildstarken Touren-Header und Lightbox-Galerien ein.
- **Keine graue Leere**: Für Routen ohne Fotos erzeugt der **Dynamic Topo Poster Generator** eine einzigartige, ästhetische SVG-Kartenkomposition auf Basis des realen GeoJSON-Tracks und des Höhenprofils.

---

## 6. Lokale Intelligenz: Fahrtenbuch, Vergleich & Akku-Modell
- **Tourenvergleich**: Bis zu 4 Touren können nebeneinander gelegt werden, um Distanz, Höhenmeter, Untergrund-Mix und Domse-Scores grafisch zu vergleichen.
- **Lokales Fahrtenbuch (Logbuch)**: Vollständiges Fahrten-Archiv (`localStorage`) zum Erfassen von gefahrenen Zeiten, realem Akkuverbrauch, Wetterkonditionen und Notizen inkl. JSON-Backup-Export.
- **Akku-Rechner**: Spezifische Schätzung für das *Bergamont Revox Sport 10* in den Modi Eco, Tour, eMTB und Turbo.
- **Ehrliches Wetter (Anforderung 9)**: Keine erfundenen Live-Wettewerte, sondern saubere Trennung von Offline-Planung und Link zu realen regionalen Hameln-Wetterdiensten.

---

## 7. Mobile Einhandbedienung & Desktop-Immersivität
- **Mobile Ergonomie**: Ein interaktives Thumb-Dock am unteren Bildschirmrand (`Spontan`, `Touren`, `Vergleich`, `Logbuch`) erlaubt schnelles Steuern mit dem Daumen. Große Touch-Targets und geschmeidige Slide-Panels.
- **Desktop**: Großzügige 2- bis 3-spaltige Magazin-Layouts, synchronisiertes Hovering zwischen Streckenkarte und Höhenprofil diagramm.
