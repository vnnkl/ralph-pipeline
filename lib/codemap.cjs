/**
 * Codemap -- CLI commands for codemap freshness detection and file management
 *
 * Provides: cmdCodemapCheck(), cmdCodemapPaths(), cmdCodemapAge()
 * Pure functions: checkFreshness(), getCodemapPaths(), getCodemapAge()
 *
 * Constants exported for use by orchestrator:
 *   CODEMAP_FILES, CODEMAP_DIR, STALENESS_THRESHOLD_MS
 *
 * Zero npm dependencies -- Node.js builtins only.
 */

const fs = require('fs');
const path = require('path');
const { output } = require('./core.cjs');

// -- Constants ----------------------------------------------------------------

const CODEMAP_DIR = '.planning/codebase';

const CODEMAP_FILES = [
  'STACK.md', 'ARCHITECTURE.md', 'STRUCTURE.md',
  'CONCERNS.md', 'CONVENTIONS.md', 'DEPENDENCIES.md', 'API.md',
];

const STALENESS_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours

// -- Pure functions (testable, no side effects) --------------------------------

/**
 * Check whether all codemap files exist and are fresh (< staleness threshold).
 * @param {string} cwd - Project root directory
 * @returns {{ exists: boolean, fresh: boolean }}
 */
function checkFreshness(cwd) {
  const dir = path.join(cwd, CODEMAP_DIR);
  const mtimes = [];

  for (const filename of CODEMAP_FILES) {
    try {
      const stat = fs.statSync(path.join(dir, filename));
      mtimes.push(stat.mtimeMs);
    } catch {
      return { exists: false, fresh: false };
    }
  }

  if (mtimes.length !== CODEMAP_FILES.length) {
    return { exists: false, fresh: false };
  }

  const oldestMtime = Math.min(...mtimes);
  const age = Date.now() - oldestMtime;

  return {
    exists: true,
    fresh: age < STALENESS_THRESHOLD_MS,
  };
}

/**
 * Get absolute paths for all codemap files (regardless of whether they exist).
 * @param {string} cwd - Project root directory
 * @returns {{ paths: string[] }}
 */
function getCodemapPaths(cwd) {
  const absolutePaths = CODEMAP_FILES.map(f =>
    path.join(cwd, CODEMAP_DIR, f)
  );
  return { paths: absolutePaths };
}

/**
 * Get age info for the codemap file set based on oldest file mtime.
 * @param {string} cwd - Project root directory
 * @returns {{ exists: boolean, age_hours: number|null, oldest_file?: string, youngest_file?: string }}
 */
function getCodemapAge(cwd) {
  const dir = path.join(cwd, CODEMAP_DIR);
  const entries = [];

  for (const filename of CODEMAP_FILES) {
    try {
      const stat = fs.statSync(path.join(dir, filename));
      entries.push({ filename, mtimeMs: stat.mtimeMs });
    } catch {
      return { exists: false, age_hours: null };
    }
  }

  if (entries.length !== CODEMAP_FILES.length) {
    return { exists: false, age_hours: null };
  }

  const sorted = [...entries].sort((a, b) => a.mtimeMs - b.mtimeMs);
  const oldest = sorted[0];
  const youngest = sorted[sorted.length - 1];
  const ageMs = Date.now() - oldest.mtimeMs;
  const ageHours = Math.round((ageMs / (1000 * 60 * 60)) * 10) / 10;

  return {
    exists: true,
    age_hours: ageHours,
    oldest_file: oldest.filename,
    youngest_file: youngest.filename,
  };
}

// -- CLI wrappers (call output() for JSON stdout) ------------------------------

function cmdCodemapCheck(cwd) {
  output(checkFreshness(cwd));
}

function cmdCodemapPaths(cwd) {
  output(getCodemapPaths(cwd));
}

function cmdCodemapAge(cwd) {
  output(getCodemapAge(cwd));
}

// -- Exports -------------------------------------------------------------------

module.exports = {
  checkFreshness,
  getCodemapPaths,
  getCodemapAge,
  cmdCodemapCheck,
  cmdCodemapPaths,
  cmdCodemapAge,
  CODEMAP_FILES,
  CODEMAP_DIR,
  STALENESS_THRESHOLD_MS,
};
