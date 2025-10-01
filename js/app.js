const els = {
  filterRegion: document.getElementById("filterRegion"),
  filterStatus: document.getElementById("filterStatus"),
  btnApplyFilters: document.getElementById("btnApplyFilters"),
  planStart: document.getElementById("planStart"),
  planEnd: document.getElementById("planEnd"),
  btnSuggestPlan: document.getElementById("btnSuggestPlan"),
  btnApplyPlan: document.getElementById("btnApplyPlan"),
  plannerStatus: document.getElementById("plannerStatus"),
  quickCarrier: document.getElementById("quickCarrier"),
  quickCapacity: document.getElementById("quickCapacity"),
  quickRegion: document.getElementById("quickRegion"),
  btnAddCarrier: document.getElementById("btnAddCarrier"),
  carrierStatus: document.getElementById("carrierStatus"),
  oCustomer: document.getElementById("oCustomer"),
  oCity: document.getElementById("oCity"),
  oRegion: document.getElementById("oRegion"),
  oPriority: document.getElementById("oPriority"),
  oDue: document.getElementById("oDue"),
  oNotes: document.getElementById("oNotes"),
  lProduct: document.getElementById("lProduct"),
  lQty: document.getElementById("lQty"),
  lWeight: document.getElementById("lWeight"),
  btnCreate: document.getElementById("btnCreate"),
  createStatus: document.getElementById("createStatus"),
  btnReload: document.getElementById("btnReload"),
  ordersTable: document.getElementById("ordersTable").querySelector("tbody"),
  dlg: document.getElementById("editDialog"),
  eId: document.getElementById("eId"),
  eStatus: document.getElementById("eStatus"),
  eCarrier: document.getElementById("eCarrier"),
  ePlanned: document.getElementById("ePlanned"),
  eSlot: document.getElementById("eSlot"),
  btnSaveEdit: document.getElementById("btnSaveEdit"),
  carrierList: document.getElementById("carrierList"),
};

let ORDERS_CACHE = [];
let PLAN_SUGGESTIONS = [];

async function refreshCarriersDatalist() {
  const carriers = await Carriers.list();
  els.carrierList.innerHTML = carriers.map(c => `<option value="${c.name}">`).join("");
}

async function loadOrders() {
  const filters = {
    region: els.filterRegion.value || undefined,
    status: els.filterStatus.value || undefined,
  };
  const rows = await Orders.list(filters);
  ORDERS_CACHE = rows;
  renderOrders(rows);
}

function renderOrders(rows) {
  const tbody = els.ordersTable;
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted">Geen orders gevonden</td></tr>';
    return;
  }
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.due_date ?? "-"}</td>
      <td>${r.customer_name ?? "-"}</td>
      <td>${r.region ?? "-"}</td>
      <td>${r.priority ?? "-"}</td>
      <td>${r.status ?? "-"}</td>
      <td>${r.assigned_carrier ?? "-"}</td>
      <td>${r.planned_date ?? "-"}</td>
    `;
    tr.addEventListener("click", () => openEdit(r));
    tbody.appendChild(tr);
  }
}

function openEdit(row){
  els.eId.value = row.id;
  els.eStatus.value = row.status || "Nieuw";
  els.eCarrier.value = row.assigned_carrier || "";
  els.ePlanned.value = row.planned_date || "";
  els.eSlot.value = row.planned_slot || "";
  els.dlg.showModal();
}

async function saveEdit(){
  const id = els.eId.value;
  const patch = {
    status: els.eStatus.value,
    assigned_carrier: els.eCarrier.value || null,
    planned_date: els.ePlanned.value || null,
    planned_slot: els.eSlot.value || null,
    updated_at: new Date().toISOString()
  };
  await Orders.update(id, patch);
  els.dlg.close();
  await loadOrders();
}

async function createOrder(){
  els.createStatus.textContent = "Bezig…";
  try {
    const order = {
      customer_name: els.oCustomer.value.trim(),
      customer_city: els.oCity.value.trim(),
      region: els.oRegion.value,
      priority: parseInt(els.oPriority.value || "3", 10),
      due_date: els.oDue.value || null,
      notes: els.oNotes.value.trim() || null,
      status: "Nieuw",
    };
    const created = await Orders.create(order);
    if (els.lProduct.value.trim()) {
      await Lines.create({
        order_id: created.id,
        product: els.lProduct.value.trim(),
        quantity: parseInt(els.lQty.value || "1", 10),
        weight_kg: parseFloat(els.lWeight.value || "0")
      });
    }
    els.createStatus.textContent = "Aangemaakt";
    ["oCustomer","oCity","oPriority","oDue","oNotes","lProduct","lQty","lWeight"].forEach(id => document.getElementById(id).value = "");
    await loadOrders();
  } catch (e) {
    console.error(e);
    els.createStatus.textContent = "Mislukt";
  }
}

async function addCarrier(){
  els.carrierStatus.textContent = "Bezig…";
  try {
    await Carriers.create({
      name: els.quickCarrier.value.trim(),
      base_region: els.quickRegion.value,
      capacity_per_day: parseInt(els.quickCapacity.value || "8", 10),
      active: true
    });
    els.carrierStatus.textContent = "Toegevoegd";
    els.quickCarrier.value = "";
    await refreshCarriersDatalist();
  } catch (e) {
    console.error(e);
    els.carrierStatus.textContent = "Mislukt";
  }
}

async function suggestPlan(){
  els.plannerStatus.textContent = "Voorstel maken…";
  const carriers = await Carriers.list();
  const active = carriers.filter(c => c.active !== false);
  const start = new Date(els.planStart.value || new Date());
  const end = new Date(els.planEnd.value || new Date(Date.now()+5*86400000));
  const dates = [];
  for (let d = new Date(start); d <= end; d = new Date(d.getTime()+86400000)){
    dates.push(d.toISOString().slice(0,10));
  }
  const cap = {};
  for (const day of dates){
    cap[day] = {};
    for (const c of active){
      cap[day][c.name] = c.capacity_per_day || 8;
    }
  }
  const openOrders = ORDERS_CACHE.filter(o => ["Nieuw","Te plannen"].includes(o.status || "Nieuw"));
  openOrders.sort((a,b) => (b.priority||0)-(a.priority||0) || (a.due_date||"").localeCompare(b.due_date||""));
  const suggestions = [];
  for (const o of openOrders){
    const regionCarriers = active.filter(c => (c.base_region||"") === (o.region||""));
    const allTry = regionCarriers.length ? regionCarriers : active;
    const pref = o.due_date || dates[0];
    const tryDates = Array.from(new Set([pref, ...dates]));
    let assigned = false;
    for (const day of tryDates){
      if (!cap[day]) continue;
      for (const c of allTry){
        if ((cap[day][c.name]||0) > 0){
          cap[day][c.name] -= 1;
          suggestions.push({ id:o.id, carrier:c.name, date:day, slot:"" });
          assigned = true;
          break;
        }
      }
      if (assigned) break;
    }
    if (!assigned){
      suggestions.push({ id:o.id, carrier:null, date:null, slot:"" });
    }
  }
  PLAN_SUGGESTIONS = suggestions;
  els.plannerStatus.textContent = `Voorstel: ${suggestions.filter(s=>s.carrier).length} toegewezen / ${suggestions.length} totaal`;
}

async function applyPlan(){
  els.plannerStatus.textContent = "Opslaan…";
  const tasks = PLAN_SUGGESTIONS.filter(s => s.carrier && s.date).map(s => 
    Orders.update(s.id, {
      status: "Gepland",
      assigned_carrier: s.carrier,
      planned_date: s.date,
      planned_slot: s.slot,
      updated_at: new Date().toISOString()
    })
  );
  await Promise.allSettled(tasks);
  els.plannerStatus.textContent = "Planning opgeslagen";
  await loadOrders();
}

function bind(){
  els.btnApplyFilters.addEventListener("click", loadOrders);
  els.btnCreate.addEventListener("click", createOrder);
  els.btnReload.addEventListener("click", loadOrders);
  els.btnAddCarrier.addEventListener("click", addCarrier);
  els.btnSuggestPlan.addEventListener("click", suggestPlan);
  els.btnApplyPlan.addEventListener("click", applyPlan);
  els.btnSaveEdit.addEventListener("click", (e)=>{ e.preventDefault(); saveEdit(); });
}

(async function init(){
  bind();
  const today = new Date();
  const end = new Date(Date.now()+5*86400000);
  els.planStart.value = today.toISOString().slice(0,10);
  els.planEnd.value = end.toISOString().slice(0,10);
  await refreshCarriersDatalist();
  await loadOrders();
})();
