(function () {
  const ROUTES = {
    start: {
      template: "partials/start.html",
      title: "Transportplanner — Start",
      path: "index.html",
      requireAuth: true,
    },
    aanvraag: {
      template: "partials/aanvraag.html",
      title: "Transportplanner — Nieuwe aanvraag",
      path: "aanvraag.html",
      requireAuth: true,
    },
    orders: {
      template: "partials/orders.html",
      title: "Transportplanner — Orders",
      path: "orders.html",
      requireAuth: true,
    },
    planning: {
      template: "partials/planning.html",
      title: "Transportplanner — Planning",
      path: "planning.html",
      requireAuth: true,
      roles: ["planner", "admin"],
    },
    routekaart: {
      template: "partials/routekaart.html",
      title: "Transportplanner — Routekaart",
      path: "routekaart.html",
      requireAuth: true,
      roles: ["planner", "admin"],
    },
    vloot: {
      template: "partials/vloot.html",
      title: "Transportplanner — Vloot & carriers",
      path: "vloot.html",
      requireAuth: true,
      roles: ["admin"],
    },
    users: {
      template: "partials/users.html",
      title: "Transportplanner — Gebruikersbeheer",
      path: "users.html",
      requireAuth: true,
      roles: ["admin"],
    },
    login: {
      template: "partials/login.html",
      title: "Transportplanner — Inloggen",
      path: "login.html",
    },
    "create-user": {
      template: "partials/create-user.html",
      title: "Transportplanner — Nieuwe gebruiker",
      path: "create-user.html",
    },
  };

  const PAGE_SCRIPTS = {
    routekaart: "js/routes.js",
    users: "js/users.js",
    login: "js/login.js",
    "create-user": "js/create-user.js",
  };

  const scriptPromises = new Map();

  const PATH_ALIASES = {
    "": "start",
    "/": "start",
    "index.html": "start",
    "orders.html": "orders",
    "aanvraag.html": "aanvraag",
    "planning.html": "planning",
    "routekaart.html": "routekaart",
    "vloot.html": "vloot",
    "users.html": "users",
    "login.html": "login",
    "create-user.html": "create-user",
  };

  const appRoot = document.getElementById("appRoot");
  if (!appRoot) {
    console.error("Kan appRoot niet vinden");
    return;
  }

  window.Pages = window.Pages || {};

  let currentRoute = null;
  let currentController = null;
  let isNavigating = false;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setBusy(state) {
    if (state) {
      appRoot.setAttribute("aria-busy", "true");
    } else {
      appRoot.removeAttribute("aria-busy");
    }
  }

  function normalizeRoute(route) {
    if (!route) return "start";
    const key = String(route).toLowerCase();
    if (ROUTES[key]) return key;
    return "start";
  }

  function getUser() {
    return window.Auth && typeof window.Auth.getUser === "function"
      ? window.Auth.getUser()
      : null;
  }

  function checkAccess(routeKey) {
    const meta = ROUTES[routeKey];
    if (!meta) {
      return { allowed: false, redirect: "start" };
    }
    const user = getUser();
    if (meta.requireAuth && !user) {
      return { allowed: false, redirect: "login" };
    }
    if (meta.roles && meta.roles.length) {
      if (!user || !meta.roles.includes(user.role)) {
        return { allowed: false, redirect: user ? "start" : "login" };
      }
    }
    if (routeKey === "login" && user) {
      return { allowed: false, redirect: "start" };
    }
    return { allowed: true };
  }

  function setActiveNav(route) {
    const links = document.querySelectorAll("a[data-route]");
    links.forEach((link) => {
      if (link.dataset.route === route) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  function getPageModule(route) {
    if (!window.Pages) return null;
    return window.Pages[route] || null;
  }

  function loadPageScript(routeKey) {
    const url = PAGE_SCRIPTS[routeKey];
    if (!url) {
      return Promise.resolve();
    }
    if (window.Pages && window.Pages[routeKey]) {
      return Promise.resolve();
    }
    if (scriptPromises.has(routeKey)) {
      return scriptPromises.get(routeKey);
    }
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.dataset.pageModule = routeKey;
      script.addEventListener(
        "load",
        () => {
          scriptPromises.delete(routeKey);
          resolve();
        },
        { once: true }
      );
      script.addEventListener(
        "error",
        () => {
          scriptPromises.delete(routeKey);
          script.remove();
          reject(new Error(`Kan script voor route "${routeKey}" niet laden (${url})`));
        },
        { once: true }
      );
      document.head.appendChild(script);
    });
    scriptPromises.set(routeKey, promise);
    return promise;
  }

  async function ensurePageModule(routeKey) {
    if (!PAGE_SCRIPTS[routeKey]) {
      return;
    }
    if (window.Pages && window.Pages[routeKey]) {
      return;
    }
    await loadPageScript(routeKey);
  }

  function applyLazyLoading(scope) {
    if (!scope || typeof scope.querySelectorAll !== "function") {
      return;
    }
    const images = scope.querySelectorAll("img:not([loading])");
    images.forEach((img) => {
      if (img.dataset && (img.dataset.lazy === "false" || img.dataset.noLazy !== undefined)) {
        return;
      }
      img.setAttribute("loading", "lazy");
    });
  }

  async function renderRoute(routeKey, options = {}) {
    const meta = ROUTES[routeKey];
    if (!meta) {
      throw new Error(`Onbekende route: ${routeKey}`);
    }
    if (currentController && typeof currentController.destroy === "function") {
      try {
        currentController.destroy();
      } catch (err) {
        console.error("Fout bij opruimen van pagina", err);
      }
      currentController = null;
    }

    setBusy(true);
    try {
      const response = await fetch(meta.template, { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`Kan fragment niet laden (${response.status})`);
      }
      const markup = await response.text();
      const wrapper = document.createElement("div");
      wrapper.innerHTML = markup.trim();
      const children = Array.from(wrapper.children);
      appRoot.innerHTML = "";
      let rootElement = null;
      children.forEach((child, index) => {
        if (index === 0) {
          rootElement = child;
        }
        appRoot.appendChild(child);
      });
      applyLazyLoading(rootElement || appRoot);
      document.title = meta.title || "Transportplanner";
      setActiveNav(routeKey);
      if (window.Auth && typeof window.Auth.applyRoleVisibility === "function") {
        window.Auth.applyRoleVisibility();
      }
      if (window.DateUtils && typeof window.DateUtils.enforceDateInputs === "function") {
        window.DateUtils.enforceDateInputs(rootElement || appRoot);
      }
      currentRoute = routeKey;
      await ensurePageModule(routeKey);
      const module = getPageModule(routeKey);
      if (module && typeof module.init === "function") {
        module.init({ route: routeKey, root: rootElement, meta });
        currentController = module;
      } else {
        currentController = null;
      }
    } catch (err) {
      console.error("Kan route niet laden", err);
      appRoot.innerHTML = `
        <section class="card">
          <h2>Pagina kan niet geladen worden</h2>
          <p>${escapeHtml(err.message || "Onbekende fout")}</p>
        </section>
      `;
      document.title = "Transportplanner — Fout";
      currentRoute = routeKey;
      currentController = null;
    } finally {
      setBusy(false);
    }
  }

  function buildUrl(routeKey) {
    const meta = ROUTES[routeKey];
    if (!meta) return "index.html";
    return meta.path || "index.html";
  }

  async function navigate(route, options = {}) {
    if (isNavigating) return;
    const routeKey = normalizeRoute(route);
    const access = checkAccess(routeKey);
    if (!access.allowed) {
      if (access.redirect === routeKey) {
        return;
      }
      return navigate(access.redirect, { replace: true, force: true });
    }
    if (!options.force && routeKey === currentRoute && !options.fromPopstate) {
      return;
    }
    isNavigating = true;
    try {
      const url = buildUrl(routeKey);
      if (!options.silent) {
        const state = { route: routeKey };
        if (options.replace) {
          window.history.replaceState(state, "", url);
        } else if (!options.fromPopstate) {
          window.history.pushState(state, "", url);
        }
      } else if (options.replace) {
        window.history.replaceState({ route: routeKey }, "", url);
      }
      await renderRoute(routeKey, options);
    } finally {
      isNavigating = false;
    }
  }

  function getRouteFromLocation() {
    const url = new URL(window.location.href);
    const queryRoute = url.searchParams.get("route");
    if (queryRoute && ROUTES[queryRoute]) {
      return queryRoute;
    }
    const path = url.pathname.split("/").pop() || "";
    const normalized = path.toLowerCase();
    return normalizeRoute(PATH_ALIASES[normalized] || normalized);
  }

  function onLinkClick(event) {
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest("a[data-route]");
    if (!anchor) return;
    const route = anchor.dataset.route;
    if (!route || !ROUTES[route]) return;
    event.preventDefault();
    navigate(route);
  }

  function handlePopState(event) {
    const stateRoute = event.state?.route;
    const route = stateRoute && ROUTES[stateRoute] ? stateRoute : getRouteFromLocation();
    navigate(route, { replace: true, fromPopstate: true, force: true, silent: true });
  }

  function handleAuthChange() {
    const user = getUser();
    if (!currentRoute) return;
    const access = checkAccess(currentRoute);
    if (!access.allowed) {
      navigate(access.redirect, { replace: true, force: true });
      return;
    }
    if (currentRoute === "login" && user) {
      navigate("start", { replace: true, force: true });
      return;
    }
    if (window.Auth && typeof window.Auth.applyRoleVisibility === "function") {
      window.Auth.applyRoleVisibility();
    }
  }

  document.addEventListener("click", onLinkClick);
  window.addEventListener("popstate", handlePopState);

  const initialRoute = getRouteFromLocation();
  navigate(initialRoute, { replace: true, silent: true, force: true });

  window.Router = {
    navigate,
    getCurrentRoute: () => currentRoute,
    reload: () => navigate(currentRoute, { replace: true, force: true }),
    handleAuthChange,
  };

  if (window.Auth && typeof window.Auth.onChange === "function") {
    window.Auth.onChange(handleAuthChange);
  }
})();
