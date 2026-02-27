/**
 * Tests for lib/init.cjs -- Verifies init pipeline and init phase return
 * time_budget_expires field from config.json.
 *
 * Uses subprocess execution (child_process.execSync) to avoid the
 * process.exit(0) trap in output(). No test framework dependency.
 *
 * Run: node tests/init.test.cjs
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

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

// -- Constants ------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..');

// -- Helper: create temp project directory with config --------------------------

function createTempProjectWithConfig(configOverrides) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-init-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  // Write config.json
  fs.writeFileSync(
    path.join(planningDir, 'config.json'),
    JSON.stringify(configOverrides, null, 2),
    'utf-8'
  );

  // Write minimal STATE.md (required by init pipeline)
  fs.writeFileSync(
    path.join(planningDir, 'STATE.md'),
    '---\nstatus: unknown\n---\n\n# Project State\n\n## Current Position\n\nPhase: 1 of 1 (Test)\nStatus: unknown\n',
    'utf-8'
  );

  // Write minimal ROADMAP.md
  fs.writeFileSync(
    path.join(planningDir, 'ROADMAP.md'),
    '# Roadmap\n',
    'utf-8'
  );

  return tmpDir;
}

function cleanupTmpDir(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// =============================================================================
// init pipeline -- time_budget_expires
// =============================================================================

test('init pipeline returns time_budget_expires when set in config', () => {
  const tmpDir = createTempProjectWithConfig({
    time_budget_expires: 1740000000000,
    time_budget_hours: 4,
  });
  try {
    const stdout = execSync(
      `node ralph-tools.cjs init pipeline --cwd "${tmpDir}" --raw`,
      { cwd: PROJECT_ROOT, encoding: 'utf-8' }
    );
    const result = JSON.parse(stdout);
    assert.strictEqual(result.time_budget_expires, 1740000000000);
  } finally {
    cleanupTmpDir(tmpDir);
  }
});

test('init pipeline returns time_budget_expires as null when not set', () => {
  const tmpDir = createTempProjectWithConfig({});
  try {
    const stdout = execSync(
      `node ralph-tools.cjs init pipeline --cwd "${tmpDir}" --raw`,
      { cwd: PROJECT_ROOT, encoding: 'utf-8' }
    );
    const result = JSON.parse(stdout);
    assert.strictEqual(result.time_budget_expires, null);
  } finally {
    cleanupTmpDir(tmpDir);
  }
});

test('init phase returns time_budget_expires when set in config', () => {
  const tmpDir = createTempProjectWithConfig({
    time_budget_expires: 1740000000000,
  });
  // Create a minimal phase directory
  const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
  fs.mkdirSync(phaseDir, { recursive: true });
  try {
    const stdout = execSync(
      `node ralph-tools.cjs init phase 1 --cwd "${tmpDir}" --raw`,
      { cwd: PROJECT_ROOT, encoding: 'utf-8' }
    );
    const result = JSON.parse(stdout);
    assert.strictEqual(result.time_budget_expires, 1740000000000);
  } finally {
    cleanupTmpDir(tmpDir);
  }
});

// -- Run ------------------------------------------------------------------------

console.log('tests/init.test.cjs\n');
runTests();
