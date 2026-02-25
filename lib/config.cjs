/**
 * Config -- config.json CRUD with dot-notation get/set
 *
 * Provides: cmdConfigGet(), cmdConfigSet()
 *
 * Uses core.cjs for output/error/loadConfig/saveConfig.
 */

const { output, error, loadConfig, saveConfig } = require('./core.cjs');

// -- Type coercion ------------------------------------------------------------

/**
 * Coerce a CLI string value to its native JS type.
 * "true"/"false" -> boolean, numeric -> number, "null" -> null.
 */
function coerceType(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (!isNaN(value) && value !== '') return Number(value);
  return value;
}

// -- Commands -----------------------------------------------------------------

/**
 * Get a config value by dot-notation key, or dump full config.
 * Outputs value via core.output(). Errors if key not found.
 */
function cmdConfigGet(cwd, key, raw) {
  const config = loadConfig(cwd);

  if (!key) {
    // Dump full config
    output(config, raw);
    return;
  }

  // Traverse dot-notation path
  const keys = key.split('.');
  let current = config;
  for (const k of keys) {
    if (current === undefined || current === null || typeof current !== 'object') {
      error('Config key not found: ' + key, 'CONFIG_KEY_NOT_FOUND');
      return;
    }
    current = current[k];
  }

  if (current === undefined) {
    error('Config key not found: ' + key, 'CONFIG_KEY_NOT_FOUND');
    return;
  }

  output(current, raw, String(current));
}

/**
 * Set a config value by dot-notation key with type coercion.
 * Outputs { updated: true, key, value }.
 */
function cmdConfigSet(cwd, key, value) {
  if (!key) {
    error('Usage: config-set <key.path> <value>', 'CONFIG_MISSING_KEY');
    return;
  }

  const config = loadConfig(cwd);
  const coerced = coerceType(value);

  // Traverse/create dot-notation path
  const keys = key.split('.');
  let current = config;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (current[k] === undefined || typeof current[k] !== 'object' || current[k] === null) {
      current[k] = {};
    }
    current = current[k];
  }
  current[keys[keys.length - 1]] = coerced;

  saveConfig(cwd, config);
  output({ updated: true, key, value: coerced });
}

module.exports = {
  cmdConfigGet,
  cmdConfigSet,
};
