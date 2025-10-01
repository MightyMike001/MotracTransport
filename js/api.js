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

async function sbSelect(table, query="") {
  const r = await fetch(`${SUPABASE_URL}/${table}${query}`, { headers: SB_HEADERS });
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

// Domein-functies
const Orders = {
  list: (filters = {}) => {
    const params = [];
    if (filters.region) params.push(`region=eq.${encodeURIComponent(filters.region)}`);
    if (filters.status) params.push(`status=eq.${encodeURIComponent(filters.status)}`);
    const createdBy = filters.createdBy;
    if (createdBy !== undefined && createdBy !== null && String(createdBy).length) {
      params.push(`created_by=eq.${encodeURIComponent(createdBy)}`);
    }
    params.push("order=due_date.asc");
    const qs = `?${params.join("&")}`;
    return sbSelect("transport_orders", qs);
  },
  create: (o) => sbInsert("transport_orders", [o]).then(r => r[0]),
  update: (id, patch) => sbUpdate("transport_orders", `id=eq.${id}`, patch),
  delete: (id) => sbDelete("transport_orders", `id=eq.${id}`),
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
