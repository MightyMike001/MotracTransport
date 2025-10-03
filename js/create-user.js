(function () {
  window.Pages = window.Pages || {};

  function refreshElements(root) {
    const scope = root || document;
    return {
      form: scope.querySelector("#createUserForm"),
      btnCreate: scope.querySelector("#btnCreateUser"),
      adminEmail: scope.querySelector("#adminEmail"),
      adminPassword: scope.querySelector("#adminPassword"),
      newUserName: scope.querySelector("#newUserName"),
      newUserEmail: scope.querySelector("#newUserEmail"),
      newUserRole: scope.querySelector("#newUserRole"),
      newUserPassword: scope.querySelector("#newUserPassword"),
      status: scope.querySelector("#createUserStatus"),
    };
  }

  let els = {};
  const listeners = [];
  let formValidator = null;

  const MOTRAC_EMAIL_PATTERN = /^[^@\s]+@motrac\.nl$/i;

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

  function setCreateStatus(message, variant = "default") {
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

  function buildValidationSchema() {
    return {
      adminEmail: {
        required: "Vul je admin e-mailadres in.",
        validate: (value) => {
          try {
            const normalized = normalizeMotracEmail(value);
            return MOTRAC_EMAIL_PATTERN.test(normalized)
              ? true
              : "Gebruik je Motrac e-mailadres.";
          } catch (err) {
            return err?.message || "Gebruik je Motrac e-mailadres.";
          }
        },
      },
      adminPassword: {
        required: "Vul je admin wachtwoord in.",
      },
      newUserName: {
        required: "Vul de naam van de nieuwe gebruiker in.",
        minLength: {
          value: 2,
          message: "De naam moet minimaal 2 tekens bevatten.",
        },
      },
      newUserEmail: {
        required: "Vul het e-mailadres van de nieuwe gebruiker in.",
        validate: (value) => {
          try {
            const normalized = normalizeMotracEmail(value);
            return MOTRAC_EMAIL_PATTERN.test(normalized)
              ? true
              : "Het e-mailadres moet eindigen op @motrac.nl.";
          } catch (err) {
            return err?.message || "Het e-mailadres moet eindigen op @motrac.nl.";
          }
        },
      },
      newUserRole: {
        required: "Kies een rol voor de nieuwe gebruiker.",
        validate: (value) => {
          if (["planner", "werknemer"].includes(value)) {
            return true;
          }
          return "Kies een geldige rol.";
        },
      },
      newUserPassword: {
        required: "Vul een tijdelijk wachtwoord in.",
        minLength: {
          value: 6,
          message: "Het wachtwoord moet minimaal 6 tekens bevatten.",
        },
      },
    };
  }

  function normalizeMotracEmail(email) {
    const cleaned = (email || "").trim().toLowerCase();
    if (!cleaned) return "";
    if (!cleaned.includes("@")) {
      return `${cleaned}@motrac.nl`;
    }
    if (!cleaned.endsWith("@motrac.nl")) {
      throw new Error("Het e-mailadres moet eindigen op @motrac.nl");
    }
    return cleaned;
  }

  function setupValidation() {
    formValidator = null;
    if (!els.form || !window.FormValidation?.createValidator) {
      return;
    }
    formValidator = window.FormValidation.createValidator(
      els.form,
      buildValidationSchema(),
      addListener
    );
    if (formValidator && typeof formValidator.reset === "function") {
      formValidator.reset();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!els.form || !window.Auth || !window.Users) return;

    if (formValidator && typeof formValidator.validate === "function") {
      const valid = formValidator.validate();
      if (!valid) {
        setCreateStatus("Controleer de gemarkeerde velden.", "error");
        return;
      }
    }

    const adminMailValue = (els.adminEmail?.value || "").trim();
    const adminPasswordValue = els.adminPassword?.value || "";
    const newNameValue = (els.newUserName?.value || "").trim();
    const newEmailValue = (els.newUserEmail?.value || "").trim();
    const newRoleValue = els.newUserRole?.value || "";
    const newPasswordValue = els.newUserPassword?.value || "";

    try {
      if (!formValidator) {
        if (!adminMailValue || !adminPasswordValue) {
          throw new Error("Vul je admin e-mailadres en wachtwoord in");
        }
        if (!newNameValue || !newEmailValue || !newRoleValue || !newPasswordValue) {
          throw new Error("Vul alle velden voor de nieuwe gebruiker in");
        }
        if (!["planner", "werknemer"].includes(newRoleValue)) {
          throw new Error("Kies een geldige rol voor de gebruiker");
        }
        if (newPasswordValue.length < 6) {
          throw new Error("Het tijdelijke wachtwoord moet minimaal 6 tekens bevatten");
        }
      }

      const normalizedAdminEmail = normalizeMotracEmail(adminMailValue);
      const normalizedUserEmail = normalizeMotracEmail(newEmailValue);

      setCreateStatus("Nieuwe gebruiker wordt aangemaakt…");
      if (els.btnCreate) {
        els.btnCreate.disabled = true;
      }

      const adminHash = await window.Auth.hashPassword(adminPasswordValue);
      const adminAuth = await window.Users.authenticate(normalizedAdminEmail, adminHash);
      const adminUser = adminAuth?.user || adminAuth;
      if (!adminUser || adminUser.role !== "admin") {
        throw new Error("Alleen admins kunnen nieuwe gebruikers aanmaken");
      }
      if (!adminUser.is_active) {
        throw new Error(
          "Dit admin-account is gedeactiveerd. Neem contact op met een beheerder voor ondersteuning."
        );
      }

      const newPasswordHash = await window.Auth.hashPassword(newPasswordValue);
      await window.Users.create({
        full_name: newNameValue.trim(),
        email: normalizedUserEmail,
        role: newRoleValue,
        password_hash: newPasswordHash,
        is_active: true,
      });

      const successMessage = "Nieuwe gebruiker is aangemaakt";
      setCreateStatus(successMessage, "success");
      notify("success", successMessage);
      els.form.reset();
      if (els.newUserRole) {
        els.newUserRole.value = "";
      }
      if (formValidator && typeof formValidator.reset === "function") {
        formValidator.reset();
      }
    } catch (err) {
      console.error(err);
      const message = window.ApiHelpers?.formatSupabaseError
        ? window.ApiHelpers.formatSupabaseError(err, "Gebruiker aanmaken mislukt")
        : err?.message || "Gebruiker aanmaken mislukt";
      setCreateStatus(message, "error");
      notify("error", message);
    } finally {
      if (els.btnCreate) {
        els.btnCreate.disabled = false;
      }
    }
  }

  function init(context = {}) {
    els = refreshElements(context.root || document);
    removeListeners();
    setupValidation();
    if (els.form) {
      addListener(els.form, "submit", handleSubmit);
    }
  }

  function destroy() {
    removeListeners();
    if (formValidator && typeof formValidator.reset === "function") {
      formValidator.reset();
    }
    formValidator = null;
    els = {};
  }

  window.Pages["create-user"] = {
    init,
    destroy,
  };
})();
