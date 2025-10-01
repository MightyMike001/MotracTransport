// js/components/orders.js
import {S, save} from '../state.js';

export function renderOrders(root){
  root.innerHTML = `
    <div class="card">
      <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px">
        <h3 style="margin:0; margin-right:auto">Orders</h3>
        <input id="q" placeholder="Zoeken…">
        <select id="status"><option value="">Alle</option><option>Nieuw</option><option>Gepland</option><option>Onderweg</option><option>Afgeleverd</option><option>Geannuleerd</option></select>
        <button id="add" class="btn primary">Nieuwe order</button>
      </div>
      <div class="table-wrap">
        <table><thead><tr>
          <th>ID</th><th>Klant</th><th>Van</th><th>Naar</th><th>Datum</th><th>Pallets</th><th>Gewicht</th><th>Status</th><th></th>
        </tr></thead><tbody id="tb"></tbody></table>
      </div>
    </div>`;

  const tb = root.querySelector('#tb');
  const qEl = root.querySelector('#q');
  const stEl = root.querySelector('#status');

  function paint(){
    const q = qEl.value.toLowerCase();
    const st = stEl.value;
    const rows = S.orders
      .filter(o => (!st || o.status===st))
      .filter(o => !q || JSON.stringify(o).toLowerCase().includes(q))
      .sort((a,b)=> (a.date||'').localeCompare(b.date||''));
    tb.innerHTML = rows.map(o=>`
      <tr>
        <td>${o.id}</td><td>${o.client}</td><td>${o.pickup}</td><td>${o.drop}</td><td>${o.date}</td>
        <td>${o.pallets||0}</td><td>${o.weight||0}</td>
        <td><select data-id="${o.id}" class="statusSel">
            ${['Nieuw','Gepland','Onderweg','Afgeleverd','Geannuleerd'].map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}
        </select></td>
        <td><button data-id="${o.id}" class="btn">Verwijder</button></td>
      </tr>`).join('');

    tb.querySelectorAll('.statusSel').forEach(sel=> sel.addEventListener('change', ()=>{
      const o = S.orders.find(x=>x.id===sel.dataset.id); if (!o) return;
      o.status = sel.value; save('Status gewijzigd'); paint();
    }));
    tb.querySelectorAll('button.btn').forEach(b=> b.addEventListener('click', ()=>{
      const id = b.dataset.id; const i = S.orders.findIndex(x=>x.id===id);
      if (i>=0){ S.orders.splice(i,1); save('Order verwijderd'); paint(); }
    }));
  }

  qEl.addEventListener('input', paint);
  stEl.addEventListener('change', paint);
  root.querySelector('#add').addEventListener('click', ()=>{
    const today = new Date().toISOString().slice(0,10);
    S.orders.push({id:'ORD'+Math.random().toString(36).slice(2,6).toUpperCase(), client:'Nieuwe klant', pickup:'', drop:'', date:today, pallets:0, weight:0, priority:'Normaal', status:'Nieuw', vehicleId:''});
    save('Lege order toegevoegd'); paint();
  });

  paint();
}
