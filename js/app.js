let els = {};

const DATE_UTILS = window.DateUtils || {};

const formatDateDisplay = typeof DATE_UTILS.formatDateDisplay === "function"
  ? DATE_UTILS.formatDateDisplay
  : (value) => {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return typeof value === "string" && value.trim() ? value : "-";
      }
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    };

const formatDateForInput = typeof DATE_UTILS.formatDateForInput === "function"
  ? DATE_UTILS.formatDateForInput
  : (value) => {
      if (!value && value !== 0) return "";
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${year}-${month}-${day}`;
    };

const getTodayDateValue = typeof DATE_UTILS.getTodayDateValue === "function"
  ? DATE_UTILS.getTodayDateValue
  : () => {
      const today = new Date();
      const day = String(today.getDate()).padStart(2, "0");
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const year = today.getFullYear();
      return `${year}-${month}-${day}`;
    };

const enforceDateInputs = typeof DATE_UTILS.enforceDateInputs === "function"
  ? DATE_UTILS.enforceDateInputs
  : () => {};

const VALIDATION_CLASSES = {
  fieldInvalid: "field-invalid",
  fieldError: "field-error",
};

function getFieldContainer(field) {
  if (!field) return null;
  if (typeof field.closest === "function") {
    const container = field.closest(".form-field");
    if (container) return container;
    const label = field.closest("label");
    if (label) return label;
  }
  return field.parentElement || null;
}

function clearFieldError(field) {
  if (!field) return;
  const container = getFieldContainer(field);
  if (!container) return;
  const errorEl = container.querySelector(`.${VALIDATION_CLASSES.fieldError}`);
  if (errorEl && errorEl.id && field.hasAttribute("aria-describedby")) {
    const ids = field
      .getAttribute("aria-describedby")
      .split(/\s+/)
      .filter(Boolean)
      .filter((id) => id !== errorEl.id);
    if (ids.length) {
      field.setAttribute("aria-describedby", ids.join(" "));
    } else {
      field.removeAttribute("aria-describedby");
    }
  }
  field.removeAttribute("aria-invalid");
  container.classList.remove(VALIDATION_CLASSES.fieldInvalid);
  if (errorEl) {
    errorEl.remove();
  }
}

function setFieldError(field, message) {
  if (!field) return;
  const container = getFieldContainer(field);
  if (!container) return;
  clearFieldError(field);
  container.classList.add(VALIDATION_CLASSES.fieldInvalid);
  field.setAttribute("aria-invalid", "true");
  let errorEl = container.querySelector(`.${VALIDATION_CLASSES.fieldError}`);
  if (!errorEl) {
    errorEl = document.createElement("div");
    errorEl.className = VALIDATION_CLASSES.fieldError;
    errorEl.setAttribute("role", "alert");
    container.appendChild(errorEl);
  }
  const fieldId = field.id || field.name;
  if (fieldId) {
    const errorId = `${fieldId}__error`;
    errorEl.id = errorId;
    const describedBy = new Set(
      (field.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter(Boolean)
    );
    describedBy.add(errorId);
    field.setAttribute("aria-describedby", Array.from(describedBy).join(" "));
  }
  errorEl.textContent = message;
}

function createFormValidator(form, schema, registerListener) {
  if (!form || !schema || typeof schema !== "object") {
    return {
      validate: () => true,
      reset: () => {},
    };
  }

  const entries = Object.entries(schema);
  const fieldCache = new Map();

  const getField = (key, config) => {
    if (fieldCache.has(key)) {
      return fieldCache.get(key);
    }
    let field = null;
    if (config && typeof config.getElement === "function") {
      field = config.getElement(form);
    }
    if (!field) {
      field = form.querySelector(`#${key}`) || form.querySelector(`[name="${key}"]`);
    }
    fieldCache.set(key, field || null);
    return field || null;
  };

  const getValue = (field, config) => {
    if (!field) return "";
    if (config && typeof config.getValue === "function") {
      return config.getValue(field, form);
    }
    const tag = field.tagName ? field.tagName.toLowerCase() : "";
    const type = (field.getAttribute && field.getAttribute("type")) || field.type || "";
    if (type === "checkbox") {
      return field.checked;
    }
    if (type === "radio") {
      const name = field.name;
      if (name) {
        const selected = form.querySelector(`input[name="${name}"]:checked`);
        return selected ? selected.value : "";
      }
      return field.checked ? field.value : "";
    }
    if (tag === "select") {
      return field.value;
    }
    const value = field.value;
    return typeof value === "string" ? value.trim() : value;
  };

  const collectValues = () => {
    const values = {};
    for (const [key, config] of entries) {
      const field = getField(key, config);
      values[key] = getValue(field, config);
    }
    return values;
  };

  const getMessage = (rule, fallback) => {
    if (typeof rule === "string") return rule;
    if (rule && typeof rule.message === "string") return rule.message;
    return fallback;
  };

  const applyRules = (key, config, values) => {
    const field = getField(key, config);
    if (!field) return true;
    clearFieldError(field);
    const rawValue = values[key];
    const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;
    if (config.required) {
      const isEmpty = value === null || value === undefined || value === "" || value === false;
      if (isEmpty) {
        setFieldError(field, getMessage(config.required, "Dit veld is verplicht."));
        return false;
      }
    }
    if (config.pattern && value) {
      const pattern = config.pattern instanceof RegExp ? config.pattern : config.pattern.value;
      if (pattern && typeof pattern.test === "function" && !pattern.test(value)) {
        setFieldError(field, getMessage(config.pattern, "Ongeldige invoer."));
        return false;
      }
    }
    if (config.minLength && typeof value === "string") {
      const limit = typeof config.minLength === "number" ? config.minLength : config.minLength.value;
      if (Number.isFinite(limit) && value.length < limit) {
        setFieldError(field, getMessage(config.minLength, `Minimaal ${limit} tekens.`));
        return false;
      }
    }
    if (config.validate) {
      try {
        const result = config.validate(value, values, field);
        if (result !== true) {
          const message = typeof result === "string" ? result : getMessage(config.validate, "Ongeldige invoer.");
          setFieldError(field, message);
          return false;
        }
      } catch (err) {
        console.error("Validatie fout", err);
        setFieldError(field, getMessage(config.validate, "Ongeldige invoer."));
        return false;
      }
    }
    clearFieldError(field);
    return true;
  };

  const validateField = (key) => {
    const config = schema[key];
    if (!config) return true;
    const values = collectValues();
    const valid = applyRules(key, config, values);
    if (valid && Array.isArray(config.revalidate)) {
      for (const linkedKey of config.revalidate) {
        const linkedConfig = schema[linkedKey];
        if (linkedConfig) {
          applyRules(linkedKey, linkedConfig, values);
        }
      }
    }
    return valid;
  };

  const validateAll = () => {
    const values = collectValues();
    let allValid = true;
    let firstInvalid = null;
    for (const [key, config] of entries) {
      const valid = applyRules(key, config, values);
      if (!valid) {
        allValid = false;
        const field = getField(key, config);
        if (!firstInvalid && field && typeof field.focus === "function") {
          firstInvalid = field;
        }
      }
    }
    if (firstInvalid) {
      firstInvalid.focus();
    }
    return allValid;
  };

  const reset = () => {
    for (const [key, config] of entries) {
      const field = getField(key, config);
      if (field) {
        clearFieldError(field);
      }
    }
  };

  const addListener = (element, type, handler) => {
    if (!element || typeof handler !== "function" || typeof type !== "string") return;
    if (typeof registerListener === "function") {
      registerListener(element, type, handler);
    } else {
      element.addEventListener(type, handler);
    }
  };

  const determineEvent = (field) => {
    if (!field) return "input";
    const tag = field.tagName ? field.tagName.toLowerCase() : "";
    const type = (field.getAttribute && field.getAttribute("type")) || field.type || "";
    if (type === "checkbox" || type === "radio") return "change";
    if (tag === "select") return "change";
    if (["date", "time", "number"].includes(type)) return "change";
    return "input";
  };

  for (const [key, config] of entries) {
    const field = getField(key, config);
    if (!field) continue;
    const eventType = determineEvent(field);
    addListener(field, eventType, () => {
      validateField(key);
      if (config && Array.isArray(config.revalidate)) {
        for (const linkedKey of config.revalidate) {
          validateField(linkedKey);
        }
      }
    });
    addListener(field, "blur", () => {
      validateField(key);
    });
  }

  return {
    validate: validateAll,
    validateField,
    reset,
  };
}

function refreshElements() {
  const doc = document;
  els = {
    filterRegion: doc.getElementById("filterRegion"),
    filterStatus: doc.getElementById("filterStatus"),
    filterQuery: doc.getElementById("filterQuery"),
    filterDate: doc.getElementById("filterDate"),
    btnApplyFilters: doc.getElementById("btnApplyFilters"),
    planStart: doc.getElementById("planStart"),
    planEnd: doc.getElementById("planEnd"),
    btnSuggestPlan: doc.getElementById("btnSuggestPlan"),
    btnApplyPlan: doc.getElementById("btnApplyPlan"),
    plannerStatus: doc.getElementById("plannerStatus"),
    quickCarrier: doc.getElementById("quickCarrier"),
    quickCapacity: doc.getElementById("quickCapacity"),
    quickRegion: doc.getElementById("quickRegion"),
    btnAddCarrier: doc.getElementById("btnAddCarrier"),
    carrierStatus: doc.getElementById("carrierStatus"),
    orderForm: doc.getElementById("orderForm"),
    oRequestReference: doc.getElementById("oRequestReference"),
    oTransportType: doc.getElementById("oTransportType"),
    oStatus: doc.getElementById("oStatus"),
    oReceivedAt: doc.getElementById("oReceivedAt"),
    oDue: doc.getElementById("oDue"),
    oCustomerName: doc.getElementById("oCustomerName"),
    oCustomerNumber: doc.getElementById("oCustomerNumber"),
    oCustomerOrderNumber: doc.getElementById("oCustomerOrderNumber"),
    oOrderReference: doc.getElementById("oOrderReference"),
    oOrderDescription: doc.getElementById("oOrderDescription"),
    oOrderContact: doc.getElementById("oOrderContact"),
    oOrderContactPhone: doc.getElementById("oOrderContactPhone"),
    oOrderContactEmail: doc.getElementById("oOrderContactEmail"),
    oPickupConfirmed: doc.getElementById("oPickupConfirmed"),
    oPickupDate: doc.getElementById("oPickupDate"),
    oPickupTimeFrom: doc.getElementById("oPickupTimeFrom"),
    oPickupTimeTo: doc.getElementById("oPickupTimeTo"),
    oPickupContact: doc.getElementById("oPickupContact"),
    oPickupPhone: doc.getElementById("oPickupPhone"),
    oPickupLocation: doc.getElementById("oPickupLocation"),
    oPickupInstructions: doc.getElementById("oPickupInstructions"),
    oDeliveryConfirmed: doc.getElementById("oDeliveryConfirmed"),
    oDeliveryDate: doc.getElementById("oDeliveryDate"),
    oDeliveryTimeFrom: doc.getElementById("oDeliveryTimeFrom"),
    oDeliveryTimeTo: doc.getElementById("oDeliveryTimeTo"),
    oDeliveryContact: doc.getElementById("oDeliveryContact"),
    oDeliveryPhone: doc.getElementById("oDeliveryPhone"),
    oDeliveryLocation: doc.getElementById("oDeliveryLocation"),
    oDeliveryInstructions: doc.getElementById("oDeliveryInstructions"),
    articleTypeInputs: doc.querySelectorAll('input[name="articleType"]'),
    articleList: doc.getElementById("articleList"),
    articleRowTemplate: doc.getElementById("articleRowTemplate"),
    btnAddArticle: doc.getElementById("btnAddArticle"),
    btnCreate: doc.getElementById("btnCreate"),
    createStatus: doc.getElementById("createStatus"),
    btnReload: doc.getElementById("btnReload"),
    ordersTable: (() => {
      const table = doc.getElementById("ordersTable");
      return table ? table.querySelector("tbody") : null;
    })(),
    pager: doc.getElementById("ordersPager"),
    pagerInfo: doc.getElementById("pagerInfo"),
    pagerPrev: doc.getElementById("pagerPrev"),
    pagerNext: doc.getElementById("pagerNext"),
    pagerPageSize: doc.getElementById("pagerPageSize"),
    dlg: doc.getElementById("editDialog"),
    eId: doc.getElementById("eId"),
    eStatus: doc.getElementById("eStatus"),
    eCarrier: doc.getElementById("eCarrier"),
    ePlanned: doc.getElementById("ePlanned"),
    eSlot: doc.getElementById("eSlot"),
    editStatus: doc.getElementById("editStatus"),
    btnDeleteOrder: doc.getElementById("btnDeleteOrder"),
    btnSaveEdit: doc.getElementById("btnSaveEdit"),
    carrierList: doc.getElementById("carrierList"),
    truckName: doc.getElementById("truckName"),
    truckPlate: doc.getElementById("truckPlate"),
    truckDriver: doc.getElementById("truckDriver"),
    truckCapacity: doc.getElementById("truckCapacity"),
    btnAddTruck: doc.getElementById("btnAddTruck"),
    truckStatus: doc.getElementById("truckStatus"),
    truckList: doc.getElementById("truckList"),
    boardDate: doc.getElementById("boardDate"),
    boardRegion: doc.getElementById("boardRegion"),
    boardStatus: doc.getElementById("boardStatus"),
    btnClearBoard: doc.getElementById("btnClearBoard"),
    planBoard: doc.getElementById("planBoard"),
  };
}

const BOUND_LISTENERS = [];

function addBoundListener(element, type, handler) {
  if (!element || typeof element.addEventListener !== "function" || typeof handler !== "function") {
    return;
  }
  element.addEventListener(type, handler);
  BOUND_LISTENERS.push({ element, type, handler });
}

function removeBoundListeners() {
  for (const binding of BOUND_LISTENERS.splice(0, BOUND_LISTENERS.length)) {
    const { element, type, handler } = binding;
    if (element && typeof element.removeEventListener === "function") {
      element.removeEventListener(type, handler);
    }
  }
}

function setupOrderFormValidation() {
  if (!els.orderForm) {
    ORDER_FORM_VALIDATOR = null;
    return;
  }
  ORDER_FORM_VALIDATOR = createFormValidator(els.orderForm, ORDER_FORM_SCHEMA, addBoundListener);
  if (ORDER_FORM_VALIDATOR && typeof ORDER_FORM_VALIDATOR.reset === "function") {
    ORDER_FORM_VALIDATOR.reset();
  }
}

const STORAGE_KEYS = {
  trucks: "transport_trucks_v1",
  board: "transport_board_v1",
  lastReference: "transport_last_reference_v1",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+0-9()\s-]{6,}$/;

const ORDER_FORM_SCHEMA = {
  oRequestReference: {
    required: "Vul de transport aanvraag referentie in.",
  },
  oDue: {
    required: "Vul de gewenste leverdatum in.",
  },
  oCustomerName: {
    required: "Vul de klantnaam in.",
  },
  oOrderReference: {
    required: "Vul de orderreferentie in.",
  },
  oOrderDescription: {
    required: "Vul de orderomschrijving in.",
    minLength: {
      value: 5,
      message: "Beschrijf de order in minimaal 5 tekens.",
    },
  },
  oOrderContact: {
    required: "Vul de order contactpersoon in.",
  },
  oOrderContactPhone: {
    required: "Vul het telefoonnummer van de order contactpersoon in.",
    pattern: {
      value: PHONE_PATTERN,
      message: "Gebruik minimaal 6 cijfers of tekens.",
    },
  },
  oOrderContactEmail: {
    required: "Vul het e-mailadres van de order contactpersoon in.",
    pattern: {
      value: EMAIL_PATTERN,
      message: "Vul een geldig e-mailadres in.",
    },
  },
  oPickupDate: {
    required: "Vul de laad datum in.",
  },
  oPickupTimeFrom: {
    required: "Vul het begin van het laad tijdslot in.",
    revalidate: ["oPickupTimeTo"],
  },
  oPickupTimeTo: {
    required: "Vul het einde van het laad tijdslot in.",
    validate: (value, values) => {
      if (!value || !values.oPickupTimeFrom) return true;
      if (values.oPickupTimeFrom > value) {
        return "Het eindtijdstip ligt vóór de starttijd.";
      }
      return true;
    },
  },
  oPickupContact: {
    required: "Vul de laad contactpersoon in.",
  },
  oPickupPhone: {
    required: "Vul het telefoonnummer van het laad contact in.",
    pattern: {
      value: PHONE_PATTERN,
      message: "Gebruik minimaal 6 cijfers of tekens.",
    },
  },
  oPickupLocation: {
    required: "Vul de laadlocatie in.",
  },
  oDeliveryDate: {
    required: "Vul de los datum in.",
  },
  oDeliveryTimeFrom: {
    required: "Vul het begin van het los tijdslot in.",
    revalidate: ["oDeliveryTimeTo"],
  },
  oDeliveryTimeTo: {
    required: "Vul het einde van het los tijdslot in.",
    validate: (value, values) => {
      if (!value || !values.oDeliveryTimeFrom) return true;
      if (values.oDeliveryTimeFrom > value) {
        return "Het eindtijdstip ligt vóór de starttijd.";
      }
      return true;
    },
  },
  oDeliveryContact: {
    required: "Vul de los contactpersoon in.",
  },
  oDeliveryPhone: {
    required: "Vul het telefoonnummer van het los contact in.",
    pattern: {
      value: PHONE_PATTERN,
      message: "Gebruik minimaal 6 cijfers of tekens.",
    },
  },
  oDeliveryLocation: {
    required: "Vul de loslocatie in.",
  },
};

let ORDER_FORM_VALIDATOR = null;

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

function buildDefaultRequestReference() {
  const year = new Date().getFullYear();
  return `TAR-${year}-${String(1).padStart(3, "0")}`;
}

function parseRequestReference(value) {
  if (!value || typeof value !== "string") {
    return null;
  }
  const match = value.trim().match(/^([A-Za-z]+)-(\d{4})-(\d+)$/);
  if (!match) {
    return null;
  }
  const [, prefixRaw, yearText, sequenceText] = match;
  const year = Number(yearText);
  const sequence = Number(sequenceText);
  if (!Number.isFinite(year) || !Number.isFinite(sequence)) {
    return null;
  }
  return {
    prefix: prefixRaw.toUpperCase(),
    year,
    sequence,
    width: sequenceText.length || 3,
  };
}

function computeNextRequestReference(latestReference) {
  const fallback = buildDefaultRequestReference();
  const parsed = parseRequestReference(latestReference);
  if (!parsed) {
    return fallback;
  }
  const now = new Date();
  const currentYear = now.getFullYear();
  const targetYear = parsed.year >= currentYear ? parsed.year : currentYear;
  const nextSequence = parsed.year === targetYear ? parsed.sequence + 1 : 1;
  const width = Math.max(parsed.width || 0, 3);
  return `${parsed.prefix}-${targetYear}-${String(nextSequence).padStart(width, "0")}`;
}

function compareRequestReferences(a, b) {
  if (a === b) return 0;
  const parsedA = parseRequestReference(a);
  const parsedB = parseRequestReference(b);
  if (!parsedA && !parsedB) return 0;
  if (!parsedA) return -1;
  if (!parsedB) return 1;
  if (parsedA.prefix !== parsedB.prefix) {
    return parsedA.prefix > parsedB.prefix ? 1 : -1;
  }
  if (parsedA.year !== parsedB.year) {
    return parsedA.year > parsedB.year ? 1 : -1;
  }
  if (parsedA.sequence !== parsedB.sequence) {
    return parsedA.sequence > parsedB.sequence ? 1 : -1;
  }
  return 0;
}

async function assignRequestReference() {
  if (!els.oRequestReference) {
    return;
  }
  els.oRequestReference.setAttribute("readonly", "readonly");
  els.oRequestReference.setAttribute("aria-readonly", "true");
  const applyValue = (value) => {
    if (!els.oRequestReference) return;
    els.oRequestReference.value = value;
    els.oRequestReference.defaultValue = value;
  };
  const storedLatest = storageGet(STORAGE_KEYS.lastReference, null);
  let candidate = computeNextRequestReference(storedLatest);
  applyValue(candidate);
  try {
    if (window.Orders && typeof window.Orders.latestReference === "function") {
      const latest = await window.Orders.latestReference();
      const latestValue = latest?.request_reference || latest?.reference || null;
      const serverCandidate = computeNextRequestReference(latestValue);
      if (compareRequestReferences(serverCandidate, candidate) > 0) {
        candidate = serverCandidate;
        applyValue(candidate);
      }
    }
  } catch (error) {
    console.warn("Kan laatste transportreferentie niet ophalen", error);
  }
}

function applyDefaultReceivedDate() {
  if (!els.oReceivedAt) {
    return;
  }
  const todayValue = getTodayDateValue();
  els.oReceivedAt.value = todayValue;
  els.oReceivedAt.defaultValue = todayValue;
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
  PLAN_BOARD = sanitizePlanBoard(storageGet(STORAGE_KEYS.board, {}));
}

function saveTrucks() {
  storageSet(STORAGE_KEYS.trucks, TRUCKS);
}

function savePlanBoard() {
  PLAN_BOARD = sanitizePlanBoard(PLAN_BOARD);
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

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function joinNonEmpty(values, separator = " • ") {
  if (!Array.isArray(values)) return "";
  const normalized = [];
  for (const value of values) {
    const cleaned = cleanText(value);
    if (cleaned) {
      normalized.push(cleaned);
    }
  }
  return normalized.join(separator);
}

function sanitizePlanBoard(value) {
  if (!value || typeof value !== "object") {
    return {};
  }
  const safeBoard = {};
  for (const [date, trucks] of Object.entries(value)) {
    if (!trucks || typeof trucks !== "object") {
      continue;
    }
    const safeTrucks = {};
    for (const [truckId, assignments] of Object.entries(trucks)) {
      if (!Array.isArray(assignments)) {
        continue;
      }
      const cleanedAssignments = assignments
        .map((assignment) => {
          if (!assignment || typeof assignment !== "object") {
            return null;
          }
          const orderId =
            assignment.orderId ?? assignment.order_id ?? assignment.id ?? null;
          if (orderId === undefined || orderId === null) {
            return null;
          }
          const normalized = {
            orderId,
            reference: cleanText(assignment.reference) || null,
            customer: cleanText(assignment.customer) || null,
            slot: cleanText(assignment.slot) || null,
          };
          if (assignment.details && typeof assignment.details === "object") {
            normalized.details = assignment.details;
          }
          return normalized;
        })
        .filter(Boolean);
      if (cleanedAssignments.length) {
        safeTrucks[truckId] = cleanedAssignments;
      }
    }
    if (Object.keys(safeTrucks).length) {
      safeBoard[date] = safeTrucks;
    }
  }
  return safeBoard;
}

function buildTimeSlot(from, to, fallback = null) {
  const start = cleanText(from);
  const end = cleanText(to);
  if (start && end) {
    return `${start} - ${end}`;
  }
  if (start) {
    return `Vanaf ${start}`;
  }
  if (end) {
    return `Tot ${end}`;
  }
  return fallback ?? null;
}

function normalizeStop(stop) {
  const base = {
    location: null,
    date: null,
    slot: null,
    time_from: null,
    time_to: null,
    confirmed: null,
    contact: null,
    phone: null,
    instructions: null,
  };
  if (!stop || typeof stop === "boolean") {
    return base;
  }
  if (typeof stop === "string") {
    return { ...base, location: cleanText(stop) };
  }
  if (typeof stop !== "object") {
    return base;
  }
  const location = cleanText(stop.location ?? stop.address);
  const date = stop.date ?? stop.day ?? null;
  const timeFrom = cleanText(stop.time_from ?? stop.timeFrom);
  const timeTo = cleanText(stop.time_to ?? stop.timeTo);
  const slot = cleanText(stop.slot) || buildTimeSlot(timeFrom, timeTo);
  const confirmed = typeof stop.confirmed === "boolean" ? stop.confirmed : null;
  const contact = cleanText(stop.contact ?? stop.contact_name);
  const phone = cleanText(stop.phone ?? stop.contact_phone);
  const instructions = cleanText(stop.instructions ?? stop.instruction ?? stop.notes);
  return {
    location: location ?? null,
    date: date ?? null,
    slot: slot ?? null,
    time_from: timeFrom ?? null,
    time_to: timeTo ?? null,
    confirmed,
    contact: contact ?? null,
    phone: phone ?? null,
    instructions: instructions ?? null,
  };
}

function mergeStops(target, source) {
  const base = normalizeStop(target);
  const incoming = normalizeStop(source);
  return {
    location: base.location || incoming.location || null,
    date: base.date || incoming.date || null,
    time_from: base.time_from || incoming.time_from || null,
    time_to: base.time_to || incoming.time_to || null,
    slot: base.slot || incoming.slot || buildTimeSlot(base.time_from || incoming.time_from, base.time_to || incoming.time_to) || null,
    confirmed: base.confirmed ?? incoming.confirmed ?? null,
    contact: base.contact || incoming.contact || null,
    phone: base.phone || incoming.phone || null,
    instructions: base.instructions || incoming.instructions || null,
  };
}

function normalizeCargo(cargo) {
  if (!cargo || typeof cargo === "boolean") {
    return { type: null };
  }
  if (typeof cargo === "string") {
    return {
      type: cleanText(cargo),
    };
  }
  if (typeof cargo !== "object") {
    return { type: null };
  }
  const type = cleanText(cargo.type);
  return {
    type: type || null,
  };
}

function mergeCargo(target, source) {
  const base = normalizeCargo(target);
  const incoming = normalizeCargo(source);
  return {
    type: base.type || incoming.type || null,
  };
}

function parseOrderDetails(order) {
  const details = {
    reference: null,
    transportType: null,
    customerOrderNumber: null,
    customerNumber: null,
    orderReference: null,
    orderDescription: null,
    pickup: normalizeStop(null),
    delivery: normalizeStop(null),
    cargo: normalizeCargo(null),
    instructions: null,
    contact: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
  };
  if (!order) return details;

  details.reference = cleanText(order.request_reference) || cleanText(order.reference);
  details.transportType = cleanText(order.transport_type ?? order.load_type ?? order.cargo_type);
  details.customerOrderNumber = cleanText(order.customer_order_number);
  details.customerNumber = cleanText(order.customer_number);
  details.orderReference = cleanText(order.order_reference);
  details.orderDescription = cleanText(order.order_description);

  details.pickup = normalizeStop({
    location: cleanText(order.pickup_location),
    date: order.pickup_date ?? null,
    time_from: order.pickup_time_from ?? null,
    time_to: order.pickup_time_to ?? null,
    slot: cleanText(order.pickup_slot),
    confirmed: order.pickup_confirmed ?? null,
    contact: cleanText(order.pickup_contact),
    phone: cleanText(order.pickup_contact_phone),
    instructions: cleanText(order.pickup_instructions),
  });
  details.delivery = normalizeStop({
    location: cleanText(order.delivery_location),
    date: order.delivery_date ?? order.due_date ?? null,
    time_from: order.delivery_time_from ?? null,
    time_to: order.delivery_time_to ?? null,
    slot: cleanText(order.delivery_slot),
    confirmed: order.delivery_confirmed ?? null,
    contact: cleanText(order.delivery_contact),
    phone: cleanText(order.delivery_contact_phone),
    instructions: cleanText(order.delivery_instructions),
  });
  details.cargo = normalizeCargo({
    type: details.transportType ?? order.cargo_type ?? null,
  });

  const contactName = cleanText(order.customer_contact ?? order.contact);
  const contactPhone = cleanText(order.customer_contact_phone);
  const contactEmail = cleanText(order.customer_contact_email);
  details.contactName = contactName;
  details.contactPhone = contactPhone;
  details.contactEmail = contactEmail;
  details.contact = joinNonEmpty([contactName, contactPhone, contactEmail]) || null;

  const raw = order.notes;
  if (raw && typeof raw === "string" && raw.startsWith("JSON:")) {
    try {
      const parsed = JSON.parse(raw.slice(5));
      if (!details.reference && parsed.reference) {
        details.reference = cleanText(parsed.reference);
      }
      details.pickup = mergeStops(details.pickup, parsed.pickup);
      details.delivery = mergeStops(details.delivery, parsed.delivery);
      details.cargo = mergeCargo(details.cargo, parsed.cargo);
      if (!details.instructions && parsed.instructions) {
        details.instructions = cleanText(parsed.instructions);
      }
      if (!details.contact && parsed.contact) {
        details.contact = cleanText(parsed.contact);
      }
    } catch (e) {
      console.warn("Kan orderdetails niet parsen", e);
      if (!details.instructions) {
        details.instructions = cleanText(raw);
      }
    }
  } else if (!details.instructions && raw) {
    details.instructions = cleanText(raw);
  }

  const extraInstructions = joinNonEmpty([
    details.orderDescription,
    details.pickup.instructions,
    details.delivery.instructions,
  ], "\n");
  if (!details.instructions && extraInstructions) {
    details.instructions = extraInstructions;
  }
  if (!details.orderDescription && details.instructions) {
    details.orderDescription = details.instructions;
  }

  if ((!details.pickup.location || !details.delivery.location) && order.customer_city) {
    const fallback = { location: cleanText(order.customer_city), date: null, slot: null };
    if (!details.pickup.location) {
      details.pickup = mergeStops(details.pickup, fallback);
    }
    if (!details.delivery.location) {
      details.delivery = mergeStops(details.delivery, fallback);
    }
  }
  if (!details.contact && order.created_by_name) {
    details.contact = cleanText(order.created_by_name);
  }
  return details;
}

function formatStop(stop) {
  if (!stop) return "-";
  const parts = [];
  if (stop.location) parts.push(stop.location);
  if (stop.date) {
    const displayDate = formatDateDisplay(stop.date);
    parts.push(displayDate !== "-" ? displayDate : stop.date);
  }
  const slotText = stop.slot || buildTimeSlot(stop.time_from, stop.time_to);
  if (slotText) parts.push(slotText);
  return parts.length ? parts.join(" • ") : "-";
}

function formatCargo(cargo) {
  if (!cargo) return "-";
  const type = cleanText(cargo.type);
  return type || "-";
}

function formatPlanned(row) {
  if (!row) return "-";
  const parts = [];
  const dateValue = row.planned_date;
  if (dateValue) {
    const formattedDate = formatDateDisplay(dateValue);
    if (formattedDate && formattedDate !== "-") {
      parts.push(formattedDate);
    }
  }
  if (row.planned_slot) {
    parts.push(`(${row.planned_slot})`);
  }
  return parts.join(" ").trim() || "-";
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

function createStatusBadge(status) {
  const span = document.createElement("span");
  span.className = "status-badge";
  const label = (status || "Onbekend").trim();
  const normalized = label.toLowerCase();
  let variant = "neutral";
  if (normalized === "gepland" || normalized === "geleverd") {
    variant = "success";
  } else if (normalized === "te plannen") {
    variant = "warning";
  } else if (normalized === "geannuleerd") {
    variant = "danger";
  } else if (normalized === "in transport") {
    variant = "info";
  }
  span.classList.add(variant);
  span.textContent = label || "-";
  span.setAttribute("aria-label", `Status: ${label || "Onbekend"}`);
  return span;
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
    tr.classList.add("order-row");
    const tooltip = [];
    if (details.orderDescription) tooltip.push(`Omschrijving: ${details.orderDescription}`);
    if (details.transportType) tooltip.push(`Transporttype: ${details.transportType}`);
    if (details.orderReference) tooltip.push(`Order referentie: ${details.orderReference}`);
    if (details.customerOrderNumber) tooltip.push(`Klantorder: ${details.customerOrderNumber}`);
    if (details.customerNumber) tooltip.push(`Klantnummer: ${details.customerNumber}`);
    if (details.contact) tooltip.push(`Contact: ${details.contact}`);
    if (details.pickup.instructions) tooltip.push(`Laad: ${details.pickup.instructions}`);
    if (details.delivery.instructions) tooltip.push(`Los: ${details.delivery.instructions}`);
    const pickupContactInfo = joinNonEmpty([details.pickup.contact, details.pickup.phone]);
    if (pickupContactInfo) tooltip.push(`Laad contact: ${pickupContactInfo}`);
    const deliveryContactInfo = joinNonEmpty([details.delivery.contact, details.delivery.phone]);
    if (deliveryContactInfo) tooltip.push(`Los contact: ${deliveryContactInfo}`);
    if (details.pickup.confirmed === true) tooltip.push("Laadlocatie bevestigd");
    if (details.delivery.confirmed === true) tooltip.push("Losadres bevestigd");
    if (!details.orderDescription && details.instructions) {
      tooltip.push(`Instructies: ${details.instructions}`);
    }
    const ownerInfo = getOrderOwner(r);
    if (ownerInfo?.id) tr.dataset.ownerId = ownerInfo.id;
    if (ownerInfo?.name) tr.dataset.ownerName = ownerInfo.name;
    if (ownerInfo?.name) {
      tooltip.push(`Aangemaakt door ${ownerInfo.name}`);
    }
    if (tooltip.length) {
      tr.title = tooltip.join("\n");
    }

    const dueCell = document.createElement("td");
    const dueSource = r.due_date || details.delivery?.date;
    dueCell.textContent = formatDateDisplay(dueSource);
    tr.appendChild(dueCell);

    const refCell = document.createElement("td");
    refCell.textContent = details.reference || "-";
    tr.appendChild(refCell);

    const customerCell = document.createElement("td");
    customerCell.textContent = r.customer_name || "-";
    tr.appendChild(customerCell);

    const orderCell = document.createElement("td");
    orderCell.textContent = details.customerOrderNumber || details.customerNumber || "-";
    tr.appendChild(orderCell);

    const pickupCell = document.createElement("td");
    pickupCell.textContent = formatStop(details.pickup);
    tr.appendChild(pickupCell);

    const deliveryCell = document.createElement("td");
    deliveryCell.textContent = formatStop(details.delivery);
    tr.appendChild(deliveryCell);

    const transportCell = document.createElement("td");
    transportCell.textContent = details.transportType || formatCargo(details.cargo) || "-";
    tr.appendChild(transportCell);

    const statusCell = document.createElement("td");
    statusCell.className = "cell-status";
    statusCell.appendChild(createStatusBadge(r.status));
    tr.appendChild(statusCell);

    const carrierCell = document.createElement("td");
    carrierCell.textContent = r.assigned_carrier || "-";
    tr.appendChild(carrierCell);

    const plannedCell = document.createElement("td");
    plannedCell.textContent = formatPlanned(r);
    tr.appendChild(plannedCell);

    if (canUserEditOrder(r, currentUser)) {
      tr.addEventListener("click", () => openEdit(r));
    } else {
      tr.classList.add("is-readonly-order");
      if (!tooltip.length && ownerInfo?.name) {
        tr.title = `Aangemaakt door ${ownerInfo.name}`;
      }
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

function readInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const num = parseInt(value, 10);
  return Number.isFinite(num) ? num : null;
}

function getArticleType() {
  if (!els.articleTypeInputs) return null;
  for (const input of els.articleTypeInputs) {
    if (input && input.checked) {
      return input.value;
    }
  }
  return null;
}

function getArticleRows() {
  if (!els.articleList) return [];
  return Array.from(els.articleList.querySelectorAll(".article-row"));
}

function createArticleRowElement() {
  if (!els.articleRowTemplate) return null;
  const fragment = els.articleRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".article-row");
  if (!row) return null;
  return row;
}

function updateArticleRowMode(row, articleType) {
  if (!row) return;
  const normalizedType = articleType === "serial" ? "serial" : "non_serial";
  const serialField = row.querySelector(".serial-field");
  const serialInput = row.querySelector('[data-field="serial_number"]');
  const quantityLabel = row.querySelector(".quantity-field");
  const quantityInput = row.querySelector('[data-field="quantity"]');

  if (serialField) {
    serialField.hidden = normalizedType !== "serial";
  }
  if (serialInput) {
    if (normalizedType === "serial") {
      serialInput.removeAttribute("disabled");
    } else {
      serialInput.value = "";
      serialInput.setAttribute("disabled", "disabled");
    }
  }
  if (quantityInput) {
    if (normalizedType === "serial") {
      quantityInput.value = "1";
      quantityInput.setAttribute("readonly", "readonly");
      quantityInput.setAttribute("aria-readonly", "true");
    } else {
      quantityInput.removeAttribute("readonly");
      quantityInput.removeAttribute("aria-readonly");
      quantityInput.removeAttribute("disabled");
      if (!quantityInput.value) {
        quantityInput.value = "1";
      }
    }
  }
  if (quantityLabel) {
    quantityLabel.classList.toggle("is-readonly", normalizedType === "serial");
  }
}

function updateArticleRowsForType(articleType) {
  const rows = getArticleRows();
  for (const row of rows) {
    updateArticleRowMode(row, articleType);
  }
}

function ensureMinimumArticleRows() {
  const rows = getArticleRows();
  if (rows.length === 0) {
    addArticleRow();
  }
}

function addArticleRow(prefill = null) {
  if (!els.articleList) return null;
  const row = createArticleRowElement();
  if (!row) return null;
  els.articleList.appendChild(row);
  updateArticleRowMode(row, getArticleType());
  if (prefill) {
    const productInput = row.querySelector('[data-field="product"]');
    const serialInput = row.querySelector('[data-field="serial_number"]');
    const quantityInput = row.querySelector('[data-field="quantity"]');
    if (productInput && prefill.product) {
      productInput.value = prefill.product;
    }
    if (serialInput && prefill.serial_number) {
      serialInput.value = prefill.serial_number;
    }
    if (quantityInput && prefill.quantity !== undefined && prefill.quantity !== null) {
      quantityInput.value = String(prefill.quantity);
    }
  }
  return row;
}

function removeArticleRow(row) {
  if (!row || !els.articleList || !els.articleList.contains(row)) return;
  row.remove();
  ensureMinimumArticleRows();
  updateArticleRowsForType(getArticleType());
}

function resetArticlesSection() {
  if (els.articleTypeInputs) {
    for (const input of els.articleTypeInputs) {
      input.checked = false;
    }
  }
  if (els.articleList) {
    els.articleList.innerHTML = "";
  }
  ensureMinimumArticleRows();
  updateArticleRowsForType(getArticleType());
}

function collectArticles(articleType) {
  const normalizedType = articleType === "serial" ? "serial" : "non_serial";
  const rows = getArticleRows();
  const items = [];
  for (const row of rows) {
    const productInput = row.querySelector('[data-field="product"]');
    const serialInput = row.querySelector('[data-field="serial_number"]');
    const quantityInput = row.querySelector('[data-field="quantity"]');
    const product = cleanText(productInput?.value);
    const serialNumber = cleanText(serialInput?.value);
    const rawQuantity = readInteger(quantityInput?.value);
    const defaultQuantity = quantityInput ? readInteger(quantityInput.defaultValue) : null;
    const isQuantityDefault = rawQuantity === null || (defaultQuantity !== null && rawQuantity === defaultQuantity);
    const isEmpty = !product && !serialNumber && (normalizedType === "serial" || isQuantityDefault);
    if (isEmpty) {
      continue;
    }
    if (!product) {
      const err = new Error("Vul voor elk artikel een omschrijving in.");
      err.code = "ARTICLE_PRODUCT_REQUIRED";
      throw err;
    }
    if (normalizedType === "serial") {
      if (!serialNumber) {
        const err = new Error("Vul voor elk serienummer gebonden artikel een serienummer in.");
        err.code = "ARTICLE_SERIAL_REQUIRED";
        throw err;
      }
      items.push({
        product,
        quantity: 1,
        serial_number: serialNumber,
      });
    } else {
      const quantity = rawQuantity ?? 1;
      if (!Number.isFinite(quantity) || quantity <= 0) {
        const err = new Error("Voer voor niet serienummer gebonden artikelen een hoeveelheid groter dan nul in.");
        err.code = "ARTICLE_QUANTITY_REQUIRED";
        throw err;
      }
      items.push({
        product,
        quantity,
        serial_number: null,
      });
    }
  }
  if (!items.length) {
    const err = new Error("Voeg minimaal één artikel toe.");
    err.code = "ARTICLE_REQUIRED";
    throw err;
  }
  return items;
}

function collectOrderPayload(articleType) {
  const requestReference = cleanText(els.oRequestReference?.value);
  const transportType = cleanText(els.oTransportType?.value) || "Afleveren";
  const status = cleanText(els.oStatus?.value) || "Nieuw";
  const customerName = cleanText(els.oCustomerName?.value);
  const orderDescription = cleanText(els.oOrderDescription?.value);
  const pickupInstructions = cleanText(els.oPickupInstructions?.value);
  const deliveryInstructions = cleanText(els.oDeliveryInstructions?.value);
  const combinedNotes = joinNonEmpty([
    orderDescription,
    pickupInstructions,
    deliveryInstructions,
  ], "\n");

  const payload = {
    reference: requestReference,
    request_reference: requestReference,
    transport_type: transportType,
    load_type: transportType,
    cargo_type: transportType,
    status,
    request_received_date: els.oReceivedAt?.value || getTodayDateValue(),
    due_date: els.oDue?.value || null,
    customer_name: customerName,
    customer_number: cleanText(els.oCustomerNumber?.value),
    customer_contact: cleanText(els.oOrderContact?.value),
    customer_contact_phone: cleanText(els.oOrderContactPhone?.value),
    customer_contact_email: cleanText(els.oOrderContactEmail?.value),
    customer_order_number: cleanText(els.oCustomerOrderNumber?.value),
    order_reference: cleanText(els.oOrderReference?.value),
    order_description: orderDescription,
    pickup_confirmed: els.oPickupConfirmed ? !!els.oPickupConfirmed.checked : null,
    pickup_date: els.oPickupDate?.value || null,
    pickup_time_from: els.oPickupTimeFrom?.value || null,
    pickup_time_to: els.oPickupTimeTo?.value || null,
    pickup_slot: buildTimeSlot(els.oPickupTimeFrom?.value, els.oPickupTimeTo?.value),
    pickup_contact: cleanText(els.oPickupContact?.value),
    pickup_contact_phone: cleanText(els.oPickupPhone?.value),
    pickup_location: cleanText(els.oPickupLocation?.value),
    pickup_instructions: pickupInstructions,
    delivery_confirmed: els.oDeliveryConfirmed ? !!els.oDeliveryConfirmed.checked : null,
    delivery_date: els.oDeliveryDate?.value || null,
    delivery_time_from: els.oDeliveryTimeFrom?.value || null,
    delivery_time_to: els.oDeliveryTimeTo?.value || null,
    delivery_slot: buildTimeSlot(els.oDeliveryTimeFrom?.value, els.oDeliveryTimeTo?.value),
    delivery_contact: cleanText(els.oDeliveryContact?.value),
    delivery_contact_phone: cleanText(els.oDeliveryPhone?.value),
    delivery_location: cleanText(els.oDeliveryLocation?.value),
    delivery_instructions: deliveryInstructions,
    instructions: combinedNotes || null,
    notes: combinedNotes || null,
    article_type: articleType === "serial" ? "serial" : articleType === "non_serial" ? "non_serial" : null,
  };

  if (!payload.due_date && payload.delivery_date) {
    payload.due_date = payload.delivery_date;
  }
  return payload;
}

function resetOrderForm(){
  if (els.orderForm) {
    els.orderForm.reset();
  }
  if (els.oStatus) {
    els.oStatus.value = "Nieuw";
  }
  if (els.oTransportType) {
    els.oTransportType.value = "Afleveren";
  }
  applyDefaultReceivedDate();
  resetArticlesSection();
  if (ORDER_FORM_VALIDATOR && typeof ORDER_FORM_VALIDATOR.reset === "function") {
    ORDER_FORM_VALIDATOR.reset();
  }
  if (els.createStatus) {
    setStatus(els.createStatus, "");
  }
}

async function createOrder(){
  if (!els.oCustomerName || !els.oRequestReference) return;
  const user = getCurrentUser();
  if (ORDER_FORM_VALIDATOR && !ORDER_FORM_VALIDATOR.validate()) {
    setStatus(els.createStatus, "Controleer de gemarkeerde velden.", "error");
    return;
  }
  const customerName = cleanText(els.oCustomerName.value);
  const requestReference = cleanText(els.oRequestReference.value);
  const articleType = getArticleType();
  if (!articleType) {
    setStatus(els.createStatus, "Kies het artikeltype.", "error");
    return;
  }
  let articleLines = [];
  try {
    articleLines = collectArticles(articleType);
  } catch (articleError) {
    setStatus(els.createStatus, articleError.message || "Controleer de artikelen.", "error");
    return;
  }
  setStatus(els.createStatus, "Bezig…");
  let createdOrderId = null;
  try {
    const payload = collectOrderPayload(articleType);
    payload.customer_name = customerName;
    payload.reference = requestReference;
    payload.request_reference = requestReference;
    const userId = user?.id ?? user?.user_id ?? null;
    if (userId !== null && userId !== undefined) {
      payload.created_by = userId;
      const creatorName = user?.name ?? user?.full_name ?? user?.email ?? null;
      if (creatorName) {
        payload.created_by_name = creatorName;
      }
    }
    const created = await Orders.create(payload);
    createdOrderId = created?.id ?? null;
    try {
      for (const line of articleLines) {
        await Lines.create({
          order_id: created.id,
          product: line.product,
          quantity: line.quantity,
          serial_number: line.serial_number,
          article_type: articleType,
        });
      }
    } catch (lineError) {
      if (createdOrderId) {
        try {
          await Orders.delete(createdOrderId);
        } catch (rollbackError) {
          console.error("Kan order niet terugdraaien", rollbackError);
        } finally {
          createdOrderId = null;
        }
      }
      throw lineError;
    }
    storageSet(STORAGE_KEYS.lastReference, requestReference);
    setStatus(els.createStatus, "Transport aangemaakt", "success");
    resetOrderForm();
    await assignRequestReference();
    await loadOrders();
  } catch (e) {
    if (createdOrderId) {
      try {
        await Orders.delete(createdOrderId);
      } catch (rollbackError) {
        console.error("Kan order niet terugdraaien", rollbackError);
      } finally {
        createdOrderId = null;
      }
    }
    console.error(e);
    const message = e && typeof e.message === "string" && e.message.trim() ? e.message : "Mislukt";
    setStatus(els.createStatus, message, "error");
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
  let boardChanged = false;
  for (const date of Object.keys(PLAN_BOARD)){
    const trucksForDay = PLAN_BOARD[date];
    if (!trucksForDay || typeof trucksForDay !== "object") {
      delete PLAN_BOARD[date];
      boardChanged = true;
      continue;
    }
    if (!trucksForDay[id]){
      continue;
    }
    delete trucksForDay[id];
    boardChanged = true;
    if (!Object.keys(trucksForDay).length){
      delete PLAN_BOARD[date];
    }
  }
  if (boardChanged){
    savePlanBoard();
  }
  renderTrucks();
  setStatus(els.boardStatus, truck ? `Planning voor ${truck.name} verwijderd.` : "Vrachtwagen verwijderd.");
  await loadOrders();
}

function syncPlanBoardFromOrders(){
  let changed = false;
  const cleaned = {};
  for (const [date, trucks] of Object.entries(PLAN_BOARD)){
    if (!trucks || typeof trucks !== "object") {
      changed = true;
      continue;
    }
    const newTrucks = {};
    for (const [truckId, assignments] of Object.entries(trucks)){
      if (!Array.isArray(assignments)) {
        changed = true;
        continue;
      }
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
    return getTodayDateValue();
  }
  let value = els.boardDate.value;
  if (!value) {
    value = getTodayDateValue();
    els.boardDate.value = value;
  }
  return value;
}

function normalizeRegion(value) {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase();
}

function getBoardRegionFilter(){
  return normalizeRegion(els.boardRegion?.value);
}

function orderMatchesBoardRegion(order, regionFilter){
  if (!regionFilter) return true;
  return normalizeRegion(order?.region) === regionFilter;
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
    tag.textContent = `Levering ${formatDateDisplay(order.due_date)}`;
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
      dates.push(formatDateForInput(d));
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
    addBoundListener(el, "click", handler);
  };
  bindClick(els.btnApplyFilters, () => loadOrders({ page: 1 }));
  bindClick(els.btnCreate, createOrder);
  bindClick(els.btnAddArticle, () => addArticleRow());
  bindClick(els.btnReload, () => loadOrders());
  bindClick(els.btnAddCarrier, addCarrier);
  bindClick(els.btnSuggestPlan, suggestPlan, canManagePlanning);
  bindClick(els.btnApplyPlan, applyPlan, canManagePlanning);
  bindClick(els.btnDeleteOrder, deleteOrder);
  if (els.btnSaveEdit) {
    addBoundListener(els.btnSaveEdit, "click", (e)=>{ e.preventDefault(); saveEdit(); });
  }
  bindClick(els.btnAddTruck, addTruck);
  bindClick(els.btnClearBoard, clearBoardForDay, canManagePlanning);
  if (els.articleList) {
    addBoundListener(els.articleList, "click", (event) => {
      const removeButton = event.target.closest('[data-action="remove-article"]');
      if (!removeButton) return;
      event.preventDefault();
      const row = removeButton.closest(".article-row");
      removeArticleRow(row);
    });
  }
  if (els.articleTypeInputs) {
    for (const input of els.articleTypeInputs) {
      addBoundListener(input, "change", () => {
        updateArticleRowsForType(getArticleType());
      });
    }
  }
  if (els.boardDate) {
    addBoundListener(els.boardDate, "change", () => { renderPlanBoard(); });
  }
  if (els.boardRegion) {
    addBoundListener(els.boardRegion, "change", () => { renderPlanBoard(); });
  }
  if (els.pagerPrev) {
    addBoundListener(els.pagerPrev, "click", goToPreviousPage);
  }
  if (els.pagerNext) {
    addBoundListener(els.pagerNext, "click", goToNextPage);
  }
  if (els.pagerPageSize) {
    const defaultSize = Number(els.pagerPageSize.value);
    if (Number.isFinite(defaultSize) && defaultSize > 0) {
      PAGINATION.pageSize = defaultSize;
    }
    addBoundListener(els.pagerPageSize, "change", handlePageSizeChange);
  }
}

async function initAppPage() {
  refreshElements();
  enforceDateInputs(document);
  const user = window.Auth?.getUser ? window.Auth.getUser() : null;
  const canManagePlanning = Boolean(user && (user.role === "planner" || user.role === "admin"));
  removeBoundListeners();
  bind(canManagePlanning);
  setupOrderFormValidation();
  await assignRequestReference();
  applyDefaultReceivedDate();
  ensureMinimumArticleRows();
  updateArticleRowsForType(getArticleType());
  hydrateLocalState();
  PLAN_SUGGESTIONS = [];
  ORDERS_CACHE = [];
  DRAG_CONTEXT = null;
  const today = new Date();
  const end = new Date(Date.now() + 5 * 86400000);
  const todayValue = formatDateForInput(today);
  const endValue = formatDateForInput(end);
  if (els.planStart) els.planStart.value = todayValue;
  if (els.planEnd) els.planEnd.value = endValue;
  if (els.boardDate) els.boardDate.value = todayValue;
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
}

function destroyAppPage() {
  removeBoundListeners();
  if (els.dlg && typeof els.dlg.close === "function" && els.dlg.open) {
    try {
      els.dlg.close();
    } catch (err) {
      console.warn("Kan dialoog niet sluiten", err);
    }
  }
  els = {};
  PLAN_SUGGESTIONS = [];
  DRAG_CONTEXT = null;
  ORDER_FORM_VALIDATOR = null;
}

window.Pages = window.Pages || {};
const sharedAppModule = {
  init: () => initAppPage(),
  destroy: destroyAppPage,
};

window.Pages.aanvraag = sharedAppModule;
window.Pages.orders = sharedAppModule;
window.Pages.planning = sharedAppModule;
window.Pages.vloot = sharedAppModule;
