import { transportOrders } from '../data/orders.js';
import { vrachtwagens } from '../data/trucks.js';

let draggedOrderId=null;

export function loadPlanningData(){
  const d=document.getElementById('planningDate')?.value || new Date().toISOString().split('T')[0];
  const loc=document.getElementById('planningLocation')?.value || '';
  const orders=transportOrders.filter(o=>(o.transportDatum===d) && (!loc || o.locatie===loc));
  const trucks=vrachtwagens.filter(t=>!loc || t.locatie===loc);
  renderTruckCards(trucks, orders);
  renderUnplanned(orders);
}

function renderTruckCards(trucks, orders){
  const c=document.getElementById('truckPlanning'); if(!c) return; c.innerHTML='';
  trucks.forEach(truck=>{
    const planned=orders.filter(o=>o.vrachtwagen===truck.id);
    const total=planned.reduce((s,o)=>s+(o.gewicht||0),0);
    const pct=Math.min((total/truck.maxGewicht)*100,100);
    const cls=pct>90?'danger':pct>75?'warning':'';
    const el=document.createElement('div'); el.className='truck-card';
    el.innerHTML=`
      <div class="truck-header"><div><strong>${truck.id}</strong><br><small>${truck.naam}</small></div><div class="truck-capacity">${truck.locatie}</div></div>
      <div style="margin-bottom:10px;">
        <strong>Gewicht:</strong> ${total.toFixed(0)} / ${truck.maxGewicht} kg
        <div class="capacity-bar"><div class="capacity-fill ${cls}" style="width:${pct}%">${pct.toFixed(0)}%</div></div>
      </div>
      <div class="drop-zone" ondrop="dropOrder(event,'${truck.id}')" ondragover="allowDrop(event)" ondragleave="removeDragOver(event)">
        ${planned.map(o=>`
          <div class="transport-item" draggable="true" ondragstart="dragOrder(event,${o.id})">
            <strong>TO-${String(o.id).padStart(3,'0')}</strong> - ${o.klantNaam}<br><small>${o.product||''}</small>
          </div>`).join('')}
        ${planned.length===0?'<div style="color:#999;text-align:center;padding:20px;">Sleep transport orders hier</div>':''}
      </div>`;
    c.appendChild(el);
  });
}

function renderUnplanned(orders){
  const c=document.getElementById('unplanedOrdersList'); if(!c) return;
  const unplanned=orders.filter(o=>!o.vrachtwagen);
  c.innerHTML = unplanned.map(o=>`
    <div class="transport-item" draggable="true" ondragstart="dragOrder(event,${o.id})">
      <strong>TO-${String(o.id).padStart(3,'0')}</strong> - ${o.klantNaam}<br><small>${o.product||''} | ${o.plaats||''}</small>
    </div>`).join('') || '<p style="color:#999;text-align:center;padding:20px;">Alle transport orders zijn gepland</p>';
}

export function dragOrder(e,id){ draggedOrderId=id; e.dataTransfer.effectAllowed='move'; }
export function allowDrop(e){ e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
export function removeDragOver(e){ e.currentTarget.classList.remove('drag-over'); }
export function dropOrder(e,truckId){
  e.preventDefault(); e.currentTarget.classList.remove('drag-over');
  if(!draggedOrderId) return;
  const idx=transportOrders.findIndex(o=>o.id===draggedOrderId);
  if(idx!==-1){ transportOrders[idx].vrachtwagen=truckId||''; alert(truckId?`Order TO-${String(draggedOrderId).padStart(3,'0')} -> ${truckId}`:'Order ongepland'); loadPlanningData(); }
  draggedOrderId=null;
}
export function optimizePlanning(){ alert('v3 demo: eenvoudige planning.'); }
