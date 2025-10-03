(function () {
  const STORAGE_KEY = "transportplanner_user_v1";
  const listeners = new Set();
  let cachedUser = null;
  let domReady = false;
  let cachedAuthToken = null;

  const storageAvailable = (() => {
    try {
      const testKey = "__auth_test__";
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch (err) {
      console.warn("Kan localStorage niet gebruiken voor sessies", err);
      return false;
    }
  })();

  function readStoredUser() {
    if (!storageAvailable) return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        cachedAuthToken = null;
        return null;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        cachedAuthToken = parsed.token || parsed.authToken || null;
      }
      return parsed;
    } catch (err) {
      console.warn("Kan gebruikerssessie niet lezen", err);
      cachedAuthToken = null;
      return null;
    }
  }

  function writeStoredUser(user) {
    if (!storageAvailable) return;
    try {
      if (user) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.warn("Kan gebruikerssessie niet opslaan", err);
    }
  }

  function getUser() {
    if (cachedUser) return cachedUser;
    cachedUser = readStoredUser();
    return cachedUser;
  }

  function setUser(user) {
    cachedUser = user || null;
    cachedAuthToken = cachedUser?.token || cachedUser?.authToken || null;
    writeStoredUser(cachedUser);
    notify();
  }

  function getAuthToken() {
    if (cachedAuthToken) return cachedAuthToken;
    const user = getUser();
    cachedAuthToken = user?.token || user?.authToken || null;
    return cachedAuthToken;
  }

  async function hashPassword(password) {
    if (!password) return "";
    if (window.crypto?.subtle) {
      const data = new TextEncoder().encode(password);
      const hash = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hash));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    // Fallback (niet cryptografisch veilig, maar voorkomt blokkeren op oudere browsers)
    let hash = 0;
    for (let i = 0; i < password.length; i += 1) {
      hash = (hash << 5) - hash + password.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(16);
  }

  function formatRole(role) {
    if (!role) return "";
    const labels = {
      admin: "Admin",
      planner: "Planner",
      werknemer: "Werknemer",
      "in aanvraag": "In aanvraag",
    };
    return labels[role] || role;
  }

  async function login(email, password) {
    const cleanedEmail = (email || "").trim().toLowerCase();
    const passwordHash = await hashPassword(password || "");
    if (!cleanedEmail || !passwordHash) {
      throw new Error("Vul een e-mailadres en wachtwoord in.");
    }
    if (!window.Users || typeof window.Users.authenticate !== "function") {
      throw new Error("Users API is niet beschikbaar");
    }
    const authResult = await window.Users.authenticate(cleanedEmail, passwordHash);
    const user = authResult?.user || authResult;
    const token = authResult?.token || authResult?.authToken || null;
    if (!user) {
      throw new Error("Onjuiste inloggegevens");
    }
    if (!user.is_active) {
      throw new Error("Dit account is gedeactiveerd");
    }
    const session = {
      id: user.id,
      name: user.full_name,
      email: user.email,
      role: user.role,
      token: token || null,
    };
    if (token) {
      session.authToken = token;
    }
    setUser(session);
    return session;
  }

  function logout() {
    setUser(null);
  }

  function updateAuthArea() {
    const area = document.getElementById("authArea");
    if (!area) return;
    const user = getUser();
    if (!user) {
      area.innerHTML = '<a class="btn primary small" href="login.html" data-route="login">Inloggen</a>';
      return;
    }
    area.innerHTML = `
      <div class="auth-summary">
        <span class="auth-user">${user.name}</span>
        <span class="auth-role">${formatRole(user.role)}</span>
      </div>
      <button class="btn ghost small" id="btnLogout" type="button">Uitloggen</button>
    `;
    const btn = document.getElementById("btnLogout");
    if (btn) {
      btn.addEventListener("click", (evt) => {
        evt.preventDefault();
        logout();
      });
    }
  }

  function applyRoleVisibility() {
    const user = getUser();
    const visible = document.querySelectorAll("[data-role-visible]");
    visible.forEach((el) => {
      const roles = el.dataset.roleVisible
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      if (!user || !roles.includes(user.role)) {
        el.classList.add("is-hidden-role");
      } else {
        el.classList.remove("is-hidden-role");
      }
    });
  }

  function enforceAccess() {
    if (window.Router && typeof window.Router.handleAuthChange === "function") {
      window.Router.handleAuthChange();
    }
  }

  function notify() {
    if (domReady) {
      updateAuthArea();
      applyRoleVisibility();
      enforceAccess();
    }
    const currentUser = getUser();
    listeners.forEach((listener) => {
      try {
        listener(currentUser);
      } catch (err) {
        console.error("Fout in auth listener", err);
      }
    });
  }

  function onChange(handler) {
    if (typeof handler === "function") {
      listeners.add(handler);
      return () => listeners.delete(handler);
    }
    return () => {};
  }

  window.Auth = {
    getUser,
    getAuthToken,
    login,
    logout,
    hashPassword,
    onChange,
    applyRoleVisibility,
  };

  document.addEventListener("DOMContentLoaded", () => {
    domReady = true;
    if (!cachedUser) {
      cachedUser = readStoredUser();
    }
    notify();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      cachedUser = readStoredUser();
      notify();
    }
  });
})();
