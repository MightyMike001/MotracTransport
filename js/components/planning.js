// js/components/planning.js
import {S, save} from '../state.js';

function fmtDate(d){ return d.toISOString().slice(0,10); }
function addDays(d,n){ const x=new Date(d); x.setDate(d.getDate()+n); return x; }

export function renderPlanning(root){
  const start = new Date(S.settings.weekStart+'T00:00:00');
  const days = [...Array(7)].map((_,i)=> addDays(start,i));
  root.innerHTML = `
    <div class="card">
      <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px">
        <h3 style="margin:0; margin-right:auto">Weekplanning</h3>
        <button id="prev" class="btn">◀</button>
        <div class="badge">${fmtDate(days[0])} – ${fmtDate(days[6])}</div>
        <button id="next" class="btn">▶</button>
        <button id="auto" class="btn primary" style="margin-left:auto">Auto-plannen</button>
      </div>
      <div class="grid cols-3">
        ${S.vehicles.map(v=>`
          <div class="card">
            <strong>${v.plate}</strong> <span class="badge">${v.type}</span>
            ${days.map(d=>{
              const dt = fmtDate(d);
              const items = S.orders.filter(o=>o.vehicleId===v.id && o.date===dt && (o.status==='Gepland'||o.status==='Onderweg'));
              return `<div data-veh="${v.id}" data-date="${dt}" class="dropzone" style="min-height:90px; border:1px dashed #d5d7df; border-radius:10px; padding:6px; margin-top:8px">
                <div style="font-size:.85rem; color:#6b6f7b">${dt}</div>
                ${items.map(o=>`<div class="order-card" draggable="true" data-id="${o.id}">${o.client} · ${o.pallets||0} pal</div>`).join('')}
              </div>`;
            }).join('')}
          </div>
        `).join('')}
      </div>
      <div style="margin-top:10px">
        <div class="badge">Niet-gepland</div>
        <div id="pool" style="display:flex; gap:8px; overflow:auto; padding:6px 0"></div>
      </div>
    </div>
  `;

  // Pool
  const pool = root.querySelector('#pool');
  const items = S.orders.filter(o=>o.status==='Nieuw' || !o.vehicleId);
  items.forEach(o=>{
    const d = document.createElement('div');
    d.className='order-card'; d.draggable=true; d.dataset.id=o.id;
    d.textContent = `${o.client} · ${o.pallets||0} pal`;
    d.addEventListener('dragstart', ev=> ev.dataTransfer.setData('text/plain', o.id));
    pool.appendChild(d);
  });

  // Drops
  root.querySelectorAll('.dropzone').forEach(z=>{
    z.addEventListener('dragover', ev=> ev.preventDefault());
    z.addEventListener('drop', ev=>{
      ev.preventDefault();
      const id = ev.dataTransfer.getData('text/plain');
      const o = S.orders.find(x=>x.id===id); if (!o) return;
      o.vehicleId = z.dataset.veh; o.date = z.dataset.date;
      if (o.status==='Nieuw') o.status='Gepland';
      save('Gepland'); renderPlanning(root);
    });
  });

  // Nav / Auto-plan
  root.querySelector('#prev').onclick = ()=>{ const d=start; d.setDate(d.getDate()-7); S.settings.weekStart=fmtDate(d); save(); renderPlanning(root); };
  root.querySelector('#next').onclick = ()=>{ const d=start; d.setDate(d.getDate()+7); S.settings.weekStart=fmtDate(d); save(); renderPlanning(root); };
  root.querySelector('#auto').onclick = ()=>{
    const week = days.map(fmtDate);
    for (const o of S.orders.filter(x=>x.status==='Nieuw')){
      let placed=false;
      for (const v of S.vehicles){
        for (const dt of week){
          const todays = S.orders.filter(p=>p.vehicleId===v.id && p.date===dt);
          const pal = todays.reduce((s,p)=> s+(p.pallets||0),0) + (o.pallets||0);
          const kg  = todays.reduce((s,p)=> s+(p.weight||0),0) + (o.weight||0);
          if (pal <= (v.capPal||0) && kg <= (v.capKg||0)){
            o.vehicleId = v.id; o.date = dt; o.status='Gepland'; placed=true; break;
          }
        }
        if (placed) break;
      }
    }
    save('Auto-plannen voltooid'); renderPlanning(root);
  };
}
