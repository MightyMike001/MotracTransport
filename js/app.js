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
  oReference: document.getElementById("oReference"),
  oCustomer: document.getElementById("oCustomer"),
  oCity: document.getElementById("oCity"),
  oContact: document.getElementById("oContact"),
  oRegion: document.getElementById("oRegion"),
  oPriority: document.getElementById("oPriority"),
  oDue: document.getElementById("oDue"),
  oLoadType: document.getElementById("oLoadType"),
  oPickupLocation: document.getElementById("oPickupLocation"),
  oPickupDate: document.getElementById("oPickupDate"),
  oPickupSlot: document.getElementById("oPickupSlot"),
  oDeliveryLocation: document.getElementById("oDeliveryLocation"),
  oDeliveryDate: document.getElementById("oDeliveryDate"),
  oDeliverySlot: document.getElementById("oDeliverySlot"),
  oPallets: document.getElementById("oPallets"),
  oWeight: document.getElementById("oWeight"),
  oVolume: document.getElementById("oVolume"),
  oNotes: document.getElementById("oNotes"),
  lProduct: document.getElementById("lProduct"),
  lQty: document.getElementById("lQty"),
  lWeight: document.getElementById("lWeight"),
  btnCreate: document.getElementById("btnCreate"),
  createStatus: document.getElementById("createStatus"),
  btnReload: document.getElementById("btnReload"),
  ordersTable: (() => {
    const table = document.getElementById("ordersTable");
    return table ? table.querySelector("tbody") : null;
  })(),
  dlg: document.getElementById("editDialog"),
  eId: document.getElementById("eId"),
  eStatus: document.getElementById("eStatus"),
  eCarrier: document.getElementById("eCarrier"),
  ePlanned: document.getElementById("ePlanned"),
  eSlot: document.getElementById("eSlot"),
  btnSaveEdit: document.getElementById("btnSaveEdit"),
  carrierList: document.getElementById("carrierList"),
  truckName: document.getElementById("truckName"),
  truckPlate: document.getElementById("truckPlate"),
  truckDriver: document.getElementById("truckDriver"),
  truckCapacity: document.getElementById("truckCapacity"),
  btnAddTruck: document.getElementById("btnAddTruck"),
  truckStatus: document.getElementById("truckStatus"),
  truckList: document.getElementById("truckList"),
  boardDate: document.getElementById("boardDate"),
  boardTruck: document.getElementById("boardTruck"),
  boardOrder: document.getElementById("boardOrder"),
  boardSlot: document.getElementById("boardSlot"),
  btnAssignOrder: document.getElementById("btnAssignOrder"),
  boardStatus: document.getElementById("boardStatus"),
  btnClearBoard: document.getElementById("btnClearBoard"),
  planBoard: document.getElementById("planBoard"),
};

const STORAGE_KEYS = {
  trucks: "transport_trucks_v1",
  board: "transport_board_v1",
};

const STORAGE_AVAILABLE = (() => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const testKey = "__transport_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
})();

function storageGet(key, fallback) {
  if (!STORAGE_AVAILABLE) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn("Kan localStorage niet lezen", e);
    return fallback;
  }
}

function storageSet(key, value) {
  if (!STORAGE_AVAILABLE) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Kan localStorage niet schrijven", e);
  }
}

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `truck-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

let ORDERS_CACHE = [];
let PLAN_SUGGESTIONS = [];
let TRUCKS = [];
let PLAN_BOARD = {};

function hydrateLocalState() {
  TRUCKS = storageGet(STORAGE_KEYS.trucks, []);
  PLAN_BOARD = storageGet(STORAGE_KEYS.board, {});
}

function saveTrucks() {
  storageSet(STORAGE_KEYS.trucks, TRUCKS);
}

function savePlanBoard() {
  storageSet(STORAGE_KEYS.board, PLAN_BOARD);
}

function parseOrderDetails(order) {
  const base = {
    reference: null,
    pickup: null,
    delivery: null,
    cargo: {},
    instructions: null,
    contact: null,
  };
  if (!order) return base;
  const raw = order.notes;
  if (raw && typeof raw === "string" && raw.startsWith("JSON:")) {
    try {
      const parsed = JSON.parse(raw.slice(5));
      Object.assign(base, {
        reference: parsed.reference ?? null,
        pickup: parsed.pickup ?? null,
        delivery: parsed.delivery ?? null,
        cargo: parsed.cargo ?? {},
        instructions: parsed.instructions ?? null,
        contact: parsed.contact ?? null,
      });
    } catch (e) {
      console.warn("Kan orderdetails niet parsen", e);
      base.instructions = raw;
    }
  } else if (raw) {
    base.instructions = raw;
  }
  if (!base.pickup && order.customer_city) {
    base.pickup = { location: order.customer_city };
  }
  if (!base.delivery && order.customer_city) {
    base.delivery = { location: order.customer_city };
  }
  if (!base.contact && order.customer_contact) {
    base.contact = order.customer_contact;
  }
  return base;
}

function formatStop(stop) {
  if (!stop) return "-";
  const parts = [];
  if (stop.location) parts.push(stop.location);
  if (stop.date) parts.push(stop.date);
  if (stop.slot) parts.push(stop.slot);
  return parts.length ? parts.join(" • ") : "-";
}

function formatCargo(cargo) {
  if (!cargo) return "-";
  const parts = [];
  if (cargo.type) parts.push(cargo.type);
  if (cargo.pallets) parts.push(`${cargo.pallets} pallets`);
  if (cargo.weight) parts.push(`${cargo.weight} kg`);
  if (cargo.volume) parts.push(`${cargo.volume} m³`);
  return parts.length ? parts.join(" • ") : "-";
}

function formatPlanned(row) {
  const parts = [];
  if (row.planned_date) parts.push(row.planned_date);
  if (row.planned_slot) parts.push(`(${row.planned_slot})`);
  return parts.join(" ") || "-";
}

function formatDateDisplay(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("nl-NL", { weekday: "short", day: "2-digit", month: "2-digit" });
}

async function refreshCarriersDatalist() {
  if (!els.carrierList) return;
  const carriers = await Carriers.list();
  els.carrierList.innerHTML = carriers.map(c => `<option value="${c.name}">`).join("");
}

async function loadOrders() {
  const filters = {
    region: els.filterRegion?.value || undefined,
    status: els.filterStatus?.value || undefined,
  };
  const rows = await Orders.list(filters);
  ORDERS_CACHE = rows;
  renderOrders(rows);
  updatePlanBoardSelectors();
  syncPlanBoardFromOrders();
  renderPlanBoard();
}

function renderOrders(rows) {
  const tbody = els.ordersTable;
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="muted">Geen orders gevonden</td></tr>';
    return;
  }
  for (const r of rows) {
    const details = parseOrderDetails(r);
    const tr = document.createElement("tr");
    const tooltip = [];
    if (details.instructions) tooltip.push(`Instructies: ${details.instructions}`);
    if (details.contact) tooltip.push(`Contact: ${details.contact}`);
    tr.title = tooltip.join("\n");
    tr.innerHTML = `
      <td>${r.due_date ?? details.delivery?.date ?? "-"}</td>
      <td>${details.reference ?? "-"}</td>
      <td>${r.customer_name ?? "-"}</td>
      <td>${formatStop(details.pickup)}</td>
      <td>${formatStop(details.delivery)}</td>
      <td>${formatCargo(details.cargo)}</td>
      <td>${r.status ?? "-"}</td>
      <td>${r.assigned_carrier ?? "-"}</td>
      <td>${formatPlanned(r)}</td>
    `;
    tr.addEventListener("click", () => openEdit(r));
    tbody.appendChild(tr);
  }
}

function openEdit(row){
  if (!els.dlg) return;
  els.eId.value = row.id;
  els.eStatus.value = row.status || "Nieuw";
  els.eCarrier.value = row.assigned_carrier || "";
  els.ePlanned.value = row.planned_date || "";
  els.eSlot.value = row.planned_slot || "";
  els.dlg.showModal();
}

async function saveEdit(){
  if (!els.eId) return;
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

function readNumber(value) {
  const num = parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

function buildOrderDetails() {
  return {
    reference: els.oReference.value.trim() || null,
    pickup: {
      location: els.oPickupLocation.value.trim() || null,
      date: els.oPickupDate.value || null,
      slot: els.oPickupSlot.value || null,
    },
    delivery: {
      location: els.oDeliveryLocation.value.trim() || null,
      date: els.oDeliveryDate.value || els.oDue.value || null,
      slot: els.oDeliverySlot.value || null,
    },
    cargo: {
      type: els.oLoadType.value || null,
      pallets: els.oPallets.value ? parseInt(els.oPallets.value, 10) : null,
      weight: readNumber(els.oWeight.value),
      volume: readNumber(els.oVolume.value),
    },
    contact: els.oContact.value.trim() || null,
    instructions: els.oNotes.value.trim() || null,
  };
}

function resetOrderForm(){
  [
    "oReference","oCustomer","oCity","oContact","oPriority","oDue","oLoadType",
    "oPickupLocation","oPickupDate","oPickupSlot","oDeliveryLocation","oDeliveryDate",
    "oDeliverySlot","oPallets","oWeight","oVolume","oNotes","lProduct","lQty","lWeight"
  ].forEach(id => {
    const field = document.getElementById(id);
    if (!field) return;
    if (field.tagName === "SELECT") {
      field.selectedIndex = 0;
    } else {
      field.value = "";
    }
  });
  if (els.oRegion) els.oRegion.selectedIndex = 0;
  if (els.oPriority) els.oPriority.value = "3";
  if (els.lQty) els.lQty.value = "1";
  if (els.lWeight) els.lWeight.value = "0";
}

async function createOrder(){
  if (!els.oCustomer || !els.oRegion) return;
  if (els.createStatus) els.createStatus.textContent = "Bezig…";
  try {
    const details = buildOrderDetails();
    const order = {
      customer_name: els.oCustomer.value.trim(),
      customer_city: els.oCity.value.trim(),
      region: els.oRegion.value,
      priority: parseInt(els.oPriority.value || "3", 10),
      due_date: details.delivery?.date || els.oDue.value || null,
      notes: "JSON:" + JSON.stringify(details),
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
    if (els.createStatus) els.createStatus.textContent = "Transport aangemaakt";
    resetOrderForm();
    await loadOrders();
  } catch (e) {
    console.error(e);
    if (els.createStatus) els.createStatus.textContent = "Mislukt";
  }
}

async function addCarrier(){
  if (!els.quickCarrier || !els.quickRegion) return;
  if (els.carrierStatus) els.carrierStatus.textContent = "Bezig…";
  try {
    await Carriers.create({
      name: els.quickCarrier.value.trim(),
      base_region: els.quickRegion.value,
      capacity_per_day: parseInt(els.quickCapacity.value || "8", 10),
      active: true
    });
    if (els.carrierStatus) els.carrierStatus.textContent = "Toegevoegd";
    els.quickCarrier.value = "";
    await refreshCarriersDatalist();
  } catch (e) {
    console.error(e);
    if (els.carrierStatus) els.carrierStatus.textContent = "Mislukt";
  }
}

function renderTrucks(){
  const list = els.truckList;
  if (!list) return;
  list.innerHTML = "";
  if (!TRUCKS.length){
    const li = document.createElement("li");
    li.className = "empty-hint";
    li.textContent = "Nog geen voertuigen opgeslagen.";
    list.appendChild(li);
  } else {
    for (const truck of TRUCKS){
      const li = document.createElement("li");
      const header = document.createElement("header");
      const title = document.createElement("strong");
      title.textContent = truck.name;
      header.appendChild(title);
      const removeBtn = document.createElement("button");
      removeBtn.className = "btn ghost small";
      removeBtn.textContent = "Verwijderen";
      removeBtn.addEventListener("click", () => removeTruck(truck.id));
      header.appendChild(removeBtn);
      li.appendChild(header);
      const meta = document.createElement("div");
      meta.className = "truck-meta";
      const metaParts = [];
      if (truck.plate) metaParts.push(`Kenteken ${truck.plate}`);
      if (truck.driver) metaParts.push(`Chauffeur ${truck.driver}`);
      metaParts.push(`${truck.capacity || "∞"} stops/dag`);
      meta.textContent = metaParts.join(" • ");
      li.appendChild(meta);
      list.appendChild(li);
    }
  }
  updatePlanBoardSelectors();
  renderPlanBoard();
}

function addTruck(){
  if (!els.truckName) return;
  const name = els.truckName.value.trim();
  if (!name){
    if (els.truckStatus) els.truckStatus.textContent = "Vul een naam in.";
    return;
  }
  const truck = {
    id: randomId(),
    name,
    plate: els.truckPlate.value.trim(),
    driver: els.truckDriver.value.trim(),
    capacity: parseInt(els.truckCapacity.value || "6", 10)
  };
  TRUCKS.push(truck);
  saveTrucks();
  if (els.truckStatus) els.truckStatus.textContent = `${truck.name} opgeslagen.`;
  ["truckName","truckPlate","truckDriver"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  els.truckCapacity.value = "6";
  renderTrucks();
}

async function removeTruck(id){
  const truck = TRUCKS.find(t => t.id === id);
  TRUCKS = TRUCKS.filter(t => t.id !== id);
  saveTrucks();
  for (const date of Object.keys(PLAN_BOARD)){
    if (PLAN_BOARD[date][id]){
      delete PLAN_BOARD[date][id];
      if (!Object.keys(PLAN_BOARD[date]).length){
        delete PLAN_BOARD[date];
      }
    }
  }
  savePlanBoard();
  renderTrucks();
  if (els.boardStatus) {
    els.boardStatus.textContent = truck ? `Planning voor ${truck.name} verwijderd.` : "Vrachtwagen verwijderd.";
  }
  await loadOrders();
}

function updatePlanBoardSelectors(){
  const truckSelect = els.boardTruck;
  const orderSelect = els.boardOrder;
  if (!truckSelect || !orderSelect) return;
  truckSelect.innerHTML = '<option value="">Selecteer vrachtwagen…</option>';
  for (const truck of TRUCKS){
    const option = document.createElement("option");
    option.value = truck.id;
    option.textContent = `${truck.name} (${truck.capacity || "∞"} stops)`;
    truckSelect.appendChild(option);
  }
  orderSelect.innerHTML = '<option value="">Selecteer transport…</option>';
  const eligible = ORDERS_CACHE.filter(o => !["Geleverd","Geannuleerd"].includes(o.status || ""));
  eligible.sort((a,b) => (a.due_date || "").localeCompare(b.due_date || ""));
  for (const order of eligible){
    const details = parseOrderDetails(order);
    const option = document.createElement("option");
    option.value = order.id;
    const parts = [];
    parts.push(details.reference || order.customer_name || `Order #${order.id}`);
    if (order.customer_name) parts.push(order.customer_name);
    const due = order.due_date || details.delivery?.date;
    if (due) parts.push(due);
    option.textContent = parts.join(" • ");
    orderSelect.appendChild(option);
  }
}

function syncPlanBoardFromOrders(){
  let changed = false;
  const cleaned = {};
  for (const [date, trucks] of Object.entries(PLAN_BOARD)){
    const newTrucks = {};
    for (const [truckId, assignments] of Object.entries(trucks)){
      const truck = TRUCKS.find(t => t.id === truckId);
      if (!truck) {
        changed = true;
        continue;
      }
      const filtered = assignments.filter(assignment => {
        const order = ORDERS_CACHE.find(o => o.id === assignment.orderId);
        if (!order) return false;
        if (order.planned_date && order.planned_date !== date) return false;
        if (order.assigned_carrier && order.assigned_carrier !== truck.name) return false;
        return true;
      }).map(assignment => {
        const order = ORDERS_CACHE.find(o => o.id === assignment.orderId);
        const details = order ? parseOrderDetails(order) : assignment.details || {};
        return {
          ...assignment,
          reference: details.reference || order?.customer_name || assignment.reference,
          details,
        };
      });
      if (filtered.length){
        newTrucks[truckId] = filtered;
      } else if (assignments.length){
        changed = true;
      }
    }
    if (Object.keys(newTrucks).length){
      cleaned[date] = newTrucks;
    } else if (Object.keys(trucks).length){
      changed = true;
    }
  }
  if (changed){
    PLAN_BOARD = cleaned;
    savePlanBoard();
  }
}

function renderPlanBoard(){
  const container = els.planBoard;
  if (!container) return;
  container.innerHTML = "";
  let date = els.boardDate ? els.boardDate.value : "";
  if (!date){
    date = new Date().toISOString().slice(0,10);
    if (els.boardDate) els.boardDate.value = date;
  }
  if (!TRUCKS.length){
    container.innerHTML = '<div class="empty-hint">Voeg eerst vrachtwagens toe om te plannen.</div>';
    if (els.boardStatus) els.boardStatus.textContent = "Geen vrachtwagens beschikbaar.";
    return;
  }
  const dayData = PLAN_BOARD[date] || {};
  let total = 0;
  for (const truck of TRUCKS){
    const card = document.createElement("div");
    card.className = "truck-card";
    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = truck.name;
    header.appendChild(title);
    const capacity = document.createElement("span");
    capacity.className = "badge";
    const used = (dayData[truck.id] || []).length;
    capacity.textContent = `${used}/${truck.capacity || "∞"}`;
    header.appendChild(capacity);
    card.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "truck-meta";
    const metaParts = [];
    if (truck.plate) metaParts.push(`Kenteken ${truck.plate}`);
    if (truck.driver) metaParts.push(`Chauffeur ${truck.driver}`);
    meta.textContent = metaParts.join(" • ") || "Geen aanvullende info";
    card.appendChild(meta);

    const assignments = (dayData[truck.id] || []).slice().sort((a,b) => {
      return (a.slot || "zzz").localeCompare(b.slot || "zzz") || (a.reference || "").localeCompare(b.reference || "");
    });

    if (!assignments.length){
      const empty = document.createElement("div");
      empty.className = "empty-hint";
      empty.textContent = "Nog geen transporten ingepland.";
      card.appendChild(empty);
    } else {
      for (const assignment of assignments){
        const order = ORDERS_CACHE.find(o => o.id === assignment.orderId);
        const details = order ? parseOrderDetails(order) : assignment.details || {};
        const item = document.createElement("div");
        item.className = "assignment";
        const titleLine = document.createElement("strong");
        titleLine.textContent = details.reference || order?.customer_name || `Order #${assignment.orderId}`;
        item.appendChild(titleLine);
        const customerLine = document.createElement("div");
        customerLine.textContent = order?.customer_name || assignment.customer || "";
        item.appendChild(customerLine);
        const routeLine = document.createElement("div");
        routeLine.className = "truck-meta";
        routeLine.textContent = `${formatStop(details.pickup)} → ${formatStop(details.delivery)}`;
        item.appendChild(routeLine);
        const cargoText = formatCargo(details.cargo);
        if (cargoText && cargoText !== "-"){
          const cargoLine = document.createElement("div");
          cargoLine.className = "truck-meta";
          cargoLine.textContent = cargoText;
          item.appendChild(cargoLine);
        }
        if (assignment.slot){
          const slotTag = document.createElement("span");
          slotTag.className = "tag";
          slotTag.textContent = assignment.slot;
          item.appendChild(slotTag);
        }
        if (details.instructions){
          item.title = details.instructions;
        }
        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.gap = "8px";
        const removeBtn = document.createElement("button");
        removeBtn.className = "btn ghost small";
        removeBtn.textContent = "Verwijderen";
        removeBtn.addEventListener("click", () => removeAssignment(date, truck.id, assignment.orderId));
        actions.appendChild(removeBtn);
        item.appendChild(actions);
        card.appendChild(item);
      }
      total += assignments.length;
    }
    container.appendChild(card);
  }
  if (els.boardStatus) {
    els.boardStatus.textContent = `${total} transport(en) ingepland op ${formatDateDisplay(date)}.`;
  }
}

async function assignOrderToTruck(){
  if (!els.boardDate || !els.boardTruck || !els.boardOrder) return;
  if (!els.boardDate.value){
    if (els.boardStatus) els.boardStatus.textContent = "Selecteer een datum.";
    return;
  }
  const truckId = els.boardTruck.value;
  const orderId = parseInt(els.boardOrder.value || "0", 10);
  if (!truckId || !orderId){
    if (els.boardStatus) els.boardStatus.textContent = "Kies zowel een vrachtwagen als een transport.";
    return;
  }
  const truck = TRUCKS.find(t => t.id === truckId);
  const order = ORDERS_CACHE.find(o => o.id === orderId);
  if (!truck || !order){
    if (els.boardStatus) els.boardStatus.textContent = "Onbekende selectie.";
    return;
  }
  const date = els.boardDate.value;
  if (!PLAN_BOARD[date]) PLAN_BOARD[date] = {};
  if (!PLAN_BOARD[date][truckId]) PLAN_BOARD[date][truckId] = [];
  if (PLAN_BOARD[date][truckId].some(a => a.orderId === orderId)){
    if (els.boardStatus) els.boardStatus.textContent = "Transport staat al ingepland op deze vrachtwagen.";
    return;
  }
  if (truck.capacity && PLAN_BOARD[date][truckId].length >= truck.capacity){
    if (els.boardStatus) els.boardStatus.textContent = `${truck.name} heeft de maximale capaciteit bereikt.`;
    return;
  }
  const details = parseOrderDetails(order);
  PLAN_BOARD[date][truckId].push({
    orderId,
    reference: details.reference || order.customer_name,
    customer: order.customer_name,
    slot: els.boardSlot ? (els.boardSlot.value || null) : null,
    details
  });
  savePlanBoard();
  if (els.boardStatus) els.boardStatus.textContent = `Transport toegewezen aan ${truck.name}.`;
  if (els.boardOrder) els.boardOrder.value = "";
  renderPlanBoard();
  try {
    await Orders.update(orderId, {
      status: "Gepland",
      assigned_carrier: truck.name,
      planned_date: date,
      planned_slot: els.boardSlot ? (els.boardSlot.value || null) : null,
      updated_at: new Date().toISOString()
    });
    await loadOrders();
  } catch (e) {
    console.error(e);
    if (els.boardStatus) els.boardStatus.textContent = "Planning opgeslagen maar synchronisatie met database mislukte.";
  }
}

async function removeAssignment(date, truckId, orderId){
  if (!PLAN_BOARD[date] || !PLAN_BOARD[date][truckId]) return;
  PLAN_BOARD[date][truckId] = PLAN_BOARD[date][truckId].filter(a => a.orderId !== orderId);
  if (!PLAN_BOARD[date][truckId].length){
    delete PLAN_BOARD[date][truckId];
  }
  if (!Object.keys(PLAN_BOARD[date]).length){
    delete PLAN_BOARD[date];
  }
  savePlanBoard();
  renderPlanBoard();
  if (els.boardStatus) els.boardStatus.textContent = "Transport verwijderd uit planning.";
  try {
    await Orders.update(orderId, {
      status: "Te plannen",
      assigned_carrier: null,
      planned_date: null,
      planned_slot: null,
      updated_at: new Date().toISOString()
    });
    await loadOrders();
  } catch (e) {
    console.error(e);
    if (els.boardStatus) els.boardStatus.textContent = "Planning lokaal bijgewerkt, maar synchronisatie mislukte.";
  }
}

async function clearBoardForDay(){
  if (!els.boardDate) return;
  const date = els.boardDate.value;
  if (!date || !PLAN_BOARD[date]){
    if (els.boardStatus) els.boardStatus.textContent = "Geen planning voor deze datum.";
    return;
  }
  const affectedAssignments = Object.values(PLAN_BOARD[date]).flat();
  delete PLAN_BOARD[date];
  savePlanBoard();
  renderPlanBoard();
  if (els.boardStatus) els.boardStatus.textContent = "Planning gewist.";
  try {
    await Promise.allSettled(affectedAssignments.map(a => Orders.update(a.orderId, {
      status: "Te plannen",
      assigned_carrier: null,
      planned_date: null,
      planned_slot: null,
      updated_at: new Date().toISOString()
    })));
    await loadOrders();
  } catch (e) {
    console.error(e);
  }
}

async function suggestPlan(){
  if (!els.planStart || !els.planEnd) return;
  if (els.plannerStatus) els.plannerStatus.textContent = "Voorstel maken…";
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
    const details = parseOrderDetails(o);
    const regionCarriers = active.filter(c => (c.base_region||"") === (o.region||""));
    const allTry = regionCarriers.length ? regionCarriers : active;
    const pref = details.delivery?.date || o.due_date || dates[0];
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
  if (els.plannerStatus) {
    els.plannerStatus.textContent = `Voorstel: ${suggestions.filter(s=>s.carrier).length} toegewezen / ${suggestions.length} totaal`;
  }
}

async function applyPlan(){
  if (els.plannerStatus) els.plannerStatus.textContent = "Opslaan…";
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
  if (els.plannerStatus) els.plannerStatus.textContent = "Planning opgeslagen";
  await loadOrders();
}

function bind(){
  const bindClick = (el, handler) => { if (el) el.addEventListener("click", handler); };
  bindClick(els.btnApplyFilters, loadOrders);
  bindClick(els.btnCreate, createOrder);
  bindClick(els.btnReload, loadOrders);
  bindClick(els.btnAddCarrier, addCarrier);
  bindClick(els.btnSuggestPlan, suggestPlan);
  bindClick(els.btnApplyPlan, applyPlan);
  if (els.btnSaveEdit) {
    els.btnSaveEdit.addEventListener("click", (e)=>{ e.preventDefault(); saveEdit(); });
  }
  bindClick(els.btnAddTruck, addTruck);
  bindClick(els.btnAssignOrder, assignOrderToTruck);
  bindClick(els.btnClearBoard, clearBoardForDay);
  if (els.boardDate) {
    els.boardDate.addEventListener("change", () => { renderPlanBoard(); });
  }
}

(async function init(){
  bind();
  hydrateLocalState();
  const today = new Date();
  const end = new Date(Date.now()+5*86400000);
  if (els.planStart) els.planStart.value = today.toISOString().slice(0,10);
  if (els.planEnd) els.planEnd.value = end.toISOString().slice(0,10);
  if (els.boardDate) els.boardDate.value = today.toISOString().slice(0,10);
  renderTrucks();
  await refreshCarriersDatalist();
  const needsOrders = Boolean(
    els.ordersTable ||
    els.btnReload ||
    els.btnApplyFilters ||
    els.btnAssignOrder ||
    els.btnSuggestPlan ||
    els.dlg
  );
  if (needsOrders) {
    await loadOrders();
  }
})();
