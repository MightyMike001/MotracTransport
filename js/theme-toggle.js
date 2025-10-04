(function () {
  const storageKey = "transportplanner-theme";
  const root = document.documentElement;
  const toggleButton = document.getElementById("themeToggle");

  if (!toggleButton) {
    return;
  }

  const label = toggleButton.querySelector(".theme-toggle__label");
  const icon = toggleButton.querySelector(".theme-toggle__icon");
  const mediaQuery = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");

  const getStoredTheme = () => {
    try {
      return window.localStorage.getItem(storageKey);
    } catch (error) {
      return null;
    }
  };

  const updateUI = (theme) => {
    const isDark = theme === "dark";
    toggleButton.setAttribute("aria-pressed", String(isDark));

    if (label) {
      label.textContent = isDark ? "Licht thema" : "Donker thema";
    }

    if (icon) {
      icon.textContent = isDark ? "🌙" : "☀️";
    }

    toggleButton.setAttribute(
      "title",
      isDark ? "Schakel naar licht thema" : "Schakel naar donker thema"
    );
  };

  const applyTheme = (theme, { persist = true } = {}) => {
    const nextTheme = theme === "dark" ? "dark" : "light";
    root.dataset.theme = nextTheme;
    updateUI(nextTheme);

    if (persist) {
      try {
        window.localStorage.setItem(storageKey, nextTheme);
      } catch (error) {
        // Ignore write errors (e.g. private mode)
      }
    }
  };

  const storedTheme = getStoredTheme();
  const initialTheme = root.dataset.theme || storedTheme || (mediaQuery?.matches ? "dark" : "light");
  applyTheme(initialTheme, { persist: false });

  toggleButton.addEventListener("click", () => {
    const currentTheme = root.dataset.theme === "dark" ? "dark" : "light";
    applyTheme(currentTheme === "dark" ? "light" : "dark");
  });

  const handleSystemThemeChange = (event) => {
    if (!getStoredTheme()) {
      applyTheme(event.matches ? "dark" : "light", { persist: false });
    }
  };

  if (mediaQuery?.addEventListener) {
    mediaQuery.addEventListener("change", handleSystemThemeChange);
  } else if (mediaQuery?.addListener) {
    mediaQuery.addListener(handleSystemThemeChange);
  }
})();
