(function () {
  const sourceEnv = (typeof window !== "undefined" && window.__APP_ENV__) || {};

  const toStringValue = (value) => (typeof value === "string" ? value.trim() : "");
  const parseList = (value) => {
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  };

  const parseJson = (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === "object") {
      return value;
    }
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      console.warn("Kan JSON-configuratie niet parsen", error);
      return null;
    }
  };

  const normalizeTemplate = (template) => {
    if (!template || typeof template !== "object") {
      return null;
    }
    const id = toStringValue(template.id) || toStringValue(template.name) || toStringValue(template.subject);
    if (!id) {
      return null;
    }
    return Object.freeze({
      id,
      name: toStringValue(template.name) || id,
      type: toStringValue(template.type) || "",
      subject: toStringValue(template.subject) || "",
      body: toStringValue(template.body) || "",
    });
  };

  const normalizeList = (list, fallbackRecipients = []) => {
    if (!list || typeof list !== "object") {
      return null;
    }
    const id = toStringValue(list.id) || toStringValue(list.name);
    if (!id) {
      return null;
    }
    const recipients = parseList(list.recipients);
    const cc = parseList(list.cc);
    const bcc = parseList(list.bcc);
    return Object.freeze({
      id,
      name: toStringValue(list.name) || id,
      recipients: recipients.length ? recipients : fallbackRecipients.slice(),
      cc,
      bcc,
    });
  };

  const defaultTemplates = Object.freeze([
    Object.freeze({
      id: "rittenlijst",
      name: "Rittenlijst dagplanning",
      type: "rittenlijst",
      subject: "Rittenlijst {date}",
      body:
        "Beste team,\n\nIn de bijlage vind je de rittenlijst voor {date}.\nRoutes: {routeCount}, stops: {stopCount}.\n\nMet vriendelijke groet,\nTransportplanning",
    }),
    Object.freeze({
      id: "cmr",
      name: "CMR versturen",
      type: "cmr",
      subject: "CMR {reference}",
      body:
        "Beste relatie,\n\nIn de bijlage vind je de CMR voor {reference}.\nGeplande datum: {plannedDate}.\n\nMet vriendelijke groet,\nTransportplanning",
    }),
  ]);

  const defaults = Object.freeze({
    SUPABASE_URL: "https://ezcxfobjsvomcjuwbgep.supabase.co",
    SUPABASE_ANON_KEY:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6Y3hmb2Jqc3ZvbWNqdXdiZ2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2NzQ3ODcsImV4cCI6MjA3MzI1MDc4N30.IhYZYfB_N2JDOG82NFbB_wxY7BJhahqJd9Y71nhpI3I",
  });

  const config = {
    SUPABASE_URL: toStringValue(sourceEnv.SUPABASE_URL) || defaults.SUPABASE_URL,
    SUPABASE_ANON_KEY:
      toStringValue(sourceEnv.SUPABASE_ANON_KEY) || defaults.SUPABASE_ANON_KEY,
    EMAIL_NOTIFICATIONS_URL: toStringValue(sourceEnv.EMAIL_NOTIFICATIONS_URL),
    EMAIL_NOTIFICATIONS_FROM: toStringValue(sourceEnv.EMAIL_NOTIFICATIONS_FROM),
    EMAIL_NOTIFICATIONS_DEFAULT_RECIPIENTS: Object.freeze(
      parseList(sourceEnv.EMAIL_NOTIFICATIONS_DEFAULT_RECIPIENTS)
    ),
    EMAIL_NOTIFICATIONS_ENABLED_EVENTS: Object.freeze(
      parseList(sourceEnv.EMAIL_NOTIFICATIONS_ENABLED_EVENTS)
    ),
    DOCUMENT_EMAIL_TEMPLATES: Object.freeze([]),
    DOCUMENT_EMAIL_LISTS: Object.freeze([]),
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.warn(
      `Ontbrekende configuratiewaarden: ${missing.join(", ")}. Standaardwaarden worden gebruikt waar beschikbaar.`
    );
  }

  if (!config.EMAIL_NOTIFICATIONS_DEFAULT_RECIPIENTS.length) {
    config.EMAIL_NOTIFICATIONS_DEFAULT_RECIPIENTS = Object.freeze([]);
  }

  if (!config.EMAIL_NOTIFICATIONS_ENABLED_EVENTS.length) {
    config.EMAIL_NOTIFICATIONS_ENABLED_EVENTS = Object.freeze([
      "created",
      "updated",
      "cancelled",
    ]);
  }

  const templateConfig = parseJson(sourceEnv.DOCUMENT_EMAIL_TEMPLATES);
  if (Array.isArray(templateConfig)) {
    const normalized = templateConfig.map(normalizeTemplate).filter(Boolean);
    if (normalized.length) {
      config.DOCUMENT_EMAIL_TEMPLATES = Object.freeze(normalized);
    } else {
      config.DOCUMENT_EMAIL_TEMPLATES = defaultTemplates;
    }
  } else {
    config.DOCUMENT_EMAIL_TEMPLATES = defaultTemplates;
  }

  const listConfig = parseJson(sourceEnv.DOCUMENT_EMAIL_LISTS);
  const baseRecipients = Array.isArray(config.EMAIL_NOTIFICATIONS_DEFAULT_RECIPIENTS)
    ? config.EMAIL_NOTIFICATIONS_DEFAULT_RECIPIENTS
    : [];
  if (Array.isArray(listConfig)) {
    const normalizedLists = listConfig
      .map((item) => normalizeList(item, baseRecipients))
      .filter(Boolean);
    if (normalizedLists.length) {
      config.DOCUMENT_EMAIL_LISTS = Object.freeze(normalizedLists);
    } else {
      config.DOCUMENT_EMAIL_LISTS = Object.freeze([
        normalizeList({ id: "planning", name: "Planningsteam" }, baseRecipients),
      ]);
    }
  } else {
    const planningList = normalizeList(
      { id: "planning", name: "Planningsteam" },
      baseRecipients
    );
    const expeditionList = normalizeList(
      {
        id: "expeditie",
        name: "Expeditie & magazijn",
        recipients: [],
      },
      []
    );
    config.DOCUMENT_EMAIL_LISTS = Object.freeze(
      [planningList, expeditionList].filter(Boolean)
    );
  }

  window.APP_CONFIG = Object.freeze(config);
})();
