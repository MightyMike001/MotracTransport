# Security Audit — Motrac Transport

## Scope
Deze controle richtte zich op de frontend-code in deze repository, de omgang met Supabase-API sleutels en het inlogproces. De audit omvatte handmatige code review (HTML/JS) en controle van bestaande configuratiebestanden.

## Belangrijkste bevindingen en oplossingen

### 1. Gehardere opslag van Supabase-sleutels
- De productie-URL en anon key stonden hard-coded in `index.html`. Dit maakte het onmogelijk om het uitlekken van sleutels via de broncode te voorkomen.
- **Oplossing:** de inline fallback is verwijderd. Alleen het door `npm run build:env` gegenereerde `js/env.js` levert nu runtime configuratie. Zonder dit bestand stopt de applicatie met een duidelijke foutmelding vanuit `js/config.js`.

### 2. Veiliger wachtwoord-hashen
- Voorheen viel `hashPassword` terug op een zwakke, niet-cryptografische hash wanneer `crypto.subtle` niet beschikbaar was. Hierdoor konden wachtwoorden lokaal worden "gehashed" met een omkeerbare functie.
- **Oplossing:** `hashPassword` vereist nu Web Crypto en stopt met een foutmelding in browsers die deze API niet ondersteunen. Gebruikers krijgen de opdracht om een moderne browser te gebruiken, waarmee zwakke hashes worden voorkomen.

### 3. XSS-risico in gebruikersbeheer opgelost
- De gebruikerslijst werd opgebouwd via `innerHTML` met ongesanitiseerde waarden uit Supabase (naam, e-mail). Een kwaadwillende kon script tags in die velden plaatsen.
- **Oplossing:** de gebruikersrijen worden nu met DOM-API's opgebouwd waarbij alle tekst via `textContent` wordt ingevoegd. Daarmee wordt HTML-injectie voorkomen.

### 4. XSS-risico in carrier-datalist verminderd
- De datalist voor carriers genereerde opties via `innerHTML`, waardoor veldwaarden met `"` of `<` onbedoelde HTML konden introduceren.
- **Oplossing:** opties worden nu programmatic aangemaakt met `document.createElement("option")`.

## Aanbevolen vervolgstappen

1. **Supabase-beveiliging**
   - Controleer of RLS (Row Level Security) voor alle tabellen is ingeschakeld.
   - Gebruik waar mogelijk policies die het anonieme sleutelgebruik beperken tot de minimaal benodigde rechten.

2. **Authenticatiehardening**
   - Overweeg server-side login via Supabase Auth of een eigen backend zodat wachtwoorden nooit client-side hoeven te worden gehashed.
   - Forceer MFA voor beheerders indien mogelijk.

3. **Client-side maatregelen**
   - Voeg een Content Security Policy toe zodra inline scripts zijn uit gefaseerd.
   - Monitor `localStorage` gebruik; tokens kunnen beter via httpOnly cookies worden beheerd wanneer een backend beschikbaar is.

4. **Geheime sleutels**
   - Houd `.env` en `js/env.js` buiten versiebeheer (reeds afgedekt via `.gitignore`).
   - Documenteer sleutel-rotatieprocedures en gebruik secrets management voor productie deployments.

## Controlelijst
- [x] Inline Supabase-configuratie verwijderd.
- [x] Wachtwoord hashing vergrendeld tot Web Crypto.
- [x] Gebruikersbeheer rendert veilig.
- [x] Carrier-datalist rendert veilig.
- [ ] CSP en aanvullende headers (aanbevolen).
- [ ] Server-side authenticatie (aanbevolen).

## Laatste reviewdatum
2024-XX-XX (vul datum van deployment in).
