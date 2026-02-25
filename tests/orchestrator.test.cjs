/**
 * Tests for lib/orchestrator.cjs -- Pipeline phase scanning, position detection,
 * template filling, and excerpt extraction.
 *
 * Uses Node.js built-in assert module. No test framework dependency.
 * Run: node tests/orchestrator.test.cjs
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
  PIPELINE_PHASES,
  scanPipelinePhases,
  detectPosition,
  fillTemplate,
  excerptFile,
} = require('../lib/orchestrator.cjs');

// -- Helper: create temp project directory with pipeline files ------------------

function createTempProject(phaseFiles) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-orch-test-'));
  const pipelineDir = path.join(tmpDir, '.planning', 'pipeline');
  fs.mkdirSync(pipelineDir, { recursive: true });

  for (const [filename, content] of Object.entries(phaseFiles)) {
    fs.writeFileSync(path.join(pipelineDir, filename), content, 'utf-8');
  }

  return tmpDir;
}

function cleanupTempDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// =============================================================================
// PIPELINE_PHASES constant
// =============================================================================

test('PIPELINE_PHASES has exactly 9 entries', () => {
  assert.strictEqual(PIPELINE_PHASES.length, 9);
});

test('PIPELINE_PHASES entries have required properties', () => {
  for (const phase of PIPELINE_PHASES) {
    assert.ok(typeof phase.id === 'number', `Phase ${phase.name}: id should be number`);
    assert.ok(typeof phase.name === 'string', `Phase ${phase.id}: name should be string`);
    assert.ok(typeof phase.template === 'string', `Phase ${phase.name}: template should be string`);
    assert.ok(Array.isArray(phase.gateOptions), `Phase ${phase.name}: gateOptions should be array`);
  }
});

test('PIPELINE_PHASES names match expected sequence', () => {
  const expectedNames = [
    'preflight', 'clarify', 'research', 'prd',
    'deepen', 'resolve', 'convert', 'execute', 'review',
  ];
  const actualNames = PIPELINE_PHASES.map(p => p.name);
  assert.deepStrictEqual(actualNames, expectedNames);
});

test('PIPELINE_PHASES gate options vary per phase', () => {
  // Not all phases have the same gateOptions
  const optionSets = PIPELINE_PHASES.map(p => JSON.stringify(p.gateOptions));
  const uniqueSets = new Set(optionSets);
  assert.ok(uniqueSets.size > 1, 'Gate options should not be identical for all phases');
});

// =============================================================================
// scanPipelinePhases(cwd)
// =============================================================================

test('scanPipelinePhases returns 9 phase objects', () => {
  const tmpDir = createTempProject({});
  try {
    const result = scanPipelinePhases(tmpDir);
    assert.strictEqual(result.length, 9);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('scanPipelinePhases: no pipeline dir returns all outputExists false', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-orch-test-'));
  try {
    const result = scanPipelinePhases(tmpDir);
    for (const phase of result) {
      assert.strictEqual(phase.outputExists, false, `${phase.name} outputExists should be false`);
      assert.strictEqual(phase.completed, false, `${phase.name} completed should be false`);
    }
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('scanPipelinePhases: file with completed: true frontmatter returns completed true', () => {
  const tmpDir = createTempProject({
    'preflight.md': '---\ncompleted: true\n---\n\n# Preflight done\n',
  });
  try {
    const result = scanPipelinePhases(tmpDir);
    const preflight = result.find(p => p.name === 'preflight');
    assert.strictEqual(preflight.outputExists, true);
    assert.strictEqual(preflight.completed, true);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('scanPipelinePhases: file with completed: false returns completed false', () => {
  const tmpDir = createTempProject({
    'clarify.md': '---\ncompleted: false\n---\n\n# Clarify in progress\n',
  });
  try {
    const result = scanPipelinePhases(tmpDir);
    const clarify = result.find(p => p.name === 'clarify');
    assert.strictEqual(clarify.outputExists, true);
    assert.strictEqual(clarify.completed, false);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('scanPipelinePhases: file without frontmatter returns completed false', () => {
  const tmpDir = createTempProject({
    'research.md': '# Research notes\n\nSome content here.\n',
  });
  try {
    const result = scanPipelinePhases(tmpDir);
    const research = result.find(p => p.name === 'research');
    assert.strictEqual(research.outputExists, true);
    assert.strictEqual(research.completed, false);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('scanPipelinePhases: returns immutable results (does not mutate PIPELINE_PHASES)', () => {
  const tmpDir = createTempProject({
    'preflight.md': '---\ncompleted: true\n---\n\nDone\n',
  });
  try {
    const result = scanPipelinePhases(tmpDir);
    // PIPELINE_PHASES should NOT have outputExists or completed properties
    assert.strictEqual(PIPELINE_PHASES[0].outputExists, undefined,
      'PIPELINE_PHASES should not be mutated with outputExists');
    assert.strictEqual(PIPELINE_PHASES[0].completed, undefined,
      'PIPELINE_PHASES should not be mutated with completed');
    // Result should have those properties
    assert.strictEqual(typeof result[0].outputExists, 'boolean');
    assert.strictEqual(typeof result[0].completed, 'boolean');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// =============================================================================
// detectPosition(cwd, statePhase)
// =============================================================================

test('detectPosition: state and file scan agree on next phase', () => {
  const tmpDir = createTempProject({
    'preflight.md': '---\ncompleted: true\n---\nDone\n',
    'clarify.md': '---\ncompleted: true\n---\nDone\n',
  });
  try {
    // Phase 3 (research) is next incomplete -- statePhase agrees
    const result = detectPosition(tmpDir, 3);
    assert.strictEqual(result.phase, 3);
    assert.strictEqual(result.mismatch, false);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('detectPosition: state disagrees with file scan -- trusts file scan', () => {
  const tmpDir = createTempProject({
    'preflight.md': '---\ncompleted: true\n---\nDone\n',
    'clarify.md': '---\ncompleted: true\n---\nDone\n',
  });
  try {
    // File scan says phase 3, state says phase 4 -- mismatch
    const result = detectPosition(tmpDir, 4);
    assert.strictEqual(result.phase, 3);
    assert.strictEqual(result.mismatch, true);
    assert.strictEqual(result.corrected_from, 4);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('detectPosition: all phases complete returns pipeline_complete', () => {
  const allFiles = {};
  const names = ['preflight', 'clarify', 'research', 'prd', 'deepen', 'resolve', 'convert', 'execute', 'review'];
  for (const name of names) {
    allFiles[`${name}.md`] = '---\ncompleted: true\n---\nDone\n';
  }
  const tmpDir = createTempProject(allFiles);
  try {
    const result = detectPosition(tmpDir, 9);
    assert.strictEqual(result.phase, null);
    assert.strictEqual(result.pipeline_complete, true);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// =============================================================================
// fillTemplate(templateContent, variables)
// =============================================================================

test('fillTemplate replaces all {{VAR}} patterns', () => {
  const template = 'Hello {{NAME}}, your project is {{PROJECT}}.';
  const result = fillTemplate(template, { NAME: 'Alice', PROJECT: 'MyApp' });
  assert.strictEqual(result, 'Hello Alice, your project is MyApp.');
});

test('fillTemplate throws on unresolved variables', () => {
  const template = 'Hello {{NAME}}, see {{MISSING}}.';
  assert.throws(
    () => fillTemplate(template, { NAME: 'Alice' }),
    /Unresolved template variables/
  );
});

test('fillTemplate handles multiple occurrences of same variable', () => {
  const template = '{{X}} and {{X}} again';
  const result = fillTemplate(template, { X: 'val' });
  assert.strictEqual(result, 'val and val again');
});

test('fillTemplate with empty variables and no placeholders passes through', () => {
  const template = 'No variables here.';
  const result = fillTemplate(template, {});
  assert.strictEqual(result, 'No variables here.');
});

test('fillTemplate converts non-string values to strings', () => {
  const template = 'Count: {{NUM}}, Flag: {{BOOL}}';
  const result = fillTemplate(template, { NUM: 42, BOOL: true });
  assert.strictEqual(result, 'Count: 42, Flag: true');
});

// =============================================================================
// excerptFile(filePath, maxLines)
// =============================================================================

test('excerptFile returns first N non-frontmatter lines', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-orch-test-'));
  const filePath = path.join(tmpDir, 'test.md');
  fs.writeFileSync(filePath, '---\ntitle: Test\n---\n\nLine 1\nLine 2\nLine 3\nLine 4\nLine 5\n', 'utf-8');
  try {
    const result = excerptFile(filePath, 3);
    const lines = result.split('\n');
    assert.strictEqual(lines.length, 3);
    assert.strictEqual(lines[0], '');
    assert.strictEqual(lines[1], 'Line 1');
    assert.strictEqual(lines[2], 'Line 2');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('excerptFile strips frontmatter before excerpting', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-orch-test-'));
  const filePath = path.join(tmpDir, 'test.md');
  fs.writeFileSync(filePath, '---\ntitle: Test\ncompleted: true\n---\n\nBody here\n', 'utf-8');
  try {
    const result = excerptFile(filePath, 10);
    assert.ok(!result.includes('---'), 'Should not contain frontmatter delimiters');
    assert.ok(!result.includes('title: Test'), 'Should not contain frontmatter fields');
    assert.ok(result.includes('Body here'), 'Should contain body content');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('excerptFile returns null for nonexistent file', () => {
  const result = excerptFile('/tmp/nonexistent-ralph-test-file-' + Date.now() + '.md', 10);
  assert.strictEqual(result, null);
});

test('excerptFile returns empty string for frontmatter-only file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-orch-test-'));
  const filePath = path.join(tmpDir, 'test.md');
  fs.writeFileSync(filePath, '---\ntitle: Test\n---\n', 'utf-8');
  try {
    const result = excerptFile(filePath, 10);
    assert.strictEqual(result, '');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('excerptFile defaults to 10 lines when maxLines not specified', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-orch-test-'));
  const filePath = path.join(tmpDir, 'test.md');
  const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`);
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
  try {
    const result = excerptFile(filePath);
    const resultLines = result.split('\n');
    assert.strictEqual(resultLines.length, 10);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// -- Run ------------------------------------------------------------------------

console.log('tests/orchestrator.test.cjs\n');
runTests();
