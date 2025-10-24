const fs = require("fs");
const path = require("path");

const ENV_OUTPUT_PATH = path.resolve(__dirname, "..", "js", "env.js");
const ENV_FILE_PATH = path.resolve(__dirname, "..", ".env");

function parseEnv(contents) {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .reduce((acc, line) => {
      const eqIndex = line.indexOf("=");
      if (eqIndex === -1) {
        return acc;
      }
      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      acc[key] = value;
      return acc;
    }, {});
}

function loadEnvValues() {
  const values = {};

  if (process.env.SUPABASE_URL) {
    values.SUPABASE_URL = process.env.SUPABASE_URL;
  }
  if (process.env.SUPABASE_ANON_KEY) {
    values.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    values.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
  if (process.env.EMAIL_NOTIFICATIONS_URL) {
    values.EMAIL_NOTIFICATIONS_URL = process.env.EMAIL_NOTIFICATIONS_URL;
  }
  if (process.env.EMAIL_NOTIFICATIONS_FROM) {
    values.EMAIL_NOTIFICATIONS_FROM = process.env.EMAIL_NOTIFICATIONS_FROM;
  }
  if (process.env.EMAIL_NOTIFICATIONS_DEFAULT_RECIPIENTS) {
    values.EMAIL_NOTIFICATIONS_DEFAULT_RECIPIENTS =
      process.env.EMAIL_NOTIFICATIONS_DEFAULT_RECIPIENTS;
  }
  if (process.env.EMAIL_NOTIFICATIONS_ENABLED_EVENTS) {
    values.EMAIL_NOTIFICATIONS_ENABLED_EVENTS =
      process.env.EMAIL_NOTIFICATIONS_ENABLED_EVENTS;
  }
  if (process.env.DOCUMENT_EMAIL_TEMPLATES) {
    values.DOCUMENT_EMAIL_TEMPLATES = process.env.DOCUMENT_EMAIL_TEMPLATES;
  }
  if (process.env.DOCUMENT_EMAIL_LISTS) {
    values.DOCUMENT_EMAIL_LISTS = process.env.DOCUMENT_EMAIL_LISTS;
  }

  if ((!values.SUPABASE_URL || !values.SUPABASE_ANON_KEY) && fs.existsSync(ENV_FILE_PATH)) {
    const fileEnv = parseEnv(fs.readFileSync(ENV_FILE_PATH, "utf8"));
    values.SUPABASE_URL = values.SUPABASE_URL || fileEnv.SUPABASE_URL;
    values.SUPABASE_ANON_KEY = values.SUPABASE_ANON_KEY || fileEnv.SUPABASE_ANON_KEY;
    values.SUPABASE_SERVICE_ROLE_KEY =
      values.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;
    values.EMAIL_NOTIFICATIONS_URL = values.EMAIL_NOTIFICATIONS_URL || fileEnv.EMAIL_NOTIFICATIONS_URL;
    values.EMAIL_NOTIFICATIONS_FROM = values.EMAIL_NOTIFICATIONS_FROM || fileEnv.EMAIL_NOTIFICATIONS_FROM;
    values.EMAIL_NOTIFICATIONS_DEFAULT_RECIPIENTS =
      values.EMAIL_NOTIFICATIONS_DEFAULT_RECIPIENTS ||
      fileEnv.EMAIL_NOTIFICATIONS_DEFAULT_RECIPIENTS;
    values.EMAIL_NOTIFICATIONS_ENABLED_EVENTS =
      values.EMAIL_NOTIFICATIONS_ENABLED_EVENTS || fileEnv.EMAIL_NOTIFICATIONS_ENABLED_EVENTS;
    values.DOCUMENT_EMAIL_TEMPLATES =
      values.DOCUMENT_EMAIL_TEMPLATES || fileEnv.DOCUMENT_EMAIL_TEMPLATES;
    values.DOCUMENT_EMAIL_LISTS =
      values.DOCUMENT_EMAIL_LISTS || fileEnv.DOCUMENT_EMAIL_LISTS;
  }

  return values;
}

function validate(values) {
  const missing = Object.entries({
    SUPABASE_URL: values.SUPABASE_URL,
    SUPABASE_ANON_KEY: values.SUPABASE_ANON_KEY,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Provide them via process.env or a .env file."
    );
  }
}

function build() {
  const envValues = loadEnvValues();
  validate(envValues);

  const configEntries = {
    SUPABASE_URL: envValues.SUPABASE_URL,
    SUPABASE_ANON_KEY: envValues.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: envValues.SUPABASE_SERVICE_ROLE_KEY || "",
    EMAIL_NOTIFICATIONS_URL: envValues.EMAIL_NOTIFICATIONS_URL || "",
    EMAIL_NOTIFICATIONS_FROM: envValues.EMAIL_NOTIFICATIONS_FROM || "",
    EMAIL_NOTIFICATIONS_DEFAULT_RECIPIENTS:
      envValues.EMAIL_NOTIFICATIONS_DEFAULT_RECIPIENTS || "",
    EMAIL_NOTIFICATIONS_ENABLED_EVENTS:
      envValues.EMAIL_NOTIFICATIONS_ENABLED_EVENTS || "",
    DOCUMENT_EMAIL_TEMPLATES: envValues.DOCUMENT_EMAIL_TEMPLATES || "",
    DOCUMENT_EMAIL_LISTS: envValues.DOCUMENT_EMAIL_LISTS || "",
  };

  const serialized = Object.entries(configEntries)
    .map(([key, value]) => `  ${key}: ${JSON.stringify(value)},`)
    .join("\n");

  const output = `window.__APP_ENV__ = Object.freeze({\n${serialized}\n});\n`;

  fs.writeFileSync(ENV_OUTPUT_PATH, output, "utf8");
  console.log(`Environment file generated at ${ENV_OUTPUT_PATH}`);
}

try {
  build();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
