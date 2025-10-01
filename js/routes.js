(function(){
  const els = {
    map: document.getElementById("routesMap"),
    date: document.getElementById("routesDate"),
    toggleRoutes: document.getElementById("toggleShowRoutes"),
    toggleOptimize: document.getElementById("toggleOptimize"),
    btnRebuild: document.getElementById("btnRebuildRoutes"),
    btnResetView: document.getElementById("btnResetView"),
    btnPrint: document.getElementById("btnPrintRoutes"),
    status: document.getElementById("routesStatus"),
    summary: document.getElementById("routesSummary"),
  };

  if (!els.map) return;

  const STORAGE_KEYS = {
    trucks: "transport_trucks_v1",
  };

  const HUBS = [
    { id: "noord", name: "Hub Noord (Groningen)", lat: 53.2194, lng: 6.5665 },
    { id: "midden", name: "Motrac HQ (Deventer)", lat: 52.2574, lng: 6.1608 },
    { id: "zuid", name: "Hub Zuid (Eindhoven)", lat: 51.4416, lng: 5.4697 },
    { id: "belgie", name: "Hub België (Antwerpen)", lat: 51.2194, lng: 4.4025 },
  ];

  const REGION_TO_HUB = {
    Noord: "noord",
    Midden: "midden",
    Zuid: "zuid",
    "België": "belgie",
  };

  const REGION_CENTERS = {
    Noord: { lat: 53.0, lng: 6.1 },
    Midden: { lat: 52.2, lng: 5.4 },
    Zuid: { lat: 51.6, lng: 5.1 },
    "België": { lat: 51.0, lng: 4.4 },
  };

  const COLOR_SCALE = [
    "#E2001A",
    "#2E7D32",
    "#1976D2",
    "#9C27B0",
    "#EF6C00",
    "#00897B",
    "#455A64",
  ];

  let map;
  let markersLayer;
  let routesLayer;
  let lastBounds = null;

  function readLocal(key, fallback){
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("Kan localStorage niet lezen", e);
      return fallback;
    }
  }

  function setStatus(message, variant = "default"){
    if (!els.status) return;
    els.status.textContent = message;
    els.status.classList.remove("status-error", "status-success");
    if (variant === "error") {
      els.status.classList.add("status-error");
    } else if (variant === "success") {
      els.status.classList.add("status-success");
    }
  }

  function ensureDate(){
    if (!els.date) return new Date().toISOString().slice(0,10);
    let value = els.date.value;
    if (!value){
      value = new Date().toISOString().slice(0,10);
      els.date.value = value;
    }
    return value;
  }

  function initMap(){
    map = L.map(els.map, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([52.2, 5.3], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap-bijdragers",
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
    routesLayer = L.layerGroup().addTo(map);
  }

  function hashString(value){
    let hash = 0;
    const text = value || "";
    for (let i = 0; i < text.length; i += 1){
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function jitterCoordinate(base, key){
    const hash = hashString(key);
    const latOffset = ((hash % 1000) / 1000) * 0.6 - 0.3;
    const lngOffset = ((((hash / 1000) | 0) % 1000) / 1000) * 0.6 - 0.3;
    return {
      lat: base.lat + latOffset,
      lng: base.lng + lngOffset,
    };
  }

  function geocodeLocation(name, region){
    const normalized = (region && REGION_CENTERS[region]) ? REGION_CENTERS[region] : REGION_CENTERS.Midden;
    return jitterCoordinate(normalized, name || region || "loc");
  }

  function haversine(a, b){
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const c = 2 * Math.asin(Math.sqrt(sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng));
    return R * c;
  }

  function orderStops(stops, start, optimize){
    if (!optimize) {
      return stops;
    }
    const remaining = stops.slice();
    const ordered = [];
    let current = start;
    while (remaining.length){
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let i = 0; i < remaining.length; i += 1){
        const candidate = remaining[i];
        const distance = haversine(current, candidate.latlng);
        if (distance < bestDistance){
          bestDistance = distance;
          bestIndex = i;
        }
      }
      const next = remaining.splice(bestIndex, 1)[0];
      ordered.push(next);
      current = next.latlng;
    }
    return ordered;
  }

  function chooseHubForStops(stops){
    const region = stops.find((s) => s.region)?.region;
    const hubId = REGION_TO_HUB[region] || "midden";
    return HUBS.find((h) => h.id === hubId) || HUBS[1];
  }

  function buildMarker(latlng, options){
    return L.circleMarker([latlng.lat, latlng.lng], {
      radius: 8,
      weight: 2,
      fillOpacity: 0.9,
      ...options,
    });
  }

  function renderSummary(groups, unplanned, date){
    if (!els.summary) return;
    els.summary.innerHTML = "";
    if (!groups.length && !unplanned.length){
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "Geen routes beschikbaar voor de geselecteerde dag.";
      els.summary.appendChild(empty);
      return;
    }
    for (const group of groups){
      const card = document.createElement("article");
      card.className = "route-summary-card";
      const header = document.createElement("header");
      const title = document.createElement("h3");
      title.textContent = group.label;
      header.appendChild(title);
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.style.backgroundColor = `${group.color}1A`;
      badge.style.color = group.color;
      badge.textContent = `${group.stops.length} stops`;
      header.appendChild(badge);
      card.appendChild(header);
      const meta = document.createElement("div");
      meta.className = "muted small";
      const weightText = group.weightKnown ? `${group.totalWeight.toFixed(0)} kg` : "onbekend gewicht";
      meta.textContent = `Afstand ${group.distance.toFixed(1)} km • Gewicht ${weightText}`;
      card.appendChild(meta);
      const list = document.createElement("ul");
      for (const stop of group.stops){
        const item = document.createElement("li");
        const ref = stop.details.reference || stop.order.customer_name || `Order #${stop.order.id}`;
        const location = stop.details.delivery?.location || stop.order.customer_city || "Onbekend";
        item.textContent = `${ref} — ${location}`;
        list.appendChild(item);
      }
      card.appendChild(list);
      els.summary.appendChild(card);
    }
    if (unplanned.length){
      const backlog = document.createElement("article");
      backlog.className = "route-summary-card unplanned";
      const header = document.createElement("header");
      const title = document.createElement("h3");
      title.textContent = "Nog niet ingepland";
      header.appendChild(title);
      const count = document.createElement("span");
      count.className = "badge";
      count.textContent = `${unplanned.length} open`;
      header.appendChild(count);
      backlog.appendChild(header);
      const hint = document.createElement("div");
      hint.className = "muted small";
      hint.textContent = `Deze opdrachten staan nog los van een voertuig op ${new Date(date).toLocaleDateString("nl-NL")}.`;
      backlog.appendChild(hint);
      const list = document.createElement("ul");
      for (const stop of unplanned){
        const item = document.createElement("li");
        const ref = stop.details.reference || stop.order.customer_name || `Order #${stop.order.id}`;
        const location = stop.details.delivery?.location || stop.order.customer_city || "Onbekend";
        item.textContent = `${ref} — ${location}`;
        list.appendChild(item);
      }
      backlog.appendChild(list);
      els.summary.appendChild(backlog);
    }
  }

  async function refreshRoutes(){
    const date = ensureDate();
    const showRoutes = els.toggleRoutes ? !!els.toggleRoutes.checked : true;
    const optimize = els.toggleOptimize ? !!els.toggleOptimize.checked : false;
    setStatus("Routes laden…");
    try {
      const [ordersResult, trucks] = await Promise.all([
        Orders.list({}),
        Promise.resolve(readLocal(STORAGE_KEYS.trucks, [])),
      ]);
      const orders = Array.isArray(ordersResult?.rows) ? ordersResult.rows : [];
      const colorMap = new Map();
      let colorIndex = 0;
      const assignments = [];
      const backlog = [];
      markersLayer.clearLayers();
      routesLayer.clearLayers();
      const bounds = L.latLngBounds([]);

      const hubs = HUBS.map((hub) => {
        const marker = L.marker([hub.lat, hub.lng], { title: hub.name });
        marker.bindPopup(`<strong>${hub.name}</strong>`);
        marker.addTo(markersLayer);
        bounds.extend([hub.lat, hub.lng]);
        return hub;
      });

      const dateOrders = orders.filter((order) => {
        if (["Geleverd", "Geannuleerd"].includes(order.status || "")) return false;
        if (order.planned_date){
          return order.planned_date === date;
        }
        return order.due_date === date;
      });

      for (const order of dateOrders){
        const details = window.parseOrderDetails ? window.parseOrderDetails(order) : { delivery: { location: order.customer_city } };
        const region = order.region || (details.delivery?.region) || "Midden";
        const deliveryName = details.delivery?.location || order.customer_city || order.customer_name || "Locatie onbekend";
        const latlng = geocodeLocation(deliveryName, region);
        const markerColor = order.assigned_carrier ? (colorMap.get(order.assigned_carrier) || COLOR_SCALE[colorIndex % COLOR_SCALE.length]) : "#6F6F6F";
        if (order.assigned_carrier && !colorMap.has(order.assigned_carrier)){
          colorMap.set(order.assigned_carrier, markerColor);
          colorIndex += 1;
        }
        const marker = buildMarker(latlng, {
          color: markerColor,
          fillColor: markerColor,
        });
        const popupParts = [
          `<strong>${details.reference || order.customer_name || `Order #${order.id}`}</strong>`,
          deliveryName,
          order.assigned_carrier ? `Voertuig: ${order.assigned_carrier}` : "Nog niet ingepland",
        ];
        marker.bindPopup(popupParts.filter(Boolean).join("<br/>"));
        marker.addTo(markersLayer);
        bounds.extend([latlng.lat, latlng.lng]);
        const stop = {
          order,
          details,
          latlng,
          region,
        };
        if (order.assigned_carrier){
          assignments.push(stop);
        } else {
          backlog.push(stop);
        }
      }

      const grouped = [];
      const ordersByCarrier = assignments.reduce((map, stop) => {
        const key = stop.order.assigned_carrier;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(stop);
        return map;
      }, new Map());

      for (const [carrier, stops] of ordersByCarrier.entries()){
        const color = colorMap.get(carrier) || COLOR_SCALE[0];
        const hub = chooseHubForStops(stops);
        const orderedStops = orderStops(stops, { lat: hub.lat, lng: hub.lng }, optimize);
        const polylinePoints = [ [hub.lat, hub.lng] ];
        let distance = 0;
        let cursor = { lat: hub.lat, lng: hub.lng };
        let totalWeight = 0;
        let weightKnown = false;
        for (const stop of orderedStops){
          polylinePoints.push([stop.latlng.lat, stop.latlng.lng]);
          distance += haversine(cursor, stop.latlng);
          cursor = stop.latlng;
          const weight = stop.details?.cargo?.weight;
          if (Number.isFinite(weight)) {
            totalWeight += weight;
            weightKnown = true;
          }
        }
        polylinePoints.push([hub.lat, hub.lng]);
        distance += haversine(cursor, { lat: hub.lat, lng: hub.lng });
        if (showRoutes){
          const routeLine = L.polyline(polylinePoints, {
            color,
            weight: 4,
            opacity: 0.7,
          });
          routeLine.bindPopup(`<strong>${carrier}</strong><br/>${orderedStops.length} stops • ${distance.toFixed(1)} km`);
          routeLine.addTo(routesLayer);
        }
        for (const point of polylinePoints){
          bounds.extend(point);
        }
        grouped.push({
          carrier,
          label: carrier,
          stops: orderedStops,
          distance,
          totalWeight,
          weightKnown,
          color,
        });
      }

      if (bounds.isValid()){
        map.fitBounds(bounds.pad(0.2));
        lastBounds = bounds;
      } else {
        map.setView([52.2, 5.3], 7);
        lastBounds = null;
      }

      renderSummary(grouped, backlog, date);
      setStatus(`Kaart bijgewerkt voor ${new Date(date).toLocaleDateString("nl-NL")}.`);
    } catch (e) {
      console.error("Kan routes niet laden", e);
      setStatus("Routes laden mislukt. Probeer het opnieuw.", "error");
    }
  }

  function bindEvents(){
    if (els.btnRebuild) els.btnRebuild.addEventListener("click", refreshRoutes);
    if (els.btnResetView) els.btnResetView.addEventListener("click", () => {
      if (lastBounds && lastBounds.isValid()){
        map.fitBounds(lastBounds.pad(0.1));
      } else {
        map.setView([52.2, 5.3], 7);
      }
    });
    if (els.btnPrint) els.btnPrint.addEventListener("click", () => window.print());
    if (els.toggleRoutes) els.toggleRoutes.addEventListener("change", refreshRoutes);
    if (els.toggleOptimize) els.toggleOptimize.addEventListener("change", refreshRoutes);
    if (els.date) els.date.addEventListener("change", refreshRoutes);
  }

  initMap();
  ensureDate();
  bindEvents();
  refreshRoutes();
})();
