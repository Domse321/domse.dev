# E-Bike Release-Checkliste

## Lokal belegt

- [x] Python 3.11.2 / Standardbibliothek
- [x] 30 eindeutige Bestandsrouten, alle `candidate`
- [x] 0 öffentliche Tracks ist fail-closed gültig
- [x] Kandidaten ohne Download, Navigation oder Empfehlung
- [x] Modusreihenfolge und Standard `MTB / E-MTB`
- [x] Filter, Akku-/Zeitmodell, Browserimport und Rendering-Sicherheit getestet
- [x] Wetter statisch nicht verfügbar, keine externen Runtime-Requests
- [x] inaktiver n8n-Export; lokale Struktur-, Provenienz-, Track-, Medien- und Deduplizierungstests
- [x] n8n-MCP-Strukturvalidierung: gültig, 8 Nodes, 7 Verbindungen, 0 Fehler/Warnungen
- [x] Desktop-Browsercheck: keine JS-/Konsolenfehler, keine externen Ressourcen, kein horizontaler Overflow
- [x] komprimiertes First-Party-JS+CSS unter 500 KiB

## Vor Testdeployment noch zwingend

- [ ] unabhängiges Code-QA-PASS
- [ ] unabhängiges Security-PASS
- [ ] echte responsive Abnahme 1440/820/390/320 und 125 % Schriftgröße
- [ ] Chromium/Firefox/WebKit-E2E und echte Safari-Touchabnahme
- [ ] releasegebundene LCP/CLS/Interaktionsmessung
- [ ] externer Privacy-Secret-Scan über das unveränderliche Releaseartefakt
- [ ] test-only Deployment- und Rollback-Gate
- [ ] Nachweis, dass `domse.dev` bytegleich unverändert blieb

Kein Testdeployment und kein n8n-Import/Activation erfolgen aus diesem Implementierungstask.
