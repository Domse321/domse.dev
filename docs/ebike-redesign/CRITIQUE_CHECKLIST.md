# Critique Checklist: E-Bike Touren-App für Domse

Diese Checkliste dient der systematischen, selbstkritischen Überprüfung der gebauten Greenfield-App gegen alle verbindlichen Anforderungen aus `PROJECT_BRIEF.md`.

---

## A. Verbindliche Funktionsprüfung (Die 12 Gebote)

- [ ] **1. Alle 30 Touren erhalten**: Werden alle 30 Routen aus `data/routes.json` vollständig geladen, filterbar und fehlerfrei angezeigt?
- [ ] **2. Einstieg über visuelle Entscheidung**: Gibt es auf der Startseite eine intuitive, bildstarke Auswahl nach Zeitfenster (spontan, kurze Runde, Halbtag, Tagestour) und Bike-Typ (MTB/E-MTB vs. normales E-Bike)?
- [ ] **3. Bildstarke Tourenansicht & 88 Galerien**: Nutzen die Touren-Detailansichten die echten `gallery`-URLs (`88` insgesamt in `routes.json`) in einer interaktiven Galerie/Carousel? Wird bei fehlenden Bildern eine hochwertige lokale CSS-/SVG-Kartenkomposition statt grauer Leere angezeigt?
- [ ] **4. Echte GeoJSON-Trackdarstellung ohne externe Bibliotheken**: Werden die Strecken aus den `data/tracks/*.geojson`-Dateien über eine performante, eigene SVG-Engine visuell dominant, interaktiv und zoombar dargestellt?
- [ ] **5. GPX-Download & Navigation**: Sind direkte GPX-Downloads (`data/gpx/...`) sowie Links zu Google Maps Navigation, Komoot und BRouter auf jeder Tour sofort nutzbar?
- [ ] **6. Lokaler Tourenvergleich, Favoriten & Fahrtenlog**: Funktioniert das Speichern von Favoriten, der visuelle Vergleich von bis zu 4 Touren sowie das persönliche Fahrtenbuch (`localStorage`) im Browser reibungslos?
- [ ] **7. Mobile Einhandbedienung & Desktop-Immersivität**: Ist die App auf Smartphones optimal per Daumen (Bottom Dock, große Touch-Flächen) bedienbar, während der Desktop eine großzügige, elegante Magazin-Ästhetik entfaltet?
- [ ] **8. Keine bürokratischen Status-/Sicherheits-/Review-Texte**: Sind Begriffe wie „Kandidat“, „Review“, „Freigabegate“, „Provenienz“, „Aggregate“ oder „Datenstatus“ komplett aus der sichtbaren Benutzeroberfläche verbannt?
- [ ] **9. Keine erfundenen Wetterwerte**: Ist das Wetter ehrlich als Offline/Nicht verfügbar gekennzeichent bzw. sauber durch externe Live-Links gelöst, ohne fake API-Platzhalterwerte?
- [ ] **10. Technische Reinheit & Autarkie**: Werden ausschließlich relative Assetpfade (`data/...`) verwendet? Kommt die App komplett ohne Buildschritt, ohne externe JS-Frameworks, ohne externes CSS und ohne externe Font-CDNs aus?
- [ ] **11. Header-Vorgaben**: Führt das Logo zu `/` (bzw. Startzustand) und besteht die Hauptnavigation ausschließlich aus den beiden Punkten **„E-Bike“** und **„Sport“**?
- [ ] **12. Privatsphäre-Schutz**: Sind private Wohn- und Hauskoordinaten/Adressen in den Wegpunkten und UI-Labeln anonymisiert bzw. ausgeblendet, während die Karten den reinen Track korrekt darstellen?

---

## B. Ästhetik & Editorial Quality Check

- [ ] **B1. Magazin-Anmutung statt Admin-Dashboard**: Fühlt sich die Oberfläche wie eine Mischung aus hochwertigem Outdoor-Magazin und Trail-Navigator an?
- [ ] **B2. Typografie & Komposition**: Sind die Schriftgrößen, Abstände und Karten-Layouts klar strukturiert, mit natürlichem Kontrast (Forest Green, Birch, Trail Amber)?
- [ ] **B3. Mikrointeraktionen mit Echtwert**: Reagieren Streckenkarten, Höhenprofile und Hover-Zustände nahtlos aufeinander (z. B. synchrone Wegpunkt-Hervorhebung)?
- [ ] **B4. Lust aufs Fahren**: Erzeugt die Tourenauswahl emotionale Vorfreude statt Datensatzverwaltung?

---

## C. Code-Qualität & Validierung

- [ ] **C1. Syntax-Check**: Läuft `node --check app.js` und optionaler Module fehlerfrei durch?
- [ ] **C2. Validierungsskript (`validate_static.py`)**: Überprüft das Skript alle 30 Routen, 30 GPX-Dateien, 30 GeoJSON-Dateien, 88 Galerie-URLs und die Abwesenheit verbotener Begriffe und externer Framework-Abhängigkeiten fehlerfrei?
- [ ] **C3. Performance & Fehlerfreiheit im Browser**: Funktioniert die App sofort nach dem Start über `python3 -m http.server` ohne Konsole-Errors oder fehlende Assets?
