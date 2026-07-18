# Data-Table-Migration

## Ziel

Tabelle **`ebike_route_research`** im selben n8n-Projekt wie der Workflow. Das Schema ist in `data-table.schema.json` kanonisch beschrieben.

## Einmalige Anlage in n8n 2.20.9

1. **Data Tables → Create Data Table**, Name exakt `ebike_route_research`.
2. Alle 20 Spalten aus `data-table.schema.json` in angegebener Reihenfolge anlegen. Für `score` den Typ **Number**, für `discovered_at` und `updated_at` **Date**, sonst **String** wählen.
3. Keine eigene Spalte `id` anlegen; n8n verwaltet die Row-ID selbst.
4. Workflow in dasselbe Projekt importieren. Node **Upsert Review Data Table** öffnen, Tabelle aus der Liste neu auswählen und das geladene Mapping gegen das Schema prüfen. Upsert-Bedingung bleibt `stable_key = {{$json.stable_key}}`.
5. Einen manuellen Lauf ausführen, Ergebnis-Tabelle und **Final Run Summary** prüfen. Erst danach bei Bedarf aktivieren.

## Migration bestehender Tabellen

Die öffentliche n8n-API kann Spaltenschemata nach Anlage nicht ändern. Für abweichende Alt-Schemata daher eine neue Tabelle `ebike_route_research_v2` mit diesem Schema anlegen, Daten kontrolliert kopieren, anschließend den Table Locator im Upsert-Node ändern. Keine direkte Datenbankänderung.

## Rollback

Workflow deaktivieren. Die Tabelle bleibt als Review-Historie erhalten; sie ist kein Website-Publishing-Ziel. Bei falschem Mapping den Workflowexport erneut inaktiv importieren und die Tabellenauswahl korrigieren.
