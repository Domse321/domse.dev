# Performancebudget

Die E-Bike-Seite bleibt frameworkfrei und lädt initial nur HTML, ein lokales Stylesheet, ES-Module und den lokalen Routenkatalog.

Budgets für das spätere Testhost-Gate:

- initial komprimiertes First-Party-JS + CSS: höchstens 500 KiB;
- medianer LCP: höchstens 2,5 s;
- CLS: höchstens 0,10;
- p95 der Fokus-/Filterinteraktion: höchstens 200 ms;
- keine initialen 30 Track- oder Medienloads;
- keine externen Runtime-Requests.

Lokale Dateigrößen sind nur ein Vorabindikator. LCP/CLS/Interaktion müssen nach test-only Deployment mit frischen, releasegebundenen Messungen ermittelt werden.
