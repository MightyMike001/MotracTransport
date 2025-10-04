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

  const config = {
    SUPABASE_URL: toStringValue(sourceEnv.SUPABASE_URL),
    SUPABASE_ANON_KEY: toStringValue(sourceEnv.SUPABASE_ANON_KEY),
    EMAIL_NOTIFICATIONS_URL: toStringValue(sourceEnv.EMAIL_NOTIFICATIONS_URL),
    EMAIL_NOTIFICATIONS_FROM: toStringValue(sourceEnv.EMAIL_NOTIFICATIONS_FROM),
    EMAIL_NOTIFICATIONS_DEFAULT_RECIPIENTS: Object.freeze(
      parseList(sourceEnv.EMAIL_NOTIFICATIONS_DEFAULT_RECIPIENTS)
    ),
    EMAIL_NOTIFICATIONS_ENABLED_EVENTS: Object.freeze(
      parseList(sourceEnv.EMAIL_NOTIFICATIONS_ENABLED_EVENTS)
    ),
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  const requiredMissing = missing.filter((key) =>
    ["SUPABASE_URL", "SUPABASE_ANON_KEY"].includes(key)
  );

  if (requiredMissing.length > 0) {
    const message =
      "Configuration missing: " +
      `${requiredMissing.join(", ")}. Did you run \"npm run build:env\" with the required environment variables?`;
    console.error(message);
    throw new Error(message);
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

  window.APP_CONFIG = Object.freeze(config);
})();
