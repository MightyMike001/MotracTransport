// js/components/dashboard.js
import {S, save, uid} from '../state.js';

export function renderDashboard(root){
  root.innerHTML = `
    <div class="kpis">
      <div class="kpi"><div class="label">Open</div><div class="value" id="kpiOpen">0</div></div>
      <div class="kpi"><div class="label">Gepland</div><div class="value" id="kpiPlan">0</div></div>
      <div class="kpi"><div class="label">Onderweg</div><div class="value" id="kpiRun">0</div></div>
      <div class="kpi"><div class="label">Afgeleverd</div><div class="value" id="kpiDone">0</div></div>
      <div class="kpi"><div class="label">Palletcapaciteit (week)</div><div class="value" id="kpiCap">0%</div></div>
    </div>
    <div class="grid cols-2" style="margin-top:12px">
      <div class="card">
        <h3>Snel nieuwe order</h3>
        <form id="quick" class="grid cols-2">
          <div><label>Klant</label><input required id="q-client"></div>
          <div><label>Prioriteit</label>
            <select id="q-prio"><option>Normaal</option><option>Hoog</option><option>Spoed</option></select></div>
          <div><label>Afhaal</label><input id="q-pickup" placeholder="plaats of adres"></div>
          <div><label>Lever</label><input id="q-drop" placeholder="plaats of adres"></div>
          <div><label>Datum</label><input type="date" id="q-date"></div>
          <div><label>Pallets</label><input type="number" id="q-pal" value="1" min="0"></div>
          <div><label>Gewicht (kg)</label><input type="number" id="q-kg" value="0" min="0" step="10"></div>
          <div style="display:flex; align-items:end"><button class="btn primary" type="submit">Toevoegen</button></div>
        </form>
      </div>
      <div class="card">
        <h3>Laatste orders</h3>
        <div class="table-wrap">
          <table><thead><tr><th>ID</th><th>Klant</th><th>Van → Naar</th><th>Datum</th><th>Status</th></tr></thead>
          <tbody id="recent"></tbody></table>
        </div>
      </div>
    </div>
  `;
  // KPIs
  const open = S.orders.filter(o=>o.status==='Nieuw').length;
  const plan = S.orders.filter(o=>o.status==='Gepland').length;
  const run  = S.orders.filter(o=>o.status==='Onderweg').length;
  const done = S.orders.filter(o=>o.status==='Afgeleverd').length;
  root.querySelector('#kpiOpen').textContent = open;
  root.querySelector('#kpiPlan').textContent = plan;
  root.querySelector('#kpiRun').textContent  = run;
  root.querySelector('#kpiDone').textContent = done;
  const totalCap = (S.vehicles.reduce((s,v)=> s+(v.capPal||0),0))*5;
  const palPlanned = S.orders.reduce((s,o)=> s+(o.pallets||0),0);
  root.querySelector('#kpiCap').textContent = totalCap? Math.min(100, Math.round(palPlanned/totalCap*100))+'%' : '0%';

  // recent
  const tb = root.querySelector('#recent');
  tb.innerHTML = S.orders.slice(-8).reverse().map(o=>`
    <tr><td>${o.id}</td><td>${o.client}</td><td>${o.pickup} → ${o.drop}</td><td>${o.date}</td><td><span class="badge">${o.status}</span></td></tr>
  `).join('');

  // quick form
  root.querySelector('#quick').addEventListener('submit', (e)=>{
    e.preventDefault();
    const o = {
      id: uid('ORD'),
      client: root.querySelector('#q-client').value.trim(),
      priority: root.querySelector('#q-prio').value,
      pickup: root.querySelector('#q-pickup').value.trim(),
      drop: root.querySelector('#q-drop').value.trim(),
      date: root.querySelector('#q-date').value || new Date().toISOString().slice(0,10),
      pallets: parseInt(root.querySelector('#q-pal').value||'0',10),
      weight: parseInt(root.querySelector('#q-kg').value||'0',10),
      status:'Nieuw', vehicleId:''
    };
    S.orders.push(o); save('Order toegevoegd');
    renderDashboard(root);
  });
}
