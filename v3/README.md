# Motrac Transport Planning — v3 (GitHub-only opslag)

Deze versie slaat data op **binnen GitHub** via Issues ➜ GitHub Action ➜ `data/orders.json`.

## Snel testen
1. Upload **de inhoud van deze zip naar de root** van je repo (tak `main`).    ⚠️ De workflow **moet** in de repo-root staan (`.github/workflows/...`) om te draaien.
2. Ga naar **Actions** en zet workflows aan (eenmalig).
3. Open je site (GitHub Pages) en ga naar **Nieuwe Transport Opdracht**.
4. Klik **“Opslaan naar GitHub (Issue)”** → bevestig het Issue in GitHub.
5. Wacht ~10–30 sec → de Action append jouw data naar `data/orders.json`.
6. Ga naar het Dashboard → **Laad orders uit GitHub** → je order verschijnt.

## Belangrijk
- Geen tokens nodig in de front-end. De gebruiker maakt het Issue; de Action gebruikt `GITHUB_TOKEN`.
- Wil je v3 in een submap (`/v3/`) testen? Dat kan voor de site, maar **verplaats dan de map `.github/workflows` naar repo-root**, anders draait de Action niet.

## Van wie laadt de app data?
Bovenaan `assets/js/features/orders.js` is ingesteld:
```js
const GH_OWNER = 'mightymike001';
const GH_REPO  = 'MotracTransport';
```
Pas aan als je een andere repo gebruikt.

## Wat zit erin
- `index.html` + CSS + JS-modules (orders/planning/map).
- `.github/workflows/issues-to-json.yml` — Issues ➜ `data/orders.json`.
- `data/orders.json` — start met `[]`.
