# Rollback

Dieses Repository verändert weder `main` noch `domse.dev` automatisch.

## Vor Testdeployment

Bei einem fehlgeschlagenen lokalen Gate bleibt der Host unverändert. Änderungen im Worktree korrigieren oder den Worktree verwerfen.

## Nach Testdeployment

Nur den etablierten test-only Releasepfad für `test.domse.dev/ebike/` verwenden. Bei Privacy-, CSP-, A11y-, Performance-, QA- oder Security-Befund atomar auf den vorherigen Testrelease zurückschalten. Produktionsdateien dürfen nicht beschrieben werden.

## Browserdaten

Vor größeren Änderungen Export anbieten. Ein neuerer, inkompatibler Browserzustand wird nicht teilweise übernommen. Nutzer können die Exportdatei behalten oder den lokalen Zustand gezielt löschen.

## n8n

Der Export bleibt inaktiv. Bei fehlgeschlagener späterer MCP/API-Zielvalidierung nicht aktivieren bzw. die inaktive Testkopie über die offizielle API entfernen. Keine direkte Datenbank- oder Dateisystemmanipulation.
