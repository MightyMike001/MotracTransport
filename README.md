# Motrac Transport

## Configuratie

De applicatie verwacht Supabase instellingen tijdens runtime via `js/env.js`. Zonder deze configuratie stopt de app bewust met laden zodat er geen verbinding wordt gemaakt met een onbekende database.

1. Kopieer `.env.example` naar `.env` en vul de waarden van je eigen Supabase project in. Gebruik voor `SUPABASE_URL` de projectbasis (bijv. `https://<project>.supabase.co`) of de PostgREST-endpoint zonder extra querystring of hashfragment; het script voegt automatisch `/rest/v1` toe.
2. Genereer het runtime configuratiebestand:
   ```bash
   npm install # alleen de eerste keer nodig
   npm run build:env
   ```
3. Start de applicatie via je gewenste webserver. Het script `npm run build:env` schrijft `js/env.js`, dat automatisch door `index.html` wordt geladen.

Wanneer `SUPABASE_URL` of `SUPABASE_ANON_KEY` ontbreken, geeft de console een foutmelding en wordt `window.APP_CONFIG` niet aangemaakt. Zo voorkom je dat productiegegevens per ongeluk worden gebruikt tijdens lokaal testen.

Let op: zowel `js/env.js` als `.env` staan in `.gitignore` en horen nooit gecommit te worden.

### Optionele e-mailmeldingen

Als er een e-mailsysteem beschikbaar is kun je automatische meldingen inschakelen via extra variabelen in `.env`:

```
EMAIL_NOTIFICATIONS_URL=https://notificaties.example.com/hooks/order
EMAIL_NOTIFICATIONS_FROM=planner@example.com
EMAIL_NOTIFICATIONS_DEFAULT_RECIPIENTS=logistiek@example.com,planning@example.com
```

Alle velden zijn optioneel. Zonder `EMAIL_NOTIFICATIONS_URL` blijven e-mailnotificaties uitgeschakeld. De standaardontvangers worden gecombineerd met het e-mailadres van de klant op de order.

### Documentmailing configureren

De module voor rittenlijsten en CMR's gebruikt sjablonen en distributielijsten. Deze zijn standaard aanwezig, maar kunnen via JSON-configuratie in `.env` worden aangepast:

```
DOCUMENT_EMAIL_TEMPLATES='[
  {"id":"rittenlijst","name":"Dagplanning","type":"rittenlijst","subject":"Rittenlijst {date}","body":"..."},
  {"id":"cmr","name":"CMR","type":"cmr","subject":"CMR {reference}","body":"..."}
]'
DOCUMENT_EMAIL_LISTS='[
  {"id":"planning","name":"Planningsteam","recipients":["planning@example.com"]},
  {"id":"expeditie","name":"Expeditie","recipients":["expeditie@example.com"],"cc":["magazijn@example.com"]}
]'
```

Laat velden leeg of weg om te vallen op de ingebouwde standaards.
