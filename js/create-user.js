(function () {
  function setCreateStatus(message, variant = "default") {
    const el = document.getElementById("createUserStatus");
    if (!el) return;
    el.textContent = message;
    el.classList.remove("status-error", "status-success");
    if (variant === "error") {
      el.classList.add("status-error");
    } else if (variant === "success") {
      el.classList.add("status-success");
    }
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

  document.addEventListener("DOMContentLoaded", () => {
    const createForm = document.getElementById("createUserForm");
    const btnCreate = document.getElementById("btnCreateUser");

    const adminEmail = document.getElementById("adminEmail");
    const adminPassword = document.getElementById("adminPassword");
    const newUserName = document.getElementById("newUserName");
    const newUserEmail = document.getElementById("newUserEmail");
    const newUserRole = document.getElementById("newUserRole");
    const newUserPassword = document.getElementById("newUserPassword");

    if (!createForm || !window.Auth || !window.Users) return;

    createForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const adminMailValue = adminEmail?.value || "";
      const adminPasswordValue = adminPassword?.value || "";
      const newNameValue = newUserName?.value || "";
      const newEmailValue = newUserEmail?.value || "";
      const newRoleValue = newUserRole?.value || "";
      const newPasswordValue = newUserPassword?.value || "";

      try {
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

        const normalizedAdminEmail = normalizeMotracEmail(adminMailValue);
        const normalizedUserEmail = normalizeMotracEmail(newEmailValue);

        setCreateStatus("Nieuwe gebruiker wordt aangemaakt…");
        if (btnCreate) {
          btnCreate.disabled = true;
        }

        const adminHash = await window.Auth.hashPassword(adminPasswordValue);
        const adminUser = await window.Users.authenticate(normalizedAdminEmail, adminHash);
        if (!adminUser || adminUser.role !== "admin") {
          throw new Error("Alleen admins kunnen nieuwe gebruikers aanmaken");
        }

        const newPasswordHash = await window.Auth.hashPassword(newPasswordValue);
        await window.Users.create({
          full_name: newNameValue.trim(),
          email: normalizedUserEmail,
          role: newRoleValue,
          password_hash: newPasswordHash,
          is_active: true,
        });

        setCreateStatus("Nieuwe gebruiker is aangemaakt", "success");
        createForm.reset();
        if (newUserRole) {
          newUserRole.value = "";
        }
      } catch (err) {
        console.error(err);
        const message = window.ApiHelpers?.formatSupabaseError
          ? window.ApiHelpers.formatSupabaseError(err, "Gebruiker aanmaken mislukt")
          : err?.message || "Gebruiker aanmaken mislukt";
        setCreateStatus(message, "error");
      } finally {
        if (btnCreate) {
          btnCreate.disabled = false;
        }
      }
    });
  });
})();
