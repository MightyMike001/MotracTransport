if (
  !window.APP_CONFIG ||
  !window.APP_CONFIG.SUPABASE_URL ||
  !window.APP_CONFIG.SUPABASE_ANON_KEY
) {
  throw new Error("Supabase configuratie ontbreekt in window.APP_CONFIG");
}

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;

function normalizeSupabaseRestUrl(url) {
  if (!url || typeof url !== "string") {
    return "";
  }

  let normalized = url.trim();
  if (!normalized) {
    return "";
  }

  // Remove trailing slashes to simplify further checks.
  normalized = normalized.replace(/\/+$/g, "");

  const restV1Pattern = /\/rest\/v1$/i;
  if (restV1Pattern.test(normalized)) {
    return normalized;
  }

  // Strip a trailing `/rest` segment so that we can safely append `/rest/v1`.
  normalized = normalized.replace(/\/rest$/i, "");

  return `${normalized}/rest/v1`;
}

const SUPABASE_REST_URL = normalizeSupabaseRestUrl(SUPABASE_URL);

if (!SUPABASE_REST_URL) {
  throw new Error("Ongeldige Supabase REST URL");
}

const SB_HEADERS = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": "Bearer " + SUPABASE_ANON_KEY
};

const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY = 400;
const NETWORK_ERROR_MESSAGE =
  "Kan geen verbinding maken met de server. Controleer je netwerk en probeer het opnieuw.";

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isNavigatorOffline() {
  if (typeof window === "undefined" || !window.navigator) return false;
  if (typeof window.navigator.onLine === "boolean") {
    return window.navigator.onLine === false;
  }
  return false;
}

function isLikelyNetworkError(error) {
  if (!error) return false;
  if (isNavigatorOffline()) return true;
  const message =
    typeof error === "string"
      ? error.toLowerCase()
      : typeof error.message === "string"
        ? error.message.toLowerCase()
        : "";
  if (!message) return false;
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network error") ||
    message.includes("load failed") ||
    message.includes("network request failed")
  );
}

async function tryWrap(operation, options = {}) {
  if (typeof operation !== "function") {
    throw new TypeError("tryWrap verwacht een functie die een Promise teruggeeft");
  }

  const retries = Number.isInteger(options.retries)
    ? Math.max(0, options.retries)
    : DEFAULT_RETRY_ATTEMPTS;
  const retryDelay = Number.isInteger(options.retryDelay)
    ? Math.max(0, options.retryDelay)
    : DEFAULT_RETRY_DELAY;

  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (attempt === retries) {
        break;
      }
      attempt += 1;
      if (retryDelay > 0) {
        await wait(retryDelay * attempt);
      }
    }
  }

  if (isLikelyNetworkError(lastError)) {
    const wrappedError = new Error(options.networkMessage || NETWORK_ERROR_MESSAGE);
    wrappedError.cause = lastError;
    throw wrappedError;
  }

  throw lastError;
}

function getActiveSessionUser() {
  try {
    if (window.Auth && typeof window.Auth.getUser === "function") {
      return window.Auth.getUser();
    }
  } catch (error) {
    console.warn("Kan actieve gebruiker niet bepalen", error);
  }
  return null;
}

function sanitizeAuditPayload(payload) {
  if (payload === undefined || payload === null) {
    return null;
  }
  if (payload instanceof Date) {
    return payload.toISOString();
  }
  if (typeof payload === "string" || typeof payload === "number" || typeof payload === "boolean") {
    return payload;
  }
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch (error) {
    return String(payload);
  }
}

const AuditLog = {
  async recordOrderAction(orderId, action, payload = null) {
    const numericOrderId = Number(orderId);
    if (!Number.isFinite(numericOrderId) || !action) {
      return null;
    }

    const activeUser = getActiveSessionUser();
    const entry = {
      order_id: numericOrderId,
      action,
      user_id: activeUser?.id ?? null,
      user_name: activeUser?.name || activeUser?.full_name || activeUser?.email || null,
      payload: sanitizeAuditPayload(payload),
    };

    try {
      const rows = await sbInsert("audit_log", [entry]);
      return Array.isArray(rows) ? rows[0] : rows;
    } catch (error) {
      console.warn("Audit-logboek schrijven mislukt", error);
      return null;
    }
  },

  async listByOrder(orderId, options = {}) {
    const numericOrderId = Number(orderId);
    if (!Number.isFinite(numericOrderId)) {
      return [];
    }
    const limitValue = Number.isFinite(options.limit) ? Math.max(1, Math.min(100, options.limit)) : 50;
    const queryParts = [
      `order_id=eq.${numericOrderId}`,
      "order=ts.desc",
      `limit=${limitValue}`,
    ];
    const query = `?${queryParts.join("&")}`;
    return sbSelect("audit_log", query);
  },
};

function buildSelectQuery(query = "") {
  const trimmed = (query || "").trim();
  if (!trimmed) {
    return "?select=*";
  }

  const withoutPrefix = trimmed.startsWith("?") ? trimmed.slice(1) : trimmed;
  if (!withoutPrefix.length) {
    return "?select=*";
  }

  const parts = withoutPrefix.split("&").filter(Boolean);
  const hasSelect = parts.some((part) => part.toLowerCase().startsWith("select="));
  if (!hasSelect) {
    parts.unshift("select=*");
  }

  return `?${parts.join("&")}`;
}

async function sbSelect(table, query = "") {
  return tryWrap(async () => {
    const normalizedQuery = buildSelectQuery(query);
    const r = await fetch(`${SUPABASE_REST_URL}/${table}${normalizedQuery}`, { headers: SB_HEADERS });
    const data = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(data));
    return data;
  });
}

async function sbInsert(table, rows) {
  return tryWrap(async () => {
    const r = await fetch(`${SUPABASE_REST_URL}/${table}`, {
      method: "POST",
      headers: { ...SB_HEADERS, "Prefer": "return=representation" },
      body: JSON.stringify(rows)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(data));
    return data;
  });
}

async function sbUpdate(table, match, patch) {
  return tryWrap(async () => {
    const r = await fetch(`${SUPABASE_REST_URL}/${table}?${match}`, {
      method: "PATCH",
      headers: { ...SB_HEADERS, "Prefer": "return=representation" },
      body: JSON.stringify(patch)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(data));
    return data;
  });
}

async function sbDelete(table, match) {
  return tryWrap(async () => {
    const r = await fetch(`${SUPABASE_REST_URL}/${table}?${match}`, {
      method: "DELETE",
      headers: SB_HEADERS
    });
    if (!r.ok) throw new Error(await r.text());
    return true;
  });
}

function tryParseJson(value) {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
}

function pickErrorMessage(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (obj.code === "23505") {
    const detailText = typeof obj.details === "string" ? obj.details.toLowerCase() : "";
    const messageText = typeof obj.message === "string" ? obj.message.toLowerCase() : "";
    if (detailText.includes("email") || messageText.includes("email")) {
      return "Dit e-mailadres is al geregistreerd.";
    }
  }
  const candidates = [obj.message, obj.error_description, obj.error, obj.details];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function formatSupabaseError(error, fallback = "Onbekende fout") {
  if (!error) return fallback;

  if (typeof error === "string") {
    const parsed = tryParseJson(error);
    if (parsed) {
      const parsedMessage = pickErrorMessage(parsed);
      if (parsedMessage) return parsedMessage;
    }
    return error;
  }

  if (typeof error.message === "string") {
    const parsed = tryParseJson(error.message);
    if (parsed) {
      const parsedMessage = pickErrorMessage(parsed);
      if (parsedMessage) return parsedMessage;
    }
    if (error.message.trim()) {
      return error.message.trim();
    }
  }

  const objectMessage = pickErrorMessage(error);
  if (objectMessage) return objectMessage;

  return fallback;
}

// Domein-functies
const Orders = {
  list: async (filters = {}, options = {}) => {
    const params = [];
    if (filters.region) params.push(`region=eq.${encodeURIComponent(filters.region)}`);
    if (filters.status) params.push(`status=eq.${encodeURIComponent(filters.status)}`);
    if (filters.date) params.push(`due_date=eq.${encodeURIComponent(filters.date)}`);
    if (filters.plannedDate) params.push(`planned_date=eq.${encodeURIComponent(filters.plannedDate)}`);
    if (filters.customer) {
      const customerTerm = encodeURIComponent(`*${filters.customer}*`);
      params.push(`customer_name.ilike.${customerTerm}`);
    }
    if (filters.customerOrder) {
      const orderTerm = encodeURIComponent(`*${filters.customerOrder}*`);
      params.push(`customer_order_number.ilike.${orderTerm}`);
    }
    if (filters.search) {
      const searchTerm = encodeURIComponent(`*${filters.search}*`);
      params.push(
        `or=(customer_name.ilike.${searchTerm},request_reference.ilike.${searchTerm},order_reference.ilike.${searchTerm},customer_order_number.ilike.${searchTerm},order_description.ilike.${searchTerm},pickup_location.ilike.${searchTerm},delivery_location.ilike.${searchTerm},notes.ilike.${searchTerm})`
      );
    }
    const createdBy = filters.createdBy;
    if (createdBy !== undefined && createdBy !== null && String(createdBy).length) {
      params.push(`created_by=eq.${encodeURIComponent(createdBy)}`);
    }
    const sortOption = options.sort;
    const sortDescriptors = Array.isArray(sortOption) ? sortOption : (sortOption ? [sortOption] : []);
    const orderClauses = [];
    for (const descriptor of sortDescriptors) {
      if (!descriptor || !descriptor.field) continue;
      const direction = descriptor.direction === "desc" ? "desc" : "asc";
      let clause = `${descriptor.field}.${direction}`;
      if (descriptor.nulls === "first") {
        clause += ".nullsfirst";
      } else if (descriptor.nulls === "last" || descriptor.nulls === "nullslast") {
        clause += ".nullslast";
      }
      orderClauses.push(clause);
    }
    if (!orderClauses.length) {
      orderClauses.push("due_date.asc");
    }
    if (!orderClauses.some((clause) => clause.startsWith("id."))) {
      orderClauses.push("id.asc");
    }
    params.push(`order=${orderClauses.join(",")}`);

    const pageSizeValue = Number(options.pageSize);
    const hasPagination = Number.isFinite(pageSizeValue) && pageSizeValue > 0;
    let pageValue = Number(options.page);
    if (!Number.isFinite(pageValue) || pageValue < 1) {
      pageValue = 1;
    }
    pageValue = Math.floor(pageValue);
    if (pageValue < 1) {
      pageValue = 1;
    }
    let limitValue = null;
    let offsetValue = null;
    if (hasPagination) {
      limitValue = Math.max(1, Math.floor(pageSizeValue));
      offsetValue = Math.max(0, (pageValue - 1) * limitValue);
      params.push(`limit=${limitValue}`);
      params.push(`offset=${offsetValue}`);
    }

    const rawQuery = params.length ? `?${params.join("&")}` : "";
    const qs = buildSelectQuery(rawQuery);

    const headers = { ...SB_HEADERS };
    if (hasPagination) {
      const from = offsetValue;
      const to = Math.max(from, from + limitValue - 1);
      headers.Range = `${from}-${to}`;
      headers.Prefer = headers.Prefer ? `${headers.Prefer},count=exact` : "count=exact";
    }

    const { response, data } = await tryWrap(async () => {
      const response = await fetch(`${SUPABASE_REST_URL}/transport_orders${qs}`, { headers });
      const data = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(data));
      return { response, data };
    });

    let total = Array.isArray(data) ? data.length : 0;
    if (hasPagination) {
      const contentRange = response.headers.get("content-range");
      if (contentRange) {
        const totalPart = contentRange.split("/")[1];
        if (totalPart && totalPart !== "*") {
          const parsedTotal = Number(totalPart);
          if (Number.isFinite(parsedTotal)) {
            total = parsedTotal;
          }
        }
      }
    }

    return {
      rows: Array.isArray(data) ? data : [],
      total,
      page: hasPagination ? pageValue : 1,
      pageSize: hasPagination ? limitValue : (Array.isArray(data) ? data.length : 0),
    };
  },
  create: async (o) => {
    const rows = await sbInsert("transport_orders", [o]);
    const created = Array.isArray(rows) ? rows[0] : rows;
    if (created && created.id !== undefined && created.id !== null) {
      await AuditLog.recordOrderAction(created.id, "create", { data: created }).catch(() => {});
    }
    return created;
  },
  update: async (id, patch) => {
    const rows = await sbUpdate("transport_orders", `id=eq.${id}`, patch);
    const updated = Array.isArray(rows) ? rows[0] : rows;
    const numericOrderId = Number(id ?? updated?.id);
    if (Number.isFinite(numericOrderId)) {
      await AuditLog.recordOrderAction(numericOrderId, "update", { patch, result: updated }).catch(() => {});
    }
    return rows;
  },
  delete: async (id) => {
    const numericOrderId = Number(id);
    const result = await sbDelete("transport_orders", `id=eq.${id}`);
    if (result && Number.isFinite(numericOrderId)) {
      await AuditLog.recordOrderAction(numericOrderId, "delete", null).catch(() => {});
    }
    return result;
  },
  latestReference: async () => {
    const query = "?select=request_reference,reference,created_at&request_reference=not.is.null&order=created_at.desc&limit=1";
    const { response, data } = await tryWrap(async () => {
      const response = await fetch(`${SUPABASE_REST_URL}/transport_orders${query}`, { headers: SB_HEADERS });
      const data = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(data));
      return { response, data };
    });
    if (!Array.isArray(data) || !data.length) {
      return null;
    }
    return data[0];
  },
};

const Lines = {
  create: (row) => sbInsert("transport_lines", [row]).then(r => r[0]),
  listByOrder: (orderId) => sbSelect("transport_lines", `?order_id=eq.${orderId}`),
};

const Carriers = {
  list: () => sbSelect("carriers", "?order=name.asc"),
  create: (c) => sbInsert("carriers", [c]).then(r => r[0]),
  update: (id, patch) => sbUpdate("carriers", `id=eq.${id}`, patch),
};

const Users = {
  list: () => sbSelect(
    "app_users",
    "?select=id,full_name,email,role,is_active,created_at&order=full_name.asc"
  ),
  create: (user) => sbInsert("app_users", [user]).then(r => r[0]),
  update: (id, patch) => sbUpdate("app_users", `id=eq.${id}`, patch).then(r => r[0]),
  remove: (id) => sbDelete("app_users", `id=eq.${id}`),
  setPassword: (id, passwordHash) =>
    sbUpdate("app_users", `id=eq.${id}`, { password_hash: passwordHash }).then(r => r[0]),
  authenticate: async (email, passwordHash) => {
    const query = `?select=id,full_name,email,role,is_active&email=eq.${encodeURIComponent(email)}&password_hash=eq.${encodeURIComponent(passwordHash)}`;
    const result = await sbSelect("app_users", query);
    return result[0] || null;
  }
};

window.Orders = Orders;
window.Lines = Lines;
window.Carriers = Carriers;
window.Users = Users;
window.AuditLog = AuditLog;
window.ApiHelpers = Object.assign({}, window.ApiHelpers, { formatSupabaseError, tryWrap });
