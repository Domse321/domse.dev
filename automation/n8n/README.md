# n8n E-Bike-OSM-Evidenzrecherche V2

Reproduzierbarer, **inaktiv exportierter** Kandidatenworkflow für n8n 2.20.9. Er erzeugt ausschließlich maschinelle Evidenz zur manuellen Prüfung und veröffentlicht nichts.

## Datenfluss

1. **Manual Trigger** sowie automatisch einmal monatlich am ersten Sonntag um 05:00 Uhr (`Europe/Berlin`). Der Schedule prüft sonntags um 05:00 Uhr, ein vorgeschaltetes Kalender-Gate lässt ausschließlich den ersten Sonntag des Monats in die Recherche weiter.
2. Overpass-Discovery benannter `route=bicycle|mtb`-Relationen im festen Weserbergland-Suchraum (51.70–52.62 N, 8.45–10.25 E).
3. Discovery wird vor dem 250er-Cap fachlich (MTB, Netz, Distanz, Rundtour) und regional gerankt. Der zweite Overpass-Aufruf nutzt je stabiler OSM-Relations-ID `out geom`; nur dies liefert `members[].geometry`. Geometrien werden zusammengeführt und aufeinanderfolgende Dubletten entfernt.
4. Fail-closed-Gates: mindestens 20 Punkte, jeder Punkt in der Such-BBox, 5–180 km, höchstens 2 km Lücke zwischen zusammengesetzten Segmenten, plausibler Schlussabstand (≤ 2,5 km oder 12 %), Geometrie/Diagonal-Verhältnis und maximal 35 % Abweichung zu einem vorhandenen OSM-Distanz-Tag.
5. Evidenzscore 0–100 wird als Liste aus Code, Punkten und Begründung gespeichert. `bike_type` stammt aus `route`, `network`, Name/Beschreibung – nicht aus Suchjobs. Identität ist immer `osm_relation_<id>`.
6. Faire Begrenzung: höchstens zwei Kandidaten je Region/Bike-Typ und 30 insgesamt.
7. Drei Trackanker bei 20/50/80 % der **kumulativen Streckenlänge** je Kandidat; Commons-`geosearch` sucht je Anker bis zu zehn Dateien in 10 km Radius. Auswahl bis zu drei eindeutiger Bilder, nach berechneter Distanz sortiert.
8. Zulässig sind nur `BITMAP` mit JPEG/PNG/WebP/TIFF und CC0, Public Domain/PD, CC BY oder CC BY-SA. CC BY/CC BY-SA wird ohne Creator, Lizenz-URL, Thumbnail oder explizite Commons-Seite fail-closed verworfen. SVG/PDF/WAV/OGG, Karten, Wappen, Diagramme und Logos werden ebenfalls verworfen.
9. Upsert nur in **`ebike_route_evidence_v2`**. Keine Review-/`first_seen`-Felder, kein Websitezugriff. Summary meldet akzeptierte/abgewiesene Datensätze, Geometriepunkte/-kilometer, Bildquote, Evidenzscore, Verteilungen und Partial-Failure-Zeilen.

## Reproduzierbarkeit und Prüfung

```bash
python3 automation/n8n/build_workflow.py
python3 automation/n8n/validate_workflow.py automation/n8n/ebike-research.workflow.json
python3 -m unittest discover -s automation/n8n/tests -p 'test_*.py' -v
```

Der Generator liest versionierte Scripts aus `js/`; beide Exporte sind byte-identisch. Fixtures enthalten valide Overpass-Formen sowie adversariale Commons-Fälle (Wappen-SVG, Karte, WAV, nicht erlaubte Lizenz).

## Betriebsvoraussetzungen

- n8n muss `https://overpass-api.de` und `https://commons.wikimedia.org` per HTTPS/DNS erreichen; keine Credentials erforderlich.
- Tabelle gemäß `DATA_TABLE_MIGRATION.md` anlegen und im Data-Table-Node lokal neu auswählen.
- Overpass-Nutzungsregeln beachten. HTTP-Nodes haben 30/60-s-Timeout, drei Versuche, Backoff/Batches und geben Fehler als Partial-Failure-Signal weiter; Workflow-Timeout 900 s.
- Ein manueller Lauf muss zuerst Summary, Gatequote, Bildlizenzen und Mapping bestätigen. Der Export bleibt inaktiv. Eventuelle Aktivierung erfolgt manuell.
- Leere Discovery und 100 % Gate-Reject werden über separate IF-Signalpfade direkt zur Summary geführt. Signale besitzen keinen `stable_key` und erreichen den Data-Table-Upsert nicht.
- **Snapshot-Grenze:** Die Tabelle ist ein Upsert-Bestand, kein vollständiger aktueller Snapshot. `observed_at` und `run_id` kennzeichnen die letzte Beobachtung einer Route; Zeilen mit anderer `run_id` als der betrachtete erfolgreiche Lauf sind als stale zu behandeln. Ein Lauf mit `no_data` löscht bewusst keine historische Evidenz.
- Keine automatische Freigabe, kein Komoot-Scraping, keine erfundenen Tracks und keine Websiteänderung.
