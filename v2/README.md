# Motrac Transport Planning (Modular Web App)

Deze versie is opgesplitst in modules (ES Modules) en assets zodat je het direct op GitHub kunt zetten (bijv. via GitHub Pages).

## Structuur
```
motrac-transport-planning/
├─ index.html
├─ assets/
   ├─ css/
   │  └─ styles.css
   └─ js/
      ├─ main.js
      ├─ lib/
      │  └─ utils.js
      ├─ data/
      │  ├─ orders.js
      │  ├─ trucks.js
      │  └─ cities.js
      └─ features/
         ├─ orders.js
         ├─ planning.js
         └─ map.js
```

## Lokale ontwikkeling
Open `index.html` direct in je browser óf serveer het via een eenvoudige webserver (aan te raden voor modules), bijvoorbeeld:

```bash
# Python 3:
python -m http.server 8000
# Open in je browser:
# http://localhost:8000
```

## GitHub Pages
1. Push deze map naar een nieuwe GitHub repo (bijv. `MotracTransportPlanning`).
2. Zet **Settings → Pages → Source: Deploy from a branch** en kies de `main` branch en **/ (root)**.
3. Jouw site staat daarna op `https://<username>.github.io/MotracTransportPlanning/`.

## Belangrijk
- De inline `onclick` handlers in `index.html` blijven werken doordat de functies in `main.js` aan `window` worden gehangen.
- Externe libraries (Leaflet) worden via CDN geladen.
- Data is in-memory (geen backend). Je kunt later eenvoudig een API of opslaglaag toevoegen.
