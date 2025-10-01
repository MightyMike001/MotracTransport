// js/components/map.js
import {S} from '../state.js';

let map, layer;

export function initLeaflet(){
  // niets nodig – map wordt bij eerste render gemaakt
}

export function renderMapView(root){
  root.innerHTML = `
    <div class="card">
      <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px">
        <h3 style="margin:0; margin-right:auto">Routekaart</h3>
        <select id="status"><option value="">Alle</option><option>Nieuw</option><option>Gepland</option><option>Onderweg</option><option>Afgeleverd</option></select>
        <button id="fit" class="btn">Reset view</button>
      </div>
      <div id="routeMap"></div>
      <div style="margin-top:8px"><span class="badge">Markers tonen steden (vereenvoudigd)</span></div>
    </div>`;

  setTimeout(()=> ensureMap(root), 0);
  root.querySelector('#fit').onclick = ()=> { if (map) map.setView([52.1,5.1], 7); };
  root.querySelector('#status').onchange = ()=> drawMarkers(root);
}

function ensureMap(root){
  if (!map){
    map = L.map(root.querySelector('#routeMap')).setView([52.1,5.1], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap'
    }).addTo(map);
  } else {
    map.invalidateSize();
  }
  drawMarkers(root);
}

const city = {
  'AMSTERDAM':[52.3676,4.9041],
  'ROTTERDAM':[51.9244,4.4777],
  'UTRECHT':[52.0907,5.1214],
  'DEN HAAG':[52.0705,4.3007],
  'EINDHOVEN':[51.4416,5.4697],
};

function drawMarkers(root){
  const st = root.querySelector('#status').value;
  const orders = S.orders.filter(o=> !st || o.status===st);
  if (layer){ layer.remove(); layer=null; }
  layer = L.layerGroup();

  orders.forEach(o=>{
    const p = city[(o.pickup||'').toUpperCase()] || [52.1,5.1];
    const d = city[(o.drop||'').toUpperCase()]   || [52.2,5.2];
    const m1 = L.circleMarker(p, {radius:8}).bindPopup(`<strong>${o.id}</strong><br>${o.client}<br>${o.pickup} → ${o.drop}`);
    const m2 = L.circleMarker(d, {radius:8});
    const line = L.polyline([p,d], {dashArray:'6,4'});
    layer.addLayer(m1); layer.addLayer(m2); layer.addLayer(line);
  });

  layer.addTo(map);
}
