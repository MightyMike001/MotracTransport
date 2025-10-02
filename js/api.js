if (
  !window.APP_CONFIG ||
  !window.APP_CONFIG.SUPABASE_URL ||
  !window.APP_CONFIG.SUPABASE_ANON_KEY
) {
  throw new Error("Supabase configuratie ontbreekt in window.APP_CONFIG");
}

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;

const SB_HEADERS = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": "Bearer " + SUPABASE_ANON_KEY
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
  const normalizedQuery = buildSelectQuery(query);
  const r = await fetch(`${SUPABASE_URL}/${table}${normalizedQuery}`, { headers: SB_HEADERS });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function sbInsert(table, rows) {
  const r = await fetch(`${SUPABASE_URL}/${table}`, {
    method: "POST",
    headers: { ...SB_HEADERS, "Prefer": "return=representation" },
    body: JSON.stringify(rows)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function sbUpdate(table, match, patch) {
  const r = await fetch(`${SUPABASE_URL}/${table}?${match}`, {
    method: "PATCH",
    headers: { ...SB_HEADERS, "Prefer": "return=representation" },
    body: JSON.stringify(patch)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function sbDelete(table, match) {
  const r = await fetch(`${SUPABASE_URL}/${table}?${match}`, {
    method: "DELETE",
    headers: SB_HEADERS
  });
  if (!r.ok) throw new Error(await r.text());
  return true;
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
    params.push("order=due_date.asc");

    const rawQuery = params.length ? `?${params.join("&")}` : "";
    const qs = buildSelectQuery(rawQuery);

    const pageSizeValue = Number(options.pageSize);
    const hasPagination = Number.isFinite(pageSizeValue) && pageSizeValue > 0;
    let pageValue = Number(options.page);
    if (!Number.isFinite(pageValue) || pageValue < 1) {
      pageValue = 1;
    }

    const headers = { ...SB_HEADERS };
    if (hasPagination) {
      const from = (pageValue - 1) * pageSizeValue;
      const to = from + pageSizeValue - 1;
      headers.Range = `${from}-${Math.max(from, to)}`;
      headers.Prefer = "count=exact";
    }

    const response = await fetch(`${SUPABASE_URL}/transport_orders${qs}`, { headers });
    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));

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
      pageSize: hasPagination ? pageSizeValue : (Array.isArray(data) ? data.length : 0),
    };
  },
  create: (o) => sbInsert("transport_orders", [o]).then(r => r[0]),
  update: (id, patch) => sbUpdate("transport_orders", `id=eq.${id}`, patch),
  delete: (id) => sbDelete("transport_orders", `id=eq.${id}`),
  latestReference: async () => {
    const query = "?select=request_reference,reference,created_at&request_reference=not.is.null&order=created_at.desc&limit=1";
    const response = await fetch(`${SUPABASE_URL}/transport_orders${query}`, { headers: SB_HEADERS });
    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));
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
window.ApiHelpers = Object.assign({}, window.ApiHelpers, { formatSupabaseError });
