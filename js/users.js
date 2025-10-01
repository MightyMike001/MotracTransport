(function () {
  const els = {
    form: document.getElementById("userForm"),
    name: document.getElementById("uName"),
    email: document.getElementById("uEmail"),
    role: document.getElementById("uRole"),
    password: document.getElementById("uPassword"),
    active: document.getElementById("uActive"),
    status: document.getElementById("userStatus"),
    tableBody: document.querySelector("#userTable tbody"),
    reload: document.getElementById("btnReloadUsers"),
  };

  let USER_CACHE = [];

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

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("nl-NL", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function renderUsers(users) {
    if (!els.tableBody) return;
    if (!users.length) {
      els.tableBody.innerHTML = '<tr><td colspan="6" class="muted">Geen gebruikers gevonden.</td></tr>';
      return;
    }

    const rows = users
      .map((user) => {
        const toggleLabel = user.is_active ? "Deactiveer" : "Activeer";
        const statusLabel = user.is_active ? "Actief" : "Gedeactiveerd";
        return `
          <tr data-id="${user.id}">
            <td>${user.full_name}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>${statusLabel}</td>
            <td>${formatDate(user.created_at)}</td>
            <td class="actions">
              <button class="btn ghost small" data-action="toggle">${toggleLabel}</button>
              <button class="btn small" data-action="reset">Reset wachtwoord</button>
            </td>
          </tr>
        `;
      })
      .join("");

    els.tableBody.innerHTML = rows;
  }

  async function loadUsers(showMessage = false) {
    if (!window.Users) {
      setStatus("Users API niet beschikbaar", "error");
      return;
    }
    try {
      if (showMessage) setStatus("Gebruikers laden…");
      USER_CACHE = await window.Users.list();
      renderUsers(USER_CACHE);
      if (showMessage) setStatus("Gebruikers bijgewerkt", "success");
    } catch (err) {
      console.error(err);
      setStatus("Kan gebruikers niet laden", "error");
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!els.form || !window.Users || !window.Auth) return;
    const name = (els.name?.value || "").trim();
    const email = (els.email?.value || "").trim().toLowerCase();
    const role = els.role?.value || "werknemer";
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
      setStatus("Gebruiker toegevoegd", "success");
      els.form.reset();
      if (els.active) els.active.checked = true;
      await loadUsers(false);
    } catch (err) {
      console.error(err);
      setStatus("Opslaan mislukt: " + (err.message || "onbekende fout"), "error");
    }
  }

  async function toggleActive(id) {
    if (!window.Users) return;
    const user = USER_CACHE.find((u) => u.id === id);
    if (!user) return;
    try {
      setStatus("Status wijzigen…");
      await window.Users.update(id, { is_active: !user.is_active });
      setStatus("Status bijgewerkt", "success");
      await loadUsers(false);
    } catch (err) {
      console.error(err);
      setStatus("Kon status niet wijzigen", "error");
    }
  }

  async function resetPassword(id) {
    if (!window.Users || !window.Auth) return;
    const user = USER_CACHE.find((u) => u.id === id);
    if (!user) return;
    const newPassword = window.prompt(`Nieuw wachtwoord voor ${user.full_name}:`);
    if (!newPassword) return;
    try {
      setStatus("Wachtwoord wordt bijgewerkt…");
      const hash = await window.Auth.hashPassword(newPassword);
      await window.Users.setPassword(id, hash);
      setStatus("Wachtwoord opnieuw ingesteld", "success");
    } catch (err) {
      console.error(err);
      setStatus("Kon wachtwoord niet bijwerken", "error");
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

  document.addEventListener("DOMContentLoaded", () => {
    if (els.form) {
      els.form.addEventListener("submit", handleCreate);
    }
    if (els.reload) {
      els.reload.addEventListener("click", (event) => {
        event.preventDefault();
        loadUsers(true);
      });
    }
    if (els.tableBody) {
      els.tableBody.addEventListener("click", handleAction);
    }
    loadUsers(true);
  });
})();
