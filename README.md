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
