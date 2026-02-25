/**
 * Core -- Shared utilities for ralph-tools.cjs
 *
 * Provides: output(), error(), safeReadFile(), execGit(),
 *           pathExistsInternal(), loadConfig(), saveConfig()
 *
 * Zero npm dependencies -- Node.js builtins only.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// -- Output helpers -----------------------------------------------------------

/**
 * Write structured JSON result to stdout and exit 0.
 * If raw mode and rawValue provided, write raw string instead.
 * If JSON exceeds 50KB, write to temp file and output @file:{path}.
 */
function output(result, raw, rawValue) {
  if (raw && rawValue !== undefined) {
    process.stdout.write(String(rawValue));
  } else {
    const json = JSON.stringify(result, null, 2);
    if (json.length > 50000) {
      const tmpPath = path.join(require('os').tmpdir(), `ralph-${Date.now()}.json`);
      fs.writeFileSync(tmpPath, json, 'utf-8');
      process.stdout.write('@file:' + tmpPath);
    } else {
      process.stdout.write(json);
    }
  }
  process.exit(0);
}

/**
 * Write structured JSON error to stderr and exit 1.
 * Error object includes { error: true, message, code }.
 */
function error(message, code) {
  const errObj = { error: true, message, code: code || 'UNKNOWN' };
  process.stderr.write(JSON.stringify(errObj) + '\n');
  process.exit(1);
}

// -- File utilities -----------------------------------------------------------

/**
 * Read a file safely, returning null on any failure.
 */
function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

// -- Git utilities ------------------------------------------------------------

/**
 * Execute a git command synchronously.
 * Returns { stdout, exitCode, stderr }.
 */
function execGit(cwd, args) {
  try {
    const escaped = args.map(a => {
      if (/^[a-zA-Z0-9._\-/=:@]+$/.test(a)) return a;
      return "'" + a.replace(/'/g, "'\\''") + "'";
    });
    const stdout = execSync('git ' + escaped.join(' '), {
      cwd,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return { exitCode: 0, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status ?? 1,
      stdout: (err.stdout ?? '').toString().trim(),
      stderr: (err.stderr ?? '').toString().trim(),
    };
  }
}

// -- Path utilities -----------------------------------------------------------

/**
 * Check if a path exists relative to cwd (or absolute).
 */
function pathExistsInternal(cwd, targetPath) {
  const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);
  try {
    fs.statSync(fullPath);
    return true;
  } catch {
    return false;
  }
}

// -- Config utilities ---------------------------------------------------------

/**
 * Load .planning/config.json with defaults.
 * Returns merged config (file values override defaults).
 * Returns defaults if file is missing or invalid.
 */
function loadConfig(cwd) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  const defaults = {
    mode: 'normal',
    depth: 'standard',
    model_profile: 'balanced',
    commit_docs: true,
    auto_advance: false,
    time_budget: null,
    ide: null,
  };

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

/**
 * Write config object to .planning/config.json.
 * Creates .planning/ directory if needed.
 */
function saveConfig(cwd, config) {
  const planningDir = path.join(cwd, '.planning');
  const configPath = path.join(planningDir, 'config.json');

  try {
    if (!fs.existsSync(planningDir)) {
      fs.mkdirSync(planningDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    error('Failed to save config: ' + err.message, 'CONFIG_WRITE_FAILED');
  }
}

module.exports = {
  output,
  error,
  safeReadFile,
  execGit,
  pathExistsInternal,
  loadConfig,
  saveConfig,
};
