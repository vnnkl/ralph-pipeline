# Phase 6: Time Budget Init Integration - Research

**Researched:** 2026-02-26
**Domain:** CLI init output / SKILL.md orchestrator field alignment
**Confidence:** HIGH

## Summary

Phase 6 closes two audit gaps (INT-01, FLOW-01) where `cmdInitPipeline` omits `time_budget_expires` from its output and SKILL.md Step 1b uses informal variable names that don't match the actual `time-budget estimate` output keys. The current code works by accident: SKILL.md checks `time_budget_expires` which is absent from init output (evaluates to `undefined`/falsy), and the null-check still passes because no budget is set. But if a budget were set and then the pipeline re-invoked, the orchestrator would not see the expiry timestamp.

The fix is surgical: (1) add `time_budget_expires` to `cmdInitPipeline` result object from `config.time_budget_expires`, (2) update SKILL.md Step 1b log line to use exact keys `estimated_beads_remaining` and `avg_bead_duration_display`, (3) write a test that sets `time_budget_expires` in config and verifies init pipeline returns it.

**Primary recommendation:** Three-file edit (init.cjs, SKILL.md, new or extended test file) -- no architectural changes, no new dependencies.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TIME-01 | User can specify time budget in hours at pipeline start | Init pipeline must return `time_budget_expires` so SKILL.md Step 1b can detect whether a budget is already set and skip/show the prompt correctly |
| TIME-04 | Time remaining persisted to config.json (survives /clear between phases) | `time_budget_expires` is already persisted by `cmdTimeBudgetStart`; init pipeline must surface it in output so the orchestrator reads it after /clear |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js builtins (fs, path) | any | File I/O for config.json | Zero-dep constraint (STATE-01) |
| assert (Node.js builtin) | any | Test assertions | Project test convention (no external framework) |

### Supporting
No additional libraries needed. This is a pure data-plumbing fix.

### Alternatives Considered
None -- this is a bug fix, not a feature choice.

## Architecture Patterns

### Pattern 1: Init Output as Config Surface
**What:** `cmdInitPipeline` selectively surfaces config fields into its result object. Each field consumers need must be explicitly listed.
**When to use:** Any time a new config field needs to be visible to SKILL.md or other consumers of `init pipeline`.
**Example:**
```javascript
// Source: lib/init.cjs lines 111-138
const result = {
  // Config
  mode: config.mode,
  depth: config.depth,
  commit_docs: config.commit_docs,
  auto_advance: config.auto_advance,
  time_budget: config.time_budget,         // existing (legacy, unused)
  time_budget_expires: config.time_budget_expires,  // NEW: needed by SKILL.md Step 1b
  ide: config.ide,
  // ...state, phase info, file checks
};
```

### Pattern 2: Exact Key Matching Between CLI Output and SKILL.md
**What:** SKILL.md references CLI output field names verbatim. Informal shorthand creates ambiguity.
**When to use:** Always -- SKILL.md is read by Claude at runtime; exact field names prevent misinterpretation.
**Current problem in SKILL.md Step 1b line 69:**
```markdown
# WRONG (current):
Log: "Budget: {hours}h. Estimated ~{estimated_beads} beads based on avg {avg_display}/bead."

# CORRECT (fix):
Log: "Budget: {hours}h. Estimated ~{estimated_beads_remaining} beads based on avg {avg_bead_duration_display}/bead."
```

### Pattern 3: Test Pattern for Init Output
**What:** Create temp project dir with config.json, call cmdInitPipeline (or its internal logic), verify result fields.
**When to use:** Testing compound init commands that read from disk.
**Example (based on existing test patterns in tests/orchestrator.test.cjs):**
```javascript
function createTempProjectWithConfig(configObj) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-init-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(
    path.join(planningDir, 'config.json'),
    JSON.stringify(configObj, null, 2),
    'utf-8'
  );
  return tmpDir;
}
```

### Anti-Patterns to Avoid
- **Implicit field pass-through:** Don't spread `...config` into init result -- explicit field listing is the project convention and prevents leaking internal config fields
- **Testing via CLI subprocess:** Don't shell out to `node ralph-tools.cjs init pipeline` in tests. The existing test pattern imports the module directly and calls functions. However, `cmdInitPipeline` calls `process.exit(0)` via `output()`, so the test must either: (a) test the internal logic by extracting the result-building into a testable function, or (b) mock `output()` / `process.exit`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config loading | Custom JSON parser | `loadConfig(cwd)` from lib/core.cjs | Already handles defaults, merging, missing file |
| Test temp dirs | Manual mkdir chains | `fs.mkdtempSync` + cleanup pattern from orchestrator.test.cjs | Proven pattern, auto-unique naming |

**Key insight:** This phase requires zero new infrastructure. All building blocks exist.

## Common Pitfalls

### Pitfall 1: Testing cmdInitPipeline Directly
**What goes wrong:** `cmdInitPipeline` calls `output()` which calls `process.exit(0)`. Importing and calling it in a test will kill the test process.
**Why it happens:** The function was designed as a CLI endpoint, not a testable unit.
**How to avoid:** Two options:
1. **Extract result-building logic** into a pure function (e.g., `buildInitPipelineResult(cwd)`) that returns the object, then have `cmdInitPipeline` call it + `output()`. Test the pure function.
2. **Use child_process.execSync** to invoke the CLI as a subprocess, parse stdout JSON. Less unit-test-y but tests the full path.
**Warning signs:** Test hangs or exits prematurely.

### Pitfall 2: Forgetting cmdInitPhase
**What goes wrong:** `cmdInitPhase` (line 221) also returns `time_budget: config.time_budget` without `time_budget_expires`. If phase subagents ever need the expiry timestamp, they won't have it.
**Why it happens:** Both init commands were written together with the same field list.
**How to avoid:** Update both `cmdInitPipeline` and `cmdInitPhase` result objects to include `time_budget_expires`.
**Warning signs:** Phase subagent can't check time budget status.

### Pitfall 3: The `time_budget` Legacy Field
**What goes wrong:** `loadConfig` defaults include `time_budget: null` (line 117 of core.cjs). This is a legacy/placeholder field. Init returns it as `time_budget`. Meanwhile, the actual time budget uses `time_budget_hours` and `time_budget_expires`. The field `time_budget` is not written to by any command.
**Why it happens:** Original config schema predates the time-budget implementation that uses separate `_hours` and `_expires` fields.
**How to avoid:** Consider whether to keep `time_budget` in init output at all. It's always null or undefined. Could be confusing. At minimum, add `time_budget_expires` alongside it. Removing `time_budget` is optional cleanup (could be Phase 8 tech debt).
**Warning signs:** Consumer reads `time_budget` expecting it to be the expiry timestamp.

## Code Examples

### Fix 1: Add time_budget_expires to cmdInitPipeline (lib/init.cjs)
```javascript
// In cmdInitPipeline result object (around line 111):
const result = {
  // Config
  mode: config.mode,
  depth: config.depth,
  commit_docs: config.commit_docs,
  auto_advance: config.auto_advance,
  time_budget: config.time_budget,
  time_budget_expires: config.time_budget_expires,  // ADD THIS
  ide: config.ide,
  // ... rest unchanged
};
```

### Fix 2: Same for cmdInitPhase (lib/init.cjs)
```javascript
// In cmdInitPhase result object (around line 215):
const result = {
  // Config (pipeline-level)
  mode: config.mode,
  depth: config.depth,
  commit_docs: config.commit_docs,
  auto_advance: config.auto_advance,
  time_budget: config.time_budget,
  time_budget_expires: config.time_budget_expires,  // ADD THIS
  ide: config.ide,
  // ... rest unchanged
};
```

### Fix 3: SKILL.md Step 1b field name alignment
```markdown
### Step 1b: Time Budget Prompt (first run only)

If `time_budget_expires` is null (no budget set yet) AND mode is NOT "yolo":
...
   - Log: "Budget: {hours}h. Estimated ~{estimated_beads_remaining} beads based on avg {avg_bead_duration_display}/bead."
   - If is_first_run: Log: "(First run -- using 20min/bead default estimate)"
```

### Fix 4: Test for init pipeline time_budget_expires
```javascript
// Option A: subprocess test (tests full CLI path)
test('init pipeline returns time_budget_expires from config', () => {
  const tmpDir = createTempProjectWithConfig({
    time_budget_expires: 1740000000000,
    time_budget_hours: 4,
  });
  try {
    const result = execSync(
      `node ralph-tools.cjs init pipeline --cwd "${tmpDir}"`,
      { encoding: 'utf-8', cwd: projectRoot }
    );
    const parsed = JSON.parse(result);
    assert.strictEqual(parsed.time_budget_expires, 1740000000000);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// Option B: extract pure function (preferred for unit testing)
// In lib/init.cjs:
function buildInitPipelineResult(cwd) { /* ... return result object */ }
function cmdInitPipeline(cwd, raw) { output(buildInitPipelineResult(cwd), raw); }
// In test:
test('buildInitPipelineResult includes time_budget_expires', () => {
  const tmpDir = createTempProjectWithConfig({ time_budget_expires: 1740000000000 });
  const result = buildInitPipelineResult(tmpDir);
  assert.strictEqual(result.time_budget_expires, 1740000000000);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `time_budget` config field | Separate `time_budget_hours` + `time_budget_expires` | Phase 5 (05-01) | Absolute timestamps survive /clear without recalculation |

**Deprecated/outdated:**
- `time_budget` config field: legacy placeholder, always null. Not actively used by any command. Consider removing in Phase 8 cleanup.

## Open Questions

1. **Should `time_budget` (the legacy null field) be removed from init output?**
   - What we know: No consumer uses it. It's always null. Removing it is a breaking change only if something reads it.
   - What's unclear: Whether any external consumer or hook depends on it.
   - Recommendation: Keep for now (low risk), flag for Phase 8 tech debt cleanup.

2. **Should the test use subprocess execution or extracted pure function?**
   - What we know: Subprocess tests work but are slower. Extracting a pure function is cleaner but changes the module API.
   - What's unclear: Project preference for init module test style.
   - Recommendation: Use subprocess test (Option A) to avoid refactoring init.cjs structure. Matches the existing pattern of testing CLI behavior end-to-end. If the planner prefers, Option B (extract pure function) is also viable.

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `lib/init.cjs` (cmdInitPipeline result object, lines 111-138)
- Direct code inspection: `lib/time-budget.cjs` (cmdTimeBudgetEstimate output keys, lines 117-137)
- Direct code inspection: `lib/core.cjs` (loadConfig defaults, lines 109-134)
- Direct code inspection: `SKILL.md` (Step 1b field references, lines 52-77)
- Direct code inspection: `.planning/v1.0-MILESTONE-AUDIT.md` (INT-01, FLOW-01 gap descriptions)
- CLI execution: `node ralph-tools.cjs init pipeline` (confirmed missing `time_budget_expires` in output)
- CLI execution: `node ralph-tools.cjs time-budget estimate` (confirmed exact output keys)

### Secondary (MEDIUM confidence)
- None needed -- all findings verified from source code.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - zero-dep Node.js, no external libraries involved
- Architecture: HIGH - direct code inspection of all affected files, clear gap identification
- Pitfalls: HIGH - tested existing code, verified exact field names, identified process.exit testing trap

**Research date:** 2026-02-26
**Valid until:** indefinite (internal codebase, no external dependencies to version-drift)
