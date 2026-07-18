# n8n E-Bike-Routenrecherche

Produktionsnaher, aber **inaktiv exportierter** Rechercheworkflow für die private E-Bike-App. Er recherchiert sonntags oder manuell Routenkandidaten, speichert sie intern zur Prüfung und veröffentlicht niemals auf einer Website.

## Ablauf

1. **Manual Trigger** und **Weekly Sunday 07:00** (Workflow-Zeitzone `Europe/Berlin`).
2. Deterministische Erzeugung von 22 deutschen Suchjobs: E-MTB und normales E-Bike für Hameln, Weserbergland, Süntel, Deister, Ith, Hils, Ottensteiner Hochfläche, Emmerthal, Hessisch Oldendorf, Bad Pyrmont und Coppenbrügge.
3. **HTTP Request** an lokales SearXNG (`GET /search`, JSON).
4. Normalisierung realer Treffer, Filterung unbrauchbarer Treffer, stabile URL-Bereinigung, In-Run-Deduplizierung und nachvollziehbarer Nutzwert-Score 0–100.
5. Pro Kandidat **HTTP Request** an die Wikimedia-Commons-API; bestes Bild inklusive Thumbnail und interner Lizenzmetadaten wird angehängt.
6. Upsert anhand `stable_key` in die n8n Data Table `ebike_route_research`.
7. Finale Laufzusammenfassung mit Anzahl, Bildern, Durchschnittsscore und Regionen; `publish_performed: false`.

## Dateien

- `ebike-research.workflow.json` – kanonischer importierbarer Export.
- `ebike-candidate.workflow.json` – kompatibler Legacy-Dateiname, identischer echter Workflow (kein Dummy).
- `build_workflow.py` – deterministischer Exportgenerator.
- `data-table.schema.json`, `DATA_TABLE_MIGRATION.md` – Review-Schema und Anlage/Migration.
- `fixtures/` – Offline-Antworten in realen SearXNG-/Commons-JSON-Strukturen.
- `validate_workflow.py`, `tests/` – Fail-closed-Strukturvalidator und Tests.

## Prüfen

Aus dem Repository-Root:

```bash
python3 automation/n8n/build_workflow.py
python3 automation/n8n/validate_workflow.py automation/n8n/ebike-research.workflow.json
python3 -m unittest discover -s automation/n8n/tests -p 'test_*.py' -v
```

## Inbetriebnahme auf n8n 2.20.9 (LXC 110)

1. Tabelle gemäß `DATA_TABLE_MIGRATION.md` im Zielprojekt anlegen.
2. `ebike-research.workflow.json` importieren. Der Export ist inaktiv; nicht automatisch aktivieren.
3. Im Node **Upsert Review Data Table** die Tabelle einmal aus der Liste auswählen, damit n8n das Resource-Mapping gegen die lokale Tabellen-ID/Spalten neu lädt.
4. Vor dem Import `http://searxng.internal:8080` im Export durch die deploymentspezifische interne SearXNG-Basis-URL ersetzen. Vom n8n-Host anschließend `GET /search?format=json&q=Hameln+E-Bike` sowie `https://commons.wikimedia.org/w/api.php?action=query&format=json&meta=siteinfo` prüfen. Es werden keine Credentials benötigt.
5. Manuellen Testlauf starten und **Final Run Summary** sowie Tabellenzeilen kontrollieren. Erst danach den Workflow aktivieren, falls der Wochenplan laufen soll.

## Betriebsgrenzen

- Nur GET-Zugriffe auf lokales SearXNG und Wikimedia Commons; keine Secrets/Credentials.
- Schreibziel ausschließlich n8n Data Table. Keine Webhooks, Website-, Git-, Mail-, Shell-, SSH- oder Publishing-Nodes.
- Quell-/Lizenz-URLs bleiben intern für Deduplizierung und spätere private Prüfung; es wird keine sichtbare Quellenbürokratie erzeugt.
- SearXNG-Motoren und externe Zielseiten können schwanken. HTTP-Fehler stoppen den Lauf sichtbar; n8n speichert Fehlerausführungen, erfolgreiche Zeitplanläufe nicht dauerhaft.
