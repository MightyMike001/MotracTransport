# Motrac Transport

## Configuratie

1. Kopieer `.env.example` naar `.env` en vul de Supabase waarden in.
2. Genereer het runtime configuratiebestand met:
   ```bash
   npm install
   npm run build:env
   ```
   > `npm install` is alleen nodig bij de eerste keer om eventuele toekomstige afhankelijkheden te installeren.
3. Start de applicatie via je gewenste webserver. Het script `npm run build:env` maakt `js/env.js` aan dat door de app wordt gelezen.

De gegenereerde `js/env.js` en `.env` staan in `.gitignore` zodat sleutels niet per ongeluk in de repository terechtkomen.

Zie ook [SECURITY.md](SECURITY.md) voor aanvullende beveiligingsrichtlijnen, onder andere over het beschermen van Supabase-sleutels en het beheer van accounts.

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
