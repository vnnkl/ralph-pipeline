/**
 * Tests for preflight cache write/read cycle.
 *
 * Validates:
 * - cmdPreflight writes .planning/.preflight-cache.json on success
 * - cmdPreflight does NOT write cache on failure
 * - cmdInitPipeline returns preflight_passed: true for valid cache
 * - cmdInitPipeline returns preflight_passed: null for missing/invalid cache
 * - --force flag deletes old cache and re-runs
 *
 * Uses subprocess execution (execSync) to avoid process.exit trap in output().
 *
 * Run: node tests/preflight.test.cjs
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// -- Test runner ----------------------------------------------------------------

const tests = [];
let mcpAvailable = null;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const { name, fn } of tests) {
    try {
      const result = await fn();
      if (result === 'SKIP') {
        console.log(`  SKIP: ${name}`);
        skipped++;
      } else {
        console.log(`  PASS: ${name}`);
        passed++;
      }
    } catch (err) {
      console.log(`  FAIL: ${name}`);
      console.log(`        ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped, ${passed + failed + skipped} total`);
  process.exit(failed > 0 ? 1 : 0);
}

// -- Constants ------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..');

// -- Helper: create temp project directory for preflight ------------------------

function createTempProjectForPreflight() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-preflight-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  // Minimal STATE.md
  fs.writeFileSync(
    path.join(planningDir, 'STATE.md'),
    '---\nstatus: unknown\n---\n\n# Project State\n\n## Current Position\n\nPhase: 1 of 1 (Test)\nStatus: unknown\n',
    'utf-8'
  );

  // Minimal ROADMAP.md
  fs.writeFileSync(
    path.join(planningDir, 'ROADMAP.md'),
    '# Roadmap\n',
    'utf-8'
  );

  // Minimal PROJECT.md
  fs.writeFileSync(
    path.join(planningDir, 'PROJECT.md'),
    '# Project\n',
    'utf-8'
  );

  // Config with IDE preference
  fs.writeFileSync(
    path.join(planningDir, 'config.json'),
    JSON.stringify({ ide: 'vscode' }, null, 2),
    'utf-8'
  );

  // GSD reference directory with VERSION file
  const refDir = path.join(tmpDir, '.reference', 'get-shit-done');
  fs.mkdirSync(refDir, { recursive: true });
  fs.writeFileSync(path.join(refDir, 'VERSION'), 'v2.1.0', 'utf-8');

  // Required skills under cwd (foundCwd path in checkSkills)
  const skills = ['ralph-tui-prd', 'ralph-tui-create-beads'];
  for (const skill of skills) {
    const skillDir = path.join(tmpDir, '.claude', 'skills', skill);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `# ${skill}\n`, 'utf-8');
  }

  return tmpDir;
}

function cleanupTmpDir(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

/**
 * Check if MCP server (context7) is configured in the test runner's home.
 * If not, preflight will fail due to missing MCP, and we skip cache-write tests.
 */
function checkMcpAvailable() {
  if (mcpAvailable !== null) return mcpAvailable;

  const homeDir = os.homedir();
  const configPaths = [
    path.join(homeDir, '.claude.json'),
    path.join(homeDir, '.claude', 'settings.json'),
  ];

  for (const configPath of configPaths) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.mcpServers && parsed.mcpServers.context7) {
        mcpAvailable = true;
        return true;
      }
    } catch {
      // skip
    }
  }

  // Also check enabledPlugins (plugin-based MCP servers)
  const settingsPath = path.join(homeDir, '.claude', 'settings.json');
  try {
    const content = fs.readFileSync(settingsPath, 'utf-8');
    const parsed = JSON.parse(content);
    if (parsed.enabledPlugins && typeof parsed.enabledPlugins === 'object') {
      const inPlugins = Object.entries(parsed.enabledPlugins)
        .some(([key, val]) => key.startsWith('context7@') && val === true);
      if (inPlugins) {
        mcpAvailable = true;
        return true;
      }
    }
  } catch {
    // skip
  }

  mcpAvailable = false;
  return false;
}

// =============================================================================
// Test 1: preflight writes cache on success
// =============================================================================

test('preflight writes cache on success', () => {
  if (!checkMcpAvailable()) {
    return 'SKIP';
  }

  const tmpDir = createTempProjectForPreflight();
  try {
    execSync(
      `node ralph-tools.cjs preflight --raw --cwd "${tmpDir}"`,
      { cwd: PROJECT_ROOT, encoding: 'utf-8' }
    );

    const cachePath = path.join(tmpDir, '.planning', '.preflight-cache.json');
    assert.ok(fs.existsSync(cachePath), 'Cache file should exist after successful preflight');

    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    assert.strictEqual(cache.version, 1, 'Cache version should be 1');
    assert.strictEqual(typeof cache.timestamp, 'number', 'Cache timestamp should be a number');
    assert.strictEqual(cache.passed, true, 'Cache passed should be true');
    assert.ok('missing' in cache, 'Cache should contain missing field');
    assert.ok('setup_actions' in cache, 'Cache should contain setup_actions field');
    assert.ok('reference' in cache, 'Cache should contain reference field');
    assert.ok('config' in cache, 'Cache should contain config field');
  } finally {
    cleanupTmpDir(tmpDir);
  }
});

// =============================================================================
// Test 2: preflight does NOT write cache on failure
// =============================================================================

test('preflight does NOT write cache on failure', () => {
  // This test requires that at least one required dependency is truly missing.
  // On dev machines with all deps installed (skills at ~, GSD at ~, context7 via plugins),
  // preflight will pass even for a bare temp dir, so we skip.
  if (checkMcpAvailable()) {
    // If MCP is available, skills and GSD likely are too — can't guarantee failure
    return 'SKIP';
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-preflight-fail-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  // Minimal config but NO skills, NO reference -- preflight will fail
  fs.writeFileSync(
    path.join(planningDir, 'config.json'),
    JSON.stringify({ ide: 'vscode' }, null, 2),
    'utf-8'
  );

  try {
    execSync(
      `node ralph-tools.cjs preflight --raw --cwd "${tmpDir}"`,
      { cwd: PROJECT_ROOT, encoding: 'utf-8' }
    );
    // If we get here, preflight unexpectedly passed
    assert.fail('Expected preflight to exit with non-zero code');
  } catch {
    // Expected: preflight exits with code 1
  }

  const cachePath = path.join(tmpDir, '.planning', '.preflight-cache.json');
  assert.ok(!fs.existsSync(cachePath), 'Cache file should NOT exist after failed preflight');

  cleanupTmpDir(tmpDir);
});

// =============================================================================
// Test 3: init pipeline returns preflight_passed true when valid cache exists
// =============================================================================

test('init pipeline returns preflight_passed true when valid cache exists', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-preflight-read-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  // Write STATE.md and config
  fs.writeFileSync(
    path.join(planningDir, 'STATE.md'),
    '---\nstatus: unknown\n---\n\n# Project State\n\n## Current Position\n\nPhase: 1 of 1 (Test)\nStatus: unknown\n',
    'utf-8'
  );
  fs.writeFileSync(
    path.join(planningDir, 'config.json'),
    JSON.stringify({ ide: 'vscode' }, null, 2),
    'utf-8'
  );

  // Pre-write valid cache
  fs.writeFileSync(
    path.join(planningDir, '.preflight-cache.json'),
    JSON.stringify({ version: 1, timestamp: Date.now(), passed: true }, null, 2),
    'utf-8'
  );

  try {
    const stdout = execSync(
      `node ralph-tools.cjs init pipeline --raw --cwd "${tmpDir}"`,
      { cwd: PROJECT_ROOT, encoding: 'utf-8' }
    );
    const result = JSON.parse(stdout);
    assert.strictEqual(result.preflight_passed, true, 'preflight_passed should be true with valid cache');
  } finally {
    cleanupTmpDir(tmpDir);
  }
});

// =============================================================================
// Test 4: init pipeline returns preflight_passed null when cache missing
// =============================================================================

test('init pipeline returns preflight_passed null when cache missing', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-preflight-nocache-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  fs.writeFileSync(
    path.join(planningDir, 'STATE.md'),
    '---\nstatus: unknown\n---\n\n# Project State\n\n## Current Position\n\nPhase: 1 of 1 (Test)\nStatus: unknown\n',
    'utf-8'
  );
  fs.writeFileSync(
    path.join(planningDir, 'config.json'),
    JSON.stringify({ ide: 'vscode' }, null, 2),
    'utf-8'
  );

  // No cache file written

  try {
    const stdout = execSync(
      `node ralph-tools.cjs init pipeline --raw --cwd "${tmpDir}"`,
      { cwd: PROJECT_ROOT, encoding: 'utf-8' }
    );
    const result = JSON.parse(stdout);
    assert.strictEqual(result.preflight_passed, null, 'preflight_passed should be null when cache missing');
  } finally {
    cleanupTmpDir(tmpDir);
  }
});

// =============================================================================
// Test 5: init pipeline returns preflight_passed null when version mismatch
// =============================================================================

test('init pipeline returns preflight_passed null when version mismatch', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-preflight-version-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  fs.writeFileSync(
    path.join(planningDir, 'STATE.md'),
    '---\nstatus: unknown\n---\n\n# Project State\n\n## Current Position\n\nPhase: 1 of 1 (Test)\nStatus: unknown\n',
    'utf-8'
  );
  fs.writeFileSync(
    path.join(planningDir, 'config.json'),
    JSON.stringify({ ide: 'vscode' }, null, 2),
    'utf-8'
  );

  // Write cache with wrong version
  fs.writeFileSync(
    path.join(planningDir, '.preflight-cache.json'),
    JSON.stringify({ version: 999, timestamp: Date.now(), passed: true }, null, 2),
    'utf-8'
  );

  try {
    const stdout = execSync(
      `node ralph-tools.cjs init pipeline --raw --cwd "${tmpDir}"`,
      { cwd: PROJECT_ROOT, encoding: 'utf-8' }
    );
    const result = JSON.parse(stdout);
    assert.strictEqual(result.preflight_passed, null, 'preflight_passed should be null when version mismatched');
  } finally {
    cleanupTmpDir(tmpDir);
  }
});

// =============================================================================
// Test 6: init pipeline returns preflight_passed null when passed is false
// =============================================================================

test('init pipeline returns preflight_passed null when passed is false', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-preflight-false-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  fs.writeFileSync(
    path.join(planningDir, 'STATE.md'),
    '---\nstatus: unknown\n---\n\n# Project State\n\n## Current Position\n\nPhase: 1 of 1 (Test)\nStatus: unknown\n',
    'utf-8'
  );
  fs.writeFileSync(
    path.join(planningDir, 'config.json'),
    JSON.stringify({ ide: 'vscode' }, null, 2),
    'utf-8'
  );

  // Write cache with passed: false
  fs.writeFileSync(
    path.join(planningDir, '.preflight-cache.json'),
    JSON.stringify({ version: 1, timestamp: Date.now(), passed: false }, null, 2),
    'utf-8'
  );

  try {
    const stdout = execSync(
      `node ralph-tools.cjs init pipeline --raw --cwd "${tmpDir}"`,
      { cwd: PROJECT_ROOT, encoding: 'utf-8' }
    );
    const result = JSON.parse(stdout);
    assert.strictEqual(result.preflight_passed, null, 'preflight_passed should be null when passed is false');
  } finally {
    cleanupTmpDir(tmpDir);
  }
});

// =============================================================================
// Test 7: --force deletes old cache and re-runs
// =============================================================================

test('--force deletes old cache and re-runs', () => {
  if (!checkMcpAvailable()) {
    return 'SKIP';
  }

  const tmpDir = createTempProjectForPreflight();
  const cachePath = path.join(tmpDir, '.planning', '.preflight-cache.json');

  // Pre-write a stale cache with old timestamp
  const staleTimestamp = Date.now() - 100000;
  fs.writeFileSync(
    cachePath,
    JSON.stringify({ version: 1, timestamp: staleTimestamp, passed: true }, null, 2),
    'utf-8'
  );

  try {
    execSync(
      `node ralph-tools.cjs preflight --force --raw --cwd "${tmpDir}"`,
      { cwd: PROJECT_ROOT, encoding: 'utf-8' }
    );

    assert.ok(fs.existsSync(cachePath), 'Cache file should exist after --force re-run');

    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    assert.ok(cache.timestamp > staleTimestamp, 'Cache timestamp should be newer after --force re-run');
    assert.strictEqual(cache.version, 1, 'Cache version should be 1');
    assert.strictEqual(cache.passed, true, 'Cache passed should be true');
  } finally {
    cleanupTmpDir(tmpDir);
  }
});

// -- Run ------------------------------------------------------------------------

console.log('tests/preflight.test.cjs\n');
runTests();
