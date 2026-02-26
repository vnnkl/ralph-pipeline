# Phase 9: Integration Polish - Research

**Researched:** 2026-02-26
**Domain:** SKILL.md variable naming, YOLO bead_format fallback, user gate excerpt flow
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Prompt user once during init/preflight if bead_format is null in config and YOLO mode is active
- Show all three options: bd (Go beads), br (Rust beads), prd.json
- Save chosen format to .planning/config.json via config-set
- Per-project persistence: each project stores its own bead_format in .planning/config.json
- After set once, never re-ask for that project -- user changes manually via `config-set` if needed
- Convert template no longer fails hard on null bead_format -- init already handled it
- Rename `{phase_name}` to `{pipeline_phase}` in SKILL.md (pipeline slug: research, convert, etc.)
- Rename PIPELINE_PHASES object key from `name` to `slug` in lib/orchestrator.cjs
- Add `displayName` field to PIPELINE_PHASES (e.g. slug:'research', displayName:'Research')
- Update fillTemplate() to use `{pipeline_phase}` and `{pipeline_display_name}` instead of `{phase_name}`/`{Name}`
- All templates updated to use new variable names
- Missing output file: show "No output available" message, gate still functions (approve/retry/abort)
- Default excerpt size: 15-20 lines (increased from current 10)
- Skip path writes frontmatter only (completed: true), no body content
- Excerpt strips frontmatter before displaying -- only content lines shown in gate prompt

### Claude's Discretion
- Exact wording of "No output available" message
- Whether to show 15 or 20 lines (pick best fit)
- Test structure and coverage approach
- Migration of existing references in template files

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ORCH-05 | User gates between phases via AskUserQuestion (approve/redirect/replan) | Variable rename ensures excerpt/skip paths use correct pipeline slug; excerpt "No output available" fallback ensures gate always functions |
| STATE-06 | Each phase output file has `completed: true/false` flag for crash recovery | Skip path writes frontmatter-only file with `completed: true`; scanPipelinePhases reads `phase.slug` (renamed from `phase.name`) for output file lookup |
| ORCH-06 | YOLO mode auto-approves all gates without user interaction | bead_format prompt during init/preflight ensures YOLO convert never hits null; convert template updated to read pre-set value instead of failing |
| CONV-01 | Conversion gate: user chooses bead format (bd Go beads / br Rust beads / prd.json) | bead_format fallback prompts once in SKILL.md init flow when YOLO + null; persists to config.json for convert template to read |
</phase_requirements>

## Summary

Phase 9 closes two low-severity integration gaps (INT-03, INT-04) and the partial "User gate excerpt" flow from the v1.0 audit. The work is entirely internal to the ralph-pipeline skill -- no new libraries, no new CJS modules, no new templates. It touches:

1. **`lib/orchestrator.cjs`** -- Rename `name` to `slug` and add `displayName` in PIPELINE_PHASES. Update all internal references (`scanPipelinePhases` output paths). Rename template variables from `PHASE_NAME`/`PHASE_SLUG` to `PIPELINE_DISPLAY_NAME`/`PIPELINE_PHASE` in the variable table and fillTemplate call site in SKILL.md.
2. **`SKILL.md`** -- Fix Step 6 excerpt/skip paths to use pipeline phase slug. Add YOLO bead_format prompt to Step 2 flow. Increase default excerpt lines. Add "No output available" fallback. Update template variable table.
3. **`templates/convert.md`** -- Replace hard fail on null bead_format in YOLO mode with graceful fallback to manual selection.
4. **9 template files** -- Rename `{{PHASE_NAME}}` to `{{PIPELINE_DISPLAY_NAME}}` and `{{PHASE_SLUG}}` to `{{PIPELINE_PHASE}}`.
5. **Tests** -- Update `tests/orchestrator.test.cjs` for renamed fields. Add tests for excerpt "No output available" behavior.
6. **`lib/init.cjs`** -- No change needed. The `phase_name` output field describes the GSD dev-phase name, not the pipeline phase slug. These are distinct concepts.

**Primary recommendation:** Rename PIPELINE_PHASES.name to .slug and add .displayName first (lib/orchestrator.cjs + tests), then cascade the rename through templates, SKILL.md, and init.cjs. Handle the bead_format YOLO fallback in SKILL.md and convert.md as a separate logical unit.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js builtins (fs, path) | >=18 | File I/O, path manipulation | Zero-dep constraint (STATE-01) |
| Node.js assert | >=18 | Test assertions | Already used in all existing tests |

### Supporting
No new libraries needed. This phase modifies existing files only.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual string replace in templates | AST-based template engine | Overkill for simple `{{VAR}}` patterns; fillTemplate regex is sufficient |

**Installation:** None required.

## Architecture Patterns

### Recommended Project Structure
No new files created. Modifications only:
```
lib/
  orchestrator.cjs     # PIPELINE_PHASES rename + fillTemplate variable updates
templates/
  *.md (9 files)       # {{PHASE_NAME}} -> {{PIPELINE_DISPLAY_NAME}}, {{PHASE_SLUG}} -> {{PIPELINE_PHASE}}
tests/
  orchestrator.test.cjs # Updated assertions for renamed fields
SKILL.md               # Step 6 fix + YOLO bead_format prompt + excerpt improvements
```

### Pattern 1: Rename Cascade (slug + displayName)
**What:** Rename `name` -> `slug` in PIPELINE_PHASES, add `displayName`, update all consumers.
**When to use:** When the existing field name is ambiguous and causes integration bugs.
**Detail:**

Current PIPELINE_PHASES entry:
```javascript
{ id: 1, name: 'preflight', template: 'preflight.md', gateOptions: ['approve', 'retry', 'abort'] }
```

New PIPELINE_PHASES entry:
```javascript
{ id: 1, slug: 'preflight', displayName: 'Pre-flight', template: 'preflight.md', gateOptions: ['approve', 'retry', 'abort'] }
```

Consumers that read `phase.name`:
- `scanPipelinePhases()` line 42 -- uses `phase.name` for output file path lookup -> change to `phase.slug`
- `tests/orchestrator.test.cjs` -- asserts `phase.name` in multiple places -> change to `phase.slug`
- `SKILL.md Step 4` variable table: `PHASE_NAME` (capitalized) and `PHASE_SLUG` (lowercase) -> rename to `PIPELINE_DISPLAY_NAME` and `PIPELINE_PHASE`

The rename must be atomic -- all references updated in one plan to avoid broken state.

### Pattern 2: YOLO bead_format Prompt in SKILL.md Init Flow
**What:** Add a bead_format check to SKILL.md's init flow when YOLO mode is active and bead_format is null.
**When to use:** When YOLO mode would otherwise fail hard at a downstream phase.
**Detail:**

Current flow:
1. SKILL.md Step 1: `init pipeline` -> gets mode, bead_format from config
2. YOLO mode: all gates auto-approved
3. Phase 7 (convert): reads bead_format, FAILS if null

New flow:
1. SKILL.md Step 1: `init pipeline` -> gets mode, bead_format from config
2. **New Step 2b:** If mode is "yolo" AND bead_format is null:
   - Prompt user once via AskUserQuestion with bd/br/prd.json options
   - Run `node ralph-tools.cjs config-set bead_format {choice}`
   - Log: "Bead format set to '{choice}' for this project"
3. Phase 7 (convert): reads bead_format from config, finds it set, proceeds normally

The prompt location is in SKILL.md's orchestrator logic (after Step 2 position detection, before Step 3 dispatch). This is the earliest point where mode is known and bead_format can be prompted without interrupting a phase.

### Pattern 3: Excerpt "No Output Available" Fallback
**What:** When `excerptFile()` returns null (file missing) or empty string (frontmatter only), SKILL.md Step 6 shows a fallback message instead of failing.
**When to use:** When a phase produced no output file or the skip path wrote frontmatter only.
**Detail:**

Current SKILL.md Step 6:
```bash
node ralph-tools.cjs excerpt .planning/pipeline/{phase_name}.md 10
```
Uses the result directly in the gate display. If file is missing, the excerpt command exits with error.

New SKILL.md Step 6:
```bash
node ralph-tools.cjs excerpt .planning/pipeline/{pipeline_phase}.md 20
```
If the command returns an error (file not found) or the excerpt is empty:
- Show: "No output available for this phase."
- Gate still presents all options (approve/redirect/skip/etc.)

### Anti-Patterns to Avoid
- **Partial rename:** Renaming `name` to `slug` in PIPELINE_PHASES but leaving `phase.name` references in scanPipelinePhases or tests. All consumers must be updated atomically.
- **Template variable mismatch:** Changing SKILL.md variable table but not updating all 9 template files. fillTemplate() throws on unresolved variables -- this will be caught immediately, but better to avoid.
- **Moving bead_format prompt into a CJS module:** The prompt is SKILL.md orchestrator logic (LLM-executed), not ralph-tools.cjs logic. The CJS layer only stores/retrieves config values.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config persistence | Custom file format | `config-set`/`config-get` CLI commands | Already handles JSON read/write with defaults, type coercion |
| Template filling | New template engine | Existing `fillTemplate()` | Regex-based, handles `{{VAR}}` patterns, throws on unresolved |
| Excerpt extraction | New file reader | Existing `excerptFile()` CLI | Already strips frontmatter, handles missing files (returns null) |

**Key insight:** All three changes leverage existing infrastructure. No new utilities needed.

## Common Pitfalls

### Pitfall 1: Test Breakage from PIPELINE_PHASES Rename
**What goes wrong:** Tests reference `phase.name` in assertions. Renaming to `phase.slug` without updating tests causes all orchestrator tests to fail.
**Why it happens:** 23 existing tests in `tests/orchestrator.test.cjs` use `phase.name` in assertions and helper functions.
**How to avoid:** Update tests first (or simultaneously) with the PIPELINE_PHASES rename. Run `node tests/orchestrator.test.cjs` after the rename to verify.
**Warning signs:** Test failures mentioning "undefined" where a string was expected.

### Pitfall 2: fillTemplate Variable Name Transition
**What goes wrong:** SKILL.md documents new variable names (`PIPELINE_PHASE`, `PIPELINE_DISPLAY_NAME`) but fillTemplate is called with old names (`PHASE_SLUG`, `PHASE_NAME`), or vice versa.
**Why it happens:** The variable names appear in three places: (1) SKILL.md Step 4 variable table, (2) fillTemplate() call site in SKILL.md Step 4 logic, (3) `{{VAR}}` patterns in 9 template files. All three must agree.
**How to avoid:** Update the SKILL.md variable table, then update all 9 templates, then verify with a grep for the old variable names.
**Warning signs:** `fillTemplate` throwing "Unresolved template variables" errors.

### Pitfall 3: scanPipelinePhases File Path After Rename
**What goes wrong:** `scanPipelinePhases()` constructs output file paths using `phase.name` (line 42 of orchestrator.cjs). After renaming to `phase.slug`, the path construction must use `phase.slug`. If missed, scan returns all phases as "not found."
**Why it happens:** The rename changes the property name but the value stays the same ('preflight', 'research', etc.), so the actual file paths don't change -- but the code must reference the new property name.
**How to avoid:** Search-and-replace `phase.name` to `phase.slug` in orchestrator.cjs (excluding the deleted `name` field itself).
**Warning signs:** `scanPipelinePhases` returning `outputExists: false` for files that actually exist.

### Pitfall 4: init.cjs `phase_name` Output Field Confusion
**What goes wrong:** Confusing `phase_name` from init pipeline (GSD dev-phase name like "Tech debt cleanup") with the pipeline phase slug (like "research", "convert").
**Why it happens:** `phase_name` in init.cjs comes from the GSD `.planning/phases/` directory structure (e.g., "08-tech-debt-cleanup" -> "Tech debt cleanup"), NOT from PIPELINE_PHASES. These are two different naming systems.
**How to avoid:** Keep the init output field as-is (`phase_name`) -- it describes the GSD dev-phase name, used for logging/display. The pipeline phase slug comes from PIPELINE_PHASES, used for file paths and template variables. Document this distinction in SKILL.md.
**Warning signs:** SKILL.md confusing the GSD dev-phase name with the pipeline phase slug.

### Pitfall 5: YOLO bead_format Prompt Placement
**What goes wrong:** Placing the bead_format prompt inside the preflight template instead of SKILL.md orchestrator logic.
**Why it happens:** CONTEXT.md says "init/preflight" but the actual mechanism must be in SKILL.md's orchestrator flow.
**How to avoid:** Place the bead_format check in SKILL.md after Step 2 (position detection), before Step 3 (status banner). The config-set call happens at the orchestrator level and persists to disk immediately.
**Warning signs:** bead_format remaining null after the prompt because it was set in a context that doesn't persist to the orchestrator's subsequent steps.

**Note on subagent persistence:** `config-set` writes to disk via `saveConfig()`, so a subagent CAN persist config changes. However, placing the prompt in SKILL.md orchestrator flow is simpler, more direct, and avoids the orchestrator needing to re-read config after a subagent finishes. This aligns with the CONTEXT.md decision.

## Code Examples

### PIPELINE_PHASES Rename (orchestrator.cjs)
```javascript
// Before:
{ id: 1, name: 'preflight', template: 'preflight.md', gateOptions: [...] }

// After:
{ id: 1, slug: 'preflight', displayName: 'Pre-flight', template: 'preflight.md', gateOptions: [...] }
```

All 9 phases with displayName values:
```javascript
const PIPELINE_PHASES = [
  { id: 1, slug: 'preflight',  displayName: 'Pre-flight',  template: 'preflight.md',  gateOptions: ['approve', 'retry', 'abort'] },
  { id: 2, slug: 'clarify',    displayName: 'Clarify',     template: 'clarify.md',    gateOptions: ['approve', 'redirect', 'skip'] },
  { id: 3, slug: 'research',   displayName: 'Research',    template: 'research.md',   gateOptions: ['approve', 'redirect', 'replan'] },
  { id: 4, slug: 'prd',        displayName: 'PRD',         template: 'prd.md',        gateOptions: ['approve', 'redirect', 'replan'] },
  { id: 5, slug: 'deepen',     displayName: 'Deepen',      template: 'deepen.md',     gateOptions: ['approve', 'redirect', 'skip'] },
  { id: 6, slug: 'resolve',    displayName: 'Resolve',     template: 'resolve.md',    gateOptions: ['approve', 'redirect'] },
  { id: 7, slug: 'convert',    displayName: 'Convert',     template: 'convert.md',    gateOptions: ['approve', 'skip'] },
  { id: 8, slug: 'execute',    displayName: 'Execute',     template: 'execute.md',    gateOptions: ['approve', 'retry', 'abort'] },
  { id: 9, slug: 'review',     displayName: 'Review',      template: 'review.md',     gateOptions: ['approve', 'skip'] },
];
```

### scanPipelinePhases Reference Update (orchestrator.cjs line 42)
```javascript
// Before:
const outputPath = path.join(cwd, '.planning', 'pipeline', `${phase.name}.md`);

// After:
const outputPath = path.join(cwd, '.planning', 'pipeline', `${phase.slug}.md`);
```

### Template Variable Rename (all 9 templates)
```markdown
<!-- Before: -->
Execute {{PHASE_NAME}} phase ({{PHASE_ID}} of 9) for the current pipeline project.
- Output file exists at .planning/pipeline/{{PHASE_SLUG}}.md

<!-- After: -->
Execute {{PIPELINE_DISPLAY_NAME}} phase ({{PHASE_ID}} of 9) for the current pipeline project.
- Output file exists at .planning/pipeline/{{PIPELINE_PHASE}}.md
```

### SKILL.md Step 4 Variable Table Update
```markdown
<!-- Before: -->
| `{{PHASE_NAME}}` | Capitalized phase name (e.g., "Research") |
| `{{PHASE_SLUG}}` | URL-safe phase name (e.g., "research") |

<!-- After: -->
| `{{PIPELINE_DISPLAY_NAME}}` | Pipeline phase display name (e.g., "Research") |
| `{{PIPELINE_PHASE}}` | Pipeline phase slug (e.g., "research") |
```

### SKILL.md Step 6 Excerpt Fix
```markdown
<!-- Before: -->
node ralph-tools.cjs excerpt .planning/pipeline/{phase_name}.md 10

<!-- After: -->
node ralph-tools.cjs excerpt .planning/pipeline/{pipeline_phase}.md 20
```
Where `{pipeline_phase}` is the slug from PIPELINE_PHASES (e.g., "research", "convert"), NOT the GSD dev-phase name from init.

### SKILL.md Step 6 Skip Path Fix
```markdown
<!-- Before: -->
- **skip** -- Mark phase as completed (write `.planning/pipeline/{phase_name}.md` ...)

<!-- After: -->
- **skip** -- Mark phase as completed (write `.planning/pipeline/{pipeline_phase}.md` ...)
```

### SKILL.md Step 2b: YOLO Bead Format Check (new section)
```markdown
### Step 2b: YOLO Bead Format Check

If mode is "yolo":
  Read bead_format: `node ralph-tools.cjs config-get bead_format --raw`
  If bead_format is null or empty:
    Ask via AskUserQuestion:
      - Header: "Bead Format (YOLO Setup)"
      - Question: "YOLO mode needs a bead format for the convert phase. Choose once for this project:"
      - Options:
        1. bd -- Go beads via /ralph-tui-create-beads
        2. br -- Rust beads via /ralph-tui-create-beads-rust
        3. prd.json -- JSON format via /ralph-tui-create-json
    Run: `node ralph-tools.cjs config-set bead_format {choice}`
    Log: "Bead format set to '{choice}' for this project."
```

### convert.md YOLO Branch Update
```markdown
<!-- Before: -->
- If bead_format is NOT set: FAIL with error.

<!-- After: -->
- If bead_format is NOT set: Fall back to manual selection.
  - Log: "YOLO mode: bead_format not set in config. Falling back to manual selection."
  - Present the AskUserQuestion bead format choice (same as non-YOLO path).
  - After selection, save to config: `node ralph-tools.cjs config-set bead_format {choice}`
```

### Excerpt Null Handling in SKILL.md Step 6
```markdown
node ralph-tools.cjs excerpt .planning/pipeline/{pipeline_phase}.md 20

If the excerpt command fails (file not found) or returns an empty excerpt:
  Set excerpt to: "No output available for this phase."

Then present the gate with the excerpt and context-dependent options.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `phase.name` for both slug and display | `phase.slug` + `phase.displayName` | Phase 9 | Eliminates ambiguity between pipeline phase identifiers and GSD dev-phase names |
| YOLO convert fails hard on null bead_format | Prompt once during init when YOLO + null | Phase 9 | YOLO mode never interrupted mid-pipeline by missing config |
| Excerpt shows 10 lines, no missing-file handling | 20 lines, "No output available" fallback | Phase 9 | User gate always functions even with missing/empty output |

**Deprecated/outdated:**
- `{{PHASE_NAME}}` template variable -- replaced by `{{PIPELINE_DISPLAY_NAME}}`
- `{{PHASE_SLUG}}` template variable -- replaced by `{{PIPELINE_PHASE}}`
- `phase.name` field in PIPELINE_PHASES -- replaced by `phase.slug`

## Open Questions

1. **Excerpt line count: 15 or 20?**
   - What we know: CONTEXT.md says "15-20 lines" and leaves it to Claude's discretion.
   - Recommendation: Use 20. More context is better for the user making gate decisions, and 20 lines is still small enough to fit in any terminal. The existing `excerptFile` function handles truncation at the specified limit.

2. **displayName capitalization for "PRD" and "Pre-flight"**
   - What we know: Phase names in SKILL.md Section "Phases" list use "Pre-flight" and "PRD" (not "Preflight" or "Prd").
   - Recommendation: Match the SKILL.md section: Pre-flight, Clarify, Research, PRD, Deepen, Resolve, Convert, Execute, Review. These are the user-facing display names.

3. **Should init.cjs `phase_name` field be renamed?**
   - What we know: `init pipeline` returns `phase_name: "Tech debt cleanup"` which is the GSD dev-phase name, not a pipeline slug. SKILL.md Step 1 parses this field for logging.
   - Recommendation: Keep as-is. This field describes the GSD phase, not the pipeline phase. Renaming it would break the existing init contract. The pipeline slug comes from PIPELINE_PHASES, which is used in Step 4 dispatch. Document the distinction in SKILL.md.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of `lib/orchestrator.cjs` (179 lines), `lib/init.cjs` (261 lines), `lib/core.cjs` (163 lines)
- Direct codebase inspection of all 9 `templates/*.md` files
- Direct codebase inspection of `SKILL.md` (374 lines)
- Direct codebase inspection of `tests/orchestrator.test.cjs` (348 lines)
- `.planning/v1.0-MILESTONE-AUDIT.md` -- INT-03, INT-04, "User gate excerpt" flow descriptions

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` accumulated decisions -- confirms YOLO bead_format behavior was intentional but recovery path not surfaced

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all changes to existing codebase
- Architecture: HIGH -- all patterns are variations of existing patterns (rename, config check, null handling)
- Pitfalls: HIGH -- directly observed from codebase analysis (test assertions, file path construction, init output)

**Research date:** 2026-02-26
**Valid until:** Indefinite (codebase-specific research, no external dependency version concerns)
