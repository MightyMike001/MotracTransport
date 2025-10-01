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

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const email = document.getElementById("loginEmail");
    const password = document.getElementById("loginPassword");
    const button = document.getElementById("btnLogin");

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
  });
})();
