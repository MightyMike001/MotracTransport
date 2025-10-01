const els = {
  filterRegion: document.getElementById("filterRegion"),
  filterStatus: document.getElementById("filterStatus"),
  filterQuery: document.getElementById("filterQuery"),
  filterDate: document.getElementById("filterDate"),
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
  pager: document.getElementById("ordersPager"),
  pagerInfo: document.getElementById("pagerInfo"),
  pagerPrev: document.getElementById("pagerPrev"),
  pagerNext: document.getElementById("pagerNext"),
  pagerPageSize: document.getElementById("pagerPageSize"),
  dlg: document.getElementById("editDialog"),
  eId: document.getElementById("eId"),
  eStatus: document.getElementById("eStatus"),
  eCarrier: document.getElementById("eCarrier"),
  ePlanned: document.getElementById("ePlanned"),
  eSlot: document.getElementById("eSlot"),
  editStatus: document.getElementById("editStatus"),
  btnDeleteOrder: document.getElementById("btnDeleteOrder"),
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
  boardRegion: document.getElementById("boardRegion"),
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
const PAGINATION = {
  currentPage: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 1,
  currentPageCount: 0,
};
const ORDER_OWNERS = new Map();
let DRAG_CONTEXT = null;

function getCurrentUser() {
  if (window.Auth && typeof window.Auth.getUser === "function") {
    return window.Auth.getUser();
  }
  return null;
}

function rememberOrderOwners(rows) {
  ORDER_OWNERS.clear();
  if (!Array.isArray(rows)) return;
  rows.forEach((row) => {
    if (!row || row.id === undefined || row.id === null) return;
    const key = String(row.id);
    ORDER_OWNERS.set(key, {
      id: row.created_by ?? null,
      name: row.created_by_name ?? null,
    });
  });
}

function getOrderOwner(order) {
  const id = typeof order === "object" ? order?.id : order;
  if (id === undefined || id === null) return null;
  return ORDER_OWNERS.get(String(id)) || null;
}

function canUserEditOrder(order, user = getCurrentUser()) {
  if (!user || user.role !== "werknemer") return true;
  const owner = getOrderOwner(order);
  if (!owner || !owner.id) return true;
  return String(owner.id) === String(user.id);
}

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

function setStatus(el, message, variant = "default") {
  if (!el) return;
  el.textContent = message;
  el.classList.remove("status-error", "status-success");
  if (variant === "error") {
    el.classList.add("status-error");
  } else if (variant === "success") {
    el.classList.add("status-success");
  }
}

function renderOrdersPlaceholder(message, className = "muted") {
  const tbody = els.ordersTable;
  if (!tbody) return;
  const table = tbody.closest("table");
  const columns = table ? table.querySelectorAll("thead th").length : 1;
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = columns || 1;
  td.className = className;
  td.textContent = message;
  tr.appendChild(td);
  tbody.innerHTML = "";
  tbody.appendChild(tr);
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
  try {
    const carriers = await Carriers.list();
    els.carrierList.innerHTML = carriers.map(c => `<option value="${c.name}">`).join("");
  } catch (e) {
    console.error("Kan carriers niet laden", e);
    els.carrierList.innerHTML = "";
  }
}

async function fetchAllOrderPages(filters, firstPageResult) {
  const pageSize = Number(firstPageResult?.pageSize);
  const total = Number(firstPageResult?.total) || 0;
  if (!pageSize || pageSize <= 0) {
    return Array.isArray(firstPageResult?.rows) ? firstPageResult.rows : [];
  }
  if (total === 0) {
    return [];
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) {
    return Array.isArray(firstPageResult?.rows) ? firstPageResult.rows : [];
  }
  const allRows = [];
  for (let page = 1; page <= totalPages; page += 1) {
    if (page === Number(firstPageResult?.page)) {
      if (Array.isArray(firstPageResult?.rows)) {
        allRows.push(...firstPageResult.rows);
      }
      continue;
    }
    const next = await Orders.list(filters, { page, pageSize });
    if (Array.isArray(next?.rows)) {
      allRows.push(...next.rows);
    }
    if (allRows.length >= total) {
      break;
    }
  }
  return allRows;
}

async function loadOrders(options = {}) {
  if (options && typeof options.preventDefault === "function") {
    options.preventDefault();
    options = {};
  }
  const requestedPageSize = Number(options.pageSize);
  if (Number.isFinite(requestedPageSize) && requestedPageSize > 0) {
    PAGINATION.pageSize = requestedPageSize;
  }
  const requestedPage = Number(options.page);
  if (Number.isFinite(requestedPage) && requestedPage >= 1) {
    PAGINATION.currentPage = requestedPage;
  }

  const usePagination = Boolean(els.ordersTable && els.pager);

  const currentUser = getCurrentUser();
  const listFilters = {
    region: els.filterRegion?.value || undefined,
    status: els.filterStatus?.value || undefined,
  };
  const queryValue = els.filterQuery?.value?.trim();
  const dateValue = els.filterDate?.value || undefined;
  if (queryValue) {
    listFilters.search = queryValue;
  }
  if (dateValue) {
    listFilters.date = dateValue;
  }
  if (currentUser?.role === "werknemer" && currentUser.id !== undefined && currentUser.id !== null) {
    listFilters.createdBy = currentUser.id;
  }
  if (els.ordersTable) {
    renderOrdersPlaceholder("Bezig met laden…");
  }
  try {
    const filtersForQuery = { ...listFilters };
    const queryOptions = usePagination ? {
      page: PAGINATION.currentPage,
      pageSize: PAGINATION.pageSize,
    } : {};
    const firstPage = await Orders.list(filtersForQuery, queryOptions);
    const safeRows = Array.isArray(firstPage?.rows) ? firstPage.rows : [];
    const totalCount = Number(firstPage?.total) || safeRows.length;
    const pageSize = usePagination ? (Number(firstPage?.pageSize) || PAGINATION.pageSize) : safeRows.length || PAGINATION.pageSize;
    const totalPages = usePagination
      ? (totalCount > 0 && pageSize > 0 ? Math.ceil(totalCount / pageSize) : 1)
      : 1;

    if (totalCount === 0) {
      PAGINATION.totalItems = 0;
      PAGINATION.totalPages = 1;
      PAGINATION.currentPageCount = 0;
      ORDERS_CACHE = [];
      rememberOrderOwners([]);
      renderOrders([]);
      syncPlanBoardFromOrders();
      renderPlanBoard();
      return;
    }

    if (usePagination && PAGINATION.currentPage > totalPages) {
      PAGINATION.currentPage = totalPages;
      await loadOrders({ page: totalPages });
      return;
    }

    PAGINATION.totalItems = totalCount;
    PAGINATION.totalPages = totalPages;
    PAGINATION.currentPageCount = safeRows.length;

    rememberOrderOwners(safeRows);
    renderOrders(safeRows);

    let allRows = safeRows;
    if (usePagination) {
      try {
        allRows = await fetchAllOrderPages(filtersForQuery, firstPage);
      } catch (err) {
        console.error("Kan volledige orderlijst niet ophalen", err);
      }
    }
    ORDERS_CACHE = Array.isArray(allRows) ? allRows : safeRows;
    rememberOrderOwners(ORDERS_CACHE);
    syncPlanBoardFromOrders();
    renderPlanBoard();
  } catch (e) {
    console.error("Kan orders niet laden", e);
    if (els.ordersTable) {
      renderOrdersPlaceholder("Orders laden mislukt. Controleer je verbinding en probeer opnieuw.", "muted error-text");
    }
    PAGINATION.totalItems = 0;
    PAGINATION.totalPages = 1;
    PAGINATION.currentPageCount = 0;
    ORDERS_CACHE = [];
    rememberOrderOwners([]);
    updatePaginationControls();
    setStatus(els.boardStatus, "Laden van orders mislukt.", "error");
  }
}

function renderOrders(rows) {
  const tbody = els.ordersTable;
  if (!tbody) {
    updatePaginationControls();
    return;
  }
  tbody.innerHTML = "";
  if (!rows.length) {
    renderOrdersPlaceholder("Geen orders gevonden");
    updatePaginationControls();
    return;
  }
  const currentUser = getCurrentUser();
  for (const r of rows) {
    const details = parseOrderDetails(r);
    const tr = document.createElement("tr");
    const tooltip = [];
    if (details.instructions) tooltip.push(`Instructies: ${details.instructions}`);
    if (details.contact) tooltip.push(`Contact: ${details.contact}`);
    tr.title = tooltip.join("\n");
    const ownerInfo = getOrderOwner(r);
    if (ownerInfo?.id) tr.dataset.ownerId = ownerInfo.id;
    if (ownerInfo?.name) tr.dataset.ownerName = ownerInfo.name;
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
    if (canUserEditOrder(r, currentUser)) {
      tr.addEventListener("click", () => openEdit(r));
    } else {
      tr.classList.add("is-readonly-order");
    }
    tbody.appendChild(tr);
  }
  updatePaginationControls();
}

function updatePaginationControls() {
  if (!els.pager) return;
  const totalItems = Number(PAGINATION.totalItems) || 0;
  const pageSize = Number(PAGINATION.pageSize) || 1;
  const totalPages = totalItems > 0 ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;
  const currentPage = Math.min(Math.max(Number(PAGINATION.currentPage) || 1, 1), totalPages);
  const pageCount = Number(PAGINATION.currentPageCount) || 0;
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = totalItems === 0 ? 0 : Math.min(start + pageCount - 1, totalItems);
  if (els.pagerInfo) {
    const infoText = totalItems === 0
      ? "Geen resultaten"
      : `Pagina ${currentPage} van ${totalPages} (${start}–${end} van ${totalItems})`;
    els.pagerInfo.textContent = infoText;
  }
  const disablePrev = currentPage <= 1 || totalItems === 0;
  const disableNext = currentPage >= totalPages || totalItems === 0;
  if (els.pagerPrev) {
    els.pagerPrev.disabled = disablePrev;
    if (disablePrev) {
      els.pagerPrev.setAttribute("aria-disabled", "true");
    } else {
      els.pagerPrev.removeAttribute("aria-disabled");
    }
  }
  if (els.pagerNext) {
    els.pagerNext.disabled = disableNext;
    if (disableNext) {
      els.pagerNext.setAttribute("aria-disabled", "true");
    } else {
      els.pagerNext.removeAttribute("aria-disabled");
    }
  }
  if (els.pagerPageSize) {
    const desiredValue = String(pageSize);
    if (els.pagerPageSize.value !== desiredValue) {
      els.pagerPageSize.value = desiredValue;
    }
  }
  const shouldHide = totalItems <= pageSize && currentPage <= 1;
  if (shouldHide) {
    els.pager.classList.add("is-hidden");
  } else {
    els.pager.classList.remove("is-hidden");
  }
}

function goToPage(page) {
  const totalItems = Number(PAGINATION.totalItems) || 0;
  if (totalItems === 0) return;
  const totalPages = Math.max(1, Number(PAGINATION.totalPages) || 1);
  const nextPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  if (nextPage === PAGINATION.currentPage) return;
  PAGINATION.currentPage = nextPage;
  loadOrders({ page: nextPage });
}

function goToPreviousPage() {
  goToPage((Number(PAGINATION.currentPage) || 1) - 1);
}

function goToNextPage() {
  goToPage((Number(PAGINATION.currentPage) || 1) + 1);
}

function handlePageSizeChange(event) {
  const value = Number(event?.target?.value);
  if (!Number.isFinite(value) || value <= 0) {
    return;
  }
  PAGINATION.currentPage = 1;
  loadOrders({ page: 1, pageSize: value });
}

function openEdit(row){
  if (!els.dlg) return;
  const user = getCurrentUser();
  if (user?.role === "werknemer" && !canUserEditOrder(row, user)) {
    const owner = getOrderOwner(row);
    const ownerName = owner?.name || "een andere medewerker";
    window.alert(`Je kunt dit transport niet bewerken. Het is aangemaakt door ${ownerName}.`);
    return;
  }
  els.eId.value = row.id;
  els.eStatus.value = row.status || "Nieuw";
  els.eCarrier.value = row.assigned_carrier || "";
  els.ePlanned.value = row.planned_date || "";
  els.eSlot.value = row.planned_slot || "";
  setStatus(els.editStatus, "");
  els.dlg.showModal();
}

async function saveEdit(){
  if (!els.eId) return;
  const id = els.eId.value;
  const user = getCurrentUser();
  if (user?.role === "werknemer" && !canUserEditOrder({ id }, user)) {
    const owner = getOrderOwner(id);
    const ownerName = owner?.name || "een andere medewerker";
    window.alert(`Je kunt dit transport niet opslaan. Het is aangemaakt door ${ownerName}.`);
    return;
  }
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

async function deleteOrder(event){
  if (event) event.preventDefault();
  if (!els.eId) return;
  const id = els.eId.value;
  if (!id) return;
  const user = getCurrentUser();
  if (user?.role === "werknemer" && !canUserEditOrder({ id }, user)) {
    const owner = getOrderOwner(id);
    const ownerName = owner?.name || "een andere medewerker";
    window.alert(`Je kunt dit transport niet verwijderen. Het is aangemaakt door ${ownerName}.`);
    return;
  }
  if (!window.confirm("Weet je zeker dat je dit transport wilt verwijderen?")) {
    return;
  }
  try {
    setStatus(els.editStatus, "Verwijderen…");
    await Orders.delete(id);
    await loadOrders();
    setStatus(els.editStatus, "Transport verwijderd.", "success");
    if (els.dlg?.open) {
      els.dlg.close();
    }
  } catch (e) {
    console.error("Kan order niet verwijderen", e);
    setStatus(els.editStatus, "Verwijderen mislukt.", "error");
  }
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
  const user = getCurrentUser();
  const customerName = els.oCustomer.value.trim();
  if (!customerName) {
    setStatus(els.createStatus, "Vul de klantnaam in.", "error");
    return;
  }
  setStatus(els.createStatus, "Bezig…");
  try {
    const details = buildOrderDetails();
    const order = {
      customer_name: customerName,
      customer_city: els.oCity.value.trim(),
      region: els.oRegion.value,
      priority: parseInt(els.oPriority.value || "3", 10),
      due_date: details.delivery?.date || els.oDue.value || null,
      notes: "JSON:" + JSON.stringify(details),
      status: "Nieuw",
    };
    const userId = user?.id ?? user?.user_id ?? null;
    if (userId !== null && userId !== undefined) {
      order.created_by = userId;
      const creatorName = user?.name ?? user?.full_name ?? user?.email ?? null;
      if (creatorName) {
        order.created_by_name = creatorName;
      }
    }
    const created = await Orders.create(order);
    if (els.lProduct.value.trim()) {
      await Lines.create({
        order_id: created.id,
        product: els.lProduct.value.trim(),
        quantity: parseInt(els.lQty.value || "1", 10),
        weight_kg: parseFloat(els.lWeight.value || "0")
      });
    }
    setStatus(els.createStatus, "Transport aangemaakt", "success");
    resetOrderForm();
    await loadOrders();
  } catch (e) {
    console.error(e);
    setStatus(els.createStatus, "Mislukt", "error");
  }
}

async function addCarrier(){
  if (!els.quickCarrier || !els.quickRegion) return;
  const name = els.quickCarrier.value.trim();
  const capacity = parseInt(els.quickCapacity.value || "", 10);
  if (!name) {
    setStatus(els.carrierStatus, "Vul een carriernaam in.", "error");
    return;
  }
  if (!Number.isFinite(capacity) || capacity <= 0) {
    setStatus(els.carrierStatus, "Voer een geldige capaciteit in.", "error");
    return;
  }
  setStatus(els.carrierStatus, "Bezig…");
  try {
    await Carriers.create({
      name,
      base_region: els.quickRegion.value,
      capacity_per_day: capacity,
      active: true
    });
    setStatus(els.carrierStatus, "Toegevoegd", "success");
    els.quickCarrier.value = "";
    await refreshCarriersDatalist();
  } catch (e) {
    console.error(e);
    setStatus(els.carrierStatus, "Mislukt", "error");
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
  renderPlanBoard();
}

function addTruck(){
  if (!els.truckName) return;
  const name = els.truckName.value.trim();
  if (!name){
    setStatus(els.truckStatus, "Vul een naam in.", "error");
    return;
  }
  const capacity = parseInt(els.truckCapacity.value || "6", 10);
  if (!Number.isFinite(capacity) || capacity <= 0) {
    setStatus(els.truckStatus, "Voer een geldige capaciteit in.", "error");
    return;
  }
  const truck = {
    id: randomId(),
    name,
    plate: els.truckPlate.value.trim(),
    driver: els.truckDriver.value.trim(),
    capacity
  };
  TRUCKS.push(truck);
  saveTrucks();
  setStatus(els.truckStatus, `${truck.name} opgeslagen.`, "success");
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
  setStatus(els.boardStatus, truck ? `Planning voor ${truck.name} verwijderd.` : "Vrachtwagen verwijderd.");
  await loadOrders();
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
        const order = ORDERS_CACHE.find(o => String(o.id) === String(assignment.orderId));
        if (!order) return false;
        if (order.planned_date && order.planned_date !== date) return false;
        if (order.assigned_carrier && order.assigned_carrier !== truck.name) return false;
        return true;
      }).map(assignment => {
        const order = ORDERS_CACHE.find(o => String(o.id) === String(assignment.orderId));
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
  PLAN_BOARD = cleaned;
  for (const order of ORDERS_CACHE){
    if (!order?.planned_date || !order?.assigned_carrier) continue;
    const truck = TRUCKS.find((t) => t.name === order.assigned_carrier);
    if (!truck) continue;
    const date = order.planned_date;
    if (!PLAN_BOARD[date]) PLAN_BOARD[date] = {};
    if (!PLAN_BOARD[date][truck.id]) PLAN_BOARD[date][truck.id] = [];
    const hasAssignment = PLAN_BOARD[date][truck.id].some((a) => String(a.orderId) === String(order.id));
    if (!hasAssignment){
      const details = parseOrderDetails(order);
      PLAN_BOARD[date][truck.id].push({
        orderId: order.id,
      reference: details.reference || order.customer_name,
      customer: order.customer_name,
      slot: order.planned_slot || null,
      details,
    });
      changed = true;
    }
  }
  if (changed){
    savePlanBoard();
  }
}

function ensureBoardDate(){
  if (!els.boardDate) {
    return new Date().toISOString().slice(0,10);
  }
  let value = els.boardDate.value;
  if (!value) {
    value = new Date().toISOString().slice(0,10);
    els.boardDate.value = value;
  }
  return value;
}

function getBoardRegionFilter(){
  return (els.boardRegion?.value || "").trim();
}

function orderMatchesBoardRegion(order, regionFilter){
  if (!regionFilter) return true;
  return (order?.region || "").trim() === regionFilter;
}

function detachAssignment(date, truckId, orderId){
  if (!PLAN_BOARD[date] || !PLAN_BOARD[date][truckId]) return null;
  const assignments = PLAN_BOARD[date][truckId];
  const index = assignments.findIndex((a) => String(a.orderId) === String(orderId));
  if (index === -1) return null;
  const [removed] = assignments.splice(index, 1);
  if (!assignments.length) {
    delete PLAN_BOARD[date][truckId];
  }
  if (!Object.keys(PLAN_BOARD[date]).length) {
    delete PLAN_BOARD[date];
  }
  return removed || null;
}

function renderPlanBoard(){
  const container = els.planBoard;
  if (!container) return;
  container.innerHTML = "";
  const date = ensureBoardDate();
  const regionFilter = getBoardRegionFilter();
  if (!TRUCKS.length){
    container.innerHTML = '<div class="empty-hint">Voeg eerst vrachtwagens toe om te plannen.</div>';
    setStatus(els.boardStatus, "Geen vrachtwagens beschikbaar.");
    return;
  }
  const dayData = PLAN_BOARD[date] || {};
  const plannedToday = new Set();
  for (const assignments of Object.values(dayData)){
    for (const assignment of assignments){
      plannedToday.add(String(assignment.orderId));
    }
  }
  const activeOrders = ORDERS_CACHE.filter((order) => {
    if (["Geleverd","Geannuleerd"].includes(order.status || "")) return false;
    if (order.planned_date && order.planned_date !== date) return false;
    return true;
  });
  const backlogOrders = activeOrders
    .filter((order) => !plannedToday.has(String(order.id)))
    .filter((order) => orderMatchesBoardRegion(order, regionFilter))
    .sort((a, b) => {
      const dueA = a.due_date || "";
      const dueB = b.due_date || "";
      return dueA.localeCompare(dueB) || (a.priority || 0) - (b.priority || 0);
    });

  const backlogLane = document.createElement("section");
  backlogLane.className = "plan-lane lane-unplanned";
  const backlogHeader = document.createElement("header");
  backlogHeader.className = "lane-header";
  const backlogTitle = document.createElement("h3");
  backlogTitle.textContent = "Ongepland";
  backlogHeader.appendChild(backlogTitle);
  const backlogCount = document.createElement("span");
  backlogCount.className = "lane-count";
  backlogCount.textContent = backlogOrders.length.toString();
  backlogHeader.appendChild(backlogCount);
  backlogLane.appendChild(backlogHeader);
  const backlogBody = document.createElement("div");
  backlogBody.className = "lane-body";
  registerDropZone(backlogBody, { type: "backlog", date });
  if (!backlogOrders.length){
    const empty = document.createElement("div");
    empty.className = "empty-hint";
    empty.textContent = regionFilter ? "Geen open opdrachten voor deze regio." : "Alle opdrachten zijn ingepland.";
    backlogBody.appendChild(empty);
  } else {
    for (const order of backlogOrders){
      const card = buildOrderCard(order, date);
      backlogBody.appendChild(card);
    }
  }
  backlogLane.appendChild(backlogBody);
  container.appendChild(backlogLane);

  let totalAssignments = 0;
  const sortedTrucks = TRUCKS.slice().sort((a, b) => a.name.localeCompare(b.name));
  for (const truck of sortedTrucks){
    const lane = document.createElement("section");
    lane.className = "plan-lane";
    lane.dataset.truckId = truck.id;
    const header = document.createElement("header");
    header.className = "lane-header";
    const title = document.createElement("h3");
    title.textContent = truck.name;
    header.appendChild(title);
    const meta = document.createElement("div");
    meta.className = "lane-meta";
    const metaParts = [];
    if (truck.driver) metaParts.push(truck.driver);
    if (truck.plate) metaParts.push(truck.plate);
    meta.textContent = metaParts.join(" • ") || "Geen extra info";
    header.appendChild(meta);

    const assignments = (dayData[truck.id] || []).slice().sort((a, b) => {
      return (a.slot || "zzz").localeCompare(b.slot || "zzz") || (a.reference || "").localeCompare(b.reference || "");
    });
    const visibleAssignments = assignments.filter((assignment) => {
      const order = ORDERS_CACHE.find((o) => String(o.id) === String(assignment.orderId));
      return orderMatchesBoardRegion(order, regionFilter);
    });
    const used = visibleAssignments.length;
    const capacityValue = Number.isFinite(truck.capacity) ? Number(truck.capacity) : null;
    const usage = capacityValue ? Math.min(used / capacityValue, 1) : 0;
    const capacityWrap = document.createElement("div");
    capacityWrap.className = "capacity-indicator";
    const capacityLabel = document.createElement("span");
    capacityLabel.className = "capacity-label";
    capacityLabel.textContent = capacityValue ? `${used}/${capacityValue} stops` : `${used} stops`;
    const capacityBar = document.createElement("div");
    capacityBar.className = "capacity-bar";
    const capacityFill = document.createElement("div");
    capacityFill.className = "capacity-fill";
    if (capacityValue){
      capacityFill.style.width = `${usage * 100}%`;
      if (usage >= 0.9){
        capacityFill.classList.add("is-critical");
      } else if (usage >= 0.75){
        capacityFill.classList.add("is-warning");
      }
    } else {
      capacityFill.style.width = "100%";
    }
    capacityBar.appendChild(capacityFill);
    capacityWrap.appendChild(capacityLabel);
    capacityWrap.appendChild(capacityBar);
    header.appendChild(capacityWrap);
    lane.appendChild(header);

    const body = document.createElement("div");
    body.className = "lane-body";
    registerDropZone(body, { type: "truck", truckId: truck.id, date });
    if (!visibleAssignments.length){
      const empty = document.createElement("div");
      empty.className = "empty-hint";
      empty.textContent = "Nog geen transporten ingepland.";
      body.appendChild(empty);
    } else {
      for (const assignment of visibleAssignments){
        const card = buildAssignmentCard(assignment, truck, date);
        body.appendChild(card);
      }
      totalAssignments += visibleAssignments.length;
    }
    lane.appendChild(body);
    container.appendChild(lane);
  }
  setStatus(els.boardStatus, `${totalAssignments} transport(en) ingepland op ${formatDateDisplay(date)}.`);
}

function buildOrderCard(order, date){
  const details = parseOrderDetails(order);
  const card = document.createElement("article");
  card.className = "assignment is-unplanned";
  const title = document.createElement("strong");
  title.textContent = details.reference || order.customer_name || `Order #${order.id}`;
  card.appendChild(title);
  if (order.customer_name){
    const customer = document.createElement("div");
    customer.textContent = order.customer_name;
    card.appendChild(customer);
  }
  const route = document.createElement("div");
  route.className = "truck-meta";
  route.textContent = `${formatStop(details.pickup)} → ${formatStop(details.delivery)}`;
  card.appendChild(route);
  const cargo = formatCargo(details.cargo);
  if (cargo && cargo !== "-"){
    const cargoLine = document.createElement("div");
    cargoLine.className = "truck-meta";
    cargoLine.textContent = cargo;
    card.appendChild(cargoLine);
  }
  if (order.due_date){
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = `Levering ${order.due_date}`;
    card.appendChild(tag);
  }
  if (details.instructions){
    card.title = details.instructions;
  }
  makeDraggable(card, {
    orderId: order.id,
    fromTruckId: null,
    date,
  });
  return card;
}

function buildAssignmentCard(assignment, truck, date){
  const order = ORDERS_CACHE.find((o) => String(o.id) === String(assignment.orderId));
  const details = order ? parseOrderDetails(order) : assignment.details || {};
  const card = document.createElement("article");
  card.className = "assignment";
  const title = document.createElement("strong");
  title.textContent = details.reference || order?.customer_name || `Order #${assignment.orderId}`;
  card.appendChild(title);
  const customer = document.createElement("div");
  customer.textContent = order?.customer_name || assignment.customer || "";
  card.appendChild(customer);
  const route = document.createElement("div");
  route.className = "truck-meta";
  route.textContent = `${formatStop(details.pickup)} → ${formatStop(details.delivery)}`;
  card.appendChild(route);
  const cargoText = formatCargo(details.cargo);
  if (cargoText && cargoText !== "-"){
    const cargo = document.createElement("div");
    cargo.className = "truck-meta";
    cargo.textContent = cargoText;
    card.appendChild(cargo);
  }
  if (assignment.slot){
    const slot = document.createElement("span");
    slot.className = "tag";
    slot.textContent = assignment.slot;
    card.appendChild(slot);
  }
  const actions = document.createElement("div");
  actions.className = "assignment-actions";
  const removeBtn = document.createElement("button");
  removeBtn.className = "btn ghost small";
  removeBtn.type = "button";
  removeBtn.textContent = "Verwijderen";
  removeBtn.addEventListener("click", () => removeAssignment(date, truck.id, assignment.orderId));
  actions.appendChild(removeBtn);
  card.appendChild(actions);
  if (details.instructions){
    card.title = details.instructions;
  }
  makeDraggable(card, {
    orderId: assignment.orderId,
    fromTruckId: truck.id,
    date,
  });
  return card;
}

function makeDraggable(element, context){
  if (!element) return;
  element.setAttribute("draggable", "true");
  element.addEventListener("dragstart", (event) => {
    DRAG_CONTEXT = { ...context };
    element.classList.add("is-dragging");
    if (event.dataTransfer){
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(context.orderId));
    }
  });
  element.addEventListener("dragend", () => {
    element.classList.remove("is-dragging");
    DRAG_CONTEXT = null;
  });
}

function registerDropZone(element, target){
  if (!element) return;
  element.addEventListener("dragenter", (event) => {
    if (!DRAG_CONTEXT) return;
    if (!isDropAllowed(target)) return;
    event.preventDefault();
    element.classList.add("is-drop-target");
  });
  element.addEventListener("dragover", (event) => {
    if (!DRAG_CONTEXT) return;
    if (!isDropAllowed(target)) return;
    event.preventDefault();
    if (event.dataTransfer){
      event.dataTransfer.dropEffect = "move";
    }
  });
  element.addEventListener("dragleave", () => {
    element.classList.remove("is-drop-target");
  });
  element.addEventListener("drop", async (event) => {
    if (!DRAG_CONTEXT) return;
    if (!isDropAllowed(target)) return;
    event.preventDefault();
    element.classList.remove("is-drop-target");
    await handleDrop(target);
  });
}

function isDropAllowed(target){
  if (!DRAG_CONTEXT) return false;
  const boardDate = ensureBoardDate();
  return !target.date || target.date === boardDate;
}

async function handleDrop(target){
  if (!DRAG_CONTEXT) return;
  const boardDate = ensureBoardDate();
  const { orderId, fromTruckId } = DRAG_CONTEXT;
  if (target.type === "backlog"){
    if (!fromTruckId) return;
    detachAssignment(boardDate, fromTruckId, orderId);
    savePlanBoard();
    renderPlanBoard();
    setStatus(els.boardStatus, "Transport teruggezet naar ongepland.", "success");
    try {
      await Orders.update(orderId, {
        status: "Te plannen",
        assigned_carrier: null,
        planned_date: null,
        planned_slot: null,
        updated_at: new Date().toISOString(),
      });
      await loadOrders();
    } catch (e) {
      console.error(e);
      setStatus(els.boardStatus, "Terugzetten gelukt, maar synchronisatie mislukt.", "error");
    }
    return;
  }
  if (target.type !== "truck") return;
  const truck = TRUCKS.find((t) => String(t.id) === String(target.truckId));
  if (!truck){
    setStatus(els.boardStatus, "Onbekende vrachtwagen.", "error");
    return;
  }
  const order = ORDERS_CACHE.find((o) => String(o.id) === String(orderId));
  if (!order){
    setStatus(els.boardStatus, "Transport niet gevonden.", "error");
    return;
  }
  const dayData = PLAN_BOARD[boardDate] || {};
  const assignments = dayData[truck.id] || [];
  const existing = assignments.find((a) => String(a.orderId) === String(orderId));
  const capacityValue = Number.isFinite(truck.capacity) ? Number(truck.capacity) : null;
  if (!existing && capacityValue && assignments.length >= capacityValue){
    setStatus(els.boardStatus, `${truck.name} heeft de maximale capaciteit bereikt.`, "error");
    renderPlanBoard();
    return;
  }
  if (fromTruckId && fromTruckId === truck.id){
    return;
  }
  const details = parseOrderDetails(order);
  if (!PLAN_BOARD[boardDate]) PLAN_BOARD[boardDate] = {};
  if (!PLAN_BOARD[boardDate][truck.id]) PLAN_BOARD[boardDate][truck.id] = [];
  if (existing){
    Object.assign(existing, {
      reference: details.reference || order.customer_name,
      customer: order.customer_name,
      slot: order.planned_slot || null,
      details,
    });
  } else {
    PLAN_BOARD[boardDate][truck.id].push({
      orderId,
      reference: details.reference || order.customer_name,
      customer: order.customer_name,
      slot: order.planned_slot || null,
      details,
    });
  }
  if (fromTruckId && fromTruckId !== truck.id){
    detachAssignment(boardDate, fromTruckId, orderId);
  }
  savePlanBoard();
  renderPlanBoard();
  setStatus(els.boardStatus, `Transport toegewezen aan ${truck.name}.`, "success");
  try {
    await Orders.update(orderId, {
      status: "Gepland",
      assigned_carrier: truck.name,
      planned_date: boardDate,
      planned_slot: order.planned_slot || null,
      updated_at: new Date().toISOString(),
    });
    await loadOrders();
  } catch (e) {
    console.error(e);
    setStatus(els.boardStatus, "Planning opgeslagen maar synchronisatie met database mislukte.", "error");
  }
}

async function removeAssignment(date, truckId, orderId, options = {}){
  const removed = detachAssignment(date, truckId, orderId);
  if (!removed) return;
  savePlanBoard();
  if (!options.silent){
    renderPlanBoard();
    setStatus(els.boardStatus, "Transport verwijderd uit planning.", "success");
  }
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
    if (!options.silent){
      setStatus(els.boardStatus, "Planning lokaal bijgewerkt, maar synchronisatie mislukte.", "error");
    }
  }
}

async function clearBoardForDay(){
  if (!els.boardDate) return;
  const date = els.boardDate.value;
  if (!date || !PLAN_BOARD[date]){
    setStatus(els.boardStatus, "Geen planning voor deze datum.");
    return;
  }
  const affectedAssignments = Object.values(PLAN_BOARD[date]).flat();
  delete PLAN_BOARD[date];
  savePlanBoard();
  renderPlanBoard();
  setStatus(els.boardStatus, "Planning gewist.", "success");
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
  setStatus(els.plannerStatus, "Voorstel maken…");
  try {
    const carriers = await Carriers.list();
    const active = carriers.filter(c => c.active !== false);
    const start = new Date(els.planStart.value || Date.now());
    const end = new Date(els.planEnd.value || Date.now()+5*86400000);
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
    setStatus(els.plannerStatus, `Voorstel: ${suggestions.filter(s=>s.carrier).length} toegewezen / ${suggestions.length} totaal`);
  } catch (e) {
    console.error("Kan planner niet uitvoeren", e);
    PLAN_SUGGESTIONS = [];
    setStatus(els.plannerStatus, "Het maken van een voorstel is mislukt.", "error");
  }
}

async function applyPlan(){
  setStatus(els.plannerStatus, "Opslaan…");
  try {
    const tasks = PLAN_SUGGESTIONS.filter(s => s.carrier && s.date).map(s =>
      Orders.update(s.id, {
        status: "Gepland",
        assigned_carrier: s.carrier,
        planned_date: s.date,
        planned_slot: s.slot,
        updated_at: new Date().toISOString()
      })
    );
    if (!tasks.length){
      setStatus(els.plannerStatus, "Er is geen voorstel om op te slaan.");
      return;
    }
    await Promise.allSettled(tasks);
    setStatus(els.plannerStatus, "Planning opgeslagen", "success");
    await loadOrders();
  } catch (e) {
    console.error("Kan planning niet opslaan", e);
    setStatus(els.plannerStatus, "Opslaan van planning mislukt.", "error");
  }
}

function bind(canManagePlanning){
  const bindClick = (el, handler, allowed = true) => {
    if (!el) return;
    if (!allowed) {
      el.setAttribute("disabled", "disabled");
      el.setAttribute("aria-disabled", "true");
      return;
    }
    el.removeAttribute("disabled");
    el.removeAttribute("aria-disabled");
    el.addEventListener("click", handler);
  };
  bindClick(els.btnApplyFilters, () => loadOrders({ page: 1 }));
  bindClick(els.btnCreate, createOrder);
  bindClick(els.btnReload, () => loadOrders());
  bindClick(els.btnAddCarrier, addCarrier);
  bindClick(els.btnSuggestPlan, suggestPlan, canManagePlanning);
  bindClick(els.btnApplyPlan, applyPlan, canManagePlanning);
  bindClick(els.btnDeleteOrder, deleteOrder);
  if (els.btnSaveEdit) {
    els.btnSaveEdit.addEventListener("click", (e)=>{ e.preventDefault(); saveEdit(); });
  }
  bindClick(els.btnAddTruck, addTruck);
  bindClick(els.btnClearBoard, clearBoardForDay, canManagePlanning);
  if (els.boardDate) {
    els.boardDate.addEventListener("change", () => { renderPlanBoard(); });
  }
  if (els.boardRegion) {
    els.boardRegion.addEventListener("change", () => { renderPlanBoard(); });
  }
  if (els.pagerPrev) {
    els.pagerPrev.addEventListener("click", goToPreviousPage);
  }
  if (els.pagerNext) {
    els.pagerNext.addEventListener("click", goToNextPage);
  }
  if (els.pagerPageSize) {
    const defaultSize = Number(els.pagerPageSize.value);
    if (Number.isFinite(defaultSize) && defaultSize > 0) {
      PAGINATION.pageSize = defaultSize;
    }
    els.pagerPageSize.addEventListener("change", handlePageSizeChange);
  }
}

(async function init(){
  const user = window.Auth?.getUser ? window.Auth.getUser() : null;
  const canManagePlanning = Boolean(user && (user.role === "planner" || user.role === "admin"));
  bind(canManagePlanning);
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
    els.btnSuggestPlan ||
    els.dlg
  );
  if (needsOrders) {
    await loadOrders();
  }
})();
