import { transportOrders } from '../data/orders.js';
import { vrachtwagens, truckColors, TRANSPORT_HUB } from '../data/trucks.js';
import { getCoordinatesForCity, getCoordinatesForLocation } from '../data/cities.js';

let map = null;
let mapMarkers = [];
let routeLines = [];
let activeTruckId = null;

export function initializeMap(){
  if (!map){
    map = L.map('mapContainer').setView([52.1326, 5.2913], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
  }
  updateMap();
}

export function updateMap(){
  if(!map) return;
  mapMarkers.forEach(m=> map.removeLayer(m));
  routeLines.forEach(line=> map.removeLayer(line));
  mapMarkers = [];
  routeLines = [];

  const selectedDate = document.getElementById('mapDate').value;
  const selectedLocation = document.getElementById('mapLocation').value;
  const selectedStatus = document.getElementById('mapStatus').value;
  const showRoutes = document.getElementById('showRoutes').checked;
  const optimizeRoutes = document.getElementById('optimizeRoutes').checked;

  const filteredOrders = transportOrders.filter(order => {
    const matchesDate = !selectedDate || order.transportDatum === selectedDate;
    const matchesLocation = !selectedLocation || order.locatie === selectedLocation;
    const matchesStatus = !selectedStatus || order.status === selectedStatus;
    return matchesDate && matchesLocation && matchesStatus;
  });

  const statusColors = {
    'Nieuw':'#1976D2','Lopend':'#F57C00','Afleveren':'#388E3C','Ophalen':'#7B1FA2','Voltooid':'#424242'
  };

  filteredOrders.forEach((order, index) => {
    const coords = getCoordinatesForCity(order.plaats);
    if(!coords) return;
    const marker = L.circleMarker(coords, {
      color: order.vrachtwagen && truckColors[order.vrachtwagen] ? truckColors[order.vrachtwagen] : 'white',
      fillColor: statusColors[order.status] || '#666',
      fillOpacity: 0.8, weight:3, radius:10
    }).addTo(map);
    marker.bindPopup(`
      <strong>TO-${order.id.toString().padStart(3,'0')}</strong><br>
      <strong>Klant:</strong> ${order.klantNaam}<br>
      <strong>Product:</strong> ${order.product || 'Niet opgegeven'}<br>
      <strong>Adres:</strong> ${order.adres}<br>
      <strong>Plaats:</strong> ${order.plaats}<br>
      <strong>Status:</strong> ${order.status}<br>
      <strong>Datum:</strong> ${new Date(order.transportDatum).toLocaleDateString('nl-NL')}<br>
      <strong>Locatie:</strong> ${order.locatie}<br>
      <strong>Gewicht:</strong> ${order.gewicht || 0} kg<br>
      <strong>Vrachtwagen:</strong> ${order.vrachtwagen || 'Niet gepland'}
    `);
    const label = L.divIcon({
      className:'order-label',
      html:`<div style="background:white;border:1px solid #333;border-radius:3px;padding:1px 4px;font-size:10px;font-weight:bold;">${index+1}</div>`,
      iconSize:[20,20], iconAnchor:[10,10]
    });
    const labelMarker = L.marker(coords,{icon:label}).addTo(map);
    mapMarkers.push(marker,labelMarker);
  });

  // Hub
  const hubMarker = L.marker(TRANSPORT_HUB.coords, {
    icon: L.icon({
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      shadowSize: [41, 41]
    })
  }).addTo(map);
  hubMarker.bindPopup(`<strong>${TRANSPORT_HUB.name}</strong><br>${TRANSPORT_HUB.address}<br>Transport Hub - Alle routes starten/eindigen hier`);
  mapMarkers.push(hubMarker);

  // Motrac locations
  ['ALMERE','VENLO','ZWIJNDRECHT'].forEach(loc => {
    if(!selectedLocation || selectedLocation === loc){
      const coords = getCoordinatesForLocation(loc);
      const marker = L.marker(coords, {
        icon: L.icon({
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          iconSize:[25,41], iconAnchor:[12,41], popupAnchor:[1,-34],
          shadowUrl:'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png', shadowSize:[41,41]
        })
      }).addTo(map);
      marker.bindPopup(`<strong>Motrac ${loc}</strong><br>Werkplaats locatie`);
      mapMarkers.push(marker);
    }
  });

  if (showRoutes){
    generateRoutes(filteredOrders, optimizeRoutes);
  }
}

export function generateRoutes(orders, optimize=false){
  const byTruck = {};
  orders.forEach(o=>{ if(o.vrachtwagen){ (byTruck[o.vrachtwagen] ||= []).push(o); } });

  let routeInfoHtml = '<h4>Route Informatie:</h4>';
  let truckListHtml = '';

  if (Object.keys(byTruck).length === 0){
    routeInfoHtml += '<p>Geen routes gevonden. Zorg ervoor dat orders zijn toegewezen aan vrachtwagens.</p>';
    truckListHtml = '<p>Geen routes gepland voor geselecteerde dag.</p>';
    document.getElementById('routeDetails').innerHTML = routeInfoHtml;
    document.getElementById('truckListDetails').innerHTML = truckListHtml;
    return;
  }

  Object.entries(byTruck).forEach(([truckId, orders]) => {
    const truck = vrachtwagens.find(t=>t.id===truckId);
    if(!truck) return;

    const homeBase = TRANSPORT_HUB.coords;
    const orderedStops = optimize ? optimizeRouteOrder(orders, homeBase) : orders;

    const waypoints = [homeBase];
    const routeStops = [];
    orderedStops.forEach(order => {
      const pickup = getCoordinatesForCity(order.pickup_plaats);
      const delivery = getCoordinatesForCity(order.plaats);
      if (pickup && delivery){
        waypoints.push(pickup, delivery);
        routeStops.push(
          { type:'Ophalen', location: order.pickup_plaats, order },
          { type:'Afleveren', location: order.plaats, order }
        );
      }
    });
    waypoints.push(homeBase);

    drawTruckRoute(waypoints, truckId, truckColors[truckId] || '#666');

    const totalDistance = calculateTotalDistance(waypoints);
    const totalWeight = orderedStops.reduce((s,o)=> s + (o.gewicht||0), 0);

    routeInfoHtml += `
      <div class="truck-route" style="border-left-color:${truckColors[truckId] || '#666'}">
        <div class="route-summary">${truckId} - ${truck.naam}</div>
        <div style="font-size:12px;color:#666;margin-bottom:8px;">Afstand: ~${totalDistance.toFixed(0)} km | Gewicht: ${totalWeight} kg | Orders: ${orderedStops.length}</div>
        <div class="route-stop"><strong>1. Start:</strong> ${TRANSPORT_HUB.name}, Apeldoorn</div>
    `;
    let stopNo = 2;
    routeStops.forEach(stop => {
      routeInfoHtml += `
        <div class="route-stop">
          <strong>${stopNo}. ${stop.type}:</strong> TO-${stop.order.id.toString().padStart(3,'0')} - ${stop.order.klantNaam} (${stop.location})
          <br>&nbsp;&nbsp;&nbsp;${stop.order.product || 'Geen product'} (${stop.order.gewicht || 0}kg) - ${stop.order.opdracht_type}
        </div>`;
      stopNo++;
    });
    routeInfoHtml += `<div class="route-stop"><strong>${stopNo}. Einde:</strong> Return ${TRANSPORT_HUB.name}, Apeldoorn</div></div>`;

    truckListHtml += `
      <div class="truck-item" style="border-left-color:${truckColors[truckId] || '#666'}" onclick="focusOnTruck('${truckId}')" data-truck-id="${truckId}">
        <div class="truck-header-info">
          <span>${truckId} - ${truck.naam}</span>
          <span style="font-size:11px;color:${truckColors[truckId] || '#666'};">●</span>
        </div>
        <div class="truck-stats">${orderedStops.length} orders | ${totalWeight}kg | ~${totalDistance.toFixed(0)}km</div>
        <div class="route-orders">${
          orderedStops.map(o=>`<div class="route-order-item">TO-${o.id.toString().padStart(3,'0')}: ${o.klantNaam} (${o.opdracht_type})</div>`).join('')
        }</div>
      </div>`;
  });

  document.getElementById('routeDetails').innerHTML = routeInfoHtml;
  document.getElementById('truckListDetails').innerHTML = truckListHtml;
}

export function focusOnTruck(truckId){
  document.querySelectorAll('.truck-item').forEach(i=>i.classList.remove('active'));
  const el = document.querySelector(`[data-truck-id="${truckId}"]`);
  if(el) el.classList.add('active');
  activeTruckId = truckId;
  highlightTruckRoute(truckId);
}

export function highlightTruckRoute(truckId){
  routeLines.forEach(line=> line.setStyle({weight:4, opacity:0.3}));
  const selected = routeLines.find(line => line.truckId === truckId);
  if (selected){
    selected.setStyle({weight:6, opacity:1});
    const bounds = selected.getBounds();
    map.fitBounds(bounds, { padding:[20,20] });
  }
}

export function drawTruckRoute(waypoints, truckId, color){
  const routeLine = L.polyline(waypoints, { color, weight:4, opacity:0.7, dashArray:'10, 5' }).addTo(map);
  routeLine.truckId = truckId;
  routeLine.bindPopup(`<strong>Route ${truckId}</strong><br>Klik op vrachtwagen lijst voor details`);
  routeLines.push(routeLine);

  const arrowIcon = L.divIcon({ className:'route-arrow', html:`<div style="color:${color};font-size:16px;">→</div>`, iconSize:[20,20] });
  for (let i=0;i<waypoints.length-1;i++){
    const mid = [(waypoints[i][0]+waypoints[i+1][0])/2, (waypoints[i][1]+waypoints[i+1][1])/2];
    const arrow = L.marker(mid,{icon:arrowIcon}).addTo(map);
    mapMarkers.push(arrow);
  }
}

export function optimizeRouteOrder(orders, homeBase){
  let unvisited = [...orders];
  let route = [];
  let current = homeBase;
  while(unvisited.length>0){
    let nearestIdx = 0;
    let nearestDist = Infinity;
    unvisited.forEach((o,idx)=>{
      const coords = getCoordinatesForCity(o.plaats);
      if(coords){
        const dist = calculateDistance(current, coords);
        if(dist < nearestDist){ nearestDist = dist; nearestIdx = idx; }
      }
    });
    const next = unvisited.splice(nearestIdx,1)[0];
    route.push(next);
    current = getCoordinatesForCity(next.plaats);
  }
  return route;
}

export function calculateDistance(a, b){
  const R = 6371;
  const dLat = (b[0]-a[0]) * Math.PI/180;
  const dLon = (b[1]-a[1]) * Math.PI/180;
  const x = Math.sin(dLat/2)**2 + Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  return R*c;
}
export function calculateTotalDistance(waypoints){
  let total=0;
  for(let i=0;i<waypoints.length-1;i++){ total += calculateDistance(waypoints[i], waypoints[i+1]); }
  return total;
}

export function toggleRoutes(){ updateMap(); }
export function calculateAllRoutes(){ updateMap(); }
export function printRoutes(){
  const routeDetails = document.getElementById('routeDetails').innerHTML;
  const w = window.open('', '_blank');
  w.document.write(`
    <html><head><title>Motrac Transport Routes</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .truck-route { margin: 20px 0; padding: 15px; border: 1px solid #ccc; }
        .route-summary { font-weight: bold; font-size: 16px; margin-bottom: 10px; }
        .route-stop { margin: 5px 0; }
        h4 { color: #8B1538; }
      </style>
    </head><body>
      <h1>Motrac Transport Route Overzicht</h1>
      <p>Gegenereerd op: ${new Date().toLocaleDateString('nl-NL')} ${new Date().toLocaleTimeString('nl-NL')}</p>
      ${routeDetails}
    </body></html>`);
  w.document.close();
  w.print();
}
export function centerMap(){ if(map) map.setView([52.1326, 5.2913], 7); }
