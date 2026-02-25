/**
 * Tests for lib/state.cjs -- State field extraction, replacement, and frontmatter sync
 *
 * Uses Node.js built-in assert module. No test framework dependency.
 * Run: node tests/state.test.cjs
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// -- Test fixture: real STATE.md content ------------------------------------

const STATE_FIXTURE = `# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Context isolation through /clear between phases combined with ralph-tui's ability to execute large batches of work unattended
**Current focus:** Phase 1 -- Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 1 of 4 in current phase
Status: Executing
Last activity: 2026-02-25 -- Completed 01-01 (core infrastructure)

Progress: [###-------] 25%

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed 01-01-PLAN.md (core infrastructure)
Resume file: None
`;

// -- Test fixture: STATE.md with YAML frontmatter (production scenario) ------

const STATE_FIXTURE_WITH_FM = `---
ralph_state_version: 1.0
current_phase: 1
total_phases: 5
current_plan: 4
status: executing
last_updated: "2026-02-25T16:14:48.647Z"
last_activity: 2026-02-25 -- Completed 01-04 (compound init + SKILL.md)
progress_percent: 75
total_plans: 4
completed_plans: 4
---

${STATE_FIXTURE}`;

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
  stateExtractField,
  stateReplaceField,
  syncStateFrontmatter,
  writeStateMd,
} = require('../lib/state.cjs');

// -- Tests ------------------------------------------------------------------

test('stateExtractField extracts Phase field', () => {
  const result = stateExtractField(STATE_FIXTURE, 'Phase');
  assert.strictEqual(result, '1 of 5 (Foundation)');
});

test('stateExtractField extracts Status field', () => {
  const result = stateExtractField(STATE_FIXTURE, 'Status');
  assert.strictEqual(result, 'Executing');
});

test('stateExtractField returns null for nonexistent field', () => {
  const result = stateExtractField(STATE_FIXTURE, 'NonExistent');
  assert.strictEqual(result, null);
});

test('stateReplaceField replaces Phase immutably', () => {
  const original = STATE_FIXTURE;
  const result = stateReplaceField(STATE_FIXTURE, 'Phase', '2 of 5 (Orchestrator)');
  // Original must be unchanged
  assert.ok(original.includes('1 of 5 (Foundation)'), 'Original should not be mutated');
  // Result should contain new value
  assert.ok(result.includes('2 of 5 (Orchestrator)'), 'Result should contain new value');
  // Result should not contain old value for the Phase field
  assert.ok(!result.includes('Phase: 1 of 5 (Foundation)'), 'Result should not contain old Phase value');
});

test('stateReplaceField replaces Status field', () => {
  const result = stateReplaceField(STATE_FIXTURE, 'Status', 'In progress');
  assert.ok(result.includes('Status: In progress'), 'Result should contain new Status value');
  assert.ok(!result.includes('Status: Executing'), 'Result should not contain old Status value');
});

test('stateReplaceField returns null for nonexistent field', () => {
  const result = stateReplaceField(STATE_FIXTURE, 'NonExistent', 'value');
  assert.strictEqual(result, null);
});

test('syncStateFrontmatter builds frontmatter from markdown body', () => {
  const result = syncStateFrontmatter(STATE_FIXTURE, '/tmp/test-cwd');
  // Result should have YAML frontmatter delimiters
  assert.ok(result.startsWith('---\n'), 'Should start with --- delimiter');
  assert.ok(result.includes('\n---\n'), 'Should have closing --- delimiter');
  // Should still contain the original body content
  assert.ok(result.includes('# Project State'), 'Should contain body heading');
  assert.ok(result.includes('Phase: 1 of 5 (Foundation)'), 'Should contain Phase field in body');
});

test('writeStateMd writes file with synced frontmatter', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-state-test-'));
  const tmpFile = path.join(tmpDir, 'STATE.md');

  writeStateMd(tmpFile, STATE_FIXTURE, tmpDir);

  const written = fs.readFileSync(tmpFile, 'utf-8');
  assert.ok(written.startsWith('---\n'), 'Written file should start with --- delimiter');
  assert.ok(written.includes('# Project State'), 'Written file should contain body');

  // Cleanup
  fs.unlinkSync(tmpFile);
  fs.rmdirSync(tmpDir);
});

// -- Tests: frontmatter-aware (production scenario) -------------------------

test('stateExtractField extracts Phase from body when frontmatter present', () => {
  const result = stateExtractField(STATE_FIXTURE_WITH_FM, 'Phase');
  assert.strictEqual(result, '1 of 5 (Foundation)',
    `Expected '1 of 5 (Foundation)' but got '${result}' -- regex matched frontmatter instead of body`);
});

test('stateExtractField extracts Status from body when frontmatter present', () => {
  const result = stateExtractField(STATE_FIXTURE_WITH_FM, 'Status');
  assert.strictEqual(result, 'Executing',
    `Expected 'Executing' but got '${result}' -- regex matched frontmatter instead of body`);
});

test('stateReplaceField replaces Phase in body not frontmatter', () => {
  const result = stateReplaceField(STATE_FIXTURE_WITH_FM, 'Phase', '2 of 5 (Orchestrator)');
  // Body Phase line should be updated
  assert.ok(result.includes('Phase: 2 of 5 (Orchestrator)'),
    'Body Phase line should be updated');
  // Frontmatter current_phase should be untouched
  assert.ok(result.includes('current_phase: 1'),
    'Frontmatter current_phase should remain unchanged');
});

test('stateReplaceField + syncStateFrontmatter round-trip preserves change', () => {
  // Simulate what phase-complete does: replace Phase in body, then sync frontmatter
  const replaced = stateReplaceField(STATE_FIXTURE_WITH_FM, 'Phase', '2 of 5 (Orchestrator)');
  assert.ok(replaced !== null, 'stateReplaceField should succeed');
  const synced = syncStateFrontmatter(replaced, '/tmp/test-cwd');
  // After sync, body should still have the new Phase value
  assert.ok(synced.includes('Phase: 2 of 5 (Orchestrator)'),
    'Body Phase should survive syncStateFrontmatter round-trip');
  // Frontmatter should now reflect the updated body (current_phase: 2)
  assert.ok(synced.includes('current_phase: 2'),
    'Frontmatter should be rebuilt from updated body with current_phase: 2');
});

// -- Run --------------------------------------------------------------------

console.log('tests/state.test.cjs\n');
runTests();
