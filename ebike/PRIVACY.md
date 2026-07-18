# Datenschutz

## Öffentliche Dateien

Die statischen Assets enthalten keinen persönlichen Startpunkt, keine private Adresse und keine persönlichen Navigationslinks. Die frühere Trackauslieferung wurde fail-closed entfernt. Ein Track darf erst nach manueller, quellenbelegter Public-Point-Freigabe wieder erscheinen.

Das Freigabeformat bindet eine eindeutige `approval_id` an Route und öffentlichen Track. Der Scan berechnet Source- und Output-Hashes neu, prüft Originaltrack-Indizes und Endpunktkoordinaten gegen GPX und GeoJSON und akzeptiert nur eingeschlossene relative Pfade. Quellenbeleg, Reviewer und zeitzonenbehafteter Review-Zeitstempel sind Pflicht. Fehlende oder ungültige Bindung bedeutet `candidate` ohne Download, Navigation oder Empfehlung.

## Browserzustand

Favoriten und Fahrten werden nur in `localStorage` gespeichert. Die Seite sendet diese Daten nicht. Export geschieht nur nach Nutzeraktion und kann persönliche Bewegungsdaten enthalten. Import wird vor jeder Zustandsänderung vollständig validiert.

## Externe Dienste

Keine Tracker, Marketing-Cookies, Wetteranbieter, Kartenkacheln oder externen Medien werden automatisch geladen. Ein Cookiebanner ist deshalb nicht erforderlich.

## Freigabescans

Ein realer Release mit öffentlichen Tracks muss zusätzlich mit `EBIKE_PRIVATE_SOURCE_ROOT` gegen die geschützten, außerhalb des Repositories liegenden Originaltracks geprüft werden. Geheimwerte und private Tracks dürfen weder in Fixtures noch in Logs oder Releaseartefakten erscheinen.
