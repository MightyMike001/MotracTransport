import { transportOrders, replaceTransportOrders } from '../data/orders.js';
import { vrachtwagens } from '../data/trucks.js';
import { formatDate, getTodayString } from '../lib/utils.js';

// === GitHub instellingen (pas aan) ===
const GH_OWNER = 'mightymike001';    // <--- jouw GitHub gebruikersnaam
const GH_REPO  = 'MotracTransport';  // <--- jouw repo naam
const GH_RAW_ORDERS_URL = `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/main/data/orders.json`;
const ISSUES_URL = `https://github.com/${GH_OWNER}/${GH_REPO}/issues`;

// ---- Section router / initialisatie ----
export function showSection(sectionName, event){
  document.querySelectorAll('.section').forEach(s=>s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
  const el = document.getElementById(sectionName);
  if(el) el.classList.remove('hidden');
  if(event?.currentTarget) event.currentTarget.classList.add('active');

  if(sectionName==='dashboard' || sectionName==='orders') loadOrders();
  else if(sectionName==='planning') import('./planning.js').then(m=>m.loadPlanningData());
  else if(sectionName==='map') import('./map.js').then(m=>m.initializeMap());

  // update issues link
  const issuesEl = document.getElementById('issuesUrl');
  if(issuesEl) issuesEl.href = ISSUES_URL;
}

// ---- Loaders / tables ----
export function loadOrders(){
  // dashboard table
  const tbody = document.getElementById('dashboardTableBody');
  if(tbody){
    tbody.innerHTML = '';
    transportOrders.forEach(order => {
      const row = tbody.insertRow();
      row.innerHTML = `
        <td>TO-${String(order.id||'').padStart(3,'0')}</td>
        <td>${order.klantNaam||'-'}</td>
        <td>${order.transportDatum ? formatDate(order.transportDatum) : '-'}</td>
        <td><span class="status-badge status-${(order.status||'').toLowerCase()}">${order.status||''}</span></td>
        <td>${order.locatie||''}</td>
        <td>
          <button class="edit-btn" onclick="editOrder(${order.id||0})">Bewerken</button>
          <button class="delete-btn" onclick="deleteOrder(${order.id||0})">Verwijderen</button>
        </td>`;
    });
  }

  // orders table
  const tbody2 = document.getElementById('ordersTableBody');
  if(tbody2){
    tbody2.innerHTML = '';
    transportOrders.forEach(order=>{
      const truckName = order.vrachtwagen ? (vrachtwagens.find(t=>t.id===order.vrachtwagen)?.naam || order.vrachtwagen) : 'Niet gepland';
      const row = tbody2.insertRow();
      row.innerHTML = `
        <td>TO-${String(order.id||'').padStart(3,'0')}</td>
        <td>${order.klantNaam||'-'}</td>
        <td>${order.contactpersoon||'-'}</td>
        <td>${order.adres||''}, ${order.postcode||''} ${order.plaats||''}</td>
        <td>${order.transportDatum?formatDate(order.transportDatum):'-'}</td>
        <td><span class="status-badge status-${(order.status||'').toLowerCase()}">${order.status||''}</span></td>
        <td>${order.locatie||''}</td>
        <td>${order.product||'-'}<br><small>${order.gewicht||0}kg | ${order.lengte||0}×${order.breedte||0}×${order.hoogte||0}cm</small></td>
        <td><small>${truckName}</small></td>
        <td>
          <button class="edit-btn" onclick="editOrder(${order.id||0})">Bewerken</button>
          <button class="delete-btn" onclick="deleteOrder(${order.id||0})">Verwijderen</button>
        </td>`;
    });
  }
}

// ---- Form helpers ----
function g(id){ return document.getElementById(id); }
function buildOrderFromForm(){
  return {
    klantNaam: g('klantNaam').value,
    contactpersoon: g('contactpersoon').value,
    transportDatum: g('transportDatum').value || getTodayString(),
    status: g('status').value,
    opdracht_type: g('opdracht_type').value,
    pickup_adres: g('pickup_adres').value,
    pickup_plaats: g('pickup_plaats').value,
    adres: g('adres').value,
    postcode: g('postcode').value,
    plaats: g('plaats').value,
    locatie: g('locatie').value,
    product: g('product').value,
    gewicht: parseFloat(g('gewicht').value) || 0,
    lengte: parseFloat(g('lengte').value) || 0,
    breedte: parseFloat(g('breedte').value) || 0,
    hoogte: parseFloat(g('hoogte').value) || 0,
    vrachtwagen: g('vrachtwagen').value,
    opmerkingen: g('opmerkingen').value
  };
}

// ---- Local save (demo) ----
export function saveOrder(e){
  e?.preventDefault?.();
  const data = buildOrderFromForm();
  const nextId = (transportOrders.reduce((m,o)=>Math.max(m,o.id||0),0) || 0) + 1;
  transportOrders.push({ ...data, id: nextId });
  alert('Lokaal opgeslagen (in-memory). Gebruik "Opslaan naar GitHub" voor permanente opslag.');
  resetForm();
  showSection('dashboard');
  loadOrders();
}

// ---- Save to GitHub (Issue) ----
export function saveOrderToGitHubFromForm(){
  const order = buildOrderFromForm();
  const body = encodeURIComponent([
    '### Nieuwe order (automatisch aangemaakt vanuit de app)',
    '',
    '```json',
    JSON.stringify(order, null, 2),
    '```',
    '',
    '_label: order_'
  ].join('\n'));
  const title = encodeURIComponent(`Nieuwe order: ${order.klantNaam || 'Onbekend'}`);
  const labels = encodeURIComponent('order');
  const url = `https://github.com/${GH_OWNER}/${GH_REPO}/issues/new?title=${title}&labels=${labels}&body=${body}`;
  window.open(url, '_blank');
}

// ---- UI helpers ----
export function togglePickupFields(){
  const orderType = g('opdracht_type').value;
  const locatie = g('locatie').value;
  if((orderType === 'Vestiging naar Klant' || orderType === 'Vestiging naar Vestiging') && locatie){
    g('pickup_adres').value = 'Motrac ' + locatie;
    g('pickup_plaats').value = locatie;
  } else {
    // don't override for other types
  }
}

// ---- Edit / Delete / Reset ----
export function editOrder(id){
  const o = transportOrders.find(x => x.id === id);
  if(!o) return;
  Object.entries({
    klantNaam: o.klantNaam, contactpersoon: o.contactpersoon, transportDatum: o.transportDatum,
    status: o.status, opdracht_type: o.opdracht_type, pickup_adres: o.pickup_adres, pickup_plaats: o.pickup_plaats,
    adres: o.adres, postcode: o.postcode, plaats: o.plaats, locatie: o.locatie, product: o.product,
    gewicht: o.gewicht, lengte: o.lengte, breedte: o.breedte, hoogte: o.hoogte, vrachtwagen: o.vrachtwagen,
    opmerkingen: o.opmerkingen
  }).forEach(([k,v])=>{ const el = g(k); if(el) el.value = (v ?? ''); });
  showSection('new-order');
}

export function deleteOrder(id){
  if(!confirm('Weet je zeker dat je deze transport opdracht wilt verwijderen?')) return;
  const idx = transportOrders.findIndex(x => x.id === id);
  if(idx !== -1){ transportOrders.splice(idx,1); loadOrders(); alert('Verwijderd (lokaal).'); }
}

export function resetForm(){
  g('transportForm')?.reset();
  g('transportDatum').value = getTodayString();
}

// ---- Filters ----
export function filterDashboard(){
  const term = (g('dashboardSearch')?.value || '').toLowerCase();
  const s = g('dashboardStatusFilter')?.value || '';
  const l = g('dashboardLocationFilter')?.value || '';
  const tbody = g('dashboardTableBody');
  if(!tbody) return;
  tbody.innerHTML = '';
  transportOrders.filter(o=>{
    const m1 = (o.klantNaam||'').toLowerCase().includes(term);
    const m2 = !s || o.status === s;
    const m3 = !l || o.locatie === l;
    return m1 && m2 && m3;
  }).forEach(order=>{
    const row = tbody.insertRow();
    row.innerHTML = `
      <td>TO-${String(order.id||'').padStart(3,'0')}</td>
      <td>${order.klantNaam||'-'}</td>
      <td>${order.transportDatum?formatDate(order.transportDatum):'-'}</td>
      <td><span class="status-badge status-${(order.status||'').toLowerCase()}">${order.status||''}</span></td>
      <td>${order.locatie||''}</td>
      <td>
        <button class="edit-btn" onclick="editOrder(${order.id||0})">Bewerken</button>
        <button class="delete-btn" onclick="deleteOrder(${order.id||0})">Verwijderen</button>
      </td>`;
  });
}

// ---- Load orders from GitHub raw JSON ----
export async function loadOrdersFromGitHub(){
  try {
    const res = await fetch(GH_RAW_ORDERS_URL, { cache: 'no-store' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const arr = await res.json();
    // ID's worden nu beheerd door de GitHub Action, dus we kunnen de data direct gebruiken.
    const orders = Array.isArray(arr) ? arr : [];
    replaceTransportOrders(orders);
    alert(`${orders.length} orders geladen uit GitHub JSON.`);
    loadOrders();
  } catch (err) {
    alert('Laden uit GitHub mislukt: ' + err.message);
    console.error(err);
  }
}

// expose functions to global scope (for inline onclick handlers)
window.showSection = showSection;
window.loadOrders = loadOrders;
window.saveOrder = saveOrder;
window.saveOrderToGitHubFromForm = saveOrderToGitHubFromForm;
window.togglePickupFields = togglePickupFields;
window.editOrder = editOrder;
window.deleteOrder = deleteOrder;
window.resetForm = resetForm;
window.filterDashboard = filterDashboard;
window.loadOrdersFromGitHub = loadOrdersFromGitHub;
