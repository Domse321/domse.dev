# n8n E-Bike Candidate Workflow

## Lieferumfang

- `ebike-candidate.workflow.json`: importierbarer, standardmäßig inaktiver Workflowexport.
- `fixtures/manual-candidate.json`: netzwerkfreies Dry-run-Beispiel.
- `config/allowlist.json`: explizite Quellen- und Medienlizenzregeln.
- `validate_workflow.py`: Struktur-/Secret-/Side-effect-Prüfung.
- `validate_candidate.py`: Provenienz-, Track-, Medien- und Deduplizierungsprüfung.
- `tests/`: lokale Standardbibliothekstests.

## Lokaler Dry-run

```bash
/usr/bin/python3 automation/n8n/validate_workflow.py automation/n8n/ebike-candidate.workflow.json
/usr/bin/python3 automation/n8n/validate_candidate.py automation/n8n/fixtures/manual-candidate.json --allowlist automation/n8n/config/allowlist.json
/usr/bin/python3 -m unittest discover -s automation/n8n/tests -p 'test_*.py' -v
```

Der Workflow trennt Geo/POIs, Track und Medienprüfung, markiert Duplikate und endet bei „Manual Approval Required“. Er schreibt nicht in Website, Repository oder `main` und besitzt keinen Publish-, Git-, Mail- oder externen Fetchpfad.

## Spätere produktive Nutzung

Nicht Bestandteil dieses Releases. Vor Import sind separat erforderlich:

1. offizielle MCP/API-Zielvalidierung gegen die konkrete n8n-Version;
2. menschliche Freigabe des unveränderten Exporthashes;
3. Import als inaktive Testkopie;
4. kontrollierter Dry-run ohne externe Recherche oder Benachrichtigung;
5. erneute Security-/Datenschutzfreigabe vor jeder Aktivierung.

Keine Credentials oder Secrets in den Export eintragen. Direkte n8n-Datenbankänderungen sind verboten.
