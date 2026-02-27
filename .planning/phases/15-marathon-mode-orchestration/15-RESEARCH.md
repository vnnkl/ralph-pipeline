# Phase 15: Marathon Mode Orchestration - Research

**Researched:** 2026-02-27
**Domain:** Orchestration / Skill architecture / Pipeline chaining
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Separate `/ralph-marathon` skill (own skill file, not a flag on `/ralph-pipeline`)
- Dedicated setup wizard at launch: asks time budget, bead format, YOLO on/off in one pass
- Resumable: detects completed planning phases via scan-phases, resumes from first incomplete
- Sets `config.marathon = true` so downstream `/ralph-pipeline` knows beads came from marathon
- Chains phases 1-7 (preflight through convert) with /clear between each phase
- Gate behavior identical to standard pipeline: auto-approve if YOLO, pause for user input otherwise
- Failure handling same as standard pipeline: auto-retry once, then pause for user
- Marathon stops after phase 7 (convert) + bead review gate -- never dispatches execute or review
- Bead inventory review gate presented after Convert phase completes
- Shows summary table: bead name, type (bd/br), estimated complexity, source phase, total count + time estimate
- User can drop individual beads from the queue (partial selection)
- Approved beads written to `.beads/` directory (same location as standard pipeline)
- Rejection sends user back to Resolve phase (phase 6) to fix open questions, then re-runs Convert
- YOLO auto-approves all gates including the bead review gate
- Even with YOLO, marathon still stops before execution (phase 8) -- marathon = planning only
- Time budget expiry timestamp is NOT set until Execute phase begins -- planning phases are never budget-constrained

### Claude's Discretion
- Setup wizard UX details (question ordering, defaults)
- State file structure for marathon-specific tracking
- How to present the bead summary table (formatting, sorting)
- Error messages and progress logging between phases

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MARA-01 | User can invoke marathon mode via separate command entry point | New `/ralph-marathon` skill with own SKILL.md; setup wizard pattern reusable from clarify/preflight templates; config flag `marathon: true` |
| MARA-02 | Marathon chains phases 1-7 with auto-approved gates and /clear between each | Orchestrator reuse: PIPELINE_PHASES array, scan-phases, fillTemplate, same dispatch pattern as SKILL.md Steps 3-7; auto-approve = YOLO-like gate bypass |
| MARA-03 | After Convert phase, marathon presents bead inventory review gate before execution | New bead review gate after phase 7; reads `.beads/*.md` frontmatter for inventory table; partial selection via user input; reject loops back to phase 6 |
| MARA-04 | Marathon produces one merged bead queue from all planning phases (`.beads/` directory) | Standard pipeline already writes to `.beads/` in convert phase; marathon reuses same path; no special merging needed beyond what convert already does |
| MARA-05 | Marathon mode works with YOLO mode (auto-approve review gate) | YOLO check on bead review gate; auto-approve = skip user prompt, proceed with all beads; marathon still stops before phase 8 even with YOLO |
</phase_requirements>

## Summary

Marathon mode is a **new skill entry point** (`/ralph-marathon`) that reuses the existing pipeline orchestration machinery to chain phases 1-7 (preflight through convert) with /clear boundaries between each, then presents a bead inventory review gate before stopping. It does NOT execute beads or run review -- it is a planning-only mode.

The implementation is architecturally straightforward because the existing `SKILL.md` orchestrator already handles phase dispatch, gate logic, YOLO bypass, scan-phases position detection, and /clear boundaries. Marathon mode is essentially a specialized orchestrator that: (1) runs a setup wizard, (2) loops through phases 1-7 using the same dispatch/gate/clear pattern, and (3) adds a new bead review gate after convert.

**Primary recommendation:** Create a new MARATHON.md skill file that replicates the orchestrator logic for phases 1-7 but adds the setup wizard, `config.marathon = true` flag, and bead review gate. Keep all state management via existing `ralph-tools.cjs` commands. The key new functionality is: (a) the setup wizard, (b) the bead inventory review gate with partial selection and reject-to-resolve loop, and (c) ensuring time budget is NOT started during planning phases.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ralph-tools.cjs | existing | All state management, config, scan-phases | Already handles everything marathon needs |
| lib/orchestrator.cjs | existing | PIPELINE_PHASES, scanPipelinePhases, fillTemplate | Phase dispatch, template filling, completion checking |
| lib/config.cjs | existing | config-get, config-set with dot-notation | Marathon config flags (marathon, bead_format, mode) |
| lib/time-budget.cjs | existing | Time budget start/check/estimate | Must NOT be called during marathon planning |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lib/init.cjs | existing | cmdInitPipeline for state loading | Marathon startup to detect position |
| lib/phase.cjs | existing | phase-complete for ROADMAP updates | Not used during marathon (no dev-phase completion) |
| lib/codemap.cjs | existing | Codemap freshness and generation | Before research phase (step 3b from SKILL.md) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate skill file | Flag on `/ralph-pipeline` | CONTEXT.md locked decision: separate skill. Also prevents bloating the main orchestrator |
| New marathon-specific CLI commands | Existing config-set/config-get | Config flags sufficient; no new CLI commands needed |
| Custom phase array for marathon | Reusing PIPELINE_PHASES[0..6] | Reuse is simpler and stays in sync with standard pipeline |

## Architecture Patterns

### Recommended Skill Structure
```
ralph-pipeline/
+-- SKILL.md                     # Existing standard pipeline skill
+-- MARATHON.md                  # NEW: Marathon mode skill (separate entry point)
+-- ralph-tools.cjs              # Unchanged: CLI entry point
+-- lib/
|   +-- orchestrator.cjs         # Unchanged: PIPELINE_PHASES, scanPipelinePhases, fillTemplate
|   +-- config.cjs               # Unchanged: config-get/set
|   +-- core.cjs                 # Unchanged
|   +-- init.cjs                 # Unchanged
|   +-- time-budget.cjs          # Unchanged
|   +-- codemap.cjs              # Unchanged
+-- templates/
|   +-- preflight.md             # Reused as-is (phases 1-7)
|   +-- clarify.md               # Reused as-is
|   +-- research.md              # Reused as-is
|   +-- prd.md                   # Reused as-is
|   +-- deepen.md                # Reused as-is
|   +-- resolve.md               # Reused as-is
|   +-- convert.md               # Reused as-is
+-- tests/
    +-- orchestrator.test.cjs    # Extend with marathon-specific tests
```

### Pattern 1: Marathon Orchestrator as Skill File
**What:** MARATHON.md follows the same structure as SKILL.md but scopes to phases 1-7 + bead review gate
**When to use:** This is the primary pattern for the entire phase
**Key differences from SKILL.md:**
- Step 0-1: Same path resolution and state loading
- Step 1b: Setup wizard (asks time budget hours, bead format, YOLO -- but does NOT call `time-budget start`)
- Step 2: Position detection uses scan-phases, but only loops phases 1-7
- Step 3-4: Same phase dispatch via Task subagent with filled templates
- Step 5: Same completion verification (dual check)
- Step 6: Same gate logic (YOLO bypass or user gate)
- Step 7: Same /clear boundary with auto-advance
- NEW Step 8: After phase 7 completes, present bead inventory review gate
- NEW Step 9: On approval, stop. On rejection, loop back to phase 6

### Pattern 2: Setup Wizard (Single-Pass Configuration)
**What:** Marathon setup asks all configuration upfront in one pass before any phase runs
**When to use:** At marathon invocation, before phase dispatch begins
**Implementation:**
```
Setup Wizard Questions (3 questions, presented sequentially):
1. Time Budget -- "How many hours for execution?" (stored but NOT started)
   - Options: 2h / 4h / 8h / No limit / Custom
   - Stores: config.marathon_time_budget_hours (deferred until execute)
2. Bead Format -- "Which bead format?"
   - Options: bd / br / prd.json
   - Stores: config.bead_format
3. YOLO Mode -- "Auto-approve all gates?"
   - Options: Yes (YOLO) / No (interactive)
   - Stores: config.mode = "yolo" or "normal"
```

YOLO mode skip: If mode is already "yolo" when marathon is invoked, skip the wizard and use existing config values (or defaults). Only prompt for bead_format if not already set.

### Pattern 3: Bead Inventory Review Gate
**What:** After convert phase, present a summary table of all beads before stopping
**When to use:** After phase 7 (convert) completes successfully
**Implementation:**
```
## Bead Inventory Review

| # | Bead | Type | Complexity | Source | Keep? |
|---|------|------|------------|--------|-------|
| 1 | US-001-auth.md | bd | Medium | PRD | yes |
| 2 | US-002-dashboard.md | bd | High | PRD | yes |
...

Total: {N} beads | Estimated execution time: {hours}h

Options:
1. Approve all -- Write all beads to .beads/ and stop
2. Drop beads -- Specify which beads to exclude
3. Reject -- Return to Resolve phase to fix open questions
```

Bead inventory data comes from `.beads/*.md` frontmatter (already written by convert phase).

### Pattern 4: Config Flag for Marathon Mode
**What:** `config.marathon = true` signals that beads came from marathon planning
**When to use:** Set at marathon start, read by standard `/ralph-pipeline` when starting execute phase
**Purpose:** Lets the standard pipeline know to:
- Defer `time-budget start` to execute phase beginning (not pipeline start)
- Skip phases 1-7 (already completed by marathon)

### Anti-Patterns to Avoid
- **Inlining orchestrator logic in MARATHON.md:** The marathon skill should reference the same patterns (template filling, phase dispatch, gate logic) that SKILL.md documents. It should NOT reimplement scan-phases or config management in the markdown.
- **Creating marathon-specific templates:** Reuse all existing templates (preflight.md through convert.md). Marathon uses exactly the same phase templates with the same variables.
- **Starting time budget during planning:** CONTEXT.md locked decision: time budget applies to execution only. Store the desired hours in config but do NOT call `time-budget start` until execute phase begins.
- **Dispatching phases 8-9:** Marathon is planning-only. It MUST stop after the bead review gate and never dispatch execute or review.
- **Mutating PIPELINE_PHASES array:** Marathon should slice/filter the existing array, never modify it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase scanning | Custom marathon phase scanner | `scan-phases` from orchestrator.cjs | Already handles all 9 phases, marathon just reads phases 1-7 |
| Template filling | Custom variable substitution | `fillTemplate` from orchestrator.cjs | Handles {{VAR}} patterns, throws on unresolved |
| Config persistence | File-level JSON reads/writes | `config-get`/`config-set` CLI commands | Type coercion, dot-notation, defaults |
| State tracking | Custom state file | Existing `.planning/STATE.md` + `ralph-tools.cjs state` | Frontmatter sync, field extraction |
| Completion detection | Custom file checking | `scan-phases` + frontmatter extraction | Already handles `completed: true/false` detection |
| Bead file reading | Custom YAML parser | `extractFrontmatter` from frontmatter.cjs | Already handles `---` delimited YAML |
| Git commits | Custom git commands | `ralph-tools.cjs commit` | Respects commit_docs flag, handles gitignore |

**Key insight:** Marathon mode introduces zero new CLI commands or library functions. Everything is orchestrated through existing `ralph-tools.cjs` commands and config flags. The only new artifacts are: (1) the MARATHON.md skill file, and (2) a few new config keys (`marathon`, `marathon_time_budget_hours`).

## Common Pitfalls

### Pitfall 1: Time Budget Started During Planning
**What goes wrong:** If `time-budget start` is called at marathon launch, the budget clock ticks down during planning phases. Long research or PRD phases could exhaust the budget before execution begins.
**Why it happens:** Standard pipeline calls `time-budget start` in Step 1b. Marathon must NOT follow this pattern.
**How to avoid:** Store desired hours in `config.marathon_time_budget_hours`. Only call `time-budget start` when execute phase begins (outside marathon scope -- standard pipeline handles this).
**Warning signs:** `time_budget_expires` is non-null after marathon setup wizard.

### Pitfall 2: Position Detection Mismatch After Partial Marathon
**What goes wrong:** If marathon is interrupted at phase 4, resuming should detect phase 4 as incomplete and resume from there, not restart from phase 1.
**Why it happens:** Position detection relies on `scan-phases` which checks `.planning/pipeline/{slug}.md` files.
**How to avoid:** Marathon uses the same `scan-phases` mechanism. The CONTEXT.md locked decision confirms: "detects completed planning phases via scan-phases, resumes from first incomplete."
**Warning signs:** Marathon restarts from phase 1 when resumed after interruption.

### Pitfall 3: Bead Review Gate Skipped When YOLO + Marathon
**What goes wrong:** YOLO auto-approves all gates, but the bead review gate is marathon-specific and might not be handled by the YOLO bypass.
**Why it happens:** The bead review gate is NEW -- it doesn't exist in the standard pipeline.
**How to avoid:** Explicitly check YOLO mode at the bead review gate. CONTEXT.md confirms: "YOLO auto-approves all gates including the bead review gate."
**Warning signs:** Marathon + YOLO mode pauses at bead review gate.

### Pitfall 4: Config State Leaks Between Marathon and Standard Pipeline
**What goes wrong:** `config.marathon = true` or `config.marathon_time_budget_hours` persists after marathon completes, causing unexpected behavior in standard pipeline runs.
**Why it happens:** Config flags are not cleaned up after marathon completes.
**How to avoid:** Marathon must clean up its config flags when it stops (whether after bead review approval, rejection, or abort). Set `config.marathon = false` before stopping.
**Warning signs:** Standard pipeline starts with `marathon = true` in config.

### Pitfall 5: Reject-to-Resolve Loop Not Resetting Convert Phase
**What goes wrong:** When user rejects bead inventory and goes back to Resolve, the Convert phase output (`.planning/pipeline/convert.md`) still has `completed: true`, so marathon tries to skip it.
**Why it happens:** scan-phases sees convert as complete, but the user wants to re-run it after resolving issues.
**How to avoid:** On rejection, marathon must delete or reset `.planning/pipeline/convert.md` (remove `completed: true`) AND `.planning/pipeline/resolve.md` before re-dispatching phase 6. This forces both resolve and convert to re-run.
**Warning signs:** After rejecting bead inventory, marathon skips directly to bead review again without re-running resolve/convert.

### Pitfall 6: Codemap Generation Skipped in Marathon
**What goes wrong:** Marathon chains phases 1-7, but the codemap generation hook (SKILL.md Step 3b) fires before phase 3 (research). Marathon must also do this.
**Why it happens:** Codemap generation is orchestrator logic, not template logic. Marathon must replicate this hook.
**How to avoid:** Marathon orchestrator must check codemap freshness before dispatching phase 3, identical to SKILL.md Step 3b.
**Warning signs:** Research agents in marathon mode lack codemap context.

## Code Examples

### Setup Wizard Flow (MARATHON.md)
```markdown
### Step 1b: Setup Wizard

If this is the first marathon run (config.marathon is not true):

**Question 1: Time Budget**
AskUserQuestion:
  Header: "Time Budget"
  Question: "How many hours should execution run? (Planning has no time limit)"
  Options:
    1. 2 hours
    2. 4 hours
    3. 8 hours
    4. No limit
    5. Custom

Store choice: `config-set marathon_time_budget_hours {hours}`
Do NOT call `time-budget start` -- this happens when execute phase begins.

**Question 2: Bead Format**
AskUserQuestion:
  Header: "Bead Format"
  Question: "Which bead output format?"
  Options:
    1. bd -- Go beads
    2. br -- Rust beads
    3. prd.json -- JSON format

Store choice: `config-set bead_format {format}`

**Question 3: YOLO Mode**
AskUserQuestion:
  Header: "Mode"
  Question: "Auto-approve all planning gates?"
  Options:
    1. Yes -- YOLO mode (fully unattended planning)
    2. No -- Interactive (pause at each gate)

Store choice: `config-set mode {yolo|normal}`
```

### Bead Inventory Construction
```bash
# List all bead files
ls .beads/*.md 2>/dev/null | sort

# For each bead, extract frontmatter for the inventory table
# Fields: title, type, complexity, story_id
```

### Config Flags for Marathon
```bash
# Marathon start
node {RALPH_TOOLS} --cwd {CWD} config-set marathon true
node {RALPH_TOOLS} --cwd {CWD} config-set marathon_time_budget_hours 4

# Marathon stop (cleanup)
node {RALPH_TOOLS} --cwd {CWD} config-set marathon false
```

### Reject-to-Resolve Loop
```bash
# On bead inventory rejection:
# 1. Reset resolve and convert phases
rm -f .planning/pipeline/resolve.md
rm -f .planning/pipeline/convert.md

# 2. Re-dispatch from phase 6 (resolve)
# Marathon loop detects resolve as incomplete via scan-phases
# and dispatches it, followed by convert, then bead review again
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single pipeline mode | Standard + Marathon modes | Phase 15 (now) | Two entry points, shared templates |
| Time budget at pipeline start | Time budget at execution start (marathon) | Phase 15 (now) | Planning phases unconstrained |
| Per-phase gate decisions | Upfront setup wizard (marathon) | Phase 15 (now) | Single config pass, then auto-chain |

**Deprecated/outdated:**
- None -- this is new functionality on a recently-shipped codebase

## Open Questions

1. **How should the standard pipeline detect marathon-completed planning?**
   - What we know: Marathon sets `config.marathon = true` and completes phases 1-7. Standard pipeline should detect this and skip to phase 8.
   - What's unclear: Should the standard pipeline's `scan-phases` naturally handle this (phases 1-7 show as complete), or should it explicitly check `config.marathon`?
   - Recommendation: Rely on `scan-phases` -- it already detects completed phases via output files. The `config.marathon` flag adds semantic context but is not needed for position detection. The flag is useful for the time-budget deferral logic: if `marathon = true` AND `time_budget_expires` is null, call `time-budget start` with `marathon_time_budget_hours` at execute phase start.

2. **Should marathon clean `.beads/` before convert phase runs?**
   - What we know: Convert phase writes beads to `.beads/`. If marathon is resumed after a previous convert, stale beads might remain.
   - What's unclear: Does the convert template already handle this (overwrite existing beads), or could stale beads accumulate?
   - Recommendation: Marathon should clear `.beads/` before dispatching phase 7 (convert) to ensure a clean bead set. This prevents stale beads from a previous run mixing with new beads.

3. **Complexity estimation in the bead inventory table**
   - What we know: CONTEXT.md says the table should show "estimated complexity."
   - What's unclear: Where does complexity come from? Bead frontmatter doesn't currently include a complexity field.
   - Recommendation: Estimate complexity from bead content length or acceptance criteria count. Simple heuristic: <20 lines = Low, 20-50 lines = Medium, >50 lines = High. Or check if bead frontmatter includes a `complexity` or `size` field from the bead creation skill.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `SKILL.md` orchestrator logic (primary reference for phase dispatch, gates, /clear)
- Existing codebase: `lib/orchestrator.cjs` (PIPELINE_PHASES, scanPipelinePhases, fillTemplate)
- Existing codebase: `lib/config.cjs`, `lib/core.cjs`, `lib/time-budget.cjs` (config management, time budget)
- Existing codebase: `templates/convert.md`, `templates/execute.md` (bead creation and execution patterns)
- `15-CONTEXT.md` -- User decisions from discussion phase

### Secondary (MEDIUM confidence)
- `REQUIREMENTS.md` -- MARA-01 through MARA-05 requirement definitions
- `ROADMAP.md` -- Phase dependency chain and success criteria

### Tertiary (LOW confidence)
- None -- all findings based on existing codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Entire implementation reuses existing codebase; zero new dependencies
- Architecture: HIGH -- Pattern directly mirrors existing SKILL.md orchestrator; same dispatch/gate/clear loop
- Pitfalls: HIGH -- Pitfalls identified from careful comparison of marathon vs standard pipeline logic paths

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable codebase, no external dependencies)
