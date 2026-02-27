/**
 * Tests for lib/codemap.cjs -- Codemap freshness detection and file management.
 *
 * Uses Node.js built-in assert module. No test framework dependency.
 * Run: node tests/codemap.test.cjs
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// -- Test runner ----------------------------------------------------------------

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  PASS: ${name}`);
      passed++;
    } catch (err) {
      console.log(`  FAIL: ${name}`);
      console.log(`        ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
  process.exit(failed > 0 ? 1 : 0);
}

// -- Import module under test ---------------------------------------------------

const {
  checkFreshness,
  getCodemapPaths,
  getCodemapAge,
  CODEMAP_FILES,
  CODEMAP_DIR,
  STALENESS_THRESHOLD_MS,
} = require('../lib/codemap.cjs');

// -- Helper: create temp project with codebase files ----------------------------

const ALL_CODEMAP_FILES = [
  'STACK.md', 'ARCHITECTURE.md', 'STRUCTURE.md',
  'CONCERNS.md', 'CONVENTIONS.md', 'DEPENDENCIES.md', 'API.md',
];

/**
 * Create a temp directory with .planning/codebase/ and optional files.
 * @param {Object} files - keys = filenames, values = content strings
 * @returns {string} temp dir path (project root)
 */
function createTempCodebase(files) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-codemap-test-'));
  const codebaseDir = path.join(tmpDir, '.planning', 'codebase');
  fs.mkdirSync(codebaseDir, { recursive: true });

  for (const [filename, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(codebaseDir, filename), content, 'utf-8');
  }

  return tmpDir;
}

function cleanupTempDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Build a files object with all 7 codemap files populated with dummy content.
 * @returns {Object} keys = filenames, values = "# FILENAME\n"
 */
function allSevenFiles() {
  const files = {};
  for (const name of ALL_CODEMAP_FILES) {
    files[name] = `# ${name}\n\nDummy content.\n`;
  }
  return files;
}

/**
 * Backdate a file's mtime by the given number of hours.
 * @param {string} filePath - absolute path to file
 * @param {number} hours - hours to subtract from current time
 */
function backdateMtime(filePath, hours) {
  const now = new Date();
  const past = new Date(now.getTime() - (hours * 60 * 60 * 1000));
  fs.utimesSync(filePath, past, past);
}

// =============================================================================
// Constants tests
// =============================================================================

test('CODEMAP_FILES has exactly 7 entries', () => {
  assert.strictEqual(CODEMAP_FILES.length, 7);
});

test('CODEMAP_FILES contains all decided names', () => {
  const expected = [
    'STACK.md', 'ARCHITECTURE.md', 'STRUCTURE.md',
    'CONCERNS.md', 'CONVENTIONS.md', 'DEPENDENCIES.md', 'API.md',
  ];
  for (const name of expected) {
    assert.ok(
      CODEMAP_FILES.includes(name),
      `CODEMAP_FILES should include ${name}`
    );
  }
});

test('STALENESS_THRESHOLD_MS equals 4 hours in milliseconds', () => {
  assert.strictEqual(STALENESS_THRESHOLD_MS, 4 * 60 * 60 * 1000);
});

// =============================================================================
// checkFreshness tests
// =============================================================================

test('checkFreshness: returns {exists: false, fresh: false} when .planning/codebase/ directory is missing', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-codemap-test-'));
  try {
    const result = checkFreshness(tmpDir);
    assert.strictEqual(result.exists, false);
    assert.strictEqual(result.fresh, false);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('checkFreshness: returns {exists: false, fresh: false} when only 6 of 7 files exist', () => {
  const files = allSevenFiles();
  delete files['API.md']; // Remove one file
  const tmpDir = createTempCodebase(files);
  try {
    const result = checkFreshness(tmpDir);
    assert.strictEqual(result.exists, false);
    assert.strictEqual(result.fresh, false);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('checkFreshness: returns {exists: true, fresh: true} when all 7 files exist and all are < 4 hours old', () => {
  const tmpDir = createTempCodebase(allSevenFiles());
  try {
    const result = checkFreshness(tmpDir);
    assert.strictEqual(result.exists, true);
    assert.strictEqual(result.fresh, true);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('checkFreshness: returns {exists: true, fresh: false} when all 7 files exist but oldest is > 4 hours old', () => {
  const tmpDir = createTempCodebase(allSevenFiles());
  try {
    // Backdate one file to 5 hours ago
    const staleFile = path.join(tmpDir, '.planning', 'codebase', 'STACK.md');
    backdateMtime(staleFile, 5);
    const result = checkFreshness(tmpDir);
    assert.strictEqual(result.exists, true);
    assert.strictEqual(result.fresh, false);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('checkFreshness: returns {exists: false, fresh: false} when directory exists but is empty', () => {
  const tmpDir = createTempCodebase({}); // empty codebase dir
  try {
    const result = checkFreshness(tmpDir);
    assert.strictEqual(result.exists, false);
    assert.strictEqual(result.fresh, false);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// =============================================================================
// getCodemapPaths tests
// =============================================================================

test('getCodemapPaths: returns object with paths array of exactly 7 strings', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-codemap-test-'));
  try {
    const result = getCodemapPaths(tmpDir);
    assert.ok(Array.isArray(result.paths), 'paths should be an array');
    assert.strictEqual(result.paths.length, 7);
    for (const p of result.paths) {
      assert.strictEqual(typeof p, 'string', 'each path should be a string');
    }
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('getCodemapPaths: each path is absolute (starts with /)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-codemap-test-'));
  try {
    const result = getCodemapPaths(tmpDir);
    for (const p of result.paths) {
      assert.ok(path.isAbsolute(p), `path should be absolute: ${p}`);
    }
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('getCodemapPaths: each path contains .planning/codebase/ segment', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-codemap-test-'));
  try {
    const result = getCodemapPaths(tmpDir);
    for (const p of result.paths) {
      assert.ok(
        p.includes(path.join('.planning', 'codebase')),
        `path should contain .planning/codebase: ${p}`
      );
    }
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('getCodemapPaths: paths include all 7 file names from the inventory', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-codemap-test-'));
  try {
    const result = getCodemapPaths(tmpDir);
    const basenames = result.paths.map(p => path.basename(p));
    for (const name of ALL_CODEMAP_FILES) {
      assert.ok(
        basenames.includes(name),
        `paths should include ${name}, got: ${basenames.join(', ')}`
      );
    }
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// =============================================================================
// getCodemapAge tests
// =============================================================================

test('getCodemapAge: returns {exists: false, age_hours: null} when files missing', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-codemap-test-'));
  try {
    const result = getCodemapAge(tmpDir);
    assert.strictEqual(result.exists, false);
    assert.strictEqual(result.age_hours, null);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('getCodemapAge: returns {exists: true, age_hours: <number>} when all files present', () => {
  const tmpDir = createTempCodebase(allSevenFiles());
  try {
    const result = getCodemapAge(tmpDir);
    assert.strictEqual(result.exists, true);
    assert.strictEqual(typeof result.age_hours, 'number');
    assert.ok(result.age_hours >= 0, 'age_hours should be non-negative');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('getCodemapAge: age_hours reflects oldest file, not newest', () => {
  const tmpDir = createTempCodebase(allSevenFiles());
  try {
    // Backdate STACK.md to 6 hours ago -- this should be the oldest
    const oldFile = path.join(tmpDir, '.planning', 'codebase', 'STACK.md');
    backdateMtime(oldFile, 6);

    const result = getCodemapAge(tmpDir);
    assert.strictEqual(result.exists, true);
    // Age should be approximately 6 hours (oldest file), not ~0 hours (newest)
    assert.ok(result.age_hours >= 5.5, `age_hours should be >= 5.5 (oldest file), got ${result.age_hours}`);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('getCodemapAge: oldest_file and youngest_file are correct with different mtimes', () => {
  const tmpDir = createTempCodebase(allSevenFiles());
  try {
    // Backdate STACK.md to 8 hours ago (oldest)
    const oldFile = path.join(tmpDir, '.planning', 'codebase', 'STACK.md');
    backdateMtime(oldFile, 8);

    // Backdate ARCHITECTURE.md to 2 hours ago (will be youngest after fresh files)
    // All other files are fresh (just created), so youngest = one of the others
    // Let's backdate all but API.md to be clear about which is youngest
    for (const name of ALL_CODEMAP_FILES) {
      if (name === 'STACK.md') continue; // already backdated
      if (name === 'API.md') continue;   // leave as newest
      const fp = path.join(tmpDir, '.planning', 'codebase', name);
      backdateMtime(fp, 4);
    }

    const result = getCodemapAge(tmpDir);
    assert.strictEqual(result.oldest_file, 'STACK.md');
    assert.strictEqual(result.youngest_file, 'API.md');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// -- Run ------------------------------------------------------------------------

console.log('tests/codemap.test.cjs\n');
runTests();
