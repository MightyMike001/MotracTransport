import { transportOrders } from '../data/orders.js';
import { vrachtwagens } from '../data/trucks.js';

let draggedOrderId = null;

export function loadPlanningData(){
  const selectedDate = document.getElementById('planningDate').value || getTodayString();
  const selectedLocation = document.getElementById('planningLocation').value;

  const planningOrders = transportOrders.filter(order => {
    const matchesDate = order.transportDatum === selectedDate;
    const matchesLocation = !selectedLocation || order.locatie === selectedLocation;
    return matchesDate && matchesLocation;
  });

  const availableTrucks = vrachtwagens.filter(truck => !selectedLocation || truck.locatie === selectedLocation);
  loadTruckCards(availableTrucks, planningOrders);
  loadUnplannedOrders(planningOrders);
}

function getTodayString(){ return new Date().toISOString().split('T')[0]; }

export function loadTruckCards(trucks, orders){
  const container = document.getElementById('truckPlanning');
  if(!container) return;
  container.innerHTML = '';

  trucks.forEach(truck => {
    const plannedOrders = orders.filter(o=>o.vrachtwagen === truck.id);
    const totalWeight = plannedOrders.reduce((s,o)=> s + (o.gewicht || 0), 0);
    const weightPercent = Math.min((totalWeight / truck.maxGewicht) * 100, 100);
    const weightClass = weightPercent > 90 ? 'danger' : (weightPercent > 75 ? 'warning' : '');

    const card = document.createElement('div');
    card.className = 'truck-card';
    card.innerHTML = `
      <div class="truck-header">
        <div><strong>${truck.id}</strong><br><small>${truck.naam}</small></div>
        <div class="truck-capacity">${truck.locatie}</div>
      </div>
      <div style="margin-bottom:10px;">
        <strong>Gewicht:</strong> ${totalWeight.toFixed(0)} / ${truck.maxGewicht} kg
        <div class="capacity-bar"><div class="capacity-fill ${weightClass}" style="width:${weightPercent}%">${weightPercent.toFixed(0)}%</div></div>
      </div>
      <div class="drop-zone" ondrop="dropOrder(event, '${truck.id}')" ondragover="allowDrop(event)" ondragleave="removeDragOver(event)">
        ${
          plannedOrders.map(order => `
            <div class="transport-item" draggable="true" ondragstart="dragOrder(event, ${order.id})">
              <strong>TO-${order.id.toString().padStart(3,'0')}</strong> - ${order.klantNaam}<br>
              <small>${order.product || ''}</small>
              <div class="dimensions-info">${order.gewicht||0}kg | ${order.lengte||0}×${order.breedte||0}×${order.hoogte||0}cm</div>
            </div>
          `).join('')
        }
        ${plannedOrders.length === 0 ? '<div style="color:#999;text-align:center;padding:20px;">Sleep transport orders hier</div>' : ''}
      </div>`;
    container.appendChild(card);
  });
}

export function loadUnplannedOrders(orders){
  const container = document.getElementById('unplanedOrdersList');
  if(!container) return;
  const unplanned = orders.filter(o=>!o.vrachtwagen);
  if(unplanned.length === 0){
    container.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">Alle transport orders zijn gepland</p>';
    return;
  }
  container.innerHTML = unplanned.map(order => `
    <div class="transport-item" draggable="true" ondragstart="dragOrder(event, ${order.id})">
      <strong>TO-${order.id.toString().padStart(3,'0')}</strong> - ${order.klantNaam}<br>
      <small>${order.product || ''} | ${order.plaats}</small>
      <div class="dimensions-info">${order.gewicht||0}kg | ${order.lengte||0}×${order.breedte||0}×${order.hoogte||0}cm</div>
    </div>
  `).join('');
}

// Drag & Drop
export function dragOrder(event, orderId){
  draggedOrderId = orderId;
  event.dataTransfer.effectAllowed = "move";
}
export function allowDrop(event){
  event.preventDefault();
  event.currentTarget.classList.add('drag-over');
}
export function removeDragOver(event){
  event.currentTarget.classList.remove('drag-over');
}
export function dropOrder(event, truckId){
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');
  if(!draggedOrderId) return;
  const idx = transportOrders.findIndex(o=>o.id===draggedOrderId);
  if(idx!==-1){
    const order = transportOrders[idx];
    if (truckId){
      const truck = vrachtwagens.find(t=>t.id===truckId);
      if(truck && !checkTruckCapacity(truck, order)){
        alert(`Vrachtwagen ${truck.id} heeft onvoldoende capaciteit voor deze order!`);
        return;
      }
      transportOrders[idx].vrachtwagen = truckId;
      alert(`Transport order TO-${order.id.toString().padStart(3,'0')} toegewezen aan ${truckId}`);
    } else {
      transportOrders[idx].vrachtwagen = '';
      alert(`Transport order TO-${order.id.toString().padStart(3,'0')} is nu ongepland`);
    }
    loadPlanningData();
  }
  draggedOrderId = null;
}

export function checkTruckCapacity(truck, newOrder){
  const currentOrders = transportOrders.filter(o=>o.vrachtwagen===truck.id && o.id !== newOrder.id);
  const totalWeight = currentOrders.reduce((s,o)=> s + (o.gewicht||0), 0) + (newOrder.gewicht||0);
  if (totalWeight > truck.maxGewicht) return false;
  if ((newOrder.lengte||0) > truck.maxLengte || (newOrder.breedte||0) > truck.maxBreedte || (newOrder.hoogte||0) > truck.maxHoogte) return false;
  return true;
}

export function optimizePlanning(){
  const selectedDate = document.getElementById('planningDate').value || getTodayString();
  const selectedLocation = document.getElementById('planningLocation').value;

  const ordersToOptimize = transportOrders.filter(order => {
    const matchesDate = order.transportDatum === selectedDate;
    const matchesLocation = !selectedLocation || order.locatie === selectedLocation;
    return matchesDate && matchesLocation;
  });

  const availableTrucks = vrachtwagens.filter(truck => !selectedLocation || truck.locatie === selectedLocation);

  ordersToOptimize.forEach(order => {
    order.vrachtwagen = '';
    for (const truck of availableTrucks){
      if (checkTruckCapacity(truck, order)){
        order.vrachtwagen = truck.id;
        break;
      }
    }
  });
  loadPlanningData();
  alert('Auto optimalisatie voltooid!');
}
