(function () {
  window.Pages = window.Pages || {};

  const DATE_UTILS = window.DateUtils || {};
  const formatDateTimeDisplay = typeof DATE_UTILS.formatDateTimeDisplay === "function"
    ? DATE_UTILS.formatDateTimeDisplay
    : (value) => {
        if (!value) return "-";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "-";
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${day}-${month}-${year} ${hours}:${minutes}`;
      };

  function refreshElements(root) {
    const scope = root || document;
    return {
      form: scope.querySelector("#userForm"),
      name: scope.querySelector("#uName"),
      email: scope.querySelector("#uEmail"),
      role: scope.querySelector("#uRole"),
      password: scope.querySelector("#uPassword"),
      active: scope.querySelector("#uActive"),
      status: scope.querySelector("#userStatus"),
      search: scope.querySelector("#userSearch"),
      statusFilter: scope.querySelector("#userStatusFilter"),
      tableBody: scope.querySelector("#userTable tbody"),
      reload: scope.querySelector("#btnReloadUsers"),
    };
  }

  const DEFAULT_ROLE = "werknemer"; // Houd in sync met de standaardwaarde in partials/users.html

  const ROLE_OPTIONS = [
    { value: "in aanvraag", label: "In aanvraag" },
    { value: "planner", label: "Planner" },
    { value: "werknemer", label: "Werknemer" },
    { value: "admin", label: "Admin" },
  ];

  function debounce(fn, delay = 300) {
    let timeoutId = null;
    const debounced = (...args) => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        fn(...args);
      }, delay);
    };
    debounced.cancel = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    return debounced;
  }

  let els = {};
  let USER_CACHE = [];
  let filters = { query: "", status: "all" };
  const runSearch = debounce((value) => {
    updateFilters({ query: value });
  }, 300);
  const listeners = [];

  function addListener(element, type, handler) {
    if (!element || typeof element.addEventListener !== "function") return;
    element.addEventListener(type, handler);
    listeners.push({ element, type, handler });
  }

  function removeListeners() {
    while (listeners.length) {
      const { element, type, handler } = listeners.pop();
      if (element && typeof element.removeEventListener === "function") {
        element.removeEventListener(type, handler);
      }
    }
  }

  function setStatus(message, variant = "default") {
    if (!els.status) return;
    els.status.textContent = message;
    els.status.classList.remove("status-error", "status-success");
    if (variant === "error") {
      els.status.classList.add("status-error");
    } else if (variant === "success") {
      els.status.classList.add("status-success");
    }
  }

  function notify(type, message) {
    if (typeof window.showToast === "function" && message) {
      window.showToast(type, message);
    }
  }

  function formatDate(value) {
    if (!value) return "-";
    const formatted = formatDateTimeDisplay(value);
    if (!formatted || formatted === "-") {
      return typeof value === "string" && value.trim() ? value : "-";
    }
    return formatted;
  }

  function applyFilters() {
    if (!Array.isArray(USER_CACHE)) return [];
    const query = (filters.query || "").trim().toLowerCase();
    const statusFilter = filters.status || "all";

    return USER_CACHE.filter((user) => {
      let matchesQuery = true;
      if (query) {
        const email = (user.email || "").toLowerCase();
        const role = (user.role || "").toLowerCase();
        matchesQuery = email.includes(query) || role.includes(query);
      }

      let matchesStatus = true;
      if (statusFilter === "active") {
        matchesStatus = !!user.is_active;
      } else if (statusFilter === "inactive") {
        matchesStatus = !user.is_active;
      }

      return matchesQuery && matchesStatus;
    });
  }

  function updateFilters(partial = {}) {
    filters = { ...filters, ...partial };
    renderUsers(applyFilters());
  }

  function renderUsers(users) {
    if (!els.tableBody) return;
    els.tableBody.textContent = "";

    if (!users.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.className = "muted";
      cell.textContent = "Geen gebruikers gevonden.";
      row.appendChild(cell);
      els.tableBody.appendChild(row);
      return;
    }

    users.forEach((user) => {
      const row = document.createElement("tr");
      row.dataset.id = String(user.id ?? "");

      const nameCell = document.createElement("td");
      nameCell.textContent = user.full_name || "";
      row.appendChild(nameCell);

      const emailCell = document.createElement("td");
      emailCell.textContent = user.email || "";
      row.appendChild(emailCell);

      const roleCell = document.createElement("td");
      const roleLabel = document.createElement("label");
      roleLabel.className = "sr-only";
      const roleId = `role-${user.id}`;
      roleLabel.htmlFor = roleId;
      roleLabel.textContent = "Rol";
      roleCell.appendChild(roleLabel);

      const roleSelect = document.createElement("select");
      roleSelect.className = "role-select";
      roleSelect.id = roleId;
      roleSelect.dataset.action = "role";
      roleSelect.dataset.id = String(user.id ?? "");

      const currentRole = user.role || "in aanvraag";
      ROLE_OPTIONS.forEach((option) => {
        const opt = document.createElement("option");
        opt.value = option.value;
        opt.textContent = option.label;
        if (option.value === currentRole) {
          opt.selected = true;
        }
        roleSelect.appendChild(opt);
      });

      roleCell.appendChild(roleSelect);
      row.appendChild(roleCell);

      const statusCell = document.createElement("td");
      statusCell.textContent = user.is_active ? "Actief" : "Gedeactiveerd";
      row.appendChild(statusCell);

      const createdCell = document.createElement("td");
      createdCell.textContent = formatDate(user.created_at);
      row.appendChild(createdCell);

      const actionsCell = document.createElement("td");
      actionsCell.className = "actions";

      const toggleButton = document.createElement("button");
      toggleButton.className = "btn ghost small";
      toggleButton.type = "button";
      toggleButton.dataset.action = "toggle";
      toggleButton.textContent = user.is_active ? "Deactiveer" : "Activeer";
      actionsCell.appendChild(toggleButton);

      const resetButton = document.createElement("button");
      resetButton.className = "btn small";
      resetButton.type = "button";
      resetButton.dataset.action = "reset";
      resetButton.textContent = "Reset wachtwoord";
      actionsCell.appendChild(resetButton);

      row.appendChild(actionsCell);

      els.tableBody.appendChild(row);
    });
  }

  async function loadUsers(showMessage = false) {
    if (!window.Users) {
      setStatus("Users API niet beschikbaar", "error");
      return;
    }
    try {
      if (showMessage) setStatus("Gebruikers laden…");
      USER_CACHE = await window.Users.list();
      renderUsers(applyFilters());
      if (showMessage) setStatus("Gebruikers bijgewerkt", "success");
    } catch (err) {
      console.error(err);
      setStatus("Kan gebruikers niet laden", "error");
      notify("error", "Kan gebruikers niet laden");
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!els.form || !window.Users || !window.Auth) return;
    const name = (els.name?.value || "").trim();
    const email = (els.email?.value || "").trim().toLowerCase();
    const role = els.role?.value || DEFAULT_ROLE;
    const password = els.password?.value || "";
    const active = !!els.active?.checked;

    if (!name || !email || !password) {
      setStatus("Vul alle verplichte velden in", "error");
      return;
    }

    try {
      setStatus("Gebruiker wordt opgeslagen…");
      const passwordHash = await window.Auth.hashPassword(password);
      const payload = {
        full_name: name,
        email,
        role,
        password_hash: passwordHash,
        is_active: active,
      };
      await window.Users.create(payload);
      const successMessage = "Gebruiker toegevoegd";
      setStatus(successMessage, "success");
      notify("success", successMessage);
      els.form.reset();
      if (els.active) els.active.checked = true;
      await loadUsers(false);
    } catch (err) {
      console.error(err);
      const message = window.ApiHelpers?.formatSupabaseError
        ? window.ApiHelpers.formatSupabaseError(err, "onbekende fout")
        : err?.message || "onbekende fout";
      setStatus(`Opslaan mislukt: ${message}`, "error");
      notify("error", message);
    }
  }

  async function toggleActive(id) {
    if (!window.Users) return;
    const user = USER_CACHE.find((u) => u.id === id);
    if (!user) return;
    const actionLabel = user.is_active ? "deactiveren" : "activeren";
    const confirmMessage = `Weet je zeker dat je ${user.full_name} wilt ${actionLabel}?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }
    try {
      setStatus("Status wijzigen…");
      await window.Users.update(id, { is_active: !user.is_active });
      const successMessage = "Status bijgewerkt";
      setStatus(successMessage, "success");
      notify("success", successMessage);
      await loadUsers(false);
    } catch (err) {
      console.error(err);
      const message = window.ApiHelpers?.formatSupabaseError
        ? window.ApiHelpers.formatSupabaseError(err, "Kon status niet wijzigen")
        : "Kon status niet wijzigen";
      setStatus(message, "error");
      notify("error", message);
    }
  }

  async function resetPassword(id) {
    if (!window.Users || !window.Auth) return;
    const user = USER_CACHE.find((u) => u.id === id);
    if (!user) return;
    const confirmReset = window.confirm(
      `Weet je zeker dat je het wachtwoord van ${user.full_name} wilt resetten?`
    );
    if (!confirmReset) {
      return;
    }
    const newPassword = window.prompt(`Nieuw wachtwoord voor ${user.full_name}:`);
    const passwordValue = (newPassword || "").trim();
    if (!passwordValue) return;
    try {
      setStatus("Wachtwoord wordt bijgewerkt…");
      const hash = await window.Auth.hashPassword(passwordValue);
      await window.Users.setPassword(id, hash);
      const successMessage = "Wachtwoord opnieuw ingesteld";
      setStatus(successMessage, "success");
      notify("success", successMessage);
    } catch (err) {
      console.error(err);
      const message = window.ApiHelpers?.formatSupabaseError
        ? window.ApiHelpers.formatSupabaseError(err, "Kon wachtwoord niet bijwerken")
        : "Kon wachtwoord niet bijwerken";
      setStatus(message, "error");
      notify("error", message);
    }
  }

  async function updateRole(id, role) {
    if (!window.Users) return;
    const user = USER_CACHE.find((u) => u.id === id);
    if (!user || !role) return;
    if (user.role === role) return;

    const isValid = ROLE_OPTIONS.some((option) => option.value === role);
    if (!isValid) {
      setStatus("Onbekende rol gekozen", "error");
      return;
    }

    try {
      setStatus("Rol wordt bijgewerkt…");
      await window.Users.update(id, { role });
      const successMessage = "Rol bijgewerkt";
      setStatus(successMessage, "success");
      notify("success", successMessage);
      await loadUsers(false);
    } catch (err) {
      console.error(err);
      const message = window.ApiHelpers?.formatSupabaseError
        ? window.ApiHelpers.formatSupabaseError(err, "Kon rol niet bijwerken")
        : "Kon rol niet bijwerken";
      setStatus(message, "error");
      notify("error", message);
    }
  }

  function handleAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    event.preventDefault();
    const row = button.closest("tr[data-id]");
    if (!row) return;
    const id = row.dataset.id;
    const action = button.dataset.action;
    if (action === "toggle") {
      toggleActive(id);
    } else if (action === "reset") {
      resetPassword(id);
    }
  }

  function handleRoleChange(event) {
    const select = event.target.closest("select[data-action='role']");
    if (!select) return;
    const id = select.dataset.id;
    updateRole(id, select.value);
  }

  function handleSearchInput(event) {
    runSearch(event.target.value || "");
  }

  function handleStatusFilter(event) {
    const value = event.target.value || "all";
    updateFilters({ status: value });
  }

  async function init(context = {}) {
    els = refreshElements(context.root || document);
    removeListeners();
    USER_CACHE = [];
    filters = { query: "", status: "all" };
    if (els.form) {
      addListener(els.form, "submit", handleCreate);
    }
    if (els.reload) {
      addListener(els.reload, "click", (event) => {
        event.preventDefault();
        loadUsers(true);
      });
    }
    if (els.search) {
      els.search.value = filters.query;
      addListener(els.search, "input", handleSearchInput);
    }
    if (els.statusFilter) {
      els.statusFilter.value = filters.status;
      addListener(els.statusFilter, "change", handleStatusFilter);
    }
    if (els.tableBody) {
      addListener(els.tableBody, "click", handleAction);
      addListener(els.tableBody, "change", handleRoleChange);
    }
    await loadUsers(true);
  }

  function destroy() {
    removeListeners();
    els = {};
    USER_CACHE = [];
    filters = { query: "", status: "all" };
    if (typeof runSearch.cancel === "function") {
      runSearch.cancel();
    }
  }

  window.Pages.users = {
    init,
    destroy,
  };
})();
