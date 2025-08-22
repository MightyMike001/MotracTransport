import { transportOrders } from '../data/orders.js';
import { vrachtwagens, truckColors, TRANSPORT_HUB } from '../data/trucks.js';
import { getCoordinatesForCity, getCoordinatesForLocation } from '../data/cities.js';

let map=null; let mapMarkers=[]; let routeLines=[];

export function initializeMap(){
  if(!map){
    map = L.map('mapContainer').setView([52.1326,5.2913],7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(map);
  }
  updateMap();
}
export function updateMap(){
  if(!map) return;
  mapMarkers.forEach(m=>map.removeLayer(m)); routeLines.forEach(l=>map.removeLayer(l));
  mapMarkers=[]; routeLines=[];

  const d=document.getElementById('mapDate').value;
  const loc=document.getElementById('mapLocation').value;
  const status=document.getElementById('mapStatus').value;
  const show=document.getElementById('showRoutes').checked;

  const items=transportOrders.filter(o=>(!d || o.transportDatum===d) && (!loc || o.locatie===loc) && (!status || o.status===status));
  const statusColors={Nieuw:'#1976D2',Lopend:'#F57C00',Afleveren:'#388E3C',Ophalen:'#7B1FA2',Voltooid:'#424242'};

  items.forEach((o,i)=>{
    const c=getCoordinatesForCity(o.plaats); if(!c) return;
    const marker=L.circleMarker(c,{
      color:o.vrachtwagen && truckColors[o.vrachtwagen]?truckColors[o.vrachtwagen]:'white',
      fillColor:statusColors[o.status]||'#666', fillOpacity:.85, weight:3, radius:10
    }).addTo(map);
    marker.bindPopup(`<strong>TO-${String(o.id).padStart(3,'0')}</strong><br>${o.klantNaam||''}<br>${o.plaats||''}`);
    const label=L.divIcon({className:'order-label',html:`<div style="background:white;border:1px solid #333;border-radius:3px;padding:1px 4px;font-size:10px;font-weight:bold;">${i+1}</div>`});
    const lm=L.marker(c,{icon:label}).addTo(map);
    mapMarkers.push(marker,lm);
  });

  const hub=L.marker(TRANSPORT_HUB.coords).addTo(map); hub.bindPopup(`<strong>${TRANSPORT_HUB.name}</strong><br>${TRANSPORT_HUB.address}`); mapMarkers.push(hub);
  ['ALMERE','VENLO','ZWIJNDRECHT'].forEach(LN=>{ if(!loc || loc===LN){ const mc=getCoordinatesForLocation(LN); const m=L.marker(mc).addTo(map); m.bindPopup(`<strong>Motrac ${LN}</strong>`); mapMarkers.push(m);} });

  if(show){ /* simplified routes in v3 demo */ }
}
export function toggleRoutes(){ updateMap(); }
export function calculateAllRoutes(){ updateMap(); }
export function printRoutes(){ window.print(); }
export function centerMap(){ if(map) map.setView([52.1326,5.2913],7); }
export function focusOnTruck(){} 
