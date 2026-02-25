# Requirements: ralph-gsd

**Defined:** 2026-02-25
**Core Value:** Context isolation through /clear between phases combined with ralph-tui's ability to execute large batches of work unattended

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Core Orchestration

- [ ] **ORCH-01**: Plugin ships as installable Claude Code skill (SKILL.md + ralph-tools.cjs + templates/)
- [x] **ORCH-02**: Pre-flight detects user's IDE environment (or asks) and checks only relevant dependencies (ralph-tui, bd/br CLIs, required skills) — no bloat installs
- [ ] **ORCH-03**: Pipeline executes phases sequentially: pre-flight → clarify → research → PRD → deepen → resolve → convert → execute → review
- [ ] **ORCH-04**: Each phase transition triggers /clear for true context isolation (fresh session per phase)
- [ ] **ORCH-05**: User gates between phases via AskUserQuestion (approve/redirect/replan)
- [ ] **ORCH-06**: YOLO mode auto-approves all gates without user interaction
- [ ] **ORCH-07**: Auto-advance chain (--auto flag): phases advance hands-free from research through review
- [x] **ORCH-08**: GSD repo cloned to .reference/get-shit-done/ and gitignored as authoritative implementation reference — subagents Read actual source files rather than relying on training data

### State Management

- [x] **STATE-01**: ralph-tools.cjs is a single .cjs file with zero npm dependencies
- [ ] **STATE-02**: ralph-tools.cjs handles all state mutations (advance phase, mark complete, update progress)
- [ ] **STATE-03**: ralph-tools.cjs handles git commits with conditional logic (commit_docs flag, .gitignore check)
- [ ] **STATE-04**: ralph-tools.cjs provides compound `init` commands that load all context in one call
- [x] **STATE-05**: State persisted to .planning/ as YAML frontmatter + markdown body (machine + human readable)
- [ ] **STATE-06**: Each phase output file has `completed: true/false` flag for crash recovery
- [ ] **STATE-07**: GSD-style resumability: on invocation, read STATE.md to determine current phase and resume from last incomplete phase
- [x] **STATE-08**: config.json stores workflow preferences (mode, depth, parallelization, model_profile, time_budget)

### Research Phase

- [ ] **RSRCH-01**: Parallel research agents spawn before PRD (repo-research-analyst, best-practices-researcher, framework-docs-researcher, learnings-researcher)
- [ ] **RSRCH-02**: Research outputs written to .planning/research/ as structured markdown
- [ ] **RSRCH-03**: Research summary synthesized from individual outputs before PRD creation

### PRD Phase

- [ ] **PRD-01**: PRD created by invoking /ralph-tui-prd skill with research context (chain, don't reimplement)
- [ ] **PRD-02**: PRD enforces tracer bullet ordering (vertical slices: DB → backend → frontend per story)
- [ ] **PRD-03**: Open questions collected during PRD creation appended to open-questions file

### Deepen Phase

- [ ] **DEEP-01**: Parallel review agents run against PRD (security-sentinel, architecture-strategist, code-simplicity-reviewer, performance-oracle)
- [ ] **DEEP-02**: Review findings incorporated into PRD with gate: refine, re-run, or proceed

### Resolution Phase

- [ ] **RSLV-01**: Blocking gate: all open questions must be resolved before conversion proceeds
- [ ] **RSLV-02**: Each open question presented via AskUserQuestion with concrete options
- [ ] **RSLV-03**: PRD updated with answers; open-questions file marked resolved

### Conversion Phase

- [ ] **CONV-01**: Conversion gate: user chooses bead format (bd Go beads / br Rust beads / prd.json)
- [ ] **CONV-02**: Bead conversion by invoking /ralph-tui-create-beads or /ralph-tui-create-beads-rust skill (chain, don't reimplement)
- [ ] **CONV-03**: Frontend stories inject /frontend-design skill as first instruction in bead acceptance criteria
- [ ] **CONV-04**: Configurable depth affects bead granularity (quick: fewer larger beads, comprehensive: more granular beads)

### Execution Phase

- [ ] **EXEC-01**: Execution gate per phase: user chooses headless (claude -p per bead) or manual (launch ralph-tui)
- [ ] **EXEC-02**: Headless mode: pipeline orchestrates claude -p per bead with structured exit codes
- [ ] **EXEC-03**: Bead results written to structured results directory with pass/fail per bead
- [ ] **EXEC-04**: Quality gates from PRD enforced per bead (tests pass, type checks pass)

### Review Phase

- [ ] **REVW-01**: Parallel review agents run post-execution (security, architecture, performance, simplicity)
- [ ] **REVW-02**: Findings categorized P1/P2/P3 with actionable fix suggestions
- [ ] **REVW-03**: Review gate: fix P1s, fix P1+P2, skip, re-run, or create PR

### Time Budget

- [ ] **TIME-01**: User can specify time budget in hours at pipeline start
- [ ] **TIME-02**: Pipeline auto-advances through phases until budget expires
- [ ] **TIME-03**: Current phase always finishes before stopping (clean phase boundaries)
- [ ] **TIME-04**: Time remaining persisted to config.json (survives /clear between phases)

## v2 Requirements

### Harvest

- **HARV-01**: Extract reusable patterns from completed work (/choo-choo-ralph style)
- **HARV-02**: Refresh codemaps after pipeline completion

### Codemap Integration

- **CMAP-01**: Codemaps used as shared context for all research and review agents
- **CMAP-02**: Stale codemap detection and refresh offer at pipeline start

### Multi-Phase Batching

- **BATCH-01**: Batch multiple phases into a single overnight run
- **BATCH-02**: Wave-based dependency ordering across batched phases

## Out of Scope

| Feature | Reason |
|---------|--------|
| Inlining /ralph-tui-prd logic | Skills maintained separately; chaining prevents duplication |
| Inlining /ralph-tui-create-beads logic | Same — invoke as-is |
| Reusing gsd-tools.cjs directly | Tightly coupled to GSD's state model; would break as GSD evolves |
| Real-time dashboard / live streaming | ralph-tui's TUI handles execution visibility |
| Compiled npm dependencies in CLI | Breaks zero-dep constraint; harder to install |
| Horizontal PRD layering | Violates tracer bullet principle; causes late integration failures |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ORCH-01 | Phase 1 | Pending |
| ORCH-02 | Phase 1 | Complete |
| ORCH-03 | Phase 2 | Pending |
| ORCH-04 | Phase 2 | Pending |
| ORCH-05 | Phase 2 | Pending |
| ORCH-06 | Phase 5 | Pending |
| ORCH-07 | Phase 5 | Pending |
| ORCH-08 | Phase 1 | Complete |
| STATE-01 | Phase 1 | Complete |
| STATE-02 | Phase 1 | Pending |
| STATE-03 | Phase 1 | Pending |
| STATE-04 | Phase 1 | Pending |
| STATE-05 | Phase 1 | Complete |
| STATE-06 | Phase 1 | Pending |
| STATE-07 | Phase 2 | Pending |
| STATE-08 | Phase 1 | Complete |
| RSRCH-01 | Phase 3 | Pending |
| RSRCH-02 | Phase 3 | Pending |
| RSRCH-03 | Phase 3 | Pending |
| PRD-01 | Phase 3 | Pending |
| PRD-02 | Phase 3 | Pending |
| PRD-03 | Phase 3 | Pending |
| DEEP-01 | Phase 3 | Pending |
| DEEP-02 | Phase 3 | Pending |
| RSLV-01 | Phase 3 | Pending |
| RSLV-02 | Phase 3 | Pending |
| RSLV-03 | Phase 3 | Pending |
| CONV-01 | Phase 4 | Pending |
| CONV-02 | Phase 4 | Pending |
| CONV-03 | Phase 4 | Pending |
| CONV-04 | Phase 4 | Pending |
| EXEC-01 | Phase 4 | Pending |
| EXEC-02 | Phase 4 | Pending |
| EXEC-03 | Phase 4 | Pending |
| EXEC-04 | Phase 4 | Pending |
| REVW-01 | Phase 4 | Pending |
| REVW-02 | Phase 4 | Pending |
| REVW-03 | Phase 4 | Pending |
| TIME-01 | Phase 5 | Pending |
| TIME-02 | Phase 5 | Pending |
| TIME-03 | Phase 5 | Pending |
| TIME-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 — added ORCH-08 (GSD reference repo requirement; total now 42)*
