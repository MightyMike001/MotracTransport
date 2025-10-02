(function () {
  const sourceEnv = (typeof window !== "undefined" && window.__APP_ENV__) || {};

  const config = {
    SUPABASE_URL: typeof sourceEnv.SUPABASE_URL === "string" ? sourceEnv.SUPABASE_URL.trim() : "",
    SUPABASE_ANON_KEY:
      typeof sourceEnv.SUPABASE_ANON_KEY === "string" ? sourceEnv.SUPABASE_ANON_KEY.trim() : "",
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    const message =
      "Configuration missing: " +
      `${missing.join(", ")}. Did you run \"npm run build:env\" with the required environment variables?`;
    console.error(message);
    throw new Error(message);
  }

  window.APP_CONFIG = Object.freeze(config);
})();
