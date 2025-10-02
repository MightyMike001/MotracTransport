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

  if ((!values.SUPABASE_URL || !values.SUPABASE_ANON_KEY) && fs.existsSync(ENV_FILE_PATH)) {
    const fileEnv = parseEnv(fs.readFileSync(ENV_FILE_PATH, "utf8"));
    values.SUPABASE_URL = values.SUPABASE_URL || fileEnv.SUPABASE_URL;
    values.SUPABASE_ANON_KEY = values.SUPABASE_ANON_KEY || fileEnv.SUPABASE_ANON_KEY;
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

  const output = `window.__APP_ENV__ = Object.freeze({\n  SUPABASE_URL: ${JSON.stringify(
    envValues.SUPABASE_URL
  )},\n  SUPABASE_ANON_KEY: ${JSON.stringify(envValues.SUPABASE_ANON_KEY)}\n});\n`;

  fs.writeFileSync(ENV_OUTPUT_PATH, output, "utf8");
  console.log(`Environment file generated at ${ENV_OUTPUT_PATH}`);
}

try {
  build();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
