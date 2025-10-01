(function () {
  function setStatus(message, variant = "default") {
    const el = document.getElementById("loginStatus");
    if (!el) return;
    el.textContent = message;
    el.classList.remove("status-error", "status-success");
    if (variant === "error") {
      el.classList.add("status-error");
    } else if (variant === "success") {
      el.classList.add("status-success");
    }
  }

  function setSignupStatus(message, variant = "default") {
    const el = document.getElementById("signupStatus");
    if (!el) return;
    el.textContent = message;
    el.classList.remove("status-error", "status-success");
    if (variant === "error") {
      el.classList.add("status-error");
    } else if (variant === "success") {
      el.classList.add("status-success");
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

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const email = document.getElementById("loginEmail");
    const password = document.getElementById("loginPassword");
    const button = document.getElementById("btnLogin");

    const signupForm = document.getElementById("signupForm");
    const signupEmail = document.getElementById("signupEmail");
    const signupPassword = document.getElementById("signupPassword");
    const signupPasswordConfirm = document.getElementById("signupPasswordConfirm");
    const signupButton = document.getElementById("btnSignup");

    if (!form || !window.Auth) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!email || !password) return;
      const mailValue = email.value;
      const passValue = password.value;

      setStatus("Controleren…");
      button.disabled = true;

      try {
        await window.Auth.login(mailValue, passValue);
        setStatus("Succesvol ingelogd, even geduld…", "success");
        window.setTimeout(() => {
          window.location.href = "index.html";
        }, 400);
      } catch (err) {
        console.error(err);
        setStatus(err.message || "Inloggen mislukt", "error");
      } finally {
        button.disabled = false;
      }
    });

    if (signupForm && window.Users && window.Auth) {
      signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const emailValue = normalizeEmail(signupEmail?.value);
        const passwordValue = signupPassword?.value || "";
        const confirmValue = signupPasswordConfirm?.value || "";

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
          if (signupButton) signupButton.disabled = true;

          const passwordHash = await window.Auth.hashPassword(passwordValue);
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
          signupForm.reset();
        } catch (err) {
          console.error(err);
          setSignupStatus(formatApiError(err), "error");
        } finally {
          if (signupButton) signupButton.disabled = false;
        }
      });
    }
  });
})();
