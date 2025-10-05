(function () {
  window.Pages = window.Pages || {};

  const DATE_UTILS = window.DateUtils || {};
  const formatDateDisplay = typeof DATE_UTILS.formatDateDisplay === "function"
    ? DATE_UTILS.formatDateDisplay
    : (value) => {
        if (!value) return "-";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          return typeof value === "string" && value.trim() ? value : "-";
        }
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
      };
  const getTodayDateValue = typeof DATE_UTILS.getTodayDateValue === "function"
    ? DATE_UTILS.getTodayDateValue
    : () => {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, "0");
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const year = today.getFullYear();
        return `${year}-${month}-${day}`;
      };
  const enforceDateInputs = typeof DATE_UTILS.enforceDateInputs === "function"
    ? DATE_UTILS.enforceDateInputs
    : () => {};

  function refreshElements(root) {
    const scope = root || document;
    return {
      map: scope.querySelector("#routesMap"),
      emptyState: scope.querySelector("#routesEmptyState"),
      date: scope.querySelector("#routesDate"),
      toggleRoutes: scope.querySelector("#toggleShowRoutes"),
      toggleOptimize: scope.querySelector("#toggleOptimize"),
      btnRebuild: scope.querySelector("#btnRebuildRoutes"),
      btnResetView: scope.querySelector("#btnResetView"),
      documentsMenuContainer: scope.querySelector("[data-export-menu]"),
      documentsToggle: scope.querySelector("#btnRouteDocuments"),
      documentsMenu: scope.querySelector("#routeDocumentsMenu"),
      documentsOptions: scope.querySelectorAll("#routeDocumentsMenu [data-export-format]"),
      status: scope.querySelector("#routesStatus"),
      summary: scope.querySelector("#routesSummary"),
    };
  }

  const htmlEscape = typeof window.escapeHtml === "function"
    ? window.escapeHtml
    : (value) => String(value ?? "").replace(/[&<>"']/g, (char) => {
        switch (char) {
          case "&":
            return "&amp;";
          case "<":
            return "&lt;";
          case ">":
            return "&gt;";
          case '"':
            return "&quot;";
          case "'":
            return "&#39;";
          default:
            return char;
        }
      });

  const buildTimeSlot = typeof window.buildTimeSlot === "function"
    ? window.buildTimeSlot
    : (from, to) => {
        const normalize = (value) => {
          if (!value) return null;
          const text = String(value).trim();
          if (!text) return null;
          if (/^\d{2}:\d{2}$/.test(text)) return text;
          if (/^\d{4}$/.test(text)) return `${text.slice(0, 2)}:${text.slice(2)}`;
          return text;
        };
        const start = normalize(from);
        const end = normalize(to);
        if (start && end) return `${start}-${end}`;
        return start || end || null;
      };

  const STORAGE_KEYS = {
    trucks: "transport_trucks_v1",
  };

  const HUBS = [
    { id: "noord", name: "Hub Noord (Groningen)", lat: 53.2194, lng: 6.5665 },
    { id: "midden", name: "Motrac HQ (Deventer)", lat: 52.2574, lng: 6.1608 },
    { id: "zuid", name: "Hub Zuid (Eindhoven)", lat: 51.4416, lng: 5.4697 },
    { id: "belgie", name: "Hub België (Antwerpen)", lat: 51.2194, lng: 4.4025 },
  ];

  const REGION_TO_HUB = {
    Noord: "noord",
    Midden: "midden",
    Zuid: "zuid",
    "België": "belgie",
  };

  const REGION_CENTERS = {
    Noord: { lat: 53.0, lng: 6.1 },
    Midden: { lat: 52.2, lng: 5.4 },
    Zuid: { lat: 51.6, lng: 5.1 },
    "België": { lat: 51.0, lng: 4.4 },
  };

  const COLOR_SCALE = [
    "#E2001A",
    "#2E7D32",
    "#1976D2",
    "#9C27B0",
    "#EF6C00",
    "#00897B",
    "#455A64",
  ];

  let els = {};
  let map = null;
  let markersLayer = null;
  let routesLayer = null;
  let lastBounds = null;
  const listeners = [];
  let latestExportSnapshot = null;

  function cloneStop(stop) {
    if (!stop || typeof stop !== "object") {
      return {
        location: null,
        date: null,
        slot: null,
        time_from: null,
        time_to: null,
        confirmed: null,
        contact: null,
        phone: null,
        instructions: null,
      };
    }
    return {
      location: stop.location || null,
      date: stop.date || null,
      slot: stop.slot || null,
      time_from: stop.time_from || null,
      time_to: stop.time_to || null,
      confirmed: typeof stop.confirmed === "boolean" ? stop.confirmed : null,
      contact: stop.contact || null,
      phone: stop.phone || null,
      instructions: stop.instructions || null,
    };
  }

  function cloneCargo(cargo) {
    if (!cargo || typeof cargo !== "object") {
      return { type: null };
    }
    return {
      type: cargo.type || null,
      description: cargo.description || null,
      pallets: cargo.pallets || null,
      weight: cargo.weight || null,
    };
  }

  function cloneStopDetails(details) {
    if (!details || typeof details !== "object") {
      return {
        reference: null,
        transportType: null,
        customerOrderNumber: null,
        customerNumber: null,
        orderReference: null,
        orderDescription: null,
        pickup: cloneStop(null),
        delivery: cloneStop(null),
        cargo: cloneCargo(null),
        instructions: null,
        contact: null,
        contactName: null,
        contactPhone: null,
        contactEmail: null,
      };
    }
    return {
      reference: details.reference || null,
      transportType: details.transportType || null,
      customerOrderNumber: details.customerOrderNumber || null,
      customerNumber: details.customerNumber || null,
      orderReference: details.orderReference || null,
      orderDescription: details.orderDescription || null,
      pickup: cloneStop(details.pickup),
      delivery: cloneStop(details.delivery),
      cargo: cloneCargo(details.cargo),
      instructions: details.instructions || null,
      contact: details.contact || null,
      contactName: details.contactName || null,
      contactPhone: details.contactPhone || null,
      contactEmail: details.contactEmail || null,
    };
  }

  function cloneOrderForExport(order) {
    if (!order || typeof order !== "object") {
      return {
        id: null,
        request_reference: null,
        customer_name: null,
        customer_order_number: null,
        customer_number: null,
        customer_city: null,
        region: null,
        status: null,
        planned_date: null,
        planned_slot: null,
        due_date: null,
        assigned_carrier: null,
      };
    }
    return {
      id: order.id ?? null,
      request_reference: order.request_reference || null,
      reference: order.reference || null,
      customer_name: order.customer_name || null,
      customer_order_number: order.customer_order_number || null,
      customer_number: order.customer_number || null,
      customer_city: order.customer_city || null,
      region: order.region || null,
      status: order.status || null,
      planned_date: order.planned_date || null,
      planned_slot: order.planned_slot || null,
      due_date: order.due_date || null,
      assigned_carrier: order.assigned_carrier || null,
    };
  }

  function normalizeExportStop(stop) {
    if (!stop || typeof stop !== "object") {
      return {
        order: cloneOrderForExport(null),
        details: cloneStopDetails(null),
      };
    }
    return {
      order: cloneOrderForExport(stop.order),
      details: cloneStopDetails(stop.details),
    };
  }

  function updateExportSnapshot(groups, backlog, date) {
    const timestamp = new Date().toISOString();
    latestExportSnapshot = {
      date: date || null,
      generatedAt: timestamp,
      groups: Array.isArray(groups)
        ? groups.map((group) => ({
            carrier: group?.carrier || null,
            label: group?.label || group?.carrier || null,
            color: group?.color || "#E2001A",
            distance: Number.isFinite(Number(group?.distance)) ? Number(group.distance) : 0,
            stops: Array.isArray(group?.stops) ? group.stops.map((stop) => normalizeExportStop(stop)) : [],
          }))
        : [],
      backlog: Array.isArray(backlog) ? backlog.map((stop) => normalizeExportStop(stop)) : [],
    };
  }

  function formatValue(value) {
    if (value === null || value === undefined) {
      return '<span class="route-export__placeholder">-</span>';
    }
    const text = String(value).trim();
    if (!text) {
      return '<span class="route-export__placeholder">-</span>';
    }
    return htmlEscape(text);
  }

  function formatMultiline(value) {
    if (Array.isArray(value)) {
      return formatMultiline(value.filter(Boolean).join("\n"));
    }
    if (value === null || value === undefined) {
      return '<span class="route-export__placeholder">-</span>';
    }
    const text = String(value).trim();
    if (!text) {
      return '<span class="route-export__placeholder">-</span>';
    }
    return htmlEscape(text).replace(/\n+/g, "<br/>");
  }

  function formatStopDisplay(stop) {
    if (!stop || typeof stop !== "object") {
      return null;
    }
    const parts = [];
    if (stop.location) {
      parts.push(stop.location);
    }
    if (stop.date) {
      const displayDate = formatDateDisplay(stop.date);
      parts.push(displayDate && displayDate !== "-" ? displayDate : stop.date);
    }
    const slot = stop.slot || buildTimeSlot(stop.time_from, stop.time_to, null);
    if (slot) {
      parts.push(slot);
    }
    return parts.length ? parts.join(" • ") : null;
  }

  function formatDateTimeLabel(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  }

  function getPlannedLabel(order) {
    if (!order) return null;
    const label = typeof window.formatPlanned === "function" ? window.formatPlanned(order) : (() => {
      const parts = [];
      if (order.planned_date) {
        const formatted = formatDateDisplay(order.planned_date);
        parts.push(formatted && formatted !== "-" ? formatted : order.planned_date);
      }
      if (order.planned_slot) {
        parts.push(`(${order.planned_slot})`);
      }
      return parts.join(" ").trim();
    })();
    const text = (label || "").trim();
    if (!text || text === "-") {
      return null;
    }
    return text;
  }

  function buildDefinition(term, valueHtml) {
    return `<div class="route-export__definition"><dt>${htmlEscape(term)}</dt><dd>${valueHtml}</dd></div>`;
  }

  function buildLocationColumn(title, stop) {
    const summary = formatStopDisplay(stop);
    const contactParts = [];
    if (stop?.contact) contactParts.push(stop.contact);
    if (stop?.phone) contactParts.push(stop.phone);
    if (stop?.instructions) contactParts.push(stop.instructions);
    const contactHtml = contactParts.length
      ? `<div class="route-export__small">${formatMultiline(contactParts.join("\n"))}</div>`
      : "";
    return `<div class="route-export__stop-column"><h5>${htmlEscape(title)}</h5><p>${summary ? formatValue(summary) : '<span class="route-export__placeholder">-</span>'}</p>${contactHtml}</div>`;
  }

  function renderArticles(lines) {
    if (!Array.isArray(lines) || !lines.length) {
      return '<div class="route-export__articles route-export__articles--empty">Geen artikelen geregistreerd.</div>';
    }
    const items = lines.map((line) => {
      if (!line || typeof line !== "object") {
        return "";
      }
      const parts = [];
      const quantity = Number.isFinite(Number(line.quantity)) ? Number(line.quantity) : null;
      if (quantity !== null) {
        parts.push(`<span class="route-export__article-qty">${htmlEscape(String(quantity))}×</span>`);
      }
      const product = line.product ? htmlEscape(line.product) : "Onbekend artikel";
      parts.push(`<span class="route-export__article-name">${product}</span>`);
      if (line.serialNumber) {
        parts.push(`<span class="route-export__article-serial">${htmlEscape(line.serialNumber)}</span>`);
      }
      return `<li>${parts.join(" ")}</li>`;
    });
    return `<ul class="route-export__articles">${items.join("")}</ul>`;
  }

  function buildStopHtml(stop, index, linesByOrder, { isBacklog = false } = {}) {
    const order = stop?.order || {};
    const details = stop?.details || {};
    const orderId = order.id ?? null;
    const orderKey = orderId !== null && orderId !== undefined ? String(orderId) : null;
    const lines = orderKey && linesByOrder.has(orderKey) ? linesByOrder.get(orderKey) : [];
    const reference = details.reference
      || order.request_reference
      || order.reference
      || order.customer_order_number
      || order.customer_name
      || (orderId ? `Order #${orderId}` : "Order onbekend");
    const stopTitlePrefix = isBacklog ? "Open opdracht" : "Stop";
    const stopNumber = index + 1;
    const plannedLabel = getPlannedLabel(order);
    const dueLabel = order.due_date ? formatDateDisplay(order.due_date) : null;
    const headerMetaParts = [];
    if (orderId !== null && orderId !== undefined) {
      headerMetaParts.push(`Order #${htmlEscape(String(orderId))}`);
    }
    if (order.status) {
      headerMetaParts.push(htmlEscape(order.status));
    }
    if (!isBacklog && plannedLabel) {
      headerMetaParts.push(htmlEscape(plannedLabel));
    }
    const headerMeta = headerMetaParts.length ? `<div class="route-export__stop-meta">${headerMetaParts.join(" • ")}</div>` : "";
    const planningItems = [
      buildDefinition("Voertuig", formatValue(order.assigned_carrier)),
      buildDefinition("Status", formatValue(order.status)),
      buildDefinition("Gepland", plannedLabel ? htmlEscape(plannedLabel) : '<span class="route-export__placeholder">-</span>'),
      buildDefinition("Gewenste leverdatum", dueLabel && dueLabel !== "-" ? htmlEscape(dueLabel) : '<span class="route-export__placeholder">-</span>'),
      buildDefinition("Transporttype", formatValue(details.transportType || details.cargo?.type)),
    ];
    const customerItems = [
      buildDefinition("Klant", formatValue(order.customer_name)),
      buildDefinition("Klantnummer", formatValue(details.customerNumber || order.customer_number)),
      buildDefinition("PO / referentie klant", formatValue(details.customerOrderNumber || order.customer_order_number)),
      buildDefinition("Contact", formatMultiline(details.contact || [details.contactName, details.contactPhone, details.contactEmail]))
    ];
    const notesParts = [];
    if (details.orderDescription && details.orderDescription !== details.instructions) {
      notesParts.push(details.orderDescription);
    }
    if (details.instructions) {
      notesParts.push(details.instructions);
    }
    const notesHtml = notesParts.length
      ? `<div class="route-export__stop-notes"><strong>Opmerkingen</strong><p>${formatMultiline(notesParts.join("\n\n"))}</p></div>`
      : "";
    return `<article class="route-export__stop">
      <header>
        <h4>${htmlEscape(`${stopTitlePrefix} ${stopNumber} — ${reference}`)}</h4>
        ${headerMeta}
      </header>
      <div class="route-export__stop-columns">
        <div class="route-export__stop-column">
          <h5>Klantgegevens</h5>
          <dl>${customerItems.join("")}</dl>
        </div>
        ${buildLocationColumn("Laadlocatie", details.pickup)}
        ${buildLocationColumn("Loslocatie", details.delivery)}
      </div>
      <div class="route-export__stop-columns route-export__stop-columns--secondary">
        <div class="route-export__stop-column">
          <h5>Planning</h5>
          <dl>${planningItems.join("")}</dl>
        </div>
        <div class="route-export__stop-column route-export__stop-column--wide">
          <h5>Artikelen</h5>
          ${renderArticles(lines)}
        </div>
      </div>
      ${notesHtml}
    </article>`;
  }

  function buildRouteSection(group, index, linesByOrder) {
    if (!group) return "";
    const stopsHtml = Array.isArray(group.stops)
      ? group.stops.map((stop, stopIndex) => buildStopHtml(stop, stopIndex, linesByOrder)).join("")
      : "";
    const distanceText = Number.isFinite(Number(group.distance))
      ? `${Number(group.distance).toFixed(1)} km`
      : "-";
    const stopCount = Array.isArray(group.stops) ? group.stops.length : 0;
    const headerMeta = `${stopCount} stops • ${distanceText}`;
    const routeLabel = group.label || group.carrier || `Route ${index + 1}`;
    const badgeLabel = group.carrier || "Voertuig";
    const color = group.color || "#E2001A";
    return `<section class="route-export__route" style="--route-color:${color};">
      <header class="route-export__route-header">
        <div>
          <h2>${htmlEscape(routeLabel)}</h2>
          <div class="route-export__route-meta">${htmlEscape(headerMeta)}</div>
        </div>
        <div class="route-export__route-badge">${htmlEscape(badgeLabel)}</div>
      </header>
      ${stopsHtml || '<p class="route-export__empty">Geen stops voor deze route.</p>'}
    </section>`;
  }

  function buildBacklogSection(backlog, linesByOrder) {
    if (!Array.isArray(backlog) || !backlog.length) {
      return "";
    }
    const items = backlog
      .map((stop, index) => buildStopHtml(stop, index, linesByOrder, { isBacklog: true }))
      .join("");
    return `<section class="route-export__route route-export__backlog" style="--route-color:#6F6F6F;">
      <header class="route-export__route-header">
        <div>
          <h2>Nog niet ingepland</h2>
          <div class="route-export__route-meta">${htmlEscape(`${backlog.length} open opdrachten`)}</div>
        </div>
      </header>
      ${items}
    </section>`;
  }

  function buildRoutesExportLoadingDocument(snapshot) {
    const dateLabel = snapshot?.date ? formatDateDisplay(snapshot.date) : null;
    const subtitle = dateLabel && dateLabel !== "-"
      ? `Dagplanning voor ${dateLabel}`
      : "Dagplanning wordt geladen";
    return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <title>Routeplanning wordt geladen…</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: only light; }
    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 32px; background: #f5f5f5; color: #2f343b; }
    .loading-shell { max-width: 860px; margin: 0 auto; background: #ffffff; padding: 56px 40px; border-radius: 16px; box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12); text-align: center; }
    h1 { font-size: 1.75rem; margin-bottom: 12px; }
    p { margin: 0; font-size: 1.05rem; color: #606b77; }
  </style>
</head>
<body>
  <div class="loading-shell">
    <h1>Routeplanning wordt voorbereid…</h1>
    <p>${htmlEscape(subtitle)}</p>
  </div>
</body>
</html>`;
  }

  function buildRoutesExportDocument(snapshot, linesByOrder) {
    const dateLabel = snapshot?.date ? formatDateDisplay(snapshot.date) : null;
    const displayDate = dateLabel && dateLabel !== "-" ? dateLabel : "Onbekende datum";
    const generated = formatDateTimeLabel(snapshot?.generatedAt) || formatDateTimeLabel(new Date().toISOString()) || "";
    const totalRoutes = Array.isArray(snapshot?.groups) ? snapshot.groups.length : 0;
    const totalStops = Array.isArray(snapshot?.groups)
      ? snapshot.groups.reduce((sum, group) => sum + (Array.isArray(group.stops) ? group.stops.length : 0), 0)
      : 0;
    const totalBacklog = Array.isArray(snapshot?.backlog) ? snapshot.backlog.length : 0;
    const routesHtml = Array.isArray(snapshot?.groups)
      ? snapshot.groups.map((group, index) => buildRouteSection(group, index, linesByOrder)).join("")
      : "";
    const backlogHtml = buildBacklogSection(snapshot?.backlog, linesByOrder);
    const hasContent = (routesHtml && routesHtml.trim()) || backlogHtml;
    const emptyState = `<section class="route-export__route">
      <p class="route-export__empty">Er zijn nog geen routes voor deze dag. Plan ritten in de planning of wijs opdrachten toe aan een voertuig.</p>
    </section>`;
    return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <title>Routeplanning ${htmlEscape(displayDate)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: only light; }
    *, *::before, *::after { box-sizing: border-box; }
    body.route-export { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #eef1f6; color: #1f2933; margin: 0; padding: 32px; }
    .route-export__page { max-width: 960px; margin: 0 auto; background: #ffffff; border-radius: 18px; padding: 36px 42px 48px; box-shadow: 0 22px 45px rgba(15, 23, 42, 0.16); }
    .route-export__header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
    .route-export__title { margin: 0; font-size: 2rem; }
    .route-export__subtitle { margin: 4px 0 0; font-size: 1.05rem; color: #4b5563; }
    .route-export__meta { min-width: 220px; font-size: 0.95rem; color: #4b5563; }
    .route-export__meta-item { display: flex; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding: 6px 0; }
    .route-export__meta-item strong { color: #111827; }
    .route-export__route { border-top: 6px solid var(--route-color, #0f766e); border-radius: 14px; padding: 20px 24px 24px; background: #fafbff; margin-top: 28px; page-break-inside: avoid; }
    .route-export__route-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .route-export__route-header h2 { margin: 0; font-size: 1.4rem; }
    .route-export__route-meta { margin-top: 6px; font-size: 0.95rem; color: #4b5563; }
    .route-export__route-badge { background: rgba(15, 118, 110, 0.12); color: #0f766e; border-radius: 999px; padding: 6px 16px; font-size: 0.85rem; font-weight: 600; align-self: flex-start; }
    .route-export__stop { margin-top: 16px; padding: 16px 18px 18px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.04); page-break-inside: avoid; }
    .route-export__stop header { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .route-export__stop h4 { margin: 0; font-size: 1.15rem; }
    .route-export__stop-meta { font-size: 0.9rem; color: #4b5563; }
    .route-export__stop-columns { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .route-export__stop-columns--secondary { margin-top: 12px; }
    .route-export__stop-column h5 { margin: 0 0 8px; font-size: 1rem; color: #1f2933; }
    .route-export__stop-column p { margin: 0 0 8px; font-size: 0.95rem; }
    .route-export__stop-column--wide { grid-column: span 2; }
    dl { margin: 0; }
    .route-export__definition { display: flex; gap: 8px; margin-bottom: 6px; font-size: 0.95rem; }
    .route-export__definition dt { min-width: 110px; color: #4b5563; font-weight: 600; }
    .route-export__definition dd { margin: 0; flex: 1; color: #111827; }
    .route-export__small { font-size: 0.9rem; color: #4b5563; }
    .route-export__articles { margin: 0; padding-left: 18px; font-size: 0.95rem; }
    .route-export__articles li { margin-bottom: 4px; }
    .route-export__articles--empty { font-style: italic; color: #6b7280; }
    .route-export__article-qty { font-weight: 600; color: #0f172a; }
    .route-export__article-serial { color: #6b7280; font-style: italic; margin-left: 6px; }
    .route-export__stop-notes { margin-top: 12px; font-size: 0.95rem; background: #f9fafb; padding: 12px 14px; border-radius: 10px; border: 1px solid #e5e7eb; }
    .route-export__placeholder { color: #9ca3af; font-style: italic; }
    .route-export__empty { margin: 12px 0 0; font-size: 0.95rem; color: #6b7280; }
    .route-export__actions { margin-top: 28px; display: flex; justify-content: flex-end; }
    .route-export__actions button { border: none; border-radius: 999px; background: #E2001A; color: #fff; padding: 12px 22px; font-size: 1rem; cursor: pointer; box-shadow: 0 10px 18px rgba(226, 0, 26, 0.25); }
    .route-export__actions button:hover { background: #c90018; }
    .route-export__backlog { background: #fff7ed; border-top-color: #fb923c; }
    .route-export__backlog .route-export__route-badge { background: rgba(251, 146, 60, 0.18); color: #c2410c; }
    .no-print { margin-top: 32px; }
    @media print {
      body.route-export { background: #ffffff; padding: 0; }
      .route-export__page { box-shadow: none; border-radius: 0; padding: 24px 32px; }
      .route-export__route { box-shadow: none; background: #ffffff; border-radius: 0; }
      .route-export__stop { box-shadow: none; }
      .route-export__stop-column--wide { grid-column: span 1; }
      .no-print { display: none !important; }
      .route-export__route-badge { background: rgba(15, 118, 110, 0.2); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body class="route-export">
  <div class="route-export__page">
    <header class="route-export__header">
      <div>
        <h1 class="route-export__title">Routeplanning</h1>
        <p class="route-export__subtitle">Dagplanning voor ${htmlEscape(displayDate)}</p>
      </div>
      <div class="route-export__meta">
        <div class="route-export__meta-item"><strong>Routes</strong><span>${htmlEscape(String(totalRoutes))}</span></div>
        <div class="route-export__meta-item"><strong>Stops</strong><span>${htmlEscape(String(totalStops))}</span></div>
        <div class="route-export__meta-item"><strong>Open opdrachten</strong><span>${htmlEscape(String(totalBacklog))}</span></div>
        <div class="route-export__meta-item"><strong>Gegenereerd</strong><span>${generated ? htmlEscape(generated) : 'n.v.t.'}</span></div>
      </div>
    </header>
    ${hasContent ? routesHtml + backlogHtml : emptyState}
    <div class="route-export__actions no-print">
      <button type="button" onclick="window.print()">Printen / Download als PDF</button>
    </div>
  </div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () {
        try { window.print(); } catch (error) { console.warn('Printen niet beschikbaar', error); }
      }, 500);
    });
  </script>
</body>
</html>`;
  }

  async function prepareRouteLines(snapshot) {
    const linesMap = new Map();
    if (!snapshot) {
      return linesMap;
    }
    const loadLines = typeof window.loadOrderLines === "function" ? window.loadOrderLines : null;
    if (!loadLines) {
      return linesMap;
    }
    const ids = new Set();
    if (Array.isArray(snapshot.groups)) {
      snapshot.groups.forEach((group) => {
        group.stops?.forEach((stop) => {
          const id = stop?.order?.id;
          if (Number.isFinite(Number(id))) {
            ids.add(String(id));
          }
        });
      });
    }
    if (Array.isArray(snapshot.backlog)) {
      snapshot.backlog.forEach((stop) => {
        const id = stop?.order?.id;
        if (Number.isFinite(Number(id))) {
          ids.add(String(id));
        }
      });
    }
    const tasks = Array.from(ids).map(async (id) => {
      try {
        const lines = await loadLines(Number(id));
        if (Array.isArray(lines)) {
          linesMap.set(id, lines);
        } else {
          linesMap.set(id, []);
        }
      } catch (error) {
        console.warn(`Kan orderregels niet laden voor export (${id})`, error);
        linesMap.set(id, []);
      }
    });
    await Promise.allSettled(tasks);
    return linesMap;
  }

  async function openRoutesExport() {
    const snapshot = latestExportSnapshot;
    const exportWindow = window.open("", "_blank", "noopener=yes");
    if (!exportWindow) {
      window.alert("Kan geen exportvenster openen. Sta pop-ups toe voor deze site.");
      return;
    }
    const loadingHtml = buildRoutesExportLoadingDocument(snapshot);
    try {
      exportWindow.document.open();
      exportWindow.document.write(loadingHtml);
      exportWindow.document.close();
    } catch (error) {
      console.warn("Kan exportvenster niet voorbereiden", error);
    }
    if (!snapshot) {
      const emptyHtml = buildRoutesExportDocument({ date: null, generatedAt: new Date().toISOString(), groups: [], backlog: [] }, new Map());
      try {
        exportWindow.document.open();
        exportWindow.document.write(emptyHtml);
        exportWindow.document.close();
      } catch (error) {
        console.warn("Kan exportdocument niet tonen", error);
      }
      return;
    }
    let linesByOrder = new Map();
    try {
      linesByOrder = await prepareRouteLines(snapshot);
    } catch (error) {
      console.warn("Kan artikelen voor export niet laden", error);
    }
    if (!exportWindow || exportWindow.closed) {
      return;
    }
    const documentHtml = buildRoutesExportDocument(snapshot, linesByOrder);
    try {
      exportWindow.document.open();
      exportWindow.document.write(documentHtml);
      exportWindow.document.close();
    } catch (error) {
      console.warn("Kan exportdocument niet tonen", error);
    }
  }

  function downloadBlob(blob, filename) {
    if (!(blob instanceof Blob)) {
      return;
    }
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename || "download.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }

  function buildRoutePdfFilename(snapshot) {
    const dateLabel = snapshot?.date ? formatDateDisplay(snapshot.date) : "";
    const base = (dateLabel || "routes")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "routes";
    return `Rittenlijst-${base}.pdf`;
  }

  function countSnapshotStops(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.groups)) {
      return 0;
    }
    return snapshot.groups.reduce((sum, group) => {
      const count = Array.isArray(group.stops) ? group.stops.length : 0;
      return sum + count;
    }, 0);
  }

  async function downloadRoutesPdf() {
    if (!window.TransportDocuments || typeof window.TransportDocuments.generateRouteListPdf !== "function") {
      window.alert("PDF-generator niet beschikbaar.");
      return;
    }
    const snapshot = latestExportSnapshot;
    if (!snapshot) {
      window.alert("Geen routes beschikbaar om te exporteren.");
      return;
    }
    try {
      const blob = await window.TransportDocuments.generateRouteListPdf(snapshot);
      if (!(blob instanceof Blob)) {
        window.alert("Het genereren van de rittenlijst is mislukt.");
        return;
      }
      const filename = buildRoutePdfFilename(snapshot);
      downloadBlob(blob, filename);
      setStatus("Rittenlijst (PDF) gedownload.", "success");
    } catch (error) {
      console.error("Kan rittenlijst niet genereren", error);
      setStatus("PDF genereren mislukt.", "error");
    }
  }

  async function emailRoutesPdf() {
    if (!window.TransportDocuments || typeof window.TransportDocuments.generateRouteListPdf !== "function") {
      window.alert("PDF-generator niet beschikbaar.");
      return;
    }
    if (!window.DocumentMail || typeof window.DocumentMail.open !== "function") {
      window.alert("E-mailmodule is niet beschikbaar.");
      return;
    }
    const snapshot = latestExportSnapshot;
    if (!snapshot) {
      window.alert("Geen routes beschikbaar om te mailen.");
      return;
    }
    let blob;
    try {
      blob = await window.TransportDocuments.generateRouteListPdf(snapshot);
    } catch (error) {
      console.error("Kan rittenlijst niet genereren", error);
      setStatus("PDF genereren mislukt.", "error");
      return;
    }
    if (!(blob instanceof Blob)) {
      setStatus("PDF genereren mislukt.", "error");
      return;
    }
    const filename = buildRoutePdfFilename(snapshot);
    const routeCount = Array.isArray(snapshot?.groups) ? snapshot.groups.length : 0;
    const stopCount = countSnapshotStops(snapshot);
    const backlogCount = Array.isArray(snapshot?.backlog) ? snapshot.backlog.length : 0;
    const context = {
      dateLabel: snapshot?.date ? formatDateDisplay(snapshot.date) : "",
      routeCount,
      stopCount,
      backlogCount,
      generatedAt: formatDateTimeLabel(snapshot?.generatedAt) || "",
    };
    try {
      const result = await window.DocumentMail.open({
        documentType: "rittenlijst",
        title: "Rittenlijst mailen",
        defaultTemplateId: "rittenlijst",
        defaultListId: "planning",
        context,
        attachments: [
          {
            filename,
            blob,
            contentType: "application/pdf",
          },
        ],
        meta: {
          date: snapshot?.date || null,
          generatedAt: snapshot?.generatedAt || null,
          routeCount,
          stopCount,
          backlogCount,
        },
      });
      if (result && result.ok) {
        setStatus("Rittenlijst per e-mail verzonden.", "success");
      }
    } catch (error) {
      console.error("E-maildialoog kon niet worden geopend", error);
    }
  }

  function getDocumentOptions() {
    if (!els.documentsOptions) {
      return [];
    }
    if (typeof els.documentsOptions.forEach === "function" && !Array.isArray(els.documentsOptions)) {
      return Array.from(els.documentsOptions);
    }
    return Array.isArray(els.documentsOptions) ? els.documentsOptions : [];
  }

  function isDocumentsMenuOpen() {
    return Boolean(els.documentsMenuContainer && els.documentsMenuContainer.classList.contains("is-open"));
  }

  function openDocumentsMenu() {
    if (!els.documentsMenu || !els.documentsToggle || !els.documentsMenuContainer) {
      return;
    }
    els.documentsMenu.hidden = false;
    els.documentsMenuContainer.classList.add("is-open");
    els.documentsToggle.setAttribute("aria-expanded", "true");
    const options = getDocumentOptions();
    if (options.length) {
      options[0].focus();
    }
  }

  function closeDocumentsMenu({ focusToggle = false } = {}) {
    if (!els.documentsMenu || !els.documentsToggle || !els.documentsMenuContainer) {
      return;
    }
    els.documentsMenu.hidden = true;
    els.documentsMenuContainer.classList.remove("is-open");
    els.documentsToggle.setAttribute("aria-expanded", "false");
    if (focusToggle) {
      els.documentsToggle.focus();
    }
  }

  function toggleDocumentsMenu() {
    if (isDocumentsMenuOpen()) {
      closeDocumentsMenu({ focusToggle: true });
    } else {
      openDocumentsMenu();
    }
  }

  function handleDocumentClickForDocumentsMenu(event) {
    if (!isDocumentsMenuOpen()) {
      return;
    }
    if (!els.documentsMenuContainer) {
      return;
    }
    if (els.documentsMenuContainer.contains(event.target)) {
      return;
    }
    closeDocumentsMenu();
  }

  function handleDocumentsMenuKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDocumentsMenu({ focusToggle: true });
    }
  }

  function handleDocumentsOptionClick(event) {
    event.preventDefault();
    const format = event?.currentTarget?.dataset?.exportFormat || "print";
    closeDocumentsMenu({ focusToggle: true });
    if (format === "pdf") {
      downloadRoutesPdf();
    } else if (format === "email") {
      emailRoutesPdf();
    } else {
      openRoutesExport();
    }
  }

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

  function destroyMap() {
    if (map && typeof map.remove === "function") {
      try {
        map.remove();
      } catch (err) {
        console.warn("Kan kaart niet verwijderen", err);
      }
    }
    map = null;
    markersLayer = null;
    routesLayer = null;
    lastBounds = null;
  }

  function readLocal(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("Kan localStorage niet lezen", e);
      return fallback;
    }
  }

  function setStatus(message, variant = "default") {
    if (!els.status) return;
    els.status.textContent = message;
    els.status.classList.remove("status-error", "status-success");
    if (variant === "error") {
      els.status.classList.add("status-error");
    } else if (variant === "success") {
      els.status.classList.add("status-success");
    }
  }

  function showEmptyState({ title, message }) {
    if (!els.emptyState) return;
    const heading = els.emptyState.querySelector("h3");
    const paragraph = els.emptyState.querySelector("p");
    if (heading && title) {
      heading.textContent = title;
    }
    if (paragraph && message) {
      paragraph.textContent = message;
    }
    els.emptyState.classList.remove("is-hidden");
  }

  function hideEmptyState() {
    if (!els.emptyState) return;
    els.emptyState.classList.add("is-hidden");
  }

  function ensureDate() {
    if (!els.date) return getTodayDateValue();
    let value = els.date.value;
    if (!value) {
      value = getTodayDateValue();
      els.date.value = value;
    }
    return value;
  }

  function initMap() {
    destroyMap();
    map = L.map(els.map, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([52.2, 5.3], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap-bijdragers",
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
    routesLayer = L.layerGroup().addTo(map);
    lastBounds = null;
  }

  function hashString(value) {
    let hash = 0;
    const text = value || "";
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function jitterCoordinate(base, key) {
    const hash = hashString(key);
    const latOffset = ((hash % 1000) / 1000) * 0.6 - 0.3;
    const lngOffset = ((((hash / 1000) | 0) % 1000) / 1000) * 0.6 - 0.3;
    return {
      lat: base.lat + latOffset,
      lng: base.lng + lngOffset,
    };
  }

  function geocodeLocation(name, region) {
    const normalized = (region && REGION_CENTERS[region]) ? REGION_CENTERS[region] : REGION_CENTERS.Midden;
    return jitterCoordinate(normalized, name || region || "loc");
  }

  function haversine(a, b) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const c = 2 * Math.asin(Math.sqrt(sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng));
    return R * c;
  }

  function orderStops(stops, start, optimize) {
    if (!optimize) {
      return stops;
    }
    const remaining = stops.slice();
    const ordered = [];
    let current = start;
    while (remaining.length) {
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let i = 0; i < remaining.length; i += 1) {
        const candidate = remaining[i];
        const distance = haversine(current, candidate.latlng);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }
      const next = remaining.splice(bestIndex, 1)[0];
      ordered.push(next);
      current = next.latlng;
    }
    return ordered;
  }

  function chooseHubForStops(stops) {
    const region = stops.find((s) => s.region)?.region;
    const hubId = REGION_TO_HUB[region] || "midden";
    return HUBS.find((h) => h.id === hubId) || HUBS[1];
  }

  function buildMarker(latlng, options) {
    return L.circleMarker([latlng.lat, latlng.lng], {
      radius: 8,
      weight: 2,
      fillOpacity: 0.9,
      ...options,
    });
  }

  function buildRouteSegment(start, end) {
    const segment = [];
    const distance = haversine(start, end);
    const steps = Math.max(6, Math.ceil(distance / 25));
    const latDiff = end.lat - start.lat;
    const lngDiff = end.lng - start.lng;
    const length = Math.hypot(latDiff, lngDiff) || 1;
    const normalLat = -lngDiff / length;
    const normalLng = latDiff / length;
    const controlStrength = Math.min(distance / 90, 0.35);
    const midLat = (start.lat + end.lat) / 2 + normalLat * controlStrength;
    const midLng = (start.lng + end.lng) / 2 + normalLng * controlStrength;
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const oneMinusT = 1 - t;
      const lat = oneMinusT * oneMinusT * start.lat + 2 * oneMinusT * t * midLat + t * t * end.lat;
      const lng = oneMinusT * oneMinusT * start.lng + 2 * oneMinusT * t * midLng + t * t * end.lng;
      segment.push([lat, lng]);
    }
    return segment;
  }

  function renderSummary(groups, unplanned, date) {
    if (!els.summary) return;
    els.summary.innerHTML = "";
    if (!groups.length && !unplanned.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "Geen routes beschikbaar voor de geselecteerde dag.";
      els.summary.appendChild(empty);
      return;
    }
    for (const group of groups) {
      const card = document.createElement("article");
      card.className = "route-summary-card";
      const header = document.createElement("header");
      const title = document.createElement("h3");
      title.textContent = group.label;
      header.appendChild(title);
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.style.backgroundColor = `${group.color}1A`;
      badge.style.color = group.color;
      badge.textContent = `${group.stops.length} stops`;
      header.appendChild(badge);
      card.appendChild(header);
      const meta = document.createElement("div");
      meta.className = "muted small";
      meta.textContent = `Afstand ${group.distance.toFixed(1)} km`;
      card.appendChild(meta);
      const list = document.createElement("ul");
      for (const stop of group.stops) {
        const item = document.createElement("li");
        const ref = stop.details.reference || stop.order.customer_name || `Order #${stop.order.id}`;
        const location = stop.details.delivery?.location || stop.order.customer_city || "Onbekend";
        item.textContent = `${ref} — ${location}`;
        list.appendChild(item);
      }
      card.appendChild(list);
      els.summary.appendChild(card);
    }
    if (unplanned.length) {
      const backlog = document.createElement("article");
      backlog.className = "route-summary-card unplanned";
      const header = document.createElement("header");
      const title = document.createElement("h3");
      title.textContent = "Nog niet ingepland";
      header.appendChild(title);
      const count = document.createElement("span");
      count.className = "badge";
      count.textContent = `${unplanned.length} open`;
      header.appendChild(count);
      backlog.appendChild(header);
      const hint = document.createElement("div");
      hint.className = "muted small";
      hint.textContent = `Deze opdrachten staan nog los van een voertuig op ${formatDateDisplay(date)}.`;
      backlog.appendChild(hint);
      const list = document.createElement("ul");
      for (const stop of unplanned) {
        const item = document.createElement("li");
        const ref = stop.details.reference || stop.order.customer_name || `Order #${stop.order.id}`;
        const location = stop.details.delivery?.location || stop.order.customer_city || "Onbekend";
        item.textContent = `${ref} — ${location}`;
        list.appendChild(item);
      }
      backlog.appendChild(list);
      els.summary.appendChild(backlog);
    }
  }

  async function refreshRoutes() {
    if (!map || !markersLayer || !routesLayer) return;
    const date = ensureDate();
    const showRoutes = els.toggleRoutes ? !!els.toggleRoutes.checked : true;
    const optimize = els.toggleOptimize ? !!els.toggleOptimize.checked : false;
    setStatus("Routes laden…");
    hideEmptyState();
    try {
      const [ordersResult, trucks] = await Promise.all([
        Orders.list({}),
        Promise.resolve(readLocal(STORAGE_KEYS.trucks, [])),
      ]);
      const orders = Array.isArray(ordersResult?.rows) ? ordersResult.rows : [];
      const colorMap = new Map();
      let colorIndex = 0;
      const assignments = [];
      const backlog = [];
      markersLayer.clearLayers();
      routesLayer.clearLayers();
      const bounds = L.latLngBounds([]);

      HUBS.forEach((hub) => {
        const marker = L.marker([hub.lat, hub.lng], { title: hub.name });
        marker.bindPopup(`<strong>${hub.name}</strong>`);
        marker.addTo(markersLayer);
        bounds.extend([hub.lat, hub.lng]);
      });

      const dateOrders = orders.filter((order) => {
        if (["Geleverd", "Geannuleerd"].includes(order.status || "")) return false;
        if (order.planned_date) {
          return order.planned_date === date;
        }
        return order.due_date === date;
      });

      for (const order of dateOrders) {
        const details = window.parseOrderDetails ? window.parseOrderDetails(order) : { delivery: { location: order.customer_city } };
        const region = order.region || details.delivery?.region || "Midden";
        const deliveryName = details.delivery?.location || order.customer_city || order.customer_name || "Locatie onbekend";
        const latlng = geocodeLocation(deliveryName, region);
        const markerColor = order.assigned_carrier
          ? colorMap.get(order.assigned_carrier) || COLOR_SCALE[colorIndex % COLOR_SCALE.length]
          : "#6F6F6F";
        if (order.assigned_carrier && !colorMap.has(order.assigned_carrier)) {
          colorMap.set(order.assigned_carrier, markerColor);
          colorIndex += 1;
        }
        const marker = buildMarker(latlng, {
          color: markerColor,
          fillColor: markerColor,
        });
        const popupParts = [
          `<strong>${details.reference || order.customer_name || `Order #${order.id}`}</strong>`,
          deliveryName,
          order.assigned_carrier ? `Voertuig: ${order.assigned_carrier}` : "Nog niet ingepland",
        ];
        marker.bindPopup(popupParts.filter(Boolean).join("<br/>"));
        marker.addTo(markersLayer);
        bounds.extend([latlng.lat, latlng.lng]);
        const stop = {
          order,
          details,
          latlng,
          region,
        };
        if (order.assigned_carrier) {
          assignments.push(stop);
        } else {
          backlog.push(stop);
        }
      }

      const grouped = [];
      const ordersByCarrier = assignments.reduce((mapCarrier, stop) => {
        const key = stop.order.assigned_carrier;
        if (!mapCarrier.has(key)) mapCarrier.set(key, []);
        mapCarrier.get(key).push(stop);
        return mapCarrier;
      }, new Map());

      for (const [carrier, stops] of ordersByCarrier.entries()) {
        const color = colorMap.get(carrier) || COLOR_SCALE[0];
        const hub = chooseHubForStops(stops);
        const orderedStops = orderStops(stops, { lat: hub.lat, lng: hub.lng }, optimize);
        const polylinePoints = [[hub.lat, hub.lng]];
        let distance = 0;
        let cursor = { lat: hub.lat, lng: hub.lng };
        for (const stop of orderedStops) {
          const segment = buildRouteSegment(cursor, stop.latlng);
          for (let i = 1; i < segment.length; i += 1) {
            polylinePoints.push(segment[i]);
          }
          distance += haversine(cursor, stop.latlng);
          cursor = stop.latlng;
        }
        const returnSegment = buildRouteSegment(cursor, { lat: hub.lat, lng: hub.lng });
        for (let i = 1; i < returnSegment.length; i += 1) {
          polylinePoints.push(returnSegment[i]);
        }
        distance += haversine(cursor, { lat: hub.lat, lng: hub.lng });
        if (showRoutes) {
          const routeLine = L.polyline(polylinePoints, {
            color,
            weight: 4,
            opacity: 0.7,
          });
          routeLine.bindPopup(`<strong>${carrier}</strong><br/>${orderedStops.length} stops • ${distance.toFixed(1)} km`);
          routeLine.addTo(routesLayer);
        }
        for (const point of polylinePoints) {
          bounds.extend(point);
        }
        grouped.push({
          carrier,
          label: carrier,
          stops: orderedStops,
          distance,
          color,
        });
      }

      const hasRoutes = grouped.length > 0;
      if (!hasRoutes) {
        const message = backlog.length
          ? `Nog geen routes ingepland voor ${formatDateDisplay(date)}. Wijs opdrachten toe aan een voertuig en kies daarna “Herbereken”.`
          : `Geen geplande opdrachten op ${formatDateDisplay(date)}. Plan ritten in de planning of kies een andere dag.`;
        showEmptyState({
          title: backlog.length ? "Nog geen toegewezen routes" : "Geen routes om te tonen",
          message,
        });
      }

      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.2));
        lastBounds = bounds;
      } else {
        map.setView([52.2, 5.3], 7);
        lastBounds = null;
      }

      renderSummary(grouped, backlog, date);
      updateExportSnapshot(grouped, backlog, date);
      setStatus(`Kaart bijgewerkt voor ${formatDateDisplay(date)}.`, "success");
    } catch (e) {
      console.error("Kan routes niet laden", e);
      setStatus("Routes laden mislukt. Probeer het opnieuw.", "error");
      updateExportSnapshot([], [], date);
    }
  }

  function resetView() {
    if (!map) return;
    if (lastBounds && lastBounds.isValid()) {
      map.fitBounds(lastBounds.pad(0.1));
    } else {
      map.setView([52.2, 5.3], 7);
    }
  }

  async function init(context = {}) {
    els = refreshElements(context.root || document);
    enforceDateInputs(context.root || document);
    if (!els.map) {
      return;
    }
    destroyMap();
    removeListeners();
    initMap();
    ensureDate();
    addListener(els.btnRebuild, "click", (event) => {
      event.preventDefault();
      refreshRoutes();
    });
    addListener(els.btnResetView, "click", (event) => {
      event.preventDefault();
      resetView();
    });
    if (els.documentsToggle) {
      addListener(els.documentsToggle, "click", (event) => {
        event.preventDefault();
        toggleDocumentsMenu();
      });
    }
    const optionButtons = getDocumentOptions();
    if (optionButtons.length) {
      optionButtons.forEach((button) => {
        addListener(button, "click", handleDocumentsOptionClick);
      });
    }
    if (els.documentsMenu) {
      addListener(els.documentsMenu, "keydown", handleDocumentsMenuKeydown);
    }
    addListener(document, "click", handleDocumentClickForDocumentsMenu);
    addListener(window, "beforeprint", () => {
      if (map && typeof map.invalidateSize === "function") {
        setTimeout(() => map.invalidateSize(true), 0);
      }
    });
    addListener(window, "afterprint", () => {
      if (map && typeof map.invalidateSize === "function") {
        setTimeout(() => map.invalidateSize(true), 0);
      }
    });
    addListener(els.toggleRoutes, "change", refreshRoutes);
    addListener(els.toggleOptimize, "change", refreshRoutes);
    addListener(els.date, "change", refreshRoutes);
    await refreshRoutes();
  }

  function destroy() {
    removeListeners();
    destroyMap();
    els = {};
    latestExportSnapshot = null;
  }

  window.Pages.routekaart = {
    init,
    destroy,
  };
})();
