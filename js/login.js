(function () {
  window.Pages = window.Pages || {};

  function refreshElements(root) {
    const scope = root || document;
    return {
      loginForm: scope.querySelector("#loginForm"),
      loginEmail: scope.querySelector("#loginEmail"),
      loginPassword: scope.querySelector("#loginPassword"),
      loginButton: scope.querySelector("#btnLogin"),
      loginStatus: scope.querySelector("#loginStatus"),
      signupForm: scope.querySelector("#signupForm"),
      signupEmail: scope.querySelector("#signupEmail"),
      signupPassword: scope.querySelector("#signupPassword"),
      signupPasswordConfirm: scope.querySelector("#signupPasswordConfirm"),
      signupButton: scope.querySelector("#btnSignup"),
      signupStatus: scope.querySelector("#signupStatus"),
    };
  }

  let els = {};
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
    if (!els.loginStatus) return;
    els.loginStatus.textContent = message;
    els.loginStatus.classList.remove("status-error", "status-success");
    if (variant === "error") {
      els.loginStatus.classList.add("status-error");
    } else if (variant === "success") {
      els.loginStatus.classList.add("status-success");
    }
  }

  function setSignupStatus(message, variant = "default") {
    if (!els.signupStatus) return;
    els.signupStatus.textContent = message;
    els.signupStatus.classList.remove("status-error", "status-success");
    if (variant === "error") {
      els.signupStatus.classList.add("status-error");
    } else if (variant === "success") {
      els.signupStatus.classList.add("status-success");
    }
  }

  function normalizeEmail(value) {
    return (value || "").trim().toLowerCase();
  }

  function deriveNameFromEmail(email) {
    if (!email || !email.includes("@")) return email;
    const localPart = email.split("@")[0] || "";
    if (!localPart) return email;
    const words = localPart
      .split(/[.\-_]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
    return words.length ? words.join(" ") : email;
  }

  function formatApiError(err) {
    if (!err) return "Onbekende fout";
    if (err.message) {
      try {
        const parsed = JSON.parse(err.message);
        if (parsed?.message) {
          if (parsed.code === "23505") {
            return "Dit e-mailadres is al geregistreerd.";
          }
          return parsed.message;
        }
      } catch (parseErr) {
        // ignore
      }
      return err.message;
    }
    return String(err);
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (!els.loginEmail || !els.loginPassword || !window.Auth) return;
    const mailValue = els.loginEmail.value;
    const passValue = els.loginPassword.value;
    setStatus("Controleren…");
    if (els.loginButton) {
      els.loginButton.disabled = true;
    }
    try {
      await window.Auth.login(mailValue, passValue);
      setStatus("Succesvol ingelogd, even geduld…", "success");
      window.setTimeout(() => {
        if (window.Router && typeof window.Router.navigate === "function") {
          window.Router.navigate("start", { replace: true });
        }
      }, 300);
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Inloggen mislukt", "error");
    } finally {
      if (els.loginButton) {
        els.loginButton.disabled = false;
      }
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    if (!els.signupForm || !window.Users || !window.Auth) return;

    const emailValue = normalizeEmail(els.signupEmail?.value);
    const passwordValue = els.signupPassword?.value || "";
    const confirmValue = els.signupPasswordConfirm?.value || "";

    if (!emailValue || !emailValue.includes("@")) {
      setSignupStatus("Vul een geldig e-mailadres in", "error");
      return;
    }

    if (!passwordValue || passwordValue.length < 6) {
      setSignupStatus("Het wachtwoord moet minimaal 6 tekens bevatten", "error");
      return;
    }

    if (passwordValue !== confirmValue) {
      setSignupStatus("De wachtwoorden komen niet overeen", "error");
      return;
    }

    try {
      setSignupStatus("Account wordt aangevraagd…");
      if (els.signupButton) els.signupButton.disabled = true;

      const passwordHash = await window.Auth.hashPassword(passwordValue, emailValue);
      const fullName = deriveNameFromEmail(emailValue);

      await window.Users.create({
        full_name: fullName,
        email: emailValue,
        role: "in aanvraag",
        password_hash: passwordHash,
        is_active: true,
      });

      setSignupStatus(
        "Account aangevraagd! Je kunt nu inloggen. Een beheerder wijst binnenkort je rol toe.",
        "success"
      );
      els.signupForm.reset();
    } catch (err) {
      console.error(err);
      setSignupStatus(formatApiError(err), "error");
    } finally {
      if (els.signupButton) els.signupButton.disabled = false;
    }
  }

  function init(context = {}) {
    els = refreshElements(context.root || document);
    removeListeners();
    if (els.loginForm) {
      addListener(els.loginForm, "submit", handleLogin);
    }
    if (els.signupForm) {
      addListener(els.signupForm, "submit", handleSignup);
    }
  }

  function destroy() {
    removeListeners();
    els = {};
  }

  window.Pages.login = {
    init,
    destroy,
  };
})();
