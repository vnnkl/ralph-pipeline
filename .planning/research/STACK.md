# Technology Stack: v1.1 Marathon Mode + Codemaps

**Project:** ralph-pipeline
**Researched:** 2026-02-27
**Scope:** Incremental additions for marathon mode and codemaps integration only
**Confidence:** HIGH (all recommendations use existing v1.0 patterns; no new dependencies)

---

## Core Principle: Zero New Dependencies

v1.1 adds features, not technology. The entire v1.0 stack carries forward unchanged:

- Node.js CJS, zero npm deps
- YAML frontmatter + markdown state files
- JSON config.json for machine state
- `ralph-tools.cjs` CLI with `lib/*.cjs` modules
- Templates in `templates/` with `{{VAR}}` substitution

**Nothing below requires a new library, runtime, or external tool.**

---

## New CLI Commands for ralph-tools.cjs

### 1. `codemap` subcommand group

Purpose: Detect, validate, and provide paths to `.planning/codebase/` files from `/gsd:map-codebase` output.

| Subcommand | Purpose | Output |
|------------|---------|--------|
| `codemap check` | Check if `.planning/codebase/` exists and has expected files | `{ exists: bool, files: string[], stale: bool, age_hours: number }` |
| `codemap paths` | Return absolute paths for all codemap files suitable for `<files_to_read>` injection | `{ paths: string[] }` or `--raw` returns newline-separated paths |
| `codemap age` | Check staleness of codemap files (oldest mtime) | `{ age_hours: number, stale: bool }` using 24h threshold |

**Implementation location:** New file `lib/codemap.cjs` (~80 lines).

**Why a separate module:** Codemap logic is self-contained (file existence checks, mtime comparison, path listing). Follows the existing pattern where each concern gets its own `lib/*.cjs` file (state.cjs, phase.cjs, time-budget.cjs, etc.).

**Why NOT inline in orchestrator.cjs:** orchestrator.cjs handles pipeline scanning and template filling. Codemap detection is orthogonal and reusable from both the standard pipeline and marathon mode.

**Staleness detection approach:**

```javascript
function getCodemapAge(cwd) {
  const codemapDir = path.join(cwd, '.planning', 'codebase');
  const expectedFiles = ['STACK.md', 'ARCHITECTURE.md', 'STRUCTURE.md',
                         'CONVENTIONS.md', 'TESTING.md', 'INTEGRATIONS.md', 'CONCERNS.md'];
  // Find oldest mtime among existing files
  // Return { age_hours, stale: age_hours > 24, files_found, files_missing }
}
```

Uses `fs.statSync(file).mtimeMs` -- no external dependencies. The 24-hour staleness threshold is a config-overridable default stored in `config.json` as `codemap_stale_hours` (default: 24).

### 2. `marathon` subcommand group

Purpose: Manage marathon mode state -- the merged plan file and execution queue.

| Subcommand | Purpose | Output |
|------------|---------|--------|
| `marathon status` | Check marathon mode state: active, plan exists, queue position | `{ active: bool, plan_exists: bool, total_beads: number, executed: number, remaining: number }` |
| `marathon activate` | Set marathon mode flag in config | `{ activated: true }` |
| `marathon deactivate` | Clear marathon mode flag | `{ deactivated: true }` |

**Implementation location:** New file `lib/marathon.cjs` (~60 lines).

**Why minimal CLI surface:** Marathon mode is primarily an orchestrator concern (SKILL.md logic). The CLI only needs to track the boolean state and provide status reads. The heavy lifting (plan merging, queue ordering) happens in the skill template, not in ralph-tools.cjs.

**Config additions for marathon mode:**

```json
{
  "marathon_active": false,
  "marathon_plan_path": null,
  "codemap_stale_hours": 24
}
```

Added to the `defaults` object in `core.cjs loadConfig()`.

### 3. `init marathon` compound command

Purpose: Load all context needed for marathon mode entry in one call, parallel to `init pipeline`.

```bash
node ralph-tools.cjs --cwd {PROJECT_CWD} init marathon
```

Output JSON includes everything from `init pipeline` plus:
- `marathon_active` -- from config
- `codemap_exists` -- from codemap check
- `codemap_stale` -- from codemap age
- `codemap_files` -- list of available codemap file paths
- `bead_format` -- from config (needed upfront since marathon plans the convert step)

**Implementation:** Add `marathon` case to the `init` switch in `ralph-tools.cjs`, calling a new `cmdInitMarathon(cwd, raw)` in `lib/init.cjs`. This function composes existing `loadConfig()`, `checkPreflightCache()`, codemap functions, and adds marathon-specific fields.

---

## Codemap Integration Points

### What `/gsd:map-codebase` Produces

Seven markdown files in `.planning/codebase/`:

| File | Content | Size (typical) |
|------|---------|----------------|
| STACK.md | Languages, runtime, frameworks, deps | 50-100 lines |
| ARCHITECTURE.md | Layers, data flow, abstractions | 80-200 lines |
| STRUCTURE.md | Directory layout, key locations | 60-120 lines |
| CONVENTIONS.md | Code style, naming, patterns | 50-100 lines |
| TESTING.md | Test framework, structure, coverage | 50-100 lines |
| INTEGRATIONS.md | External APIs, databases | 40-80 lines |
| CONCERNS.md | Tech debt, known issues | 40-80 lines |

Total: ~400-800 lines of markdown. Within budget for `<files_to_read>` injection into subagent prompts.

### How Codemaps Are Consumed

Codemaps are **read-only context** for subagents. They are never written to by the pipeline. Consumption is via `<files_to_read>` blocks in templates.

**Which phases consume codemaps:**

| Phase | Why | Which Codemap Files |
|-------|-----|---------------------|
| 3 - Research | Agents need existing codebase context to research relevant patterns | STACK.md, ARCHITECTURE.md |
| 4 - PRD | PRD creation needs architecture understanding for story scoping | ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md |
| 5 - Deepen | Review agents need code patterns to give relevant feedback | All 7 files (parallel agents, each reads all) |
| 9 - Review | Post-execution review agents need codebase context for architectural judgment | All 7 files |

**Phases that do NOT consume codemaps (and why):**

| Phase | Why Not |
|-------|---------|
| 1 - Preflight | Dependency checks, no code understanding needed |
| 2 - Clarify | User-driven scoping, codemap would add noise |
| 6 - Resolve | Question resolution against PRD, not codebase |
| 7 - Convert | Mechanical PRD-to-beads conversion via chained skill |
| 8 - Execute | Beads execute against the actual code, not against a map |

### Template Variable: `{{CODEMAP_FILES}}`

New template variable. Computed by the orchestrator at dispatch time:

```
{{CODEMAP_FILES}}
```

Resolves to a `<files_to_read>` list of codemap paths if they exist, or empty string if not:

```
- .planning/codebase/STACK.md
- .planning/codebase/ARCHITECTURE.md
- .planning/codebase/STRUCTURE.md
- .planning/codebase/CONVENTIONS.md
- .planning/codebase/TESTING.md
- .planning/codebase/INTEGRATIONS.md
- .planning/codebase/CONCERNS.md
```

**Why a template variable (not hardcoded paths):** Codemaps are optional. If `.planning/codebase/` does not exist, `{{CODEMAP_FILES}}` resolves to empty. Templates do not need conditional logic.

### Codemap Refresh After Execution

After phase 8 (Execute) completes, the orchestrator should offer to refresh codemaps before phase 9 (Review). This ensures review agents see the codebase as it exists post-execution.

**Implementation:** Add a new orchestrator step between phases 8 and 9 in SKILL.md. Not a new CLI command -- the orchestrator invokes `/gsd:map-codebase` as a Task subagent if codemaps are stale.

Decision: Refresh is opt-in in non-YOLO mode (AskUserQuestion). In YOLO mode, auto-refresh if codemaps are older than the execution phase start time.

---

## Marathon Mode Architecture

### What Marathon Mode Is

An alternative to the standard 9-phase sequential pipeline. Instead of plan-execute-gate per phase, marathon mode:

1. Runs phases 1-7 (preflight through convert) in a single planning session
2. Collects all beads into one merged queue
3. Executes the entire queue in a single run (phase 8)
4. Runs review (phase 9) once at the end

**Key difference:** Time budget applies to execution (phase 8) only, not planning phases.

### What Marathon Mode Is NOT

- NOT a new CLI tool
- NOT a separate SKILL.md
- NOT parallel execution of planning phases
- NOT a bypass of any phase content -- all phases still run, just without /clear boundaries during planning

### Marathon Mode Skill Entry

Marathon mode is invoked as an argument to the existing pipeline skill:

```
/ralph-pipeline --marathon
```

Or via trigger phrases in a separate SKILL.md (a thin wrapper):

```yaml
---
name: ralph-marathon
description: "Marathon mode for ralph-pipeline. Plans all phases upfront, merges into one bead queue, executes in single run. Triggers on: ralph marathon, marathon mode, plan all then execute."
---
```

**Recommendation:** Separate SKILL.md file (`MARATHON.md` or similar) that internally dispatches to the same ralph-tools.cjs CLI. This keeps the main SKILL.md focused on the standard 9-phase flow and avoids bloating it with marathon-specific logic.

### Marathon Planning Flow

Marathon mode runs phases 1-7 as Task subagents sequentially (no `/clear` between them, no user gates between planning phases). The orchestrator collects all phase outputs and feeds them forward as `PHASE_FILES`:

```
Phase 1 (Preflight) -> Phase 2 (Clarify) -> Phase 3 (Research) -> ...
     ^                      ^                      ^
     |                      |                      |
   Same session          Same session           Same session
   No /clear             No /clear              No /clear
```

**Why still sequential (not parallel):** Phases have data dependencies. Phase 3 (Research) needs Phase 2 (Clarify) output. Phase 4 (PRD) needs Phase 3 output. These are inherently sequential.

**Why no user gates during planning:** Marathon mode is for users who trust the pipeline to make reasonable decisions. Gates are deferred to a single review after all planning completes. The user reviews the merged plan before execution starts.

### Marathon State File

Marathon mode writes a single merged plan to:

```
.planning/pipeline/marathon-plan.md
```

Format:

```yaml
---
marathon: true
phases_completed: [1, 2, 3, 4, 5, 6, 7]
total_beads: 12
bead_format: bd
created: 2026-02-27T10:00:00Z
---

## Phase Outputs (Summary)

### Clarify
{excerpt from clarify.md}

### Research
{excerpt from research SUMMARY.md}

### PRD
{excerpt from prd.md}

### Deepen
{excerpt from deepen.md}

### Resolve
{excerpt from resolve.md -- auto-resolved or deferred}

### Convert
{bead count and format}

## Merged Bead Queue

1. {bead-1-name} -- {one-line description}
2. {bead-2-name} -- {one-line description}
...
```

This file serves as the single checkpoint for marathon mode. If the session crashes during planning, the orchestrator can detect which phases completed and resume.

### Merged Bead Queue Management

The merged bead queue is NOT a new data structure in ralph-tools.cjs. It is the same `.beads/` directory produced by the Convert phase. Marathon mode simply:

1. Runs Convert (phase 7) which produces `.beads/*.md`
2. Lists beads with `ls .beads/*.md | sort`
3. Executes them sequentially (same as standard mode phase 8)

**No new queue data structure needed.** The existing bead execution machinery in `templates/execute.md` handles everything.

The marathon-plan.md file is a human-readable summary only. It is NOT the execution queue. The queue is the `.beads/` directory.

---

## Config Additions

New fields in `.planning/config.json` (added to `loadConfig()` defaults in core.cjs):

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `marathon_active` | boolean | `false` | Whether marathon mode is currently running |
| `marathon_plan_path` | string/null | `null` | Path to marathon-plan.md (for resumability) |
| `codemap_stale_hours` | number | `24` | Hours before codemaps are considered stale |

**Total additions to core.cjs defaults:** 3 keys. Minimal footprint.

---

## File Changes Summary

### New Files

| File | Lines (est.) | Purpose |
|------|-------------|---------|
| `lib/codemap.cjs` | ~80 | Codemap detection, staleness, path listing |
| `lib/marathon.cjs` | ~60 | Marathon mode state management |
| `templates/marathon.md` | ~200 | Marathon orchestration template |
| `MARATHON.md` (or section in SKILL.md) | ~150 | Marathon mode entry point skill |

### Modified Files

| File | Change | Lines Added (est.) |
|------|--------|-------------------|
| `ralph-tools.cjs` | Add `codemap` and `marathon` command routing | ~30 |
| `lib/core.cjs` | Add 3 config defaults | ~3 |
| `lib/init.cjs` | Add `cmdInitMarathon()` | ~40 |
| `lib/orchestrator.cjs` | Add `{{CODEMAP_FILES}}` to `fillTemplate()` variable computation | ~15 |
| `SKILL.md` | Add codemap refresh step between phases 8-9, `{{CODEMAP_FILES}}` in PHASE_FILES table | ~20 |
| `templates/research.md` | Add `{{CODEMAP_FILES}}` to files_to_read | ~2 |
| `templates/prd.md` | Add `{{CODEMAP_FILES}}` to files_to_read | ~2 |
| `templates/deepen.md` | Add `{{CODEMAP_FILES}}` to files_to_read | ~2 |
| `templates/review.md` | Add `{{CODEMAP_FILES}}` to files_to_read | ~2 |

### Files NOT Changed

| File | Why Not |
|------|---------|
| `lib/frontmatter.cjs` | No new YAML patterns needed |
| `lib/state.cjs` | STATE.md format unchanged |
| `lib/phase.cjs` | Phase completion logic unchanged |
| `lib/commands.cjs` | Git commit logic unchanged |
| `lib/preflight.cjs` | No new dependencies to check |
| `lib/time-budget.cjs` | Time budget logic unchanged (marathon reuses it) |
| `lib/config.cjs` | Config get/set unchanged (new keys are just defaults in core.cjs) |
| `templates/preflight.md` | No codemap context needed |
| `templates/clarify.md` | No codemap context needed |
| `templates/resolve.md` | No codemap context needed |
| `templates/convert.md` | No codemap context needed |
| `templates/execute.md` | No codemap context needed; marathon uses same execution |

---

## Alternatives Considered

| Decision | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Marathon SKILL.md | Separate file | Section in main SKILL.md | Main SKILL.md is already 446 lines; adding marathon branches would make it unreadable. Separate file keeps both focused. |
| Codemap consumption | Template variable `{{CODEMAP_FILES}}` | Hardcoded paths in templates | Codemaps are optional. Template variable resolves to empty when absent. Hardcoding would cause file-not-found errors. |
| Marathon planning | Sequential subagents, same session | Parallel subagents | Phase dependencies prevent parallelism (Research needs Clarify, PRD needs Research). Sequential is correct. |
| Merged bead queue | Use existing `.beads/` directory | New queue data structure in config.json | `.beads/` is the canonical bead store. Adding a parallel queue creates sync problems. Convert phase already orders beads correctly. |
| Codemap refresh | After phase 8, before phase 9 | Before every phase | Unnecessary context cost. Codemaps change only after execution. Pre-execution, the initial map is sufficient. |
| Codemap staleness | File mtime check | Git commit hash comparison | Mtime is simpler, sufficient, and does not require git operations. Git hash comparison adds complexity for minimal benefit. |
| Marathon state | Config flag + marathon-plan.md | New state file format | Config.json already handles boolean flags. A summary markdown file follows the existing phase output pattern. No new state format needed. |

---

## What NOT to Add

| Avoid | Why | Correct Approach |
|-------|-----|------------------|
| New npm dependencies | Breaks zero-dep constraint | All features implementable with Node.js builtins |
| Codemap generation logic in ralph-tools.cjs | `/gsd:map-codebase` already does this; duplicating is wrong | Invoke `/gsd:map-codebase` as a skill/Task subagent |
| Parallel phase execution in marathon mode | Phases have data dependencies; parallelism would require dependency resolution | Sequential subagents with output forwarding |
| Interactive gates during marathon planning | Defeats the purpose of marathon mode | Single review gate before execution starts |
| New bead queue format | `.beads/` directory is the queue | Reuse existing Convert + Execute flow |
| Codemap content in orchestrator context | Violates the "orchestrator passes paths, never content" rule | Pass codemap paths via `<files_to_read>` in templates |
| Dedicated codemap MCP server | Over-engineering for file path listing | Simple filesystem checks in `lib/codemap.cjs` |
| Codemap diffing (detect what changed) | Unnecessary complexity; agents read full codemap each time | Full read each time; 400-800 lines is within budget |

---

## Test Coverage Requirements

### New test files needed:

| File | Tests | Priority |
|------|-------|----------|
| `tests/codemap.test.cjs` | Check detection, staleness calc, path listing, missing dir handling | HIGH |
| `tests/marathon.test.cjs` | Activate/deactivate, status with beads, init marathon output | HIGH |

### Existing tests to extend:

| File | Addition |
|------|----------|
| `tests/init.test.cjs` | Add `init marathon` test case |
| `tests/orchestrator.test.cjs` | Add `{{CODEMAP_FILES}}` variable resolution test |

Pattern: Follow existing test patterns in `tests/state.test.cjs` and `tests/phase.test.cjs` -- synchronous Node.js assert-based tests with filesystem mocking via temp directories.

---

## Integration Points with v1.0

| v1.0 Component | How v1.1 Integrates | Coupling |
|----------------|---------------------|----------|
| `init pipeline` | `init marathon` extends the same pattern, shares `loadConfig()`, `checkPreflightCache()` | Shared utility functions |
| `scan-phases` | Marathon mode reuses scan-phases for phase 8/9 completion detection | Direct reuse |
| `time-budget` | Marathon time-budget starts before phase 8 only (not planning phases) | Direct reuse |
| `phase-complete` | Called once after marathon phase 9 completes (same as standard flow) | Direct reuse |
| `config-get/set` | Marathon adds 3 new config keys, uses same get/set commands | Direct reuse |
| `fillTemplate()` | Extended with `{{CODEMAP_FILES}}` variable | Backward compatible (new variable, existing templates unaffected until updated) |
| Template `<files_to_read>` | Codemap paths appended to existing `{{PHASE_FILES}}` block | Additive only |
| Execute template | Marathon dispatches identical execute template with same bead execution | Unchanged |
| Review template | Marathon dispatches identical review template | Unchanged (gains codemap context) |

---

## Sources

- `/Users/constantin/Code/skills/ralph-pipeline/ralph-tools.cjs` -- Existing CLI entry point, command routing pattern. **Confidence: HIGH** (primary source, verified by reading code)
- `/Users/constantin/Code/skills/ralph-pipeline/lib/core.cjs` -- Config defaults, loadConfig(), output patterns. **Confidence: HIGH**
- `/Users/constantin/Code/skills/ralph-pipeline/lib/init.cjs` -- Compound init pattern for cmdInitPipeline(). **Confidence: HIGH**
- `/Users/constantin/Code/skills/ralph-pipeline/lib/orchestrator.cjs` -- fillTemplate(), PIPELINE_PHASES, scanPipelinePhases(). **Confidence: HIGH**
- `/Users/constantin/Code/skills/ralph-pipeline/SKILL.md` -- Orchestrator logic, template dispatch, PHASE_FILES table. **Confidence: HIGH**
- `/Users/constantin/Code/skills/ralph-pipeline/.reference/get-shit-done/workflows/map-codebase.md` -- /gsd:map-codebase output format: 7 files in .planning/codebase/. **Confidence: HIGH**
- `/Users/constantin/Code/skills/ralph-pipeline/.planning/codebase/*.md` -- Actual codemap output format and content. **Confidence: HIGH**
- `/Users/constantin/Code/skills/ralph-pipeline/.planning/PROJECT.md` -- v1.1 requirements: marathon mode + codemaps. **Confidence: HIGH**

---

*Stack research for: ralph-pipeline v1.1 Marathon Mode + Codemaps*
*Researched: 2026-02-27*
