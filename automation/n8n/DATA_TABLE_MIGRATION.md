# Data-Table-Inbetriebnahme V2

## Sicherheitsentscheidung

V2 schreibt ausschließlich in die neue Tabelle **`ebike_route_evidence_v2`**. Die bestehende Review-Tabelle wird weder gelesen noch verändert. Damit können `review_status` und `first_seen` durch einen Recherchelauf nicht überschrieben werden. Die Verbindung zwischen späterem menschlichem Review und Evidenz erfolgt ausschließlich über `stable_key` (`osm_relation_<id>`).

## Einmalige Anlage in n8n 2.20.9

1. Im selben n8n-Projekt eine Data Table exakt namens `ebike_route_evidence_v2` anlegen.
2. Die 30 Spalten aus `data-table.schema.json` in der angegebenen Reihenfolge anlegen: `number` → Number, `boolean` → Boolean, `date` → Date, alle übrigen → String. Keine eigene `id`-Spalte.
3. Workflow inaktiv importieren. Im Node **Upsert Machine Evidence V2** die lokale Tabelle neu auswählen und das Mapping neu laden. Match bleibt `stable_key`.
4. Eine eventuell vorhandene Review-Tabelle bleibt separat. Falls Reviewdaten angebunden werden, nur lesend/joinend über `stable_key`; niemals Reviewfelder in dieses Workflowmapping aufnehmen.
5. Erst manuellen Lauf und Summary prüfen. Aktivierung des Sonntagsplans ist eine separate, bewusste Betriebsentscheidung.

## Rollback

Workflow deaktivieren. Evidence-Tabelle kann zur Diagnose erhalten oder separat gelöscht werden; Review- und Website-Daten sind nicht betroffen.
