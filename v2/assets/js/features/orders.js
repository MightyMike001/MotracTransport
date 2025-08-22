import { transportOrders, nextId, editingId, setEditingId } from '../data/orders.js';
import { vrachtwagens } from '../data/trucks.js';
import { formatDate } from '../lib/utils.js';

export function showSectionInit(sectionName, event){
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.getElementById(sectionName).classList.remove('hidden');
  if (event && event.currentTarget) event.currentTarget.classList.add('active');

  if (sectionName === 'dashboard' || sectionName === 'orders') loadOrders();
  else if (sectionName === 'planning') {
    const { loadPlanningData } = awaitImportPlanning();
    awaitImportPlanning().then(({loadPlanningData})=>loadPlanningData());
  } else if (sectionName === 'map') {
    awaitImportMap().then(({initializeMap})=>initializeMap());
  }
}

// Dynamic imports to avoid circular references
function awaitImportPlanning(){ return import('./planning.js'); }
function awaitImportMap(){ return import('./map.js'); }

export function loadOrders(){
  loadDashboardTable();
  loadOrdersTable();
}

export function loadDashboardTable(){
  const tbody = document.getElementById('dashboardTableBody');
  if(!tbody) return;
  tbody.innerHTML = '';
  transportOrders.forEach(order => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td>TO-${order.id.toString().padStart(3,'0')}</td>
      <td>${order.klantNaam}</td>
      <td>${formatDate(order.transportDatum)}</td>
      <td><span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span></td>
      <td>${order.locatie}</td>
      <td>
        <button class="edit-btn" onclick="editOrder(${order.id})">Bewerken</button>
        <button class="delete-btn" onclick="deleteOrder(${order.id})">Verwijderen</button>
      </td>`;
  });
}

export function loadOrdersTable(){
  const tbody = document.getElementById('ordersTableBody');
  if(!tbody) return;
  tbody.innerHTML='';
  transportOrders.forEach(order=>{
    const truckName = order.vrachtwagen ? (vrachtwagens.find(t=>t.id===order.vrachtwagen)?.naam || order.vrachtwagen) : 'Niet gepland';
    const row = tbody.insertRow();
    row.innerHTML = `
      <td>TO-${order.id.toString().padStart(3,'0')}</td>
      <td>${order.klantNaam}</td>
      <td>${order.contactpersoon || '-'}</td>
      <td>${order.adres}, ${order.postcode} ${order.plaats}</td>
      <td>${formatDate(order.transportDatum)}</td>
      <td><span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span></td>
      <td>${order.locatie}</td>
      <td>${order.product || '-'}<br><small>${order.gewicht || 0}kg | ${order.lengte || 0}×${order.breedte || 0}×${order.hoogte || 0}cm</small></td>
      <td><small>${truckName}</small></td>
      <td>
        <button class="edit-btn" onclick="editOrder(${order.id})">Bewerken</button>
        <button class="delete-btn" onclick="deleteOrder(${order.id})">Verwijderen</button>
      </td>`;
  });
}

export function saveOrder(event){
  event?.preventDefault?.();
  const get = id => document.getElementById(id).value;

  const orderData = {
    klantNaam: get('klantNaam'),
    contactpersoon: get('contactpersoon'),
    transportDatum: get('transportDatum'),
    status: get('status'),
    opdracht_type: get('opdracht_type'),
    pickup_adres: get('pickup_adres'),
    pickup_plaats: get('pickup_plaats'),
    adres: get('adres'),
    postcode: get('postcode'),
    plaats: get('plaats'),
    locatie: get('locatie'),
    product: get('product'),
    gewicht: parseFloat(get('gewicht')) || 0,
    lengte: parseFloat(get('lengte')) || 0,
    breedte: parseFloat(get('breedte')) || 0,
    hoogte: parseFloat(get('hoogte')) || 0,
    vrachtwagen: get('vrachtwagen'),
    opmerkingen: get('opmerkingen')
  };

  if (editingId){
    const idx = transportOrders.findIndex(o=>o.id===editingId);
    if (idx !== -1) transportOrders[idx] = { ...orderData, id: editingId };
    setEditingId(null);
    alert('Transport opdracht bijgewerkt!');
  } else {
    transportOrders.push({ ...orderData, id: nextId });
    // Manually increase nextId (cannot reassign imported binding directly in strict ESM)
    const nid = nextId + 1;
    // Hack: reflect in window for simplicity in this static app
    import('../data/orders.js').then(m=>{ m.nextId = nid; });
    alert('Transport opdracht aangemaakt!');
  }
  resetForm();
  showSectionInit('dashboard');
  loadOrders();
}

export function togglePickupFields(){
  const orderType = document.getElementById('opdracht_type').value;
  const locatie = document.getElementById('locatie').value;
  const pickupAdres = document.getElementById('pickup_adres');
  const pickupPlaats = document.getElementById('pickup_plaats');

  if ((orderType === 'Vestiging naar Klant' || orderType === 'Vestiging naar Vestiging') && locatie){
    pickupAdres.value = 'Motrac ' + locatie;
    pickupPlaats.value = locatie;
  } else {
    pickupAdres.value = '';
    pickupPlaats.value = '';
  }
}

export function editOrder(id){
  const order = transportOrders.find(o=>o.id===id);
  if(!order) return;
  setEditingId(id);
  const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.value = val ?? ''; };
  set('klantNaam', order.klantNaam);
  set('contactpersoon', order.contactpersoon);
  set('transportDatum', order.transportDatum);
  set('status', order.status);
  set('opdracht_type', order.opdracht_type || 'Vestiging naar Klant');
  set('pickup_adres', order.pickup_adres);
  set('pickup_plaats', order.pickup_plaats);
  set('adres', order.adres);
  set('postcode', order.postcode);
  set('plaats', order.plaats);
  set('locatie', order.locatie);
  set('product', order.product);
  set('gewicht', order.gewicht);
  set('lengte', order.lengte);
  set('breedte', order.breedte);
  set('hoogte', order.hoogte);
  set('vrachtwagen', order.vrachtwagen);
  set('opmerkingen', order.opmerkingen);

  showSectionInit('new-order');
}

export function deleteOrder(id){
  if (!confirm('Weet je zeker dat je deze transport opdracht wilt verwijderen?')) return;
  const idx = transportOrders.findIndex(o=>o.id===id);
  if(idx!==-1){
    transportOrders.splice(idx,1);
    loadOrders();
    alert('Transport opdracht verwijderd!');
  }
}

export function resetForm(){
  document.getElementById('transportForm')?.reset();
  setEditingId(null);
  // default date to today
  const today = new Date().toISOString().split('T')[0];
  const td = document.getElementById('transportDatum');
  if (td) td.value = today;
  const pa = document.getElementById('pickup_adres');
  const pp = document.getElementById('pickup_plaats');
  if (pa) pa.value = '';
  if (pp) pp.value = '';
}

export function filterDashboard(){
  const searchTerm = (document.getElementById('dashboardSearch').value||'').toLowerCase();
  const statusFilter = document.getElementById('dashboardStatusFilter').value;
  const locationFilter = document.getElementById('dashboardLocationFilter').value;

  const tbody = document.getElementById('dashboardTableBody');
  if(!tbody) return;
  tbody.innerHTML='';

  transportOrders.filter(order=>{
    const matchesSearch = order.klantNaam.toLowerCase().includes(searchTerm);
    const matchesStatus = !statusFilter || order.status === statusFilter;
    const matchesLocation = !locationFilter || order.locatie === locationFilter;
    return matchesSearch && matchesStatus && matchesLocation;
  }).forEach(order=>{
    const row = tbody.insertRow();
    row.innerHTML = `
      <td>TO-${order.id.toString().padStart(3,'0')}</td>
      <td>${order.klantNaam}</td>
      <td>${formatDate(order.transportDatum)}</td>
      <td><span class="status-badge status-${order.status.toLowerCase()}">${order.status}</span></td>
      <td>${order.locatie}</td>
      <td>
        <button class="edit-btn" onclick="editOrder(${order.id})">Bewerken</button>
        <button class="delete-btn" onclick="deleteOrder(${order.id})">Verwijderen</button>
      </td>`;
  });
}
