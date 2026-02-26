# Roadmap: ralph-gsd

## Overview

Build a Claude Code skill that orchestrates a 9-phase idea-to-code pipeline using context isolation (/clear between phases) and ralph-tui as the execution engine. The build order is strict: CLI and state schema first (everything depends on them), then the orchestrator shell, then phase-specific subagents, then the execution layer, then advanced automation features layered on top of a verified core.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - ralph-tools.cjs CLI + .planning/ schema + pre-flight skeleton
- [x] **Phase 2: Orchestrator Shell** - SKILL.md entry point, phase sequencing, /clear boundary pattern, user gates
- [x] **Phase 3: Phase Content** - Research, PRD, Deepen, and Resolution subagent prompts
- [x] **Phase 4: Execution Layer** - Conversion, headless execution, bead results, compound review
- [x] **Phase 5: Advanced Features** - YOLO mode, auto-advance chain, time budget, configurable depth
- [x] **Phase 6: Time Budget Init Integration** - Fix init pipeline time_budget_expires + SKILL.md field name alignment
- [x] **Phase 7: Preflight Cache + Skip-on-Resume** - Write preflight cache, populate preflight_passed in init
- [x] **Phase 8: Tech Debt Cleanup** - Replace stub templates, remove dead exports
- [x] **Phase 9: Integration Polish** - Fix {phase_name} variable ambiguity + YOLO bead_format fallback
- [x] **Phase 10: Cosmetic Cleanup** - loadConfig defaults, ROADMAP checkboxes, traceability table, dead code (completed 2026-02-26)
- [x] **Phase 11: Orchestrator State Sync** - Wire cmdPhaseComplete into orchestrator, fix STATE.md staleness
- [ ] **Phase 12: YOLO Time Budget Tracking** - Call record-bead in YOLO mode, fix estimate default
- [ ] **Phase 13: Quality Gate + Doc Polish** - Review re-run QUALITY_GATE_SUFFIX, PHASE_FILES, SKILL.md CLI table

## Phase Details

### Phase 1: Foundation
**Goal**: ralph-tools.cjs and the .planning/ schema exist and are verified end-to-end -- every subsequent phase depends on these
**Depends on**: Nothing (first phase)
**Requirements**: ORCH-01, ORCH-02, ORCH-08, STATE-01, STATE-02, STATE-03, STATE-04, STATE-05, STATE-06, STATE-08
**GSD Reference**: `.reference/get-shit-done/bin/gsd-tools.cjs` (CLI patterns), `.reference/get-shit-done/lib/*.cjs` (helper modules)
**Success Criteria** (what must be TRUE):
  1. `.reference/get-shit-done/` exists on disk and `.gitignore` contains `.reference/` -- the reference is present but not committed
  2. Running `node ralph-tools.cjs init` returns structured JSON with all project state fields populated from .planning/ files -- implementation modeled on `.reference/get-shit-done/bin/gsd-tools.cjs`
  3. Running `node ralph-tools.cjs phase-complete 1` advances STATE.md current_phase and writes a dated entry -- readable in a new shell session with no in-memory state
  4. Pre-flight detects a missing required skill (e.g., /ralph-tui-prd not installed) and exits with a clear blocking error -- not a warning
  5. The skill is installable as a Claude Code skill (SKILL.md present, correct frontmatter, slash-command registers)
**Plans**: 5 plans
- [x] 01-01-PLAN.md -- Core infrastructure: lib/core.cjs, lib/frontmatter.cjs, lib/config.cjs, ralph-tools.cjs router
- [x] 01-02-PLAN.md -- State management (TDD): lib/state.cjs, lib/phase.cjs, lib/commands.cjs
- [x] 01-03-PLAN.md -- Pre-flight + GSD reference: lib/preflight.cjs, setup commands
- [x] 01-04-PLAN.md -- Compound init + SKILL.md: lib/init.cjs, SKILL.md rewrite
- [x] 01-05-PLAN.md -- Gap closure: fix stateExtractField/stateReplaceField frontmatter bug + SUMMARY.md completed boolean

### Phase 2: Orchestrator Shell
**Goal**: SKILL.md can sequence phases, dispatch Task subagents, verify completion flags, and present user gates -- the /clear boundary pattern works end-to-end for at least two phases
**Depends on**: Phase 1
**Requirements**: ORCH-03, ORCH-04, ORCH-05, STATE-07
**GSD Reference**: `.reference/get-shit-done/workflows/` (phase sequencing patterns, /clear boundary implementation, user gate patterns)
**Success Criteria** (what must be TRUE):
  1. Invoking the skill in a fresh session reads STATE.md and resumes at the correct incomplete phase -- no manual phase number needed; sequencing logic mirrors `.reference/get-shit-done/workflows/execute-phase.md`
  2. A phase subagent completes, sets completed: true in its output file, and the orchestrator advances STATE.md without reading the file contents
  3. The user gate appears between phases with approve/redirect/replan options -- selecting redirect sends the subagent back to revise output
  4. Simulating a /clear mid-pipeline and re-invoking the skill resumes from the last incomplete phase, not from Phase 1
**Plans**: 2 plans
- [x] 02-01-PLAN.md -- TDD: lib/orchestrator.cjs (pipeline phase map, scanning, position detection, template filling, excerpt) + tests + CLI wiring
- [x] 02-02-PLAN.md -- SKILL.md orchestrator rewrite (sequencing, dispatch, gates, /clear recovery) + 9 stub template files in templates/

### Phase 3: Phase Content
**Goal**: Research, PRD, Deepen, and Resolution phases each have working subagent prompts that invoke chained skills correctly and produce validated output
**Depends on**: Phase 2
**Requirements**: RSRCH-01, RSRCH-02, RSRCH-03, PRD-01, PRD-02, PRD-03, DEEP-01, DEEP-02, RSLV-01, RSLV-02, RSLV-03
**GSD Reference**: `.reference/get-shit-done/workflows/` (subagent prompt structure, agent definitions), agent definitions and prompt templates in `.reference/get-shit-done/` for research, review, and resolution patterns
**Success Criteria** (what must be TRUE):
  1. Research phase spawns four parallel agents (repo-research, best-practices, framework-docs, learnings) and writes individual output files plus a synthesized SUMMARY.md to .planning/research/ -- agent prompt structure follows GSD agent definitions in `.reference/get-shit-done/`
  2. PRD phase invokes /ralph-tui-prd, validates that [PRD]...[/PRD] markers are present and at least 3 user stories exist -- fails visibly if validation fails instead of proceeding with empty output
  3. PRD output contains a tracer bullet US-001 story that includes DB, backend, and frontend layers -- a horizontal-only slice is rejected
  4. Deepen phase runs four parallel review agents against the PRD and presents findings with a gate: refine, re-run, or proceed
  5. Resolution gate blocks conversion until every [TBD], [TODO], and [PLACEHOLDER] pattern in the PRD has been resolved via AskUserQuestion
**Plans**: 2 plans
- [x] 03-01-PLAN.md -- Research + PRD templates (parallel agent dispatch, skill chaining, validation, open questions)
- [x] 03-02-PLAN.md -- Deepen + Resolve templates + PHASE_FILES (review agents, refine/re-run/proceed gate, TBD resolution, orchestrator dispatch)

### Phase 4: Execution Layer
**Goal**: Beads can be generated, executed headlessly, and reviewed -- the full conversion-to-review loop completes without manual intervention beyond the execution gate
**Depends on**: Phase 3
**Requirements**: CONV-01, CONV-02, CONV-03, CONV-04, EXEC-01, EXEC-02, EXEC-03, EXEC-04, REVW-01, REVW-02, REVW-03
**GSD Reference**: `.reference/get-shit-done/workflows/execute-phase.md` (headless execution patterns, result file schema, quality gate enforcement)
**Success Criteria** (what must be TRUE):
  1. Conversion gate presents bead format choices (bd Go / br Rust / prd.json), invokes the correct chained skill, and validates .beads/*.md output exists before marking complete
  2. Headless execution runs claude -p per bead sequentially and writes a status: passed|failed|blocked result file per bead to the results directory -- result file schema matches patterns in `.reference/get-shit-done/workflows/execute-phase.md`
  3. Quality gates (tests pass, type checks pass) are enforced per bead -- a failing bead stops the batch and surfaces the failure clearly
  4. Post-execution review spawns four parallel agents (security, architecture, performance, simplicity) and categorizes findings as P1/P2/P3
  5. Review gate presents fix P1s / fix P1+P2 / skip / re-run / create PR options and executes the chosen action
**Plans**: 4 plans
- [x] 04-01-PLAN.md -- Convert template (bead format gate, skill chaining, frontend detection, bead validation)
- [x] 04-02-PLAN.md -- Execute template (headless claude -p / manual ralph-tui, stop-on-failure, result files)
- [x] 04-03-PLAN.md -- Review template + PHASE_FILES (parallel review agents, P1/P2/P3, fix/re-run/PR gate)
- [x] 04-04-PLAN.md -- Quality gate injection into bead prompts

### Phase 5: Advanced Features
**Goal**: YOLO mode, auto-advance chain, and time budget work as described -- users can run the full pipeline hands-free overnight
**Depends on**: Phase 4
**Requirements**: ORCH-06, ORCH-07, TIME-01, TIME-02, TIME-03, TIME-04
**GSD Reference**: `.reference/get-shit-done/workflows/discuss-phase.md` (auto-advance gate bypass patterns), `.reference/get-shit-done/workflows/plan-phase.md` (hands-free chaining between phases)
**Success Criteria** (what must be TRUE):
  1. YOLO mode auto-approves all phase gates without prompting -- the pipeline runs from research through review without any user interaction; gate bypass logic follows patterns in `.reference/get-shit-done/workflows/discuss-phase.md`
  2. --auto flag enables auto-advance: pipeline sequences through all phases hands-free from the current phase to completion, chaining modeled on `.reference/get-shit-done/workflows/plan-phase.md`
  3. User specifies a time budget in hours; ralph-tools.cjs records time_budget_expires in config.json and the pipeline stops auto-advancing after the budget expires -- the current phase always finishes before stopping
  4. Time budget value persists across /clear -- a new session reads config.json and continues budget enforcement correctly
**Plans**: 3 plans
- [x] 05-01-PLAN.md -- Time budget CLI: lib/time-budget.cjs, loadConfig defaults, ralph-tools.cjs routing
- [x] 05-02-PLAN.md -- YOLO mode: --yolo flag detection in SKILL.md, gate bypass in all 9 templates
- [x] 05-03-PLAN.md -- Auto-advance: SessionStart hook, time budget phase boundary check, /clear chain logic

### Phase 6: Time Budget Init Integration
**Goal:** Fix init pipeline to return `time_budget_expires` and align SKILL.md Step 1b variable names with actual output keys — eliminates accidental correctness and undefined behavior
**Depends on**: Phase 5
**Requirements**: TIME-01, TIME-04
**Gap Closure:** Closes INT-01, FLOW-01 from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. `cmdInitPipeline` returns `time_budget_expires` field populated from config.json
  2. SKILL.md Step 1b references exact field names matching time-budget estimate output (`estimated_beads_remaining`, `avg_bead_duration_display`)
  3. Test verifies init pipeline output includes `time_budget_expires` when time budget is set
**Plans**: 1 plan
- [x] 06-01-PLAN.md -- Fix init pipeline time_budget_expires + SKILL.md Step 1b field name alignment + test

### Phase 7: Preflight Cache + Skip-on-Resume
**Goal:** Preflight writes a cache file on success so init pipeline can report `preflight_passed` and skip re-running preflight on resume
**Depends on**: Phase 1
**Requirements**: ORCH-02
**Gap Closure:** Closes INT-02, FLOW-02 from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. `cmdPreflight` writes `.planning/.preflight-cache.json` with timestamp and results on success
  2. `cmdInitPipeline` reads preflight cache and returns `preflight_passed: true` when cache is fresh
  3. Test verifies preflight cache write/read cycle and stale cache detection
**Plans**: 1 plan
- [x] 07-01-PLAN.md -- TDD: preflight cache write, init cache read (remove TTL, add version check), --force flag, gitignore, tests

### Phase 8: Tech Debt Cleanup
**Goal:** Replace stub templates with functional implementations and remove dead exports
**Depends on**: Phase 7
**Requirements**: ORCH-02, ORCH-03
**Gap Closure:** Closes tech debt from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. templates/preflight.md invokes `cmdPreflight` CLI and reports results instead of immediately writing completed: true
  2. templates/clarify.md gathers project scope via AskUserQuestion instead of immediately writing completed: true
  3. lib/preflight.cjs only exports symbols that are imported elsewhere
**Plans**: 2 plans
- [x] 08-01-PLAN.md -- Replace preflight stub template + remove dead exports
- [x] 08-02-PLAN.md -- Replace clarify stub template with AskUserQuestion flow

### Phase 9: Integration Polish
**Goal:** Fix SKILL.md {phase_name} variable ambiguity and add YOLO convert bead_format fallback — eliminates the two low-severity integration gaps
**Depends on**: Phase 8
**Requirements**: ORCH-05, STATE-06, ORCH-06, CONV-01
**Gap Closure:** Closes INT-03, INT-04, Flow "User gate excerpt" from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. SKILL.md Step 6 excerpt/skip path uses pipeline phase slug (e.g., `research`, `convert`) not GSD dev-phase name
  2. YOLO convert path auto-prompts or falls back to default bead_format when config value is null
  3. Flow "User gate excerpt" completes end-to-end without ambiguity
**Plans**: 2 plans
- [x] 09-01-PLAN.md -- Rename cascade: PIPELINE_PHASES slug+displayName, scanPipelinePhases, tests, all 9 template variables
- [x] 09-02-PLAN.md -- SKILL.md variable table + excerpt/skip fix + YOLO bead_format prompt + convert.md fallback

### Phase 10: Cosmetic Cleanup
**Goal:** Fix loadConfig defaults, update stale ROADMAP checkboxes, align traceability table, remove dead code — all info-severity items
**Depends on**: Phase 9
**Requirements**: ORCH-07
**Gap Closure:** Closes INT-05, INT-06, tech debt from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. `loadConfig` includes `auto_advance_started_at` in defaults (no CONFIG_KEY_NOT_FOUND)
  2. ROADMAP.md phase checkboxes reflect actual completion status
  3. REQUIREMENTS.md traceability table maps TIME-01/TIME-04 to Phase 6 and ORCH-02 to Phase 7
  4. Dead `spliceFrontmatter` function body removed from lib/frontmatter.cjs
**Plans**: 1 plan
- [x] 10-01-PLAN.md -- loadConfig defaults, ROADMAP checkboxes, traceability table, dead code removal

### Phase 11: Orchestrator State Sync
**Goal:** Wire cmdPhaseComplete into the SKILL.md orchestrator completion path so STATE.md stays current and ROADMAP checkboxes auto-update during pipeline runs — eliminates mismatch warning noise on resume
**Depends on**: Phase 10
**Requirements**: STATE-03
**Gap Closure:** Closes STATE-03 integration gap + Phase 2 tech debt (cmdPhaseComplete orphaned, STATE.md stale)
**Success Criteria** (what must be TRUE):
  1. After each phase completes, SKILL.md orchestrator calls `ralph-tools.cjs phase-complete` to advance STATE.md
  2. STATE.md Phase field reflects the actual current phase during a pipeline run
  3. Resume after /clear no longer fires mismatch warning for stale Phase field

### Phase 12: YOLO Time Budget Tracking
**Goal:** Call record-bead after each bead completes in YOLO execute path so time budget estimate uses actual bead duration data instead of the 20-minute default
**Depends on**: Phase 10
**Requirements**: TIME-03, TIME-04
**Gap Closure:** Closes TIME-03, TIME-04 integration gaps + Phase 5 tech debt (record-bead/estimate in YOLO)
**Success Criteria** (what must be TRUE):
  1. YOLO execute path calls `ralph-tools.cjs time-budget record-bead` after each bead completes
  2. `time-budget estimate` returns avg_bead_duration_ms based on actual recorded data, not 20-min default
  3. estimated_beads_remaining is accurate in YOLO sessions

### Phase 13: Quality Gate + Doc Polish
**Goal:** Fix review re-run quality gate suffix and align documentation declarations — closes the last flow gap and remaining doc-level tech debt
**Depends on**: Phase 10
**Requirements**: EXEC-03, REVW-03
**Gap Closure:** Closes review re-run flow gap + Phase 4 tech debt (QUALITY_GATE_SUFFIX) + Phase 3 tech debt (PHASE_FILES) + Phase 9 tech debt (SKILL.md CLI table)
**Success Criteria** (what must be TRUE):
  1. Re-running a bead from review gate appends QUALITY_GATE_SUFFIX to the bead prompt
  2. clarify.md declared in PHASE_FILES constant in orchestrator
  3. time-budget subcommands listed in SKILL.md CLI reference table

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 5/5 | Complete | 2026-02-25 |
| 2. Orchestrator Shell | 2/2 | Complete | 2026-02-25 |
| 3. Phase Content | 2/2 | Complete | 2026-02-25 |
| 4. Execution Layer | 4/4 | Complete | 2026-02-25 |
| 5. Advanced Features | 3/3 | Complete | 2026-02-25 |
| 6. Time Budget Init Integration | 1/1 | Complete | 2026-02-26 |
| 7. Preflight Cache + Skip-on-Resume | 1/1 | Complete | 2026-02-26 |
| 8. Tech Debt Cleanup | 2/2 | Complete | 2026-02-26 |
| 9. Integration Polish | 2/2 | Complete | 2026-02-26 |
| 10. Cosmetic Cleanup | 1/1 | Complete | 2026-02-26 |
| 11. Orchestrator State Sync | 1/1 | Complete    | 2026-02-26 |
| 12. YOLO Time Budget Tracking | 0/0 | Planned | — |
| 13. Quality Gate + Doc Polish | 0/0 | Planned | — |
