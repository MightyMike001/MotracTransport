import { transportOrders } from '../data/orders.js';
import { vrachtwagens } from '../data/trucks.js';

let draggedOrderId = null;

export function loadPlanningData(){
  const selectedDate = document.getElementById('planningDate')?.value || new Date().toISOString().split('T')[0];
  const selectedLocation = document.getElementById('planningLocation')?.value || '';
  const planningOrders = transportOrders.filter(o => (o.transportDatum === selectedDate) && (!selectedLocation || o.locatie === selectedLocation));
  const availableTrucks = vrachtwagens.filter(t => !selectedLocation || t.locatie === selectedLocation);
  loadTruckCards(availableTrucks, planningOrders);
  loadUnplannedOrders(planningOrders);
}

function loadTruckCards(trucks, orders){
  const container = document.getElementById('truckPlanning');
  if(!container) return;
  container.innerHTML = '';
  trucks.forEach(truck => {
    const planned = orders.filter(o => o.vrachtwagen === truck.id);
    const totalWeight = planned.reduce((s,o)=>s+(o.gewicht||0),0);
    const pct = Math.min((totalWeight / truck.maxGewicht) * 100, 100);
    const weightClass = pct > 90 ? 'danger' : pct > 75 ? 'warning' : '';
    const card = document.createElement('div');
    card.className = 'truck-card';
    card.innerHTML = `
      <div class="truck-header">
        <div><strong>${truck.id}</strong><br><small>${truck.naam}</small></div>
        <div class="truck-capacity">${truck.locatie}</div>
      </div>
      <div style="margin-bottom:10px;">
        <strong>Gewicht:</strong> ${totalWeight.toFixed(0)} / ${truck.maxGewicht} kg
        <div class="capacity-bar"><div class="capacity-fill ${weightClass}" style="width:${pct}%">${pct.toFixed(0)}%</div></div>
      </div>
      <div class="drop-zone" ondrop="dropOrder(event,'${truck.id}')" ondragover="allowDrop(event)" ondragleave="removeDragOver(event)">
        ${planned.map(o=>`<div class="transport-item" draggable="true" ondragstart="dragOrder(event,${o.id})">
          <strong>TO-${String(o.id).padStart(3,'0')}</strong> - ${o.klantNaam}<br><small>${o.product||''}</small></div>`).join('')}
        ${planned.length===0 ? '<div style="color:#999;text-align:center;padding:20px;">Sleep transport orders hier</div>' : ''}
      </div>`;
    container.appendChild(card);
  });
}

function loadUnplannedOrders(orders){
  const container = document.getElementById('unplanedOrdersList');
  if(!container) return;
  const unplanned = orders.filter(o => !o.vrachtwagen);
  if(unplanned.length === 0){
    container.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Alle transport orders zijn gepland</p>';
    return;
  }
  container.innerHTML = unplanned.map(o=>`<div class="transport-item" draggable="true" ondragstart="dragOrder(event,${o.id})">
    <strong>TO-${String(o.id).padStart(3,'0')}</strong> - ${o.klantNaam}<br><small>${o.product||''} | ${o.plaats||''}</small></div>`).join('');
}

export function dragOrder(e,id){ draggedOrderId = id; e.dataTransfer.effectAllowed = 'move'; }
export function allowDrop(e){ e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
export function removeDragOver(e){ e.currentTarget.classList.remove('drag-over'); }

export function dropOrder(e, truckId){
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if(!draggedOrderId) return;
  const idx = transportOrders.findIndex(o => o.id === draggedOrderId);
  if(idx !== -1){
    transportOrders[idx].vrachtwagen = truckId || '';
    alert(truckId ? `Order TO-${String(draggedOrderId).padStart(3,'0')} toegewezen aan ${truckId}` : `Order ongepland`);
    loadPlanningData();
  }
  draggedOrderId = null;
}

export function optimizePlanning(){ alert('Demo: eenvoudige auto-optimalisatie niet ingeschakeld in deze build.'); }

// expose drop/drag helpers globally (so inline handlers work)
window.dragOrder = dragOrder;
window.allowDrop = allowDrop;
window.removeDragOver = removeDragOver;
window.dropOrder = dropOrder;
