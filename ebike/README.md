# E-Bike Scout Hameln

Frameworkfreier, privacy-first Tourenkatalog für `/ebike/`.

## Status dieses Releases

- 30 Bestandsrouten wurden als Inventar in Schema 1.0 migriert.
- Alle 30 Einträge sind `candidate`; null öffentliche Tracks sind freigegeben.
- Kandidaten bieten deshalb bewusst keinen GPX-/GeoJSON-Download, keine Navigation und keine Empfehlung.
- Wetter und Fahrbarkeit sind ohne belastbare Quelle als `nicht verfügbar` gekennzeichnet.
- Favoriten und Fahrtenlog bleiben im Browser. Export und atomarer Import erfolgen manuell.
- Es gibt keine Tracker, externen Kartenkacheln, Hotlinks oder Runtime-Wetterrequests.

## Lokal prüfen

```bash
/usr/bin/python3 --version  # exakt 3.11.2
node --check ebike/app.js
node --test ebike/tests/js/*.test.js
/usr/bin/python3 -m unittest discover -s ebike/tests -p 'test_*.py' -v
/usr/bin/python3 ebike/validate_routes.py
/usr/bin/python3 -m unittest discover -s automation/n8n/tests -p 'test_*.py' -v
/usr/bin/python3 automation/n8n/validate_workflow.py automation/n8n/ebike-candidate.workflow.json
bash scripts/validate-ebike-release.sh
```

Lokaler Server:

```bash
/usr/bin/python3 -m http.server 4173 --directory .
```

Danach `http://127.0.0.1:4173/ebike/` öffnen.

## Öffentliche Trackfreigabe

`ebike/config/public-route-approvals.json` darf 0 bis 30 Freigaben enthalten. Jeder Eintrag muss exakt den in `ebike/tools/privacy_scan.py` geprüften A2-Vertrag erfüllen. `approval_id` wird dabei an genau eine Route und deren `publicTrack.approvalId` gebunden. Der Scan berechnet die Hashes des geschützten Originaltracks sowie der öffentlichen GPX-/GeoJSON-Ausgaben neu und vergleicht die freigegebenen Start-/Endkoordinaten mit den angegebenen Originaltrack-Indizes und beiden Ausgabedateien.

Originaltracks bleiben außerhalb des Repositorys. Für eine reale Freigabe zeigt `EBIKE_PRIVATE_SOURCE_ROOT` auf dieses geschützte Verzeichnis; `source_track_file` ist immer ein darin eingeschlossener relativer Pfad. Fehlt der Kontext oder weichen Pfad, Hash, Route, Koordinaten, Reviewer, Zeitstempel oder HTTPS-Quellenbeleg ab, schlägt das Release fail-closed fehl. Ohne gültige Bindung bleibt die Route Kandidat. Es werden keine Connectoren erfunden.

## Browserdaten

Export: Bereich „Favoriten & Fahrtenlog“ öffnen und „Exportieren“ wählen. Import: JSON-Datei bis 1 MiB auswählen. Unbekannte Routen-IDs, Zusatzfelder, beschädigte Daten und Grenzwertverletzungen verwerfen die gesamte Datei; der bisherige Zustand bleibt erhalten.
