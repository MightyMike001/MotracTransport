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

const formatDateTimeDisplay = typeof DATE_UTILS.formatDateTimeDisplay === "function"
  ? DATE_UTILS.formatDateTimeDisplay
  : (value) => {
      if (!value) return "-";
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return "-";
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${day}-${month}-${year} ${hours}:${minutes}`;
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

const showToastMessage = (type, message) => {
  if (typeof window.showToast === "function" && message) {
    window.showToast(type, message);
  }
};

function getSupabaseErrorMessage(error, fallback) {
  if (window.ApiHelpers?.formatSupabaseError) {
    return window.ApiHelpers.formatSupabaseError(error, fallback);
  }
  if (error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return fallback;
}

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
      validateField: () => true,
      validateGroup: () => true,
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

  const validateGroup = (keys) => {
    if (!Array.isArray(keys) || keys.length === 0) {
      return validateAll();
    }
    const values = collectValues();
    let allValid = true;
    let firstInvalid = null;
    for (const key of keys) {
      const config = schema[key];
      if (!config) continue;
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
    validateGroup,
    reset,
  };
}

function refreshElements() {
  const doc = document;
  const ordersTableElement = doc.getElementById("ordersTable");
  els = {
    filterRegion: doc.getElementById("filterRegion"),
    filterStatus: doc.getElementById("filterStatus"),
    filterCustomer: doc.getElementById("filterCustomer"),
    filterCustomerOrder: doc.getElementById("filterCustomerOrder"),
    filterQuery: doc.getElementById("filterQuery"),
    filterDate: doc.getElementById("filterDate"),
    btnApplyFilters: doc.getElementById("btnApplyFilters"),
    btnExportOrders: doc.getElementById("btnExportOrders"),
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
    articleCsvInput: doc.getElementById("articleCsvInput"),
    articleImportStatus: doc.getElementById("articleImportStatus"),
    articleImportPreview: doc.getElementById("articleImportPreview"),
    articleImportPreviewBody: doc.getElementById("articleImportPreviewBody"),
    btnApplyArticleImport: doc.getElementById("btnApplyArticleImport"),
    btnClearArticleImport: doc.getElementById("btnClearArticleImport"),
    btnCreate: doc.getElementById("btnCreate"),
    createStatus: doc.getElementById("createStatus"),
    wizardStepperItems: Array.from(doc.querySelectorAll('[data-stepper-step]')),
    wizardPanels: Array.from(doc.querySelectorAll('[data-order-step]')),
    wizardNextButtons: Array.from(doc.querySelectorAll('[data-action="wizard-next"]')),
    wizardPrevButtons: Array.from(doc.querySelectorAll('[data-action="wizard-prev"]')),
    wizardStatus: doc.getElementById("wizardStatus"),
    orderSummary: doc.getElementById("orderSummary"),
    orderSummaryArticles: doc.getElementById("orderSummaryArticles"),
    btnReload: doc.getElementById("btnReload"),
    ordersTableElement,
    ordersTable: ordersTableElement ? ordersTableElement.querySelector("tbody") : null,
    orderSortHeaders: ordersTableElement
      ? Array.from(ordersTableElement.querySelectorAll("thead th[data-sort]"))
      : [],
    orderSortToggles: ordersTableElement
      ? Array.from(ordersTableElement.querySelectorAll("thead th[data-sort] .table-sort-button"))
      : [],
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
    btnPrintOrder: doc.getElementById("btnPrintOrder"),
    btnSaveEdit: doc.getElementById("btnSaveEdit"),
    orderAuditLog: doc.getElementById("orderAuditLog"),
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

function getWizardPanels() {
  return Array.isArray(els.wizardPanels) ? els.wizardPanels : [];
}

function findWizardPanel(step) {
  return getWizardPanels().find((panel) => Number(panel?.getAttribute?.("data-order-step")) === step) || null;
}

function resetWizardStatus() {
  if (els.wizardStatus) {
    setStatus(els.wizardStatus, "");
  }
}

function updateWizardStepper(step) {
  if (!Array.isArray(els.wizardStepperItems)) {
    return;
  }
  for (const item of els.wizardStepperItems) {
    const itemStep = Number(item?.getAttribute?.("data-stepper-step"));
    const isCurrent = itemStep === step;
    const isComplete = Number.isFinite(itemStep) && itemStep < step;
    if (isCurrent) {
      item.setAttribute("aria-current", "step");
    } else {
      item.removeAttribute("aria-current");
    }
    item.classList.toggle("is-current", isCurrent);
    item.classList.toggle("is-complete", isComplete);
  }
}

function setWizardStep(step) {
  const panels = getWizardPanels();
  if (!panels.length) {
    ORDER_WIZARD_STATE.currentStep = 1;
    ORDER_WIZARD_STATE.totalSteps = 1;
    return;
  }
  const total = panels.length;
  ORDER_WIZARD_STATE.totalSteps = total;
  const targetStep = Math.min(Math.max(1, Number(step) || 1), total);
  ORDER_WIZARD_STATE.currentStep = targetStep;
  for (const panel of panels) {
    const panelStep = Number(panel.getAttribute("data-order-step"));
    const isActive = panelStep === targetStep;
    panel.classList.toggle("is-active", isActive);
    if (isActive) {
      panel.removeAttribute("hidden");
    } else {
      panel.setAttribute("hidden", "hidden");
    }
  }
  updateWizardStepper(targetStep);
  resetWizardStatus();
  if (targetStep === ORDER_WIZARD_STATE.totalSteps) {
    updateOrderSummary();
  }
  const activePanel = findWizardPanel(targetStep);
  if (activePanel) {
    const focusTarget = activePanel.querySelector(
      "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])"
    );
    if (focusTarget && typeof focusTarget.focus === "function") {
      focusTarget.focus({ preventScroll: false });
    }
  }
}

function goToWizardStep(step) {
  setWizardStep(step);
}

function validateWizardStep(step) {
  resetWizardStatus();
  if (ORDER_FORM_VALIDATOR && Array.isArray(ORDER_WIZARD_STEP_FIELDS[step]) && ORDER_WIZARD_STEP_FIELDS[step].length) {
    if (!ORDER_FORM_VALIDATOR.validateGroup(ORDER_WIZARD_STEP_FIELDS[step])) {
      if (els.wizardStatus) {
        setStatus(els.wizardStatus, "Controleer de gemarkeerde velden.", "error");
      }
      return false;
    }
  }
  if (step === 4) {
    const articleType = getArticleType();
    if (!articleType) {
      if (els.wizardStatus) {
        setStatus(els.wizardStatus, "Kies het artikeltype.", "error");
      }
      return false;
    }
    try {
      collectArticles(articleType);
    } catch (articleError) {
      if (els.wizardStatus) {
        setStatus(
          els.wizardStatus,
          articleError?.message || "Controleer de artikelen.",
          "error"
        );
      }
      return false;
    }
  }
  return true;
}

function goToNextWizardStep() {
  const current = ORDER_WIZARD_STATE.currentStep || 1;
  if (!validateWizardStep(current)) {
    return;
  }
  const nextStep = Math.min(current + 1, ORDER_WIZARD_STATE.totalSteps || current + 1);
  setWizardStep(nextStep);
}

function goToPreviousWizardStep() {
  const current = ORDER_WIZARD_STATE.currentStep || 1;
  const previousStep = Math.max(1, current - 1);
  setWizardStep(previousStep);
}

function findWizardStepWithErrors() {
  const panels = getWizardPanels();
  for (const panel of panels) {
    if (!panel) continue;
    const hasError = panel.querySelector(`.${VALIDATION_CLASSES.fieldInvalid}`);
    if (hasError) {
      const step = Number(panel.getAttribute("data-order-step"));
      if (Number.isFinite(step)) {
        return step;
      }
    }
  }
  return null;
}

function getSelectedArticleTypeLabel(articleType) {
  const selected = document.querySelector('input[name="articleType"]:checked');
  if (selected) {
    const label = selected.closest("label");
    if (label) {
      const text = label.textContent || "";
      if (text.trim()) {
        return text.trim();
      }
    }
  }
  if (articleType === "serial") {
    return "Serienummer gebonden artikel";
  }
  if (articleType === "non_serial") {
    return "Niet serienummer gebonden artikel";
  }
  return "Geen artikeltype geselecteerd";
}

function renderOrderSummaryArticles(articleType, articles) {
  if (!els.orderSummaryArticles) {
    return;
  }
  els.orderSummaryArticles.innerHTML = "";
  if (!articleType) {
    const message = document.createElement("p");
    message.className = "muted small";
    message.textContent = "Geen artikeltype geselecteerd.";
    els.orderSummaryArticles.appendChild(message);
    return;
  }
  if (!Array.isArray(articles) || articles.length === 0) {
    const message = document.createElement("p");
    message.className = "muted small";
    message.textContent = "Geen artikelen toegevoegd.";
    els.orderSummaryArticles.appendChild(message);
    return;
  }
  const table = document.createElement("table");
  table.className = "summary-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const productHeader = document.createElement("th");
  productHeader.textContent = "Artikel";
  headRow.appendChild(productHeader);
  if (articleType === "serial") {
    const serialHeader = document.createElement("th");
    serialHeader.textContent = "Serienummer";
    headRow.appendChild(serialHeader);
  } else {
    const quantityHeader = document.createElement("th");
    quantityHeader.textContent = "Aantal";
    headRow.appendChild(quantityHeader);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  for (const item of articles) {
    const row = document.createElement("tr");
    const productCell = document.createElement("td");
    productCell.textContent = item?.product || "-";
    row.appendChild(productCell);
    const secondCell = document.createElement("td");
    if (articleType === "serial") {
      secondCell.textContent = item?.serial_number || "-";
    } else {
      secondCell.textContent = Number.isFinite(item?.quantity) ? String(item.quantity) : "-";
    }
    row.appendChild(secondCell);
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  els.orderSummaryArticles.appendChild(table);
}

function setSummaryField(name, value) {
  if (!els.orderSummary) {
    return;
  }
  const target = els.orderSummary.querySelector(`[data-summary-field="${name}"]`);
  if (!target) {
    return;
  }
  target.textContent = value || "-";
}

function updateOrderSummary() {
  const requestReference = cleanText(els.oRequestReference?.value) || "-";
  const dueDate = formatDateDisplay(els.oDue?.value);
  const customerOrder = cleanText(els.oCustomerOrderNumber?.value) || "-";
  const customerName = cleanText(els.oCustomerName?.value) || "-";
  const customerNumber = cleanText(els.oCustomerNumber?.value) || "-";
  const orderReference = cleanText(els.oOrderReference?.value) || "-";
  const orderDescription = cleanText(els.oOrderDescription?.value) || "-";
  const orderContact = cleanText(els.oOrderContact?.value) || "-";
  const orderContactPhone = cleanText(els.oOrderContactPhone?.value) || "-";
  const orderContactEmail = cleanText(els.oOrderContactEmail?.value) || "-";
  const pickupConfirmed = els.oPickupConfirmed?.checked ? "Ja" : "Nee";
  const pickupDate = formatDateDisplay(els.oPickupDate?.value);
  const pickupSlot = buildTimeSlot(els.oPickupTimeFrom?.value, els.oPickupTimeTo?.value) || "-";
  const pickupContact = cleanText(els.oPickupContact?.value) || "-";
  const pickupPhone = cleanText(els.oPickupPhone?.value) || "-";
  const pickupLocation = cleanText(els.oPickupLocation?.value) || "-";
  const pickupInstructions = cleanText(els.oPickupInstructions?.value) || "-";
  const deliveryConfirmed = els.oDeliveryConfirmed?.checked ? "Ja" : "Nee";
  const deliveryDate = formatDateDisplay(els.oDeliveryDate?.value);
  const deliverySlot = buildTimeSlot(els.oDeliveryTimeFrom?.value, els.oDeliveryTimeTo?.value) || "-";
  const deliveryContact = cleanText(els.oDeliveryContact?.value) || "-";
  const deliveryPhone = cleanText(els.oDeliveryPhone?.value) || "-";
  const deliveryLocation = cleanText(els.oDeliveryLocation?.value) || "-";
  const deliveryInstructions = cleanText(els.oDeliveryInstructions?.value) || "-";
  const articleType = getArticleType();
  let articles = [];
  try {
    articles = articleType ? collectArticles(articleType) : [];
  } catch (error) {
    articles = [];
  }
  setSummaryField("request_reference", requestReference);
  setSummaryField("due_date", dueDate);
  setSummaryField("customer_order_number", customerOrder);
  setSummaryField("customer_name", customerName);
  setSummaryField("customer_number", customerNumber);
  setSummaryField("order_reference", orderReference);
  setSummaryField("order_description", orderDescription);
  setSummaryField("order_contact", orderContact);
  setSummaryField("order_contact_phone", orderContactPhone);
  setSummaryField("order_contact_email", orderContactEmail);
  setSummaryField("pickup_confirmed", pickupConfirmed);
  setSummaryField("pickup_date", pickupDate);
  setSummaryField("pickup_slot", pickupSlot);
  setSummaryField("pickup_contact", pickupContact);
  setSummaryField("pickup_phone", pickupPhone);
  setSummaryField("pickup_location", pickupLocation);
  setSummaryField("pickup_instructions", pickupInstructions);
  setSummaryField("delivery_confirmed", deliveryConfirmed);
  setSummaryField("delivery_date", deliveryDate);
  setSummaryField("delivery_slot", deliverySlot);
  setSummaryField("delivery_contact", deliveryContact);
  setSummaryField("delivery_phone", deliveryPhone);
  setSummaryField("delivery_location", deliveryLocation);
  setSummaryField("delivery_instructions", deliveryInstructions);
  setSummaryField("article_type", getSelectedArticleTypeLabel(articleType));
  renderOrderSummaryArticles(articleType, articles);
}

function resetOrderWizard() {
  ORDER_WIZARD_STATE.currentStep = 1;
  setWizardStep(1);
}

function setupOrderWizard() {
  ORDER_WIZARD_STATE.currentStep = 1;
  ORDER_WIZARD_STATE.totalSteps = getWizardPanels().length || 1;
  setWizardStep(1);
}

const STORAGE_KEYS = {
  trucks: "transport_trucks_v1",
  board: "transport_board_v1",
  lastReference: "transport_last_reference_v1",
  orderFilters: "transport_order_filters_v1",
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

const ORDER_WIZARD_STEP_FIELDS = {
  1: [
    "oRequestReference",
    "oDue",
    "oCustomerName",
    "oOrderReference",
    "oOrderDescription",
    "oOrderContact",
    "oOrderContactPhone",
    "oOrderContactEmail",
  ],
  2: [
    "oPickupDate",
    "oPickupTimeFrom",
    "oPickupTimeTo",
    "oPickupContact",
    "oPickupPhone",
    "oPickupLocation",
  ],
  3: [
    "oDeliveryDate",
    "oDeliveryTimeFrom",
    "oDeliveryTimeTo",
    "oDeliveryContact",
    "oDeliveryPhone",
    "oDeliveryLocation",
  ],
  4: [],
};

const ORDER_WIZARD_STATE = {
  currentStep: 1,
  totalSteps: 5,
};

let ORDER_FORM_VALIDATOR = null;

let ARTICLE_IMPORT_STATE = null;

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
let SUPABASE_REALTIME_CLIENT = null;
let ORDERS_REALTIME_CHANNEL = null;
let ORDERS_REALTIME_SUBSCRIBED = false;
let ORDERS_REALTIME_HANDLER_BOUND = false;
let ORDERS_REALTIME_REFRESH_TIMEOUT = null;
let ORDERS_SKELETON_TIMEOUT = null;
let ORDER_AUDIT_LOG_STATE = { token: 0, orderId: null };
let CURRENT_EDIT_ORDER = null;
let CURRENT_EDIT_ORDER_DETAILS = null;
let CURRENT_EDIT_ORDER_LINES = null;
let CURRENT_EDIT_LINES_LOADING = null;
const ORDERS_REALTIME_REFRESH_DELAY = 400;
const PAGINATION = {
  currentPage: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 1,
  currentPageCount: 0,
};
const ORDER_OWNERS = new Map();
let DRAG_CONTEXT = null;

const DEFAULT_ORDER_SORT_COLUMN = "due_date";
const ORDER_SORT_CONFIG = {
  due_date: { field: "due_date", defaultDirection: "asc", nulls: "last" },
  request_reference: { field: "request_reference", defaultDirection: "asc" },
  customer_name: { field: "customer_name", defaultDirection: "asc" },
  customer_order_number: { field: "customer_order_number", defaultDirection: "asc" },
  pickup_location: { field: "pickup_location", defaultDirection: "asc" },
  delivery_location: { field: "delivery_location", defaultDirection: "asc" },
  transport_type: { field: "transport_type", defaultDirection: "asc" },
  status: { field: "status", defaultDirection: "asc" },
  assigned_carrier: { field: "assigned_carrier", defaultDirection: "asc" },
  planned_date: { field: "planned_date", defaultDirection: "asc", nulls: "last" },
};

const ORDER_SORTING = {
  column: DEFAULT_ORDER_SORT_COLUMN,
  direction: ORDER_SORT_CONFIG[DEFAULT_ORDER_SORT_COLUMN]?.defaultDirection || "asc",
};

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

function captureOrderFilterState() {
  return {
    region: els.filterRegion?.value ?? "",
    status: els.filterStatus?.value ?? "",
    customer: els.filterCustomer?.value ?? "",
    customerOrder: els.filterCustomerOrder?.value ?? "",
    query: els.filterQuery?.value ?? "",
    date: els.filterDate?.value ?? "",
    pageSize: Number.isFinite(PAGINATION.pageSize) && PAGINATION.pageSize > 0
      ? PAGINATION.pageSize
      : undefined,
  };
}

function persistOrderFilters() {
  if (
    !els ||
    (!els.filterRegion &&
      !els.filterStatus &&
      !els.filterCustomer &&
      !els.filterCustomerOrder &&
      !els.filterQuery &&
      !els.filterDate &&
      !els.pagerPageSize)
  ) {
    return;
  }
  const state = captureOrderFilterState();
  storageSet(STORAGE_KEYS.orderFilters, state);
}

function restoreOrderFilters() {
  if (!els) {
    return;
  }
  const saved = storageGet(STORAGE_KEYS.orderFilters, null);
  if (!saved || typeof saved !== "object") {
    return;
  }
  const applyValue = (element, value) => {
    if (!element) return;
    const normalized = value === undefined || value === null ? "" : String(value);
    if (element.value === normalized) return;
    element.value = normalized;
    if (element.value !== normalized) {
      element.value = "";
    }
  };
  applyValue(els.filterRegion, saved.region);
  applyValue(els.filterStatus, saved.status);
  applyValue(els.filterCustomer, saved.customer);
  applyValue(els.filterCustomerOrder, saved.customerOrder);
  applyValue(els.filterQuery, saved.query);
  applyValue(els.filterDate, saved.date);
  const savedPageSize = Number(saved.pageSize);
  if (els.pagerPageSize && Number.isFinite(savedPageSize) && savedPageSize > 0) {
    const normalizedSize = Math.max(1, Math.floor(savedPageSize));
    const desired = String(normalizedSize);
    if (els.pagerPageSize.value !== desired) {
      els.pagerPageSize.value = desired;
    }
    if (els.pagerPageSize.value === desired) {
      PAGINATION.pageSize = normalizedSize;
    }
  }
}

function saveTrucks() {
  storageSet(STORAGE_KEYS.trucks, TRUCKS);
}

function savePlanBoard() {
  PLAN_BOARD = sanitizePlanBoard(PLAN_BOARD);
  storageSet(STORAGE_KEYS.board, PLAN_BOARD);
}

function getSupabaseRealtimeClient() {
  if (SUPABASE_REALTIME_CLIENT) {
    return SUPABASE_REALTIME_CLIENT;
  }
  const config = window.APP_CONFIG || {};
  const restUrl = config.SUPABASE_URL || "";
  const anonKey = config.SUPABASE_ANON_KEY || "";
  if (!restUrl || !anonKey) {
    return null;
  }
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    return null;
  }
  let clientUrl = restUrl.replace(/\/rest\/v1\/?$/, "");
  if (!clientUrl) {
    clientUrl = restUrl;
  }
  clientUrl = clientUrl.replace(/\/$/, "");
  try {
    SUPABASE_REALTIME_CLIENT = window.supabase.createClient(clientUrl, anonKey, {
      auth: { persistSession: false },
    });
  } catch (error) {
    console.warn("Supabase realtime client kon niet worden aangemaakt", error);
    SUPABASE_REALTIME_CLIENT = null;
  }
  return SUPABASE_REALTIME_CLIENT;
}

function ensureOrdersRealtimeSubscription() {
  const client = getSupabaseRealtimeClient();
  if (!client) {
    return null;
  }
  if (
    !ORDERS_REALTIME_CHANNEL ||
    ORDERS_REALTIME_CHANNEL.state === "closed" ||
    ORDERS_REALTIME_CHANNEL.state === "errored"
  ) {
    ORDERS_REALTIME_CHANNEL = client.channel("transport-orders-planning");
    ORDERS_REALTIME_HANDLER_BOUND = false;
    ORDERS_REALTIME_SUBSCRIBED = false;
  }
  if (ORDERS_REALTIME_CHANNEL && !ORDERS_REALTIME_HANDLER_BOUND) {
    ORDERS_REALTIME_CHANNEL.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "transport_orders" },
      (payload) => handleOrdersRealtimeChange(payload)
    );
    ORDERS_REALTIME_HANDLER_BOUND = true;
  }
  if (ORDERS_REALTIME_CHANNEL) {
    const state = ORDERS_REALTIME_CHANNEL.state;
    if (!ORDERS_REALTIME_SUBSCRIBED && state !== "joining" && state !== "joined") {
      ORDERS_REALTIME_CHANNEL
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            ORDERS_REALTIME_SUBSCRIBED = true;
          } else if (status === "CHANNEL_ERROR" || status === "CLOSED") {
            ORDERS_REALTIME_SUBSCRIBED = false;
            ORDERS_REALTIME_CHANNEL = null;
            ORDERS_REALTIME_HANDLER_BOUND = false;
            setTimeout(() => ensureOrdersRealtimeSubscription(), 2000);
          } else if (status === "TIMED_OUT") {
            ORDERS_REALTIME_SUBSCRIBED = false;
            ORDERS_REALTIME_CHANNEL = null;
            ORDERS_REALTIME_HANDLER_BOUND = false;
            setTimeout(() => ensureOrdersRealtimeSubscription(), 2000);
          }
        })
        .catch((error) => {
          console.warn("Realtime kanaal kon niet worden gestart", error);
        });
    }
  }
  return ORDERS_REALTIME_CHANNEL;
}

function handleOrdersRealtimeChange(payload) {
  if (!isRelevantOrdersRealtimeChange(payload)) {
    return;
  }
  scheduleOrdersRealtimeRefresh();
}

function isRelevantOrdersRealtimeChange(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const eventType = payload.eventType || payload.type;
  if (eventType === "INSERT" || eventType === "DELETE") {
    return true;
  }
  if (eventType === "UPDATE") {
    const newRow = payload.new || {};
    const oldRow = payload.old || {};
    const fields = [
      "status",
      "assigned_carrier",
      "planned_date",
      "planned_slot",
      "due_date",
      "region",
      "updated_at",
    ];
    return fields.some((field) => {
      const nextValue = newRow && Object.prototype.hasOwnProperty.call(newRow, field)
        ? newRow[field]
        : null;
      const prevValue = oldRow && Object.prototype.hasOwnProperty.call(oldRow, field)
        ? oldRow[field]
        : null;
      return nextValue !== prevValue;
    });
  }
  return false;
}

function scheduleOrdersRealtimeRefresh() {
  if (ORDERS_REALTIME_REFRESH_TIMEOUT) {
    clearTimeout(ORDERS_REALTIME_REFRESH_TIMEOUT);
  }
  ORDERS_REALTIME_REFRESH_TIMEOUT = setTimeout(() => {
    ORDERS_REALTIME_REFRESH_TIMEOUT = null;
    Promise.resolve(loadOrders()).catch((error) => {
      console.error("Realtime bijwerken van orders mislukt", error);
    });
  }, ORDERS_REALTIME_REFRESH_DELAY);
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

function prepareOrdersLoadingState() {
  if (!els.ordersTable) {
    return;
  }
  stopOrdersSkeleton();
  const table = els.ordersTableElement
    || (typeof els.ordersTable.closest === "function" ? els.ordersTable.closest("table") : null);
  if (table && typeof table.setAttribute === "function") {
    table.setAttribute("aria-busy", "true");
  }
  els.ordersTable.innerHTML = "";
  ORDERS_SKELETON_TIMEOUT = window.setTimeout(() => {
    renderOrdersSkeleton();
  }, 250);
}

function stopOrdersSkeleton() {
  if (ORDERS_SKELETON_TIMEOUT) {
    window.clearTimeout(ORDERS_SKELETON_TIMEOUT);
    ORDERS_SKELETON_TIMEOUT = null;
  }
  const table = els.ordersTableElement
    || (els.ordersTable && typeof els.ordersTable.closest === "function" ? els.ordersTable.closest("table") : null);
  if (table && typeof table.removeAttribute === "function") {
    table.removeAttribute("aria-busy");
  }
}

function renderOrdersSkeleton() {
  if (!els.ordersTable) {
    return;
  }
  ORDERS_SKELETON_TIMEOUT = null;
  const table = els.ordersTableElement
    || (typeof els.ordersTable.closest === "function" ? els.ordersTable.closest("table") : null);
  const columns = Math.max(table ? table.querySelectorAll("thead th").length : 1, 1);
  const columnWidths = [
    "45%",
    "55%",
    "40%",
    "50%",
    "60%",
    "50%",
    "45%",
    "35%",
    "40%",
    "35%",
  ];
  const rowCount = 4;
  els.ordersTable.innerHTML = "";
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const tr = document.createElement("tr");
    tr.className = "orders-table-skeleton-row";
    tr.setAttribute("aria-hidden", "true");
    for (let colIndex = 0; colIndex < columns; colIndex += 1) {
      const td = document.createElement("td");
      td.className = "orders-table-skeleton-cell";
      const span = document.createElement("span");
      span.className = "orders-table-skeleton-shimmer";
      span.style.width = columnWidths[colIndex] || "55%";
      td.appendChild(span);
      tr.appendChild(td);
    }
    els.ordersTable.appendChild(tr);
  }
}

function renderOrdersPlaceholder(message, className = "muted") {
  const tbody = els.ordersTable;
  if (!tbody) return;
  const table = els.ordersTableElement
    || (typeof tbody.closest === "function" ? tbody.closest("table") : null);
  const columns = table ? table.querySelectorAll("thead th").length : 1;
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = columns || 1;
  td.className = className;
  if (message instanceof Node) {
    td.appendChild(message);
  } else if (message !== undefined && message !== null) {
    td.textContent = message;
  }
  tr.appendChild(td);
  tbody.innerHTML = "";
  tbody.appendChild(tr);
}

function renderOrdersEmptyState() {
  const container = document.createElement("div");
  container.className = "orders-empty-state";
  const title = document.createElement("p");
  title.className = "orders-empty-state__title";
  title.textContent = "Geen orders gevonden";
  const description = document.createElement("p");
  description.className = "orders-empty-state__description";
  description.textContent = "Start een nieuwe aanvraag om je eerste order vast te leggen.";
  const action = document.createElement("a");
  action.className = "btn primary";
  action.href = "aanvraag.html";
  action.setAttribute("data-route", "aanvraag");
  action.textContent = "Nieuwe aanvraag";
  container.append(title, description, action);
  renderOrdersPlaceholder(container, "orders-empty-state-cell");
}

function cleanText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function escapeHtml(value) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMultiline(value) {
  const text = cleanText(value);
  if (!text) return "";
  return escapeHtml(text).replace(/\n/g, "<br />");
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

const QR_CONSTANTS = {
  version: 1,
  size: 21,
  dataCodewords: 19,
  ecCodewords: 7,
  capacityBits: 152,
  maskPattern: 0,
  errorLevel: "L",
};

const QR_GALOIS_EXP = new Array(512).fill(0);
const QR_GALOIS_LOG = new Array(256).fill(0);
let QR_FIELDS_INITIALIZED = false;
const QR_GENERATOR_CACHE = new Map();

function ensureQrFieldsInitialized() {
  if (QR_FIELDS_INITIALIZED) return;
  let value = 1;
  for (let i = 0; i < 255; i += 1) {
    QR_GALOIS_EXP[i] = value;
    QR_GALOIS_LOG[value] = i;
    value <<= 1;
    if (value & 0x100) {
      value ^= 0x11d;
    }
  }
  for (let i = 255; i < QR_GALOIS_EXP.length; i += 1) {
    QR_GALOIS_EXP[i] = QR_GALOIS_EXP[i - 255];
  }
  QR_FIELDS_INITIALIZED = true;
}

function qrGfMul(a, b) {
  if (!a || !b) return 0;
  ensureQrFieldsInitialized();
  const logSum = QR_GALOIS_LOG[a] + QR_GALOIS_LOG[b];
  return QR_GALOIS_EXP[logSum % 255];
}

function multiplyQrPolynomials(a, b) {
  const result = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      result[i + j] ^= qrGfMul(a[i], b[j]);
    }
  }
  return result;
}

function getQrGeneratorPolynomial(degree) {
  if (QR_GENERATOR_CACHE.has(degree)) {
    return QR_GENERATOR_CACHE.get(degree);
  }
  ensureQrFieldsInitialized();
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    poly = multiplyQrPolynomials(poly, [1, QR_GALOIS_EXP[i]]);
  }
  QR_GENERATOR_CACHE.set(degree, poly);
  return poly;
}

function computeQrErrorCorrection(dataCodewords, degree) {
  const generator = getQrGeneratorPolynomial(degree);
  const buffer = dataCodewords.slice();
  buffer.push(...new Array(degree).fill(0));
  for (let i = 0; i < dataCodewords.length; i += 1) {
    const factor = buffer[i];
    if (factor === 0) continue;
    for (let j = 0; j < generator.length; j += 1) {
      buffer[i + j] ^= qrGfMul(generator[j], factor);
    }
  }
  return buffer.slice(dataCodewords.length);
}

function qrPushBits(target, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) {
    target.push((value >> i) & 1);
  }
}

function buildQrDataCodewords(bytes) {
  const bits = [];
  const length = Math.min(bytes.length, 17);
  qrPushBits(bits, 0b0100, 4);
  qrPushBits(bits, length, 8);
  for (let i = 0; i < length; i += 1) {
    qrPushBits(bits, bytes[i], 8);
  }
  const remaining = QR_CONSTANTS.capacityBits - bits.length;
  if (remaining > 0) {
    qrPushBits(bits, 0, Math.min(4, remaining));
  }
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) {
      byte = (byte << 1) | bits[i + j];
    }
    codewords.push(byte);
  }
  const PAD_BYTES = [0xec, 0x11];
  let padIndex = 0;
  while (codewords.length < QR_CONSTANTS.dataCodewords) {
    codewords.push(PAD_BYTES[padIndex % PAD_BYTES.length]);
    padIndex += 1;
  }
  return codewords;
}

function createEmptyQrMatrix(size) {
  const matrix = new Array(size);
  for (let row = 0; row < size; row += 1) {
    matrix[row] = new Array(size).fill(null);
  }
  return matrix;
}

function placeFinderPattern(matrix, row, col) {
  for (let r = 0; r < 7; r += 1) {
    for (let c = 0; c < 7; c += 1) {
      const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
      const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      matrix[row + r][col + c] = isBorder || isInner;
    }
  }
}

function placeFinderSeparators(matrix, row, col) {
  for (let offset = -1; offset <= 7; offset += 1) {
    const rTop = row - 1;
    const rBottom = row + 7;
    const cLeft = col - 1;
    const cRight = col + 7;
    if (matrix[rTop] && matrix[rTop][col + offset] === null) {
      matrix[rTop][col + offset] = false;
    }
    if (matrix[rBottom] && matrix[rBottom][col + offset] === null) {
      matrix[rBottom][col + offset] = false;
    }
    if (matrix[row + offset] && matrix[row + offset][cLeft] === null) {
      matrix[row + offset][cLeft] = false;
    }
    if (matrix[row + offset] && matrix[row + offset][cRight] === null) {
      matrix[row + offset][cRight] = false;
    }
  }
}

function placeTimingPatterns(matrix) {
  const size = matrix.length;
  for (let i = 0; i < size; i += 1) {
    if (matrix[6][i] === null) {
      matrix[6][i] = i % 2 === 0;
    }
    if (matrix[i][6] === null) {
      matrix[i][6] = i % 2 === 0;
    }
  }
}

function setQrModule(matrix, row, col, value) {
  if (row < 0 || col < 0 || row >= matrix.length || col >= matrix.length) return;
  matrix[row][col] = value;
}

function getQrFormatBits(level, maskPattern) {
  const levelBitsMap = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };
  const levelBits = levelBitsMap[level] ?? levelBitsMap.L;
  const data = ((levelBits << 3) | (maskPattern & 0x07)) & 0x1f;
  let bits = data << 10;
  const generator = 0b10100110111;
  for (let i = 14; i >= 10; i -= 1) {
    if (((bits >> i) & 1) === 0) continue;
    bits ^= generator << (i - 10);
  }
  const formatInfo = ((data << 10) | bits) ^ 0b101010000010010;
  return formatInfo & 0x7fff;
}

function placeFormatInformation(matrix, level, maskPattern) {
  const size = matrix.length;
  const bits = getQrFormatBits(level, maskPattern);
  const positionsA = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8],
  ];
  const positionsB = [
    [size - 1, 8],
    [size - 2, 8],
    [size - 3, 8],
    [size - 4, 8],
    [size - 5, 8],
    [size - 6, 8],
    [size - 7, 8],
    [8, size - 8],
    [8, size - 7],
    [8, size - 6],
    [8, size - 5],
    [8, size - 4],
    [8, size - 3],
    [8, size - 2],
    [8, size - 1],
  ];
  for (let i = 0; i < 15; i += 1) {
    const bit = ((bits >> (14 - i)) & 1) === 1;
    const [r1, c1] = positionsA[i];
    const [r2, c2] = positionsB[i];
    setQrModule(matrix, r1, c1, bit);
    setQrModule(matrix, r2, c2, bit);
  }
}

function maskBit(maskPattern, row, col) {
  if (maskPattern === 0) {
    return (row + col) % 2 === 0;
  }
  return false;
}

function placeQrData(matrix, dataBits, maskPattern) {
  const size = matrix.length;
  let bitIndex = 0;
  let upward = true;
  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let rowOffset = 0; rowOffset < size; rowOffset += 1) {
      const row = upward ? size - 1 - rowOffset : rowOffset;
      for (let c = col; c >= col - 1; c -= 1) {
        if (c < 0) continue;
        if (matrix[row][c] !== null) continue;
        const bit = bitIndex < dataBits.length ? dataBits[bitIndex] : 0;
        bitIndex += 1;
        const masked = maskBit(maskPattern, row, c) ? bit ^ 1 : bit;
        matrix[row][c] = masked === 1;
      }
    }
    upward = !upward;
  }
}

function buildQrMatrix(bytes) {
  const codewords = buildQrDataCodewords(bytes);
  const ecCodewords = computeQrErrorCorrection(codewords, QR_CONSTANTS.ecCodewords);
  const fullCodewords = codewords.concat(ecCodewords);
  const dataBits = [];
  for (const byte of fullCodewords) {
    for (let bit = 7; bit >= 0; bit -= 1) {
      dataBits.push((byte >> bit) & 1);
    }
  }
  const matrix = createEmptyQrMatrix(QR_CONSTANTS.size);
  placeFinderPattern(matrix, 0, 0);
  placeFinderPattern(matrix, 0, QR_CONSTANTS.size - 7);
  placeFinderPattern(matrix, QR_CONSTANTS.size - 7, 0);
  placeFinderSeparators(matrix, 0, 0);
  placeFinderSeparators(matrix, 0, QR_CONSTANTS.size - 7);
  placeFinderSeparators(matrix, QR_CONSTANTS.size - 7, 0);
  placeTimingPatterns(matrix);
  setQrModule(matrix, 4 * QR_CONSTANTS.version + 9, 8, true);
  placeFormatInformation(matrix, QR_CONSTANTS.errorLevel, QR_CONSTANTS.maskPattern);
  placeQrData(matrix, dataBits, QR_CONSTANTS.maskPattern);
  return matrix;
}

function renderQrMatrixAsSvg(matrix, options = {}) {
  if (!matrix || !matrix.length) return "";
  const moduleSize = Number.isFinite(options.moduleSize) && options.moduleSize > 0 ? options.moduleSize : 4;
  const margin = Number.isFinite(options.margin) && options.margin >= 0 ? options.margin : 4;
  const size = matrix.length;
  const total = (size + margin * 2) * moduleSize;
  let content = "";
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!matrix[row][col]) continue;
      const x = (col + margin) * moduleSize;
      const y = (row + margin) * moduleSize;
      content += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" />`;
    }
  }
  const viewBox = `0 0 ${total} ${total}`;
  const safeContent = content ? `<g fill="#111">${content}</g>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="QR-code"><rect width="100%" height="100%" fill="#fff"/>${safeContent}</svg>`;
}

function generateQrSvg(value, options = {}) {
  const textValue = value === undefined || value === null ? "" : String(value);
  if (!textValue) {
    return "";
  }
  const bytes = [];
  for (let i = 0; i < textValue.length && bytes.length < 17; i += 1) {
    bytes.push(textValue.charCodeAt(i) & 0xff);
  }
  try {
    const matrix = buildQrMatrix(bytes);
    return renderQrMatrixAsSvg(matrix, options);
  } catch (error) {
    console.warn("Kan QR-code niet genereren", error);
    return "";
  }
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

function normalizeOrderLine(line) {
  if (!line || typeof line !== "object") {
    return null;
  }
  const id = Number.isFinite(Number(line.id)) ? Number(line.id) : null;
  const product = cleanText(line.product ?? line.description ?? line.name);
  const serialNumber = cleanText(line.serial_number ?? line.serialNumber);
  const rawQuantity = Number(line.quantity);
  const quantity = Number.isFinite(rawQuantity) ? rawQuantity : null;
  const articleType = cleanText(line.article_type ?? line.articleType);
  if (!product && !serialNumber && quantity === null) {
    return null;
  }
  return {
    id,
    product: product || null,
    quantity,
    serialNumber: serialNumber || null,
    articleType: articleType || null,
  };
}

async function loadOrderLines(orderId) {
  const numericId = Number(orderId);
  if (!Number.isFinite(numericId)) {
    return [];
  }
  if (!window.Lines || typeof window.Lines.listByOrder !== "function") {
    return [];
  }
  try {
    const rows = await window.Lines.listByOrder(numericId);
    if (!Array.isArray(rows)) {
      return [];
    }
    const normalized = rows.map(normalizeOrderLine).filter(Boolean);
    normalized.sort((a, b) => {
      if (a.id !== null && b.id !== null && a.id !== b.id) {
        return a.id - b.id;
      }
      return 0;
    });
    return normalized;
  } catch (error) {
    console.warn("Kan orderregels niet laden", error);
    return [];
  }
}

function formatPrintDate(value) {
  if (!value) return null;
  const formatted = formatDateDisplay(value);
  if (formatted && formatted !== "-") {
    return formatted;
  }
  const text = cleanText(value);
  return text || null;
}

function buildOrderPrintDocument(order, details, lines = []) {
  const safeOrder = order || {};
  const safeDetails = details || parseOrderDetails(order);
  const safeLines = Array.isArray(lines) ? lines : [];
  const placeholder = '<span class="print-bon__muted">-</span>';
  const orderIdText = safeOrder.id === 0 || Number.isFinite(Number(safeOrder.id))
    ? String(safeOrder.id)
    : cleanText(safeOrder.id) || "-";
  const referenceLabel =
    cleanText(safeDetails.reference) ||
    cleanText(safeOrder.request_reference) ||
    `Order #${orderIdText}`;
  const customerLabel = cleanText(safeOrder.customer_name);
  const statusLabel = cleanText(safeOrder.status);
  const carrierLabel = cleanText(safeOrder.assigned_carrier);
  const plannedLabel = joinNonEmpty([
    formatPrintDate(safeOrder.planned_date),
    cleanText(safeOrder.planned_slot),
  ], " • ");
  const deliveryLabel = joinNonEmpty([
    formatPrintDate(safeOrder.due_date || safeDetails.delivery?.date),
    cleanText(safeDetails.delivery?.slot),
  ], " • ");
  const orderContactParts = [];
  if (safeDetails.contactName) orderContactParts.push(safeDetails.contactName);
  if (safeDetails.contactPhone) orderContactParts.push(safeDetails.contactPhone);
  if (safeDetails.contactEmail) orderContactParts.push(safeDetails.contactEmail);
  const orderContact = orderContactParts.join("\n");

  const pickupContactParts = [];
  if (safeDetails.pickup?.contact) pickupContactParts.push(safeDetails.pickup.contact);
  if (safeDetails.pickup?.phone) pickupContactParts.push(safeDetails.pickup.phone);
  const deliveryContactParts = [];
  if (safeDetails.delivery?.contact) deliveryContactParts.push(safeDetails.delivery.contact);
  if (safeDetails.delivery?.phone) deliveryContactParts.push(safeDetails.delivery.phone);

  const formatValue = (value) => {
    const text = cleanText(value);
    return text ? escapeHtml(text) : placeholder;
  };
  const formatMultilineValue = (value) => {
    const rendered = formatMultiline(value);
    return rendered ? rendered : placeholder;
  };
  const formatTiming = (dateValue, slotValue) => {
    const timing = joinNonEmpty([formatPrintDate(dateValue), cleanText(slotValue)], " • ");
    return timing ? escapeHtml(timing) : placeholder;
  };

  const pickupSection = {
    location: formatValue(safeDetails.pickup?.location),
    timing: formatTiming(
      safeDetails.pickup?.date,
      safeDetails.pickup?.slot || buildTimeSlot(safeDetails.pickup?.time_from, safeDetails.pickup?.time_to)
    ),
    contact: formatValue(pickupContactParts.join(" • ")),
    instructions: formatMultilineValue(safeDetails.pickup?.instructions),
  };
  const deliverySection = {
    location: formatValue(safeDetails.delivery?.location),
    timing: formatTiming(
      safeDetails.delivery?.date,
      safeDetails.delivery?.slot || buildTimeSlot(safeDetails.delivery?.time_from, safeDetails.delivery?.time_to)
    ),
    contact: formatValue(deliveryContactParts.join(" • ")),
    instructions: formatMultilineValue(safeDetails.delivery?.instructions),
  };

  const articlesRows = safeLines.length
    ? safeLines
        .map((line, index) => {
          const product = formatValue(line.product);
          const quantity = line.quantity !== null && line.quantity !== undefined
            ? escapeHtml(String(line.quantity))
            : placeholder;
          const serial = line.serialNumber ? escapeHtml(line.serialNumber) : placeholder;
          return `<tr><td>${escapeHtml(String(index + 1))}</td><td>${product}</td><td class="print-bon__table--number">${quantity}</td><td>${serial}</td></tr>`;
        })
        .join("")
    : `<tr class="print-bon__table-empty"><td colspan="4">Geen artikelen geregistreerd.</td></tr>`;

  const qrMarkup = generateQrSvg(orderIdText, { moduleSize: 4, margin: 4 }) || `<div class="print-bon__qr-placeholder">QR niet beschikbaar</div>`;
  const generatedAt = formatDateTimeDisplay ? formatDateTimeDisplay(new Date().toISOString()) : new Date().toLocaleString();

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <title>Transportbon ${escapeHtml(referenceLabel)}</title>
  <style>
    :root { color-scheme: only light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif;
      background: #f5f5f5;
      color: #1a1a1a;
    }
    .print-bon__page {
      width: 210mm;
      max-width: 100%;
      margin: 0 auto;
      padding: 18mm 16mm 14mm;
      background: #fff;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      gap: 12mm;
    }
    h1 {
      margin: 0;
      font-size: 26px;
      letter-spacing: 0.02em;
    }
    h2 {
      margin: 0 0 6mm;
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #555;
    }
    p {
      margin: 0;
      line-height: 1.5;
    }
    dl { margin: 0; }
    .print-bon__muted { color: #7a7a7a; }
    .print-bon__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16mm;
      border-bottom: 3px solid #e2001a;
      padding-bottom: 10mm;
    }
    .print-bon__meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(40mm, 1fr));
      gap: 3mm 10mm;
      margin-top: 6mm;
      font-size: 12px;
    }
    .print-bon__meta-item dt {
      font-weight: 600;
      margin-bottom: 2px;
      color: #444;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 11px;
    }
    .print-bon__meta-item dd {
      margin: 0;
      font-size: 12px;
      white-space: pre-line;
    }
    .print-bon__qr svg {
      display: block;
      width: 42mm;
      height: 42mm;
    }
    .print-bon__qr-placeholder {
      width: 42mm;
      height: 42mm;
      border: 1px dashed #bbb;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      color: #888;
      text-align: center;
      padding: 4mm;
    }
    .print-bon__columns {
      display: grid;
      gap: 12mm;
      grid-template-columns: repeat(auto-fit, minmax(80mm, 1fr));
    }
    .print-bon__section {
      flex: 1;
    }
    .print-bon__details {
      display: grid;
      gap: 4mm;
      font-size: 12px;
    }
    .print-bon__details dt {
      font-weight: 600;
      margin-bottom: 1mm;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-size: 11px;
    }
    .print-bon__details dd {
      margin: 0;
      min-height: 14px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #d0d0d0;
      padding: 3mm;
      text-align: left;
    }
    th {
      background: #f2f2f2;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 11px;
      color: #555;
    }
    .print-bon__table--number {
      text-align: right;
      width: 22mm;
    }
    .print-bon__table-empty td {
      text-align: center;
      font-style: italic;
      color: #777;
    }
    .print-bon__footer {
      margin-top: auto;
      font-size: 11px;
      color: #666;
      border-top: 1px solid #ddd;
      padding-top: 4mm;
    }
    .print-bon__actions {
      display: flex;
      gap: 6mm;
      justify-content: flex-end;
    }
    .print-bon__actions button {
      padding: 6px 14px;
      font-size: 13px;
      border-radius: 4px;
      border: 1px solid #bbb;
      background: #f8f8f8;
      cursor: pointer;
    }
    .print-bon__actions button.primary {
      border-color: #e2001a;
      background: #e2001a;
      color: #fff;
    }
    @media print {
      body { background: #fff; }
      .print-bon__page {
        width: auto;
        padding: 0;
        gap: 10mm;
      }
      .print-bon__header { padding-bottom: 8mm; }
      .no-print { display: none !important; }
    }
    @page {
      size: A4;
      margin: 12mm;
    }
  </style>
</head>
<body class="print-bon">
  <div class="print-bon__page">
    <header class="print-bon__header">
      <div>
        <h1>Transportbon</h1>
        <p>${formatValue(referenceLabel)}</p>
        <dl class="print-bon__meta">
          <div class="print-bon__meta-item"><dt>Order-ID</dt><dd>${formatValue(orderIdText)}</dd></div>
          <div class="print-bon__meta-item"><dt>Klant</dt><dd>${formatValue(customerLabel)}</dd></div>
          <div class="print-bon__meta-item"><dt>Status</dt><dd>${formatValue(statusLabel)}</dd></div>
          <div class="print-bon__meta-item"><dt>Gepland</dt><dd>${plannedLabel ? escapeHtml(plannedLabel) : placeholder}</dd></div>
          <div class="print-bon__meta-item"><dt>Leverdatum</dt><dd>${deliveryLabel ? escapeHtml(deliveryLabel) : placeholder}</dd></div>
          <div class="print-bon__meta-item"><dt>Carrier</dt><dd>${formatValue(carrierLabel)}</dd></div>
          <div class="print-bon__meta-item"><dt>Contact</dt><dd>${formatMultilineValue(orderContact)}</dd></div>
        </dl>
      </div>
      <div class="print-bon__qr">${qrMarkup}</div>
    </header>
    <section class="print-bon__columns">
      <section class="print-bon__section">
        <h2>Laadadres</h2>
        <dl class="print-bon__details">
          <div><dt>Adres</dt><dd>${pickupSection.location}</dd></div>
          <div><dt>Datum &amp; tijd</dt><dd>${pickupSection.timing}</dd></div>
          <div><dt>Contact</dt><dd>${pickupSection.contact}</dd></div>
          <div><dt>Instructies</dt><dd>${pickupSection.instructions}</dd></div>
        </dl>
      </section>
      <section class="print-bon__section">
        <h2>Losadres</h2>
        <dl class="print-bon__details">
          <div><dt>Adres</dt><dd>${deliverySection.location}</dd></div>
          <div><dt>Datum &amp; tijd</dt><dd>${deliverySection.timing}</dd></div>
          <div><dt>Contact</dt><dd>${deliverySection.contact}</dd></div>
          <div><dt>Instructies</dt><dd>${deliverySection.instructions}</dd></div>
        </dl>
      </section>
    </section>
    <section class="print-bon__section">
      <h2>Artikelen</h2>
      <table class="print-bon__table">
        <thead>
          <tr><th>#</th><th>Omschrijving</th><th class="print-bon__table--number">Aantal</th><th>Serienummer</th></tr>
        </thead>
        <tbody>${articlesRows}</tbody>
      </table>
    </section>
    <section class="print-bon__section">
      <h2>Opmerkingen</h2>
      <p>${formatMultilineValue(safeDetails.instructions)}</p>
    </section>
    <footer class="print-bon__footer">
      <p>Gegenereerd op ${formatValue(generatedAt)} • Order-ID ${formatValue(orderIdText)}</p>
    </footer>
    <div class="print-bon__actions no-print">
      <button type="button" class="primary" onclick="window.print()">Printen</button>
      <button type="button" onclick="window.close()">Sluiten</button>
    </div>
  </div>
  <script>
    window.addEventListener('load', function () {
      window.focus();
      setTimeout(function () { window.print(); }, 300);
    });
  </script>
</body>
</html>`;
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

async function fetchAllOrderPages(filters, firstPageResult, sortDescriptors) {
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
    const next = await Orders.list(filters, { page, pageSize, sort: sortDescriptors });
    if (Array.isArray(next?.rows)) {
      allRows.push(...next.rows);
    }
    if (allRows.length >= total) {
      break;
    }
  }
  return allRows;
}

function getOrderSortConfig(column) {
  if (!column) return null;
  return ORDER_SORT_CONFIG[column] || null;
}

function getOrderSortDescriptors() {
  const descriptors = [];
  const activeConfig = getOrderSortConfig(ORDER_SORTING.column) || getOrderSortConfig(DEFAULT_ORDER_SORT_COLUMN);
  if (activeConfig) {
    descriptors.push({
      field: activeConfig.field,
      direction: ORDER_SORTING.direction === "desc" ? "desc" : "asc",
      nulls: activeConfig.nulls,
    });
  }
  if (!descriptors.some((descriptor) => descriptor.field === "due_date")) {
    descriptors.push({ field: "due_date", direction: "asc", nulls: "last" });
  }
  if (!descriptors.some((descriptor) => descriptor.field === "id")) {
    descriptors.push({ field: "id", direction: "asc" });
  }
  return descriptors;
}

function updateSortIndicators() {
  if (!Array.isArray(els.orderSortHeaders)) {
    return;
  }
  const activeColumn = ORDER_SORTING.column;
  const direction = ORDER_SORTING.direction === "desc" ? "desc" : "asc";
  for (const header of els.orderSortHeaders) {
    if (!header || !header.dataset) continue;
    const sortKey = header.dataset.sort;
    const isActive = sortKey === activeColumn;
    header.classList.toggle("is-sorted", isActive);
    header.classList.toggle("is-sorted-asc", isActive && direction === "asc");
    header.classList.toggle("is-sorted-desc", isActive && direction === "desc");
    if (isActive) {
      header.setAttribute("aria-sort", direction === "desc" ? "descending" : "ascending");
    } else {
      header.removeAttribute("aria-sort");
    }
  }
  if (els.ordersTableElement) {
    els.ordersTableElement.setAttribute("data-sort-column", activeColumn || "");
    els.ordersTableElement.setAttribute("data-sort-direction", direction);
  }
  if (Array.isArray(els.orderSortToggles)) {
    for (const button of els.orderSortToggles) {
      const header = typeof button?.closest === "function" ? button.closest("th[data-sort]") : null;
      if (!header) continue;
      const sortKey = header.dataset.sort;
      const nextDirection =
        sortKey === activeColumn && direction === "asc"
          ? "desc"
          : getOrderSortConfig(sortKey)?.defaultDirection || "asc";
      const label = header.textContent?.trim() || "Kolom";
      button.setAttribute("aria-label", `Sorteer ${label} (${nextDirection === "desc" ? "aflopend" : "oplopend"})`);
    }
  }
}

function setOrderSort(column) {
  if (!column) return;
  const config = getOrderSortConfig(column);
  if (!config) return;
  if (ORDER_SORTING.column === column) {
    ORDER_SORTING.direction = ORDER_SORTING.direction === "asc" ? "desc" : "asc";
  } else {
    ORDER_SORTING.column = column;
    ORDER_SORTING.direction = config.defaultDirection || "asc";
  }
  PAGINATION.currentPage = 1;
  updateSortIndicators();
  loadOrders({ page: 1 });
}

async function loadOrders(options = {}) {
  if (options && typeof options.preventDefault === "function") {
    options.preventDefault();
    options = {};
  }
  const requestedPageSize = Number(options.pageSize);
  if (Number.isFinite(requestedPageSize) && requestedPageSize > 0) {
    PAGINATION.pageSize = Math.max(1, Math.floor(requestedPageSize));
  }
  const requestedPage = Number(options.page);
  if (Number.isFinite(requestedPage) && requestedPage >= 1) {
    PAGINATION.currentPage = Math.max(1, Math.floor(requestedPage));
  }

  persistOrderFilters();

  const usePagination = Boolean(els.ordersTable && els.pager);

  const currentUser = getCurrentUser();
  const listFilters = {
    region: els.filterRegion?.value || undefined,
    status: els.filterStatus?.value || undefined,
  };
  const customerValue = cleanText(els.filterCustomer?.value);
  const customerOrderValue = cleanText(els.filterCustomerOrder?.value);
  const queryValue = cleanText(els.filterQuery?.value);
  const dateValue = els.filterDate?.value || undefined;
  if (customerValue) {
    listFilters.customer = customerValue;
  }
  if (customerOrderValue) {
    listFilters.customerOrder = customerOrderValue;
  }
  if (queryValue) {
    listFilters.search = queryValue;
  }
  if (dateValue) {
    listFilters.date = dateValue;
  }
  if (currentUser?.role === "werknemer" && currentUser.id !== undefined && currentUser.id !== null) {
    listFilters.createdBy = currentUser.id;
  }
  prepareOrdersLoadingState();
  try {
    const filtersForQuery = { ...listFilters };
    const sortDescriptors = getOrderSortDescriptors();
    const queryOptions = {
      sort: sortDescriptors,
    };
    if (usePagination) {
      queryOptions.page = PAGINATION.currentPage;
      queryOptions.pageSize = PAGINATION.pageSize;
    }
    const firstPage = await Orders.list(filtersForQuery, queryOptions);
    stopOrdersSkeleton();
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
      updateSortIndicators();
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
    updateSortIndicators();

    let allRows = safeRows;
    if (usePagination) {
      try {
        allRows = await fetchAllOrderPages(filtersForQuery, firstPage, sortDescriptors);
      } catch (err) {
        console.error("Kan volledige orderlijst niet ophalen", err);
      }
    }
    ORDERS_CACHE = Array.isArray(allRows) ? allRows : safeRows;
    rememberOrderOwners(ORDERS_CACHE);
    updateCurrentEditOrderFromCache();
    syncPlanBoardFromOrders();
    renderPlanBoard();
  } catch (e) {
    console.error("Kan orders niet laden", e);
    stopOrdersSkeleton();
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
    updateSortIndicators();
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
    renderOrdersEmptyState();
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

    const dueSource = r.due_date || details.delivery?.date;
    const displayDate = formatDateDisplay(dueSource);
    const referenceLabel = details.reference || details.customerOrderNumber || details.customerNumber || null;
    const dueCell = document.createElement("td");
    dueCell.textContent = displayDate;
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
      tr.setAttribute("tabindex", "0");
      tr.setAttribute("role", "button");
      const labelParts = [
        displayDate !== "-" ? displayDate : null,
        r.customer_name || null,
        referenceLabel,
      ].filter(Boolean);
      const accessibleLabel = labelParts.length
        ? `Order bewerken: ${labelParts.join(" – ")}`
        : "Order bewerken";
      tr.setAttribute("aria-label", accessibleLabel);
      tr.addEventListener("keydown", (event) => {
        if (event.defaultPrevented) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openEdit(r);
        }
      });
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

function exportOrdersToCsv() {
  const rows = Array.isArray(ORDERS_CACHE) ? ORDERS_CACHE : [];
  if (!rows.length) {
    showToastMessage("info", "Geen orders om te exporteren.");
    return;
  }
  const header = [
    "Gewenste leverdatum",
    "Transport aanvraag referentie",
    "Klant",
    "Ordernummer klant",
    "Laadadres",
    "Losadres",
    "Transport type",
    "Status",
    "Vrachtwagen",
    "Gepland",
  ];
  const escapeValue = (value) => {
    if (value === null || value === undefined) {
      return "";
    }
    const stringValue = String(value).replace(/\r?\n|\r/g, " ").trim();
    if (!stringValue.length) {
      return "";
    }
    if (/[";\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };
  const dataRows = rows.map((row) => {
    const details = parseOrderDetails(row);
    const dueSource = row.due_date || details.delivery?.date;
    return [
      formatDateDisplay(dueSource),
      details.reference || "-",
      row.customer_name || "-",
      details.customerOrderNumber || details.customerNumber || "-",
      formatStop(details.pickup),
      formatStop(details.delivery),
      details.transportType || formatCargo(details.cargo) || "-",
      row.status || "-",
      row.assigned_carrier || "-",
      formatPlanned(row),
    ];
  });
  const csvSeparator = ";";
  const csvLines = [header, ...dataRows].map((line) => line.map(escapeValue).join(csvSeparator));
  const csvContent = csvLines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0];
  const filename = `orders-${timestamp}.csv`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    URL.revokeObjectURL(link.href);
  }, 0);
  showToastMessage("success", "CSV-export gestart.");
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
  const normalized = Math.max(1, Math.floor(value));
  if (event?.target && String(event.target.value) !== String(normalized)) {
    event.target.value = String(normalized);
  }
  PAGINATION.currentPage = 1;
  loadOrders({ page: 1, pageSize: normalized });
}

function formatAuditActionLabel(action) {
  if (!action) return "Onbekende actie";
  const normalized = String(action).toLowerCase();
  if (normalized === "create") return "Aangemaakt";
  if (normalized === "update") return "Bijgewerkt";
  if (normalized === "delete") return "Verwijderd";
  return action;
}

const AUDIT_FIELD_LABELS = {
  status: "Status",
  assigned_carrier: "Carrier / vrachtwagen",
  planned_date: "Geplande datum",
  planned_slot: "Tijdslot",
};

const AUDIT_IGNORED_FIELDS = new Set([
  "updated_at",
  "created_at",
  "id",
  "order_id",
  "user_id",
  "user_name",
  "ts",
]);

function humanizeKey(key) {
  if (!key) return "Onbekend veld";
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAuditFieldLabel(field) {
  if (!field) return "Veld";
  if (Object.prototype.hasOwnProperty.call(AUDIT_FIELD_LABELS, field)) {
    return AUDIT_FIELD_LABELS[field];
  }
  return humanizeKey(field);
}

function formatAuditFieldValue(field, value) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  if (typeof value === "boolean") {
    return value ? "Ja" : "Nee";
  }
  if (field === "planned_date") {
    return formatDateDisplay(value);
  }
  if (value instanceof Date) {
    return formatDateTimeDisplay(value);
  }
  return String(value);
}

function extractAuditEntryChanges(entry) {
  if (!entry || typeof entry !== "object") {
    return [];
  }
  const payload = entry.payload;
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const changes = [];
  if (entry.action === "update" && payload.patch && typeof payload.patch === "object") {
    for (const [field, value] of Object.entries(payload.patch)) {
      if (AUDIT_IGNORED_FIELDS.has(field)) continue;
      changes.push({ field, value });
    }
  } else if (entry.action === "create") {
    const snapshot = payload.data || payload.result || null;
    if (snapshot && typeof snapshot === "object") {
      for (const [field, value] of Object.entries(snapshot)) {
        if (value === undefined || value === null || value === "") continue;
        if (AUDIT_IGNORED_FIELDS.has(field)) continue;
        if (!Object.prototype.hasOwnProperty.call(AUDIT_FIELD_LABELS, field)) continue;
        changes.push({ field, value });
      }
    }
  } else if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    for (const [field, value] of Object.entries(payload)) {
      if (value === undefined) continue;
      if (AUDIT_IGNORED_FIELDS.has(field)) continue;
      changes.push({ field, value });
    }
  }
  return changes;
}

function renderAuditEntryDetails(entry, container) {
  if (!container) return;
  const changes = extractAuditEntryChanges(entry);
  if (!changes.length) {
    const payload = entry?.payload;
    if (typeof payload === "string" && payload.trim()) {
      const message = document.createElement("p");
      message.className = "audit-log__message";
      message.textContent = payload.trim();
      container.appendChild(message);
      return;
    }
    if (typeof payload === "number" || typeof payload === "boolean") {
      const message = document.createElement("p");
      message.className = "audit-log__message";
      message.textContent = String(payload);
      container.appendChild(message);
      return;
    }
    if (entry && entry.action === "delete") {
      const message = document.createElement("p");
      message.className = "audit-log__message muted";
      message.textContent = "Transport verwijderd.";
      container.appendChild(message);
    }
    return;
  }

  const list = document.createElement("dl");
  list.className = "audit-log__changes";
  for (const change of changes) {
    const label = document.createElement("dt");
    label.textContent = formatAuditFieldLabel(change.field);
    list.appendChild(label);

    const value = document.createElement("dd");
    value.textContent = formatAuditFieldValue(change.field, change.value);
    list.appendChild(value);
  }
  container.appendChild(list);
}

function renderOrderAuditLogPlaceholder(message, className = "muted small") {
  if (!els.orderAuditLog) return;
  els.orderAuditLog.innerHTML = "";
  const placeholder = document.createElement("p");
  placeholder.className = className;
  placeholder.textContent = message;
  els.orderAuditLog.appendChild(placeholder);
}

function renderOrderAuditLogEntries(entries) {
  if (!els.orderAuditLog) return;
  if (!Array.isArray(entries) || !entries.length) {
    renderOrderAuditLogPlaceholder("Nog geen logboekregels voor deze order.");
    return;
  }
  els.orderAuditLog.innerHTML = "";
  const list = document.createElement("ul");
  list.className = "audit-log";
  for (const entry of entries) {
    const item = document.createElement("li");
    item.className = "audit-log__item";

    const meta = document.createElement("div");
    meta.className = "audit-log__meta";

    const timeEl = document.createElement("time");
    timeEl.className = "audit-log__time";
    if (entry?.ts) {
      timeEl.dateTime = entry.ts;
      timeEl.textContent = formatDateTimeDisplay(entry.ts);
    } else {
      timeEl.textContent = "-";
    }
    meta.appendChild(timeEl);

    const actor = document.createElement("span");
    actor.className = "audit-log__actor";
    actor.textContent = entry?.user_name || "Onbekend";
    meta.appendChild(actor);

    const action = document.createElement("span");
    action.className = "audit-log__action";
    action.textContent = formatAuditActionLabel(entry?.action);
    meta.appendChild(action);

    item.appendChild(meta);

    const detailsContainer = document.createElement("div");
    detailsContainer.className = "audit-log__details";
    renderAuditEntryDetails(entry, detailsContainer);
    if (detailsContainer.childNodes.length) {
      item.appendChild(detailsContainer);
    }

    list.appendChild(item);
  }
  els.orderAuditLog.appendChild(list);
}

async function loadOrderAuditLog(orderId) {
  if (!els.orderAuditLog) return;
  const numericOrderId = Number(orderId);
  if (!Number.isFinite(numericOrderId)) {
    renderOrderAuditLogPlaceholder("Logboek niet beschikbaar.");
    return;
  }
  if (!window.AuditLog || typeof window.AuditLog.listByOrder !== "function") {
    renderOrderAuditLogPlaceholder("Logboek niet beschikbaar.");
    return;
  }

  ORDER_AUDIT_LOG_STATE.token += 1;
  const requestToken = ORDER_AUDIT_LOG_STATE.token;
  ORDER_AUDIT_LOG_STATE.orderId = numericOrderId;
  renderOrderAuditLogPlaceholder("Logboek laden…");

  try {
    const entries = await window.AuditLog.listByOrder(numericOrderId, { limit: 25 });
    if (ORDER_AUDIT_LOG_STATE.token !== requestToken) {
      return;
    }
    renderOrderAuditLogEntries(entries);
  } catch (error) {
    if (ORDER_AUDIT_LOG_STATE.token !== requestToken) {
      return;
    }
    console.error("Kan auditlog niet laden", error);
    renderOrderAuditLogPlaceholder("Logboek laden mislukt.", "muted small error-text");
  }
}

function clearCurrentEditContext() {
  CURRENT_EDIT_ORDER = null;
  CURRENT_EDIT_ORDER_DETAILS = null;
  CURRENT_EDIT_ORDER_LINES = null;
  CURRENT_EDIT_LINES_LOADING = null;
  if (els && els.btnPrintOrder) {
    els.btnPrintOrder.setAttribute("disabled", "disabled");
    els.btnPrintOrder.setAttribute("aria-disabled", "true");
  }
}

function setCurrentEditContext(order) {
  if (!order) {
    clearCurrentEditContext();
    return;
  }
  CURRENT_EDIT_ORDER = { ...order };
  CURRENT_EDIT_ORDER_DETAILS = parseOrderDetails(order);
  CURRENT_EDIT_ORDER_LINES = null;
  const numericId = Number(order.id);
  if (els && els.btnPrintOrder) {
    els.btnPrintOrder.removeAttribute("disabled");
    els.btnPrintOrder.removeAttribute("aria-disabled");
  }
  if (Number.isFinite(numericId)) {
    CURRENT_EDIT_LINES_LOADING = loadOrderLines(numericId)
      .then((lines) => {
        if (CURRENT_EDIT_ORDER && Number(CURRENT_EDIT_ORDER.id) === numericId) {
          CURRENT_EDIT_ORDER_LINES = lines;
        }
        return lines;
      })
      .catch((error) => {
        console.warn("Kan orderregels niet voorbereiden", error);
        return [];
      });
  } else {
    CURRENT_EDIT_LINES_LOADING = Promise.resolve([]);
  }
}

function updateCurrentEditOrderFromCache() {
  if (!CURRENT_EDIT_ORDER || !Array.isArray(ORDERS_CACHE)) {
    return;
  }
  const updated = ORDERS_CACHE.find((item) => String(item.id) === String(CURRENT_EDIT_ORDER.id));
  if (updated) {
    CURRENT_EDIT_ORDER = { ...updated };
    CURRENT_EDIT_ORDER_DETAILS = parseOrderDetails(updated);
  }
}

async function printCurrentOrder() {
  if (!CURRENT_EDIT_ORDER) {
    window.alert("Open eerst een order om een bon te printen.");
    return;
  }
  const order = CURRENT_EDIT_ORDER;
  const details = CURRENT_EDIT_ORDER_DETAILS || parseOrderDetails(order);
  let lines = CURRENT_EDIT_ORDER_LINES;
  if (!Array.isArray(lines)) {
    try {
      if (CURRENT_EDIT_LINES_LOADING) {
        lines = await CURRENT_EDIT_LINES_LOADING;
      } else {
        lines = await loadOrderLines(order.id);
      }
      if (CURRENT_EDIT_ORDER && String(CURRENT_EDIT_ORDER.id) === String(order.id)) {
        CURRENT_EDIT_ORDER_LINES = lines;
      }
    } catch (error) {
      console.warn("Kan orderregels niet laden voor print", error);
      lines = [];
    }
  }
  const printWindow = window.open("", "_blank", "noopener=yes");
  if (!printWindow) {
    window.alert("Kan geen printvenster openen. Sta pop-ups toe voor deze site.");
    return;
  }
  const documentHtml = buildOrderPrintDocument(order, details, Array.isArray(lines) ? lines : []);
  printWindow.document.open();
  printWindow.document.write(documentHtml);
  printWindow.document.close();
  try {
    printWindow.focus();
  } catch (error) {
    console.warn("Kan printvenster niet focussen", error);
  }
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
  setCurrentEditContext(row);
  if (els.orderAuditLog) {
    renderOrderAuditLogPlaceholder("Logboek laden…");
    loadOrderAuditLog(row.id);
  }
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
  try {
    setStatus(els.editStatus, "Opslaan…");
    await Orders.update(id, patch);
    const successMessage = "Transport bijgewerkt.";
    setStatus(els.editStatus, successMessage, "success");
    showToastMessage("success", successMessage);
    if (els.dlg?.open) {
      els.dlg.close();
    }
    await loadOrders();
  } catch (e) {
    console.error("Kan order niet opslaan", e);
    const message = getSupabaseErrorMessage(e, "Opslaan mislukt.");
    setStatus(els.editStatus, message, "error");
    showToastMessage("error", message);
  }
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
    const successMessage = "Transport verwijderd.";
    setStatus(els.editStatus, successMessage, "success");
    showToastMessage("success", successMessage);
    if (els.dlg?.open) {
      els.dlg.close();
    }
  } catch (e) {
    console.error("Kan order niet verwijderen", e);
    const message = getSupabaseErrorMessage(e, "Verwijderen mislukt.");
    setStatus(els.editStatus, message, "error");
    showToastMessage("error", message);
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

function isArticleRowEmpty(row, articleType) {
  if (!row) return true;
  const productInput = row.querySelector('[data-field="product"]');
  const serialInput = row.querySelector('[data-field="serial_number"]');
  const quantityInput = row.querySelector('[data-field="quantity"]');
  const product = cleanText(productInput?.value);
  const serialNumber = cleanText(serialInput?.value);
  const rawQuantity = readInteger(quantityInput?.value);
  const defaultQuantity = quantityInput ? readInteger(quantityInput.defaultValue) : null;
  const normalizedType = articleType === "serial" ? "serial" : "non_serial";
  const isQuantityDefault = rawQuantity === null || (defaultQuantity !== null && rawQuantity === defaultQuantity);
  if (normalizedType === "serial") {
    return !product && !serialNumber;
  }
  return !product && !serialNumber && isQuantityDefault;
}

function removeEmptyArticleRows(articleType) {
  const rows = getArticleRows();
  for (const row of rows) {
    if (isArticleRowEmpty(row, articleType)) {
      row.remove();
    }
  }
}

function detectCsvSeparator(line) {
  if (!line || typeof line !== "string") {
    return ";";
  }
  const semicolons = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  if (semicolons === 0 && commas === 0) {
    return ";";
  }
  return semicolons >= commas ? ";" : ",";
}

function parseDelimitedValues(text, separator) {
  const rows = [];
  if (!text || typeof text !== "string") {
    return rows;
  }
  let value = "";
  let inQuotes = false;
  let row = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "\"") {
      if (inQuotes && text[i + 1] === "\"") {
        value += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === separator && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }
    value += char;
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function parseArticleCsvContent(text) {
  if (!text || typeof text !== "string") {
    return { rows: [] };
  }
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized.trim()) {
    return { rows: [] };
  }
  const firstLineBreak = normalized.indexOf("\n");
  const headerLine = firstLineBreak === -1 ? normalized : normalized.slice(0, firstLineBreak);
  const separator = detectCsvSeparator(headerLine);
  const rawRows = parseDelimitedValues(normalized, separator);
  if (!rawRows.length) {
    return { rows: [] };
  }
  const sanitizeCell = (value) => {
    if (value === undefined || value === null) return "";
    return String(value).replace(/^\uFEFF/, "").trim();
  };
  const header = rawRows[0].map((cell) => sanitizeCell(cell).toLowerCase());
  const artikelIndex = header.findIndex((cell) => cell === "artikel");
  const serialIndex = header.findIndex((cell) => cell === "serienummer");
  const quantityIndex = header.findIndex((cell) => cell === "aantal");
  const missing = [];
  if (artikelIndex === -1) missing.push("artikel");
  if (serialIndex === -1) missing.push("serienummer");
  if (quantityIndex === -1) missing.push("aantal");
  if (missing.length) {
    const formatted = missing.map((column) => `“${column}”`).join(", ");
    return { error: `Ontbrekende kolommen: ${formatted}.` };
  }
  const rows = [];
  for (let i = 1; i < rawRows.length; i++) {
    const cells = rawRows[i];
    if (!cells || !cells.length) {
      continue;
    }
    const product = sanitizeCell(cells[artikelIndex]);
    const serial = sanitizeCell(cells[serialIndex]);
    const quantityText = sanitizeCell(cells[quantityIndex]);
    if (!product && !serial && !quantityText) {
      continue;
    }
    rows.push({
      rowNumber: i + 1,
      product,
      serial_number: serial,
      quantityText,
    });
  }
  return { rows };
}

function validateArticleImportRows(rows, articleType) {
  const normalizedType = articleType === "serial" ? "serial" : "non_serial";
  const validated = [];
  for (const row of rows) {
    const errors = [];
    const product = cleanText(row.product);
    const serialNumber = cleanText(row.serial_number);
    const quantityText = typeof row.quantityText === "string" ? row.quantityText.trim() : "";
    const quantityValue = quantityText ? readInteger(quantityText) : null;
    const result = {
      rowNumber: row.rowNumber,
      product,
      productDisplay: row.product || "",
      serial_number: normalizedType === "serial" ? serialNumber : null,
      serialDisplay: row.serial_number || "",
      quantity: normalizedType === "serial" ? 1 : null,
      quantityDisplay: normalizedType === "serial" ? quantityText || "1" : quantityText,
      errors,
      isValid: true,
    };

    if (!product) {
      errors.push("Artikel is verplicht.");
    }

    if (normalizedType === "serial") {
      if (!serialNumber) {
        errors.push("Serienummer is verplicht.");
      }
      if (quantityText && quantityValue !== 1) {
        errors.push("Aantal moet 1 zijn voor serienummers.");
      }
    } else {
      if (quantityText.length === 0) {
        errors.push("Aantal is verplicht.");
      } else if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
        errors.push("Aantal moet groter dan nul zijn.");
      } else {
        result.quantity = quantityValue;
        result.quantityDisplay = String(quantityValue);
      }
      result.serial_number = null;
    }

    result.isValid = errors.length === 0;
    validated.push(result);
  }
  return validated;
}

function updateArticleImportActions(rows) {
  const state = ARTICLE_IMPORT_STATE;
  let effectiveRows = Array.isArray(rows) ? rows : null;
  if (!effectiveRows && state && Array.isArray(state.validatedRows)) {
    effectiveRows = state.validatedRows;
  }
  const total = Array.isArray(effectiveRows) ? effectiveRows.length : 0;
  const validCount = Array.isArray(effectiveRows)
    ? effectiveRows.filter((row) => row && row.isValid).length
    : 0;
  const hasValidRows = validCount > 0;

  if (els.btnApplyArticleImport) {
    if (hasValidRows) {
      els.btnApplyArticleImport.removeAttribute("disabled");
      els.btnApplyArticleImport.removeAttribute("aria-disabled");
    } else {
      els.btnApplyArticleImport.setAttribute("disabled", "disabled");
      els.btnApplyArticleImport.setAttribute("aria-disabled", "true");
    }
  }

  if (els.btnClearArticleImport) {
    const hasRawRows = Boolean(state && Array.isArray(state.rawRows) && state.rawRows.length);
    const hasSelection = Boolean(els.articleCsvInput && els.articleCsvInput.value);
    if (hasRawRows || hasSelection) {
      els.btnClearArticleImport.removeAttribute("disabled");
      els.btnClearArticleImport.removeAttribute("aria-disabled");
    } else {
      els.btnClearArticleImport.setAttribute("disabled", "disabled");
      els.btnClearArticleImport.setAttribute("aria-disabled", "true");
    }
  }

  return { total, validCount };
}

function renderArticleImportPreview(rows) {
  if (!els.articleImportPreview || !els.articleImportPreviewBody) {
    return;
  }
  const body = els.articleImportPreviewBody;
  body.innerHTML = "";
  if (!Array.isArray(rows) || rows.length === 0) {
    els.articleImportPreview.classList.add("is-hidden");
    const counts = updateArticleImportActions(rows || []);
    if (counts.total === 0 && els.articleImportStatus) {
      setStatus(els.articleImportStatus, "Geen regels gevonden in het bestand.", "error");
    }
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const tr = document.createElement("tr");
    if (!row.isValid) {
      tr.classList.add("is-invalid");
    }
    const rowCell = document.createElement("th");
    rowCell.scope = "row";
    rowCell.textContent = row.rowNumber != null ? String(row.rowNumber) : "";
    tr.appendChild(rowCell);

    const productCell = document.createElement("td");
    productCell.textContent = row.productDisplay || "";
    tr.appendChild(productCell);

    const serialCell = document.createElement("td");
    serialCell.textContent = row.serialDisplay || "";
    tr.appendChild(serialCell);

    const quantityCell = document.createElement("td");
    quantityCell.textContent = row.quantityDisplay || "";
    tr.appendChild(quantityCell);

    const statusCell = document.createElement("td");
    statusCell.textContent = row.errors.length
      ? row.errors.join(" ")
      : "Klaar om toe te voegen";
    tr.appendChild(statusCell);

    fragment.appendChild(tr);
  }

  body.appendChild(fragment);
  els.articleImportPreview.classList.remove("is-hidden");

  const { total, validCount } = updateArticleImportActions(rows);
  const invalidCount = total - validCount;
  if (!els.articleImportStatus) {
    return;
  }
  if (invalidCount > 0) {
    const rijText = invalidCount === 1 ? "rij" : "rijen";
    if (validCount > 0) {
      setStatus(
        els.articleImportStatus,
        `${validCount} van ${total} regels klaar om toe te voegen. Controleer de rood gemarkeerde ${rijText}.`,
        "error",
      );
    } else {
      setStatus(
        els.articleImportStatus,
        `Geen geldige regels gevonden. Controleer de rood gemarkeerde ${rijText}.`,
        "error",
      );
    }
  } else {
    const artikelText = validCount === 1 ? "artikel" : "artikelen";
    setStatus(els.articleImportStatus, `${validCount} ${artikelText} klaar om toe te voegen.`, "success");
  }
}

function refreshArticleImportPreview(options = {}) {
  const { silent = false } = options;
  if (!ARTICLE_IMPORT_STATE || !Array.isArray(ARTICLE_IMPORT_STATE.rawRows) || !ARTICLE_IMPORT_STATE.rawRows.length) {
    if (!silent && els.articleImportStatus) {
      setStatus(els.articleImportStatus, "");
    }
    if (els.articleImportPreview) {
      els.articleImportPreview.classList.add("is-hidden");
    }
    updateArticleImportActions([]);
    return;
  }
  const articleType = getArticleType();
  if (!articleType) {
    if (!silent && els.articleImportStatus) {
      setStatus(els.articleImportStatus, "Kies het artikeltype om de import te controleren.", "error");
    }
    if (els.articleImportPreview) {
      els.articleImportPreview.classList.add("is-hidden");
    }
    ARTICLE_IMPORT_STATE.validatedRows = [];
    updateArticleImportActions([]);
    return;
  }
  const validatedRows = validateArticleImportRows(ARTICLE_IMPORT_STATE.rawRows, articleType);
  ARTICLE_IMPORT_STATE.validatedRows = validatedRows;
  renderArticleImportPreview(validatedRows);
}

function resetArticleImport(options = {}) {
  const { clearInput = true, clearStatus = true } = options;
  ARTICLE_IMPORT_STATE = null;
  if (els.articleImportPreviewBody) {
    els.articleImportPreviewBody.innerHTML = "";
  }
  if (els.articleImportPreview) {
    els.articleImportPreview.classList.add("is-hidden");
  }
  if (clearInput && els.articleCsvInput) {
    els.articleCsvInput.value = "";
  }
  if (clearStatus && els.articleImportStatus) {
    setStatus(els.articleImportStatus, "");
  }
  updateArticleImportActions([]);
}

function processArticleCsvContent(text) {
  const parsed = parseArticleCsvContent(text);
  if (parsed.error) {
    if (els.articleImportStatus) {
      setStatus(els.articleImportStatus, parsed.error, "error");
    }
    resetArticleImport({ clearStatus: false });
    return;
  }
  if (!parsed.rows.length) {
    if (els.articleImportStatus) {
      setStatus(els.articleImportStatus, "Geen regels gevonden in het bestand.", "error");
    }
    resetArticleImport({ clearStatus: false });
    return;
  }
  ARTICLE_IMPORT_STATE = {
    rawRows: parsed.rows,
    validatedRows: [],
  };
  refreshArticleImportPreview();
}

function handleArticleCsvChange(event) {
  const input = event?.target;
  const file = input && input.files && input.files[0] ? input.files[0] : null;
  if (!file) {
    resetArticleImport();
    return;
  }
  resetArticleImport({ clearInput: false });
  if (els.articleImportStatus) {
    setStatus(els.articleImportStatus, `Bestand ${file.name} wordt verwerkt…`);
  }
  const reader = new FileReader();
  reader.addEventListener("error", () => {
    if (els.articleImportStatus) {
      setStatus(els.articleImportStatus, "Het CSV-bestand kan niet worden gelezen.", "error");
    }
    resetArticleImport({ clearStatus: false });
  });
  reader.addEventListener("load", () => {
    const text = typeof reader.result === "string" ? reader.result : "";
    processArticleCsvContent(text);
  });
  reader.readAsText(file, "utf-8");
}

function applyArticleImport(event) {
  if (event) {
    event.preventDefault();
  }
  if (!ARTICLE_IMPORT_STATE || !Array.isArray(ARTICLE_IMPORT_STATE.rawRows) || !ARTICLE_IMPORT_STATE.rawRows.length) {
    if (els.articleImportStatus) {
      setStatus(els.articleImportStatus, "Geen import beschikbaar.", "error");
    }
    return;
  }
  const articleType = getArticleType();
  if (!articleType) {
    if (els.articleImportStatus) {
      setStatus(els.articleImportStatus, "Kies eerst het artikeltype.", "error");
    }
    return;
  }
  const validatedRows = ARTICLE_IMPORT_STATE.validatedRows && ARTICLE_IMPORT_STATE.validatedRows.length
    ? ARTICLE_IMPORT_STATE.validatedRows
    : validateArticleImportRows(ARTICLE_IMPORT_STATE.rawRows, articleType);
  const validRows = validatedRows.filter((row) => row && row.isValid);
  if (!validRows.length) {
    if (els.articleImportStatus) {
      setStatus(els.articleImportStatus, "Geen geldige regels om toe te voegen.", "error");
    }
    return;
  }
  removeEmptyArticleRows(articleType);
  for (const row of validRows) {
    addArticleRow({
      product: row.product,
      serial_number: articleType === "serial" ? row.serial_number : null,
      quantity: articleType === "serial" ? 1 : row.quantity,
    });
  }
  updateArticleRowsForType(articleType);
  const message = validRows.length === 1
    ? "1 artikel toegevoegd."
    : `${validRows.length} artikelen toegevoegd.`;
  if (els.articleImportStatus) {
    setStatus(els.articleImportStatus, message, "success");
  }
  resetArticleImport({ clearStatus: false });
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
  resetArticleImport();
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
  resetOrderWizard();
  if (els.createStatus) {
    setStatus(els.createStatus, "");
  }
}

async function createOrder(){
  if (!els.oCustomerName || !els.oRequestReference) return;
  const user = getCurrentUser();
  resetWizardStatus();
  if (ORDER_FORM_VALIDATOR && !ORDER_FORM_VALIDATOR.validate()) {
    setStatus(els.createStatus, "Controleer de gemarkeerde velden.", "error");
    const errorStep = findWizardStepWithErrors();
    if (errorStep) {
      setWizardStep(errorStep);
      if (els.wizardStatus) {
        setStatus(els.wizardStatus, "Controleer de gemarkeerde velden.", "error");
      }
    }
    return;
  }
  const customerName = cleanText(els.oCustomerName.value);
  const requestReference = cleanText(els.oRequestReference.value);
  const articleType = getArticleType();
  if (!articleType) {
    setStatus(els.createStatus, "Kies het artikeltype.", "error");
    setWizardStep(4);
    if (els.wizardStatus) {
      setStatus(els.wizardStatus, "Kies het artikeltype.", "error");
    }
    return;
  }
  let articleLines = [];
  try {
    articleLines = collectArticles(articleType);
  } catch (articleError) {
    setStatus(els.createStatus, articleError.message || "Controleer de artikelen.", "error");
    setWizardStep(4);
    if (els.wizardStatus) {
      setStatus(els.wizardStatus, articleError.message || "Controleer de artikelen.", "error");
    }
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
    const successMessage = "Transport aangemaakt";
    setStatus(els.createStatus, successMessage, "success");
    showToastMessage("success", successMessage);
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
    const message = getSupabaseErrorMessage(e, "Transport opslaan mislukt");
    setStatus(els.createStatus, message, "error");
    showToastMessage("error", message);
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
    const results = await Promise.allSettled(tasks);
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length) {
      const message = getSupabaseErrorMessage(
        failures[0].reason,
        failures.length === tasks.length
          ? "Opslaan van planning mislukt."
          : "Planning deels opgeslagen. Controleer de orders."
      );
      setStatus(els.plannerStatus, message, "error");
      showToastMessage("error", message);
    } else {
      const successMessage = "Planning opgeslagen";
      setStatus(els.plannerStatus, successMessage, "success");
      showToastMessage("success", successMessage);
    }
    await loadOrders();
  } catch (e) {
    console.error("Kan planning niet opslaan", e);
    const message = getSupabaseErrorMessage(e, "Opslaan van planning mislukt.");
    setStatus(els.plannerStatus, message, "error");
    showToastMessage("error", message);
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
  if (Array.isArray(els.wizardNextButtons)) {
    for (const button of els.wizardNextButtons) {
      addBoundListener(button, "click", (event) => {
        event.preventDefault();
        goToNextWizardStep();
      });
    }
  }
  if (Array.isArray(els.wizardPrevButtons)) {
    for (const button of els.wizardPrevButtons) {
      addBoundListener(button, "click", (event) => {
        event.preventDefault();
        goToPreviousWizardStep();
      });
    }
  }
  bindClick(els.btnAddArticle, () => addArticleRow());
  bindClick(els.btnApplyArticleImport, applyArticleImport);
  bindClick(els.btnClearArticleImport, () => resetArticleImport());
  bindClick(els.btnReload, () => loadOrders());
  bindClick(els.btnExportOrders, () => exportOrdersToCsv());
  bindClick(els.btnAddCarrier, addCarrier);
  bindClick(els.btnSuggestPlan, suggestPlan, canManagePlanning);
  bindClick(els.btnApplyPlan, applyPlan, canManagePlanning);
  bindClick(els.btnDeleteOrder, deleteOrder);
  bindClick(els.btnPrintOrder, () => printCurrentOrder());
  if (els.btnSaveEdit) {
    addBoundListener(els.btnSaveEdit, "click", (e)=>{ e.preventDefault(); saveEdit(); });
  }
  if (els.dlg) {
    addBoundListener(els.dlg, "close", () => { clearCurrentEditContext(); });
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
  if (els.articleCsvInput) {
    addBoundListener(els.articleCsvInput, "change", handleArticleCsvChange);
  }
  if (els.articleTypeInputs) {
    for (const input of els.articleTypeInputs) {
      addBoundListener(input, "change", () => {
        updateArticleRowsForType(getArticleType());
        if (ARTICLE_IMPORT_STATE && Array.isArray(ARTICLE_IMPORT_STATE.rawRows) && ARTICLE_IMPORT_STATE.rawRows.length) {
          refreshArticleImportPreview();
        }
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
      PAGINATION.pageSize = Math.max(1, Math.floor(defaultSize));
      if (String(els.pagerPageSize.value) !== String(PAGINATION.pageSize)) {
        els.pagerPageSize.value = String(PAGINATION.pageSize);
      }
    }
    addBoundListener(els.pagerPageSize, "change", handlePageSizeChange);
  }
  if (Array.isArray(els.orderSortToggles)) {
    for (const button of els.orderSortToggles) {
      addBoundListener(button, "click", (event) => {
        event.preventDefault();
        const header = typeof button?.closest === "function" ? button.closest("th[data-sort]") : null;
        if (!header) return;
        const column = header.dataset.sort;
        setOrderSort(column);
      });
    }
  }
}

async function initAppPage() {
  refreshElements();
  clearCurrentEditContext();
  restoreOrderFilters();
  updateSortIndicators();
  enforceDateInputs(document);
  const user = window.Auth?.getUser ? window.Auth.getUser() : null;
  const canManagePlanning = Boolean(user && (user.role === "planner" || user.role === "admin"));
  removeBoundListeners();
  bind(canManagePlanning);
  setupOrderFormValidation();
  setupOrderWizard();
  await assignRequestReference();
  applyDefaultReceivedDate();
  ensureMinimumArticleRows();
  resetArticleImport();
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
  ensureOrdersRealtimeSubscription();
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
  clearCurrentEditContext();
  els = {};
  PLAN_SUGGESTIONS = [];
  DRAG_CONTEXT = null;
  ORDER_FORM_VALIDATOR = null;
  ARTICLE_IMPORT_STATE = null;
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
