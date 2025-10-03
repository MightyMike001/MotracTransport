(function () {
  const TOAST_DEFAULT_DURATION = 5000;
  const TOAST_CONTAINER_ID = "toast-container";
  const TOAST_ICONS = {
    success: "✔",
    error: "⚠",
    info: "ℹ",
  };

  function buildToastKey(type, message) {
    const normalizedType = typeof type === "string" ? type.toLowerCase() : "info";
    const normalizedMessage = typeof message === "string" ? message.trim() : "";
    return `${normalizedType}::${normalizedMessage}`;
  }

  function ensureContainer() {
    let container = document.getElementById(TOAST_CONTAINER_ID);
    if (!container) {
      container = document.createElement("div");
      container.id = TOAST_CONTAINER_ID;
      container.className = "toast-container";
      container.setAttribute("role", "status");
      container.setAttribute("aria-live", "polite");
      document.body.appendChild(container);
    }
    return container;
  }

  function removeToast(toast) {
    if (!toast) return;
    toast.classList.remove("is-visible");
    const removeAfter = () => {
      toast.removeEventListener("transitionend", removeAfter);
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    };
    toast.addEventListener("transitionend", removeAfter);
    window.setTimeout(() => {
      if (toast.parentElement) {
        removeAfter();
      }
    }, 300);
  }

  function showToast(type = "info", message = "") {
    if (!message || typeof message !== "string") return;
    const normalizedType = ["success", "error", "info"].includes(type) ? type : "info";
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    const container = ensureContainer();
    const toastKey = buildToastKey(normalizedType, trimmedMessage);

    for (const existing of Array.from(container.querySelectorAll(".toast"))) {
      if (existing && existing.dataset.toastKey === toastKey) {
        existing.remove();
      }
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${normalizedType}`;
    toast.setAttribute("role", normalizedType === "error" ? "alert" : "status");
    toast.dataset.toastKey = toastKey;

    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = TOAST_ICONS[normalizedType] || TOAST_ICONS.info;
    toast.appendChild(icon);

    const text = document.createElement("div");
    text.className = "toast-message";
    text.textContent = trimmedMessage;
    toast.appendChild(text);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "toast-close";
    closeButton.setAttribute("aria-label", "Sluiten");
    closeButton.innerHTML = "&times;";
    closeButton.addEventListener("click", () => removeToast(toast));
    toast.appendChild(closeButton);

    container.appendChild(toast);

    // Force layout before adding visible class for transition.
    window.requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });

    const duration = TOAST_DEFAULT_DURATION;
    const timeoutId = window.setTimeout(() => removeToast(toast), duration);

    toast.addEventListener("mouseenter", () => {
      window.clearTimeout(timeoutId);
    });
    toast.addEventListener("mouseleave", () => {
      const newTimeout = window.setTimeout(() => removeToast(toast), duration / 2);
      toast.addEventListener("mouseenter", () => window.clearTimeout(newTimeout), { once: true });
    });
  }

  window.showToast = showToast;
})();
