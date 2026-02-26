# Roadmap: ralph-gsd

## Overview

Build a Claude Code skill that orchestrates a 9-phase idea-to-code pipeline using context isolation (/clear between phases) and ralph-tui as the execution engine. The build order is strict: CLI and state schema first (everything depends on them), then the orchestrator shell, then phase-specific subagents, then the execution layer, then advanced automation features layered on top of a verified core.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - ralph-tools.cjs CLI + .planning/ schema + pre-flight skeleton
- [x] **Phase 2: Orchestrator Shell** - SKILL.md entry point, phase sequencing, /clear boundary pattern, user gates
- [x] **Phase 3: Phase Content** - Research, PRD, Deepen, and Resolution subagent prompts
- [x] **Phase 4: Execution Layer** - Conversion, headless execution, bead results, compound review
- [ ] **Phase 5: Advanced Features** - YOLO mode, auto-advance chain, time budget, configurable depth
- [ ] **Phase 6: Time Budget Init Integration** - Fix init pipeline time_budget_expires + SKILL.md field name alignment
- [ ] **Phase 7: Preflight Cache + Skip-on-Resume** - Write preflight cache, populate preflight_passed in init
- [ ] **Phase 8: Tech Debt Cleanup** - Replace stub templates, remove dead exports

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
**Plans**: 3 plans
- [x] 04-01-PLAN.md -- Convert template (bead format gate, skill chaining, frontend detection, bead validation)
- [x] 04-02-PLAN.md -- Execute template (headless claude -p / manual ralph-tui, stop-on-failure, result files)
- [x] 04-03-PLAN.md -- Review template + PHASE_FILES (parallel review agents, P1/P2/P3, fix/re-run/PR gate)

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
- [ ] 05-01-PLAN.md -- Time budget CLI: lib/time-budget.cjs, loadConfig defaults, ralph-tools.cjs routing
- [ ] 05-02-PLAN.md -- YOLO mode: --yolo flag detection in SKILL.md, gate bypass in all 9 templates
- [ ] 05-03-PLAN.md -- Auto-advance: SessionStart hook, time budget phase boundary check, /clear chain logic

### Phase 6: Time Budget Init Integration
**Goal:** Fix init pipeline to return `time_budget_expires` and align SKILL.md Step 1b variable names with actual output keys — eliminates accidental correctness and undefined behavior
**Depends on**: Phase 5
**Requirements**: TIME-01, TIME-04
**Gap Closure:** Closes INT-01, FLOW-01 from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. `cmdInitPipeline` returns `time_budget_expires` field populated from config.json
  2. SKILL.md Step 1b references exact field names matching time-budget estimate output (`estimated_beads_remaining`, `avg_bead_duration_display`)
  3. Test verifies init pipeline output includes `time_budget_expires` when time budget is set
**Plans**: 0 plans (to be planned)

### Phase 7: Preflight Cache + Skip-on-Resume
**Goal:** Preflight writes a cache file on success so init pipeline can report `preflight_passed` and skip re-running preflight on resume
**Depends on**: Phase 1
**Requirements**: ORCH-02
**Gap Closure:** Closes INT-02, FLOW-02 from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. `cmdPreflight` writes `.planning/.preflight-cache.json` with timestamp and results on success
  2. `cmdInitPipeline` reads preflight cache and returns `preflight_passed: true` when cache is fresh
  3. Test verifies preflight cache write/read cycle and stale cache detection
**Plans**: 0 plans (to be planned)

### Phase 8: Tech Debt Cleanup
**Goal:** Replace stub templates with functional implementations and remove dead exports
**Depends on**: Phase 7
**Requirements**: ORCH-02, ORCH-03
**Gap Closure:** Closes tech debt from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. templates/preflight.md invokes `cmdPreflight` CLI and reports results instead of immediately writing completed: true
  2. templates/clarify.md gathers project scope via AskUserQuestion instead of immediately writing completed: true
  3. lib/preflight.cjs only exports symbols that are imported elsewhere
**Plans**: 0 plans (to be planned)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 5/5 | Complete | 2026-02-25 |
| 2. Orchestrator Shell | 2/2 | Complete | 2026-02-25 |
| 3. Phase Content | 2/2 | Complete | 2026-02-25 |
| 4. Execution Layer | 3/3 | Complete | 2026-02-25 |
| 5. Advanced Features | 0/3 | Not started | - |
| 6. Time Budget Init Integration | 0/0 | Not started | - |
| 7. Preflight Cache + Skip-on-Resume | 0/0 | Not started | - |
| 8. Tech Debt Cleanup | 0/0 | Not started | - |
