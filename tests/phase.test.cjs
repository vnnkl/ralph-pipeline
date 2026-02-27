/**
 * Tests for lib/phase.cjs -- ROADMAP.md fallback functions and cmdPhaseComplete
 *
 * Uses Node.js built-in assert module. No test framework dependency.
 * Run: node tests/phase.test.cjs
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// -- Test runner ------------------------------------------------------------

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

// -- Import module under test -----------------------------------------------

const {
  findPhaseFromRoadmap,
  findNextPhaseFromRoadmap,
} = require('../lib/phase.cjs');

// -- Fixtures ---------------------------------------------------------------

const ROADMAP_BOLD = `# Roadmap
- [x] **Phase 1: Foundation** - Set up project
- [ ] **Phase 2: Core Logic** - Build pipeline
- [ ] **Phase 3: Polish** - Final touches
`;

const ROADMAP_PLAIN = `# Roadmap
- [x] Phase 1: Foundation - Set up project
- [ ] Phase 2: Core Logic - Build pipeline
- [ ] Phase 3: Polish - Final touches
`;

const STATE_TEMPLATE = `---
ralph_state_version: 1.0
current_phase: 2
total_phases: 3
status: executing
---

# Project State

## Current Position

Phase: 2 of 3
Status: Executing
Last activity: 2026-02-27 -- Phase 1 complete
`;

// -- Helpers ----------------------------------------------------------------

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-phase-test-'));
}

function setupProject(tmpDir, roadmapContent, stateContent) {
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  if (roadmapContent) {
    fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), roadmapContent, 'utf-8');
  }
  if (stateContent) {
    fs.writeFileSync(path.join(planningDir, 'STATE.md'), stateContent, 'utf-8');
  }
}

function cleanupTmpDir(tmpDir) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

// -- Tests: findPhaseFromRoadmap --------------------------------------------

test('findPhaseFromRoadmap finds phase 2 in bold ROADMAP', () => {
  const tmpDir = makeTmpDir();
  try {
    setupProject(tmpDir, ROADMAP_BOLD);
    const result = findPhaseFromRoadmap(tmpDir, 2);
    assert.ok(result !== null, 'Should find phase 2');
    assert.strictEqual(result.number, '02');
    assert.strictEqual(result.name, 'Core Logic');
    assert.strictEqual(result.directory, null);
    assert.strictEqual(result.path, null);
  } finally {
    cleanupTmpDir(tmpDir);
  }
});

test('findPhaseFromRoadmap finds phase 2 in plain ROADMAP', () => {
  const tmpDir = makeTmpDir();
  try {
    setupProject(tmpDir, ROADMAP_PLAIN);
    const result = findPhaseFromRoadmap(tmpDir, 2);
    assert.ok(result !== null, 'Should find phase 2');
    assert.strictEqual(result.number, '02');
    assert.strictEqual(result.name, 'Core Logic');
  } finally {
    cleanupTmpDir(tmpDir);
  }
});

test('findPhaseFromRoadmap returns null for non-existent phase 99', () => {
  const tmpDir = makeTmpDir();
  try {
    setupProject(tmpDir, ROADMAP_BOLD);
    const result = findPhaseFromRoadmap(tmpDir, 99);
    assert.strictEqual(result, null);
  } finally {
    cleanupTmpDir(tmpDir);
  }
});

test('findPhaseFromRoadmap returns null when no ROADMAP.md exists', () => {
  const tmpDir = makeTmpDir();
  try {
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    const result = findPhaseFromRoadmap(tmpDir, 1);
    assert.strictEqual(result, null);
  } finally {
    cleanupTmpDir(tmpDir);
  }
});

test('findPhaseFromRoadmap returned object has directory: null and path: null', () => {
  const tmpDir = makeTmpDir();
  try {
    setupProject(tmpDir, ROADMAP_BOLD);
    const result = findPhaseFromRoadmap(tmpDir, 1);
    assert.ok(result !== null);
    assert.strictEqual(result.directory, null, 'directory should be null');
    assert.strictEqual(result.path, null, 'path should be null');
  } finally {
    cleanupTmpDir(tmpDir);
  }
});

// -- Tests: findNextPhaseFromRoadmap ----------------------------------------

test('findNextPhaseFromRoadmap returns phase 2 when current is 1 (bold)', () => {
  const result = findNextPhaseFromRoadmap(ROADMAP_BOLD, 1);
  assert.ok(result !== null, 'Should find next phase');
  assert.strictEqual(result.number, 2);
  assert.strictEqual(result.name, 'Core Logic');
});

test('findNextPhaseFromRoadmap returns phase 3 when current is 2', () => {
  const result = findNextPhaseFromRoadmap(ROADMAP_BOLD, 2);
  assert.ok(result !== null);
  assert.strictEqual(result.number, 3);
  assert.strictEqual(result.name, 'Polish');
});

test('findNextPhaseFromRoadmap returns null when current is 3 (last phase)', () => {
  const result = findNextPhaseFromRoadmap(ROADMAP_BOLD, 3);
  assert.strictEqual(result, null);
});

test('findNextPhaseFromRoadmap returns null when content is null', () => {
  const result = findNextPhaseFromRoadmap(null, 1);
  assert.strictEqual(result, null);
});

test('findNextPhaseFromRoadmap works with plain format', () => {
  const result = findNextPhaseFromRoadmap(ROADMAP_PLAIN, 1);
  assert.ok(result !== null);
  assert.strictEqual(result.number, 2);
  assert.strictEqual(result.name, 'Core Logic');
});

// -- Integration: cmdPhaseComplete with ROADMAP-only project ----------------

test('cmdPhaseComplete succeeds with ROADMAP-only project (no .planning/phases/)', () => {
  const tmpDir = makeTmpDir();
  try {
    setupProject(tmpDir, ROADMAP_BOLD, STATE_TEMPLATE);

    // Run cmdPhaseComplete in a child process (it calls process.exit)
    const libDir = path.resolve(__dirname, '..');
    const script = `
      process.chdir('${libDir}');
      require('./lib/phase.cjs').cmdPhaseComplete('${tmpDir}', '2', true);
    `;
    const result = execSync(`node -e "${script.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const parsed = JSON.parse(result.trim());
    assert.strictEqual(parsed.completed, 2, 'Should report completed phase 2');
    assert.strictEqual(parsed.next_phase, 3, 'Should report next phase 3');

    // Verify ROADMAP checkbox updated
    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('[x] **Phase 2:'), 'ROADMAP phase 2 checkbox should be checked');

    // Verify STATE.md advanced
    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('Phase: 3 of 3'), 'STATE should advance to phase 3');
  } finally {
    cleanupTmpDir(tmpDir);
  }
});

test('cmdPhaseComplete handles last phase in ROADMAP-only project', () => {
  const tmpDir = makeTmpDir();
  try {
    const statePhase3 = STATE_TEMPLATE
      .replace('current_phase: 2', 'current_phase: 3')
      .replace('Phase: 2 of 3', 'Phase: 3 of 3');
    setupProject(tmpDir, ROADMAP_BOLD, statePhase3);

    const libDir = path.resolve(__dirname, '..');
    const script = `
      process.chdir('${libDir}');
      require('./lib/phase.cjs').cmdPhaseComplete('${tmpDir}', '3', true);
    `;
    const result = execSync(`node -e "${script.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const parsed = JSON.parse(result.trim());
    assert.strictEqual(parsed.completed, 3);
    assert.strictEqual(parsed.next_phase, null, 'Last phase should have no next');
    assert.strictEqual(parsed.pipeline_complete, true);
  } finally {
    cleanupTmpDir(tmpDir);
  }
});

// -- Run --------------------------------------------------------------------

console.log('tests/phase.test.cjs\n');
runTests();
