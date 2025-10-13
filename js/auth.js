(function () {
  const STORAGE_KEY = "transportplanner_user_v1";
  const listeners = new Set();
  let cachedUser = null;
  let domReady = false;
  let cachedAuthToken = null;

  const PASSWORD_PBKDF2_ITERATIONS = 150000;
  const PASSWORD_KEY_LENGTH_BITS = 256;

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

  function normalizeSaltSource(value) {
    if (typeof value !== "string") return "";
    return value.trim().toLowerCase();
  }

  function encodeBytesToBase64(bytes) {
    if (!(bytes instanceof Uint8Array)) {
      return "";
    }
    const base64Encoder =
      (typeof window !== "undefined" && typeof window.btoa === "function")
        ? window.btoa.bind(window)
        : typeof btoa === "function"
          ? btoa
          : null;
    if (!base64Encoder) {
      return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return base64Encoder(binary);
  }

  async function computeLegacyHash(password) {
    const value = typeof password === "string" ? password : String(password || "");
    if (!value) return "";

    if (window.crypto?.subtle) {
      try {
        const data = new TextEncoder().encode(value);
        const hash = await window.crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hash));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch (error) {
        console.warn("SHA-256 hashing niet beschikbaar", error);
      }
    }

    // Fallback (niet cryptografisch veilig, maar voorkomt blokkeren op oudere browsers)
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(16);
  }

  async function computePbkdf2Hash(password, saltSource = "") {
    const value = typeof password === "string" ? password : String(password || "");
    if (!value) return "";
    if (!window.crypto?.subtle) {
      return "";
    }

    try {
      const encoder = new TextEncoder();
      const normalizedSalt = normalizeSaltSource(saltSource) || "transportplanner";
      const saltDigest = await window.crypto.subtle.digest(
        "SHA-256",
        encoder.encode(normalizedSalt)
      );
      const saltBytes = new Uint8Array(saltDigest).slice(0, 16);
      const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(value),
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
      );
      const derivedBits = await window.crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          hash: "SHA-256",
          iterations: PASSWORD_PBKDF2_ITERATIONS,
          salt: saltBytes,
        },
        keyMaterial,
        PASSWORD_KEY_LENGTH_BITS
      );
      const derivedBytes = new Uint8Array(derivedBits);
      const encodedSalt = encodeBytesToBase64(saltBytes);
      const encodedHash = encodeBytesToBase64(derivedBytes);
      if (!encodedSalt || !encodedHash) {
        return "";
      }
      return `pbkdf2$sha256$${PASSWORD_PBKDF2_ITERATIONS}$${encodedSalt}$${encodedHash}`;
    } catch (error) {
      console.warn("PBKDF2 hashing niet beschikbaar", error);
      return "";
    }
  }

  async function hashPassword(password, saltSource = "") {
    const pbkdf2Hash = await computePbkdf2Hash(password, saltSource);
    if (pbkdf2Hash) {
      return pbkdf2Hash;
    }
    return computeLegacyHash(password);
  }

  async function generatePasswordHashes(password, saltSource = "") {
    const candidates = [];
    const primary = await computePbkdf2Hash(password, saltSource);
    const legacy = await computeLegacyHash(password);
    if (primary) {
      candidates.push(primary);
    }
    if (legacy && !candidates.includes(legacy)) {
      candidates.push(legacy);
    }
    return {
      primary: primary || legacy || "",
      legacy,
      hashes: candidates.filter((value) => typeof value === "string" && value.length > 0),
    };
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
    const hashes = await generatePasswordHashes(password || "", cleanedEmail);
    const candidates = Array.isArray(hashes.hashes) ? hashes.hashes.filter(Boolean) : [];
    if (!cleanedEmail || !candidates.length) {
      throw new Error("Vul een e-mailadres en wachtwoord in.");
    }
    if (!window.Users || typeof window.Users.authenticate !== "function") {
      throw new Error("Users API is niet beschikbaar");
    }
    const authResult = await window.Users.authenticate(cleanedEmail, candidates);
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
      <img
        src="LMH_MOTRAC_LOGO_2_Links_RGB.png"
        alt="LMH Motrac logo"
        class="auth-logo"
      />
      <div class="auth-controls">
        <div class="auth-summary">
          <span class="auth-user">${user.name}</span>
          <span class="auth-role">${formatRole(user.role)}</span>
        </div>
        <button class="btn ghost small" id="btnLogout" type="button">Uitloggen</button>
      </div>
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
    generatePasswordHashes,
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
