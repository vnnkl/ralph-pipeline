# Project Research Summary

**Project:** ralph-pipeline v1.1 — Marathon Mode + Codemaps Integration
**Domain:** AI coding pipeline orchestrator — incremental extension of existing 9-phase skill
**Researched:** 2026-02-27
**Confidence:** HIGH

## Executive Summary

ralph-pipeline v1.1 is a targeted extension of a working v1.0 pipeline orchestrator. The two additions — marathon mode and codemaps integration — are architecturally orthogonal and can be built independently. Codemaps integration has no dependency on marathon mode but marathon mode depends on codemaps; build codemaps first. The entire v1.0 stack carries forward unchanged: zero new npm dependencies, Node.js CJS only, YAML frontmatter state files, and the existing `ralph-tools.cjs` CLI extended with two new `lib/*.cjs` modules. All 9 existing templates are reused by marathon mode without modification; only the orchestrator chaining logic in SKILL.md changes.

The recommended approach treats marathon mode as an alternative orchestration path via a `mode: marathon` config flag in the existing SKILL.md, not as a separate skill or orchestrator. The counterintuitive insight from research is that "one continuous marathon run" still uses `/clear` between planning phases to preserve context isolation — the only differences from standard auto-advance are: auto-approved user gates during planning phases 2-7, time budget deferred to execution phase entry, and a codemap lifecycle (generate at planning start, refresh at execution end). The `.beads/` directory produced by the existing Convert phase is the marathon execution queue; no new queue data structure is needed.

The primary implementation risk is context budget violation in two specific forms: loading codemap content into subagent prompts instead of passing file paths (bloats orchestrator when filling templates), and loading phase plan content into the marathon orchestrator itself. Both are completely avoidable by maintaining the existing architecture's core invariant: the orchestrator passes file paths only, never content. A selective `{{CODEMAP_FILES}}` template variable (analogous to the existing `{{PHASE_FILES}}`) handles codemap injection per agent role without touching orchestrator context.

---

## Key Findings

### Recommended Stack

v1.1 adds zero new dependencies. All new functionality is implemented in two new `lib/*.cjs` modules (`lib/codemap.cjs` ~80 lines for codemap detection/staleness/path-listing, `lib/marathon.cjs` ~60-180 lines for marathon state management), one new template (`templates/codemap.md` ~120 lines with 4 parallel mapper agents), and targeted additions to five existing files. Four existing templates gain `{{CODEMAP_FILES}}` variable injection (research.md, prd.md, deepen.md, review.md). The existing execute.md template is entirely unchanged — marathon dispatches it identically to standard mode.

**Core technologies (all existing, no new additions):**
- Node.js CJS + `lib/*.cjs` modules — new modules follow the exact pattern of existing `lib/phase.cjs`, `lib/state.cjs`, `lib/time-budget.cjs`
- `fs.statSync().mtimeMs` — codemap staleness detection, 24h default threshold configurable via `codemap_stale_hours` in config.json
- `.beads/*.md` directory — existing bead store is the marathon execution queue; no new queue data format
- YAML frontmatter + markdown — marathon state in `.planning/marathon/status.json` and `queue.json`; codemaps in `.planning/codebase/`
- `{{CODEMAP_FILES}}` template variable — new variable computed by `fillTemplate()` in `lib/orchestrator.cjs`, resolves to file path list or empty string when absent

**New config keys added to `loadConfig()` defaults in `lib/core.cjs`:**
- `pipeline_mode: 'standard'` — `'standard' | 'marathon'`
- `codemap_enabled: null` — `null` (auto-detect) | `true` | `false`
- `codemap_stale_hours: 24` — staleness threshold in hours
- `codemap_refreshed_at: null` — ISO8601 timestamp of last refresh

### Expected Features

**Must have (table stakes — v1.1 launch, all P1):**
- Marathon command entry point (`--marathon` flag or direct `mode: marathon` config)
- Planning phase chain with auto-approved gates between phases 2-7 (no user interruption during planning)
- Planning review gate after phase 7 Convert (user approves bead inventory before execution starts)
- Time budget deferred to execution start, not pipeline invocation
- Resume-from-failure execution (scan `.claude/pipeline/bead-results/` for passed beads, skip them on re-run)
- Codemap generation before research phase (4 parallel mapper agents writing 7 files to `.planning/codebase/`)
- Selective codemap files per agent role via `{{CODEMAP_FILES}}` (research gets STACK + ARCHITECTURE; review gets post-exec codemap)
- Codemap refresh after execution before review (scoped: arch + concerns mappers only)

**Should have (v1.1.x):**
- Marathon dry-run mode (`--dry-run` stops after phase 7, shows bead inventory without executing)
- Bead queue visualization with time estimates at planning review gate
- Codemap freshness warning and `--no-codemap` skip option
- Dependency-aware bead ordering (topological sort from `depends_on` frontmatter field)

**Defer (v2+):**
- Incremental codemap refresh (re-map only changed files — requires new mapper agent mode)
- Codemap diff for review agents (send only changed sections — complex diffing, unclear ROI)
- Context budget monitoring with dynamic `/clear` — no introspection API available
- Marathon for multi-milestone chaining — out of scope for v1.1

### Architecture Approach

Marathon mode and codemaps are layered onto the existing v1.0 architecture without altering its fundamental data flow. SKILL.md gains a `--marathon` detection step (Step 2c) and a Marathon Orchestrator section (~120 lines) that dispatches the same 9 phase templates with different gate behavior. Codemaps are handled via a new `templates/codemap.md` dispatched as a Task subagent before phase 3; the template inlines the GSD map-codebase logic (4 parallel mapper agents) because Task subagents cannot invoke the Skill tool. Templates self-detect codemap availability via `ls .planning/codebase/*.md` rather than receiving hardcoded paths from the orchestrator, keeping the orchestrator mode-agnostic. The existing `scan-phases`, `phase-complete`, and `time-budget` commands are reused without modification.

**Major components:**
1. `SKILL.md` (modified) — adds Step 2c marathon detection, Step 4b codemap dispatch between clarify/research, Marathon Orchestrator section; estimated +120-150 lines
2. `templates/codemap.md` (new) — 4 parallel mapper Task subagents writing 7 documents to `.planning/codebase/`; handles freshness check internally; ~120 lines
3. `lib/marathon.cjs` (new) — CLI commands: `init` (creates `.planning/marathon/status.json`), `merge-queue` (reads `.beads/*.md`, writes `queue.json`), `status`; ~60-180 lines
4. `lib/codemap.cjs` (new) — `check`, `paths`, `age` commands; file mtime staleness detection; ~80 lines
5. `lib/orchestrator.cjs` (modified) — adds `{{CODEMAP_FILES}}` variable with per-phase selective injection table in `fillTemplate()`; ~+15 lines

**Files unchanged by v1.1 (critical to confirm during implementation):** `lib/frontmatter.cjs`, `lib/state.cjs`, `lib/phase.cjs`, `lib/commands.cjs`, `lib/preflight.cjs`, `lib/time-budget.cjs`, `lib/config.cjs`, and `templates/execute.md`.

### Critical Pitfalls

1. **Marathon orchestrator context overflow** — The orchestrator must never load phase output content during marathon planning. Pass file paths only (same as standard mode). Marathon planning still uses `/clear` between phases; auto-approval of gates is the only behavioral difference. Warning sign: orchestrator context exceeding 20% during marathon planning, or compaction triggered during orchestration (not during subagent work).

2. **Codemap staleness in long marathon execution** — A 20-40 bead marathon runs 4-8 hours. The pre-execution codemap becomes wrong for post-execution review. Solution: two codemap snapshots — `.planning/codebase/` (pre-exec) and `.planning/codebase-post-exec/` (post-exec). Post-exec refresh is scoped to arch + concerns mappers only (ARCHITECTURE.md, STRUCTURE.md, CONCERNS.md change most during execution; STACK.md and CONVENTIONS.md rarely do).

3. **Codemap token budget explosion** — 7 codemap files for a production codebase reach 3000-5000 lines (15K-25K tokens). Passing all 7 to every agent across 4 parallel agents x 3 phases = up to 12 agent instances with unnecessary content. Solution: selective injection per agent role via `{{CODEMAP_FILES}}` template variable, passing file paths (not content) for only the relevant documents.

4. **Time budget semantics collision** — `cmdTimeBudgetCheck` in `lib/time-budget.cjs` stores an absolute expiry timestamp with no scope field. If `time-budget start` is called at marathon invocation, planning phases get stopped by a budget meant only for execution. Solution: defer `time-budget start` until execute phase entry in marathon mode. Zero changes to `lib/time-budget.cjs` required.

5. **Separate marathon orchestrator or SKILL.md entry point** — Creating a parallel orchestrator duplicates logic, causes drift, and confuses users. Marathon is `mode: marathon` in config, handled by conditionals in the existing SKILL.md. The SessionStart hook reads `mode` from config and adjusts gate behavior.

---

## Implications for Roadmap

The build order is two sequential implementation phases with a final integration testing phase. Codemaps must precede marathon. All three phases involve only SKILL.md modifications plus small new/modified CJS files — no architectural breaks.

### Phase 1: Codemaps Foundation
**Rationale:** Codemaps integration has no dependency on marathon mode, but marathon mode's start/end codemap lifecycle depends on codemaps working correctly. Building it first makes it independently useful in standard mode immediately. All design decisions are fully resolved in research; no ambiguity remains.

**Delivers:**
- `templates/codemap.md` — 4 parallel mapper agents, freshness check, 7-file output
- `lib/codemap.cjs` — `check`, `paths`, `age` commands; mtime staleness detection
- `lib/core.cjs` — `codemap_enabled`, `codemap_refreshed_at`, `codemap_stale_hours` config defaults
- `lib/orchestrator.cjs` — `{{CODEMAP_FILES}}` variable with per-phase selective injection table
- `templates/research.md` — Step 1.5: conditional codemap injection per agent role
- `templates/prd.md` — conditional codemap injection (ARCHITECTURE + STRUCTURE)
- `templates/deepen.md` — conditional codemap injection (role-specific per agent)
- `templates/review.md` — Step 3.5: conditional codemap injection (post-exec path)
- `SKILL.md` — Step 4b: codemap dispatch between clarify and research
- `tests/codemap.test.cjs` — check detection, staleness calc, path listing, missing dir handling

**Avoids:** Pitfalls 3 (token budget explosion) and 2 (staleness — two-snapshot approach designed in from the start)

### Phase 2: Marathon Mode Orchestration
**Rationale:** Depends on Phase 1 (codemaps must work for marathon's generate-at-start and refresh-at-end lifecycle). All 9 existing templates are reused unchanged — only the orchestrator chaining and new CLI module are the implementation surface. Marathon is auto-advance + auto-approved planning gates + deferred time budget; no new templates, no new execution logic.

**Delivers:**
- `lib/marathon.cjs` — `init`, `merge-queue`, `status` CLI commands; `.planning/marathon/` directory management
- `ralph-tools.cjs` — marathon command routing in main switch
- `lib/core.cjs` — `pipeline_mode` config default
- `lib/init.cjs` — `cmdInitMarathon()` function composing existing utilities + marathon fields
- `SKILL.md` — Step 2c (marathon detection) + Marathon Orchestrator section (~120 lines)
- Time budget deferral to execute phase entry in marathon orchestrator
- Planning review gate after Convert (bead inventory approval before execution)
- Progress logging during marathon planning (phase transition messages)
- `tests/marathon.test.cjs` — activate/deactivate, status with beads, init marathon output
- `tests/init.test.cjs` extended — `init marathon` test case
- `tests/orchestrator.test.cjs` extended — `{{CODEMAP_FILES}}` resolution test

**Avoids:** Pitfalls 1 (orchestrator context), 4 (time budget semantics), 5 (separate orchestrator), and UX pitfall of no progress visibility

### Phase 3: Integration Testing and Hardening
**Rationale:** The marathon + codemaps interaction surface has multiple failure modes that only surface end-to-end. The "Looks Done But Isn't" checklist from PITFALLS.md has 10 specific verification points requiring full pipeline runs.

**Delivers verified behavior for:**
- Standard mode + codemaps: codemap auto-detection, selective injection per agent role confirmed
- Marathon mode end-to-end: phases 1-7 planning (no user gates), merge queue, execute, review
- Marathon + codemap refresh: `.planning/codebase-post-exec/` exists, review agents receive post-exec path
- Time budget in marathon: `time_budget_expires` not set until execute phase begins
- Resume after interrupt: passed beads skipped on re-invocation
- Config cleanup: `mode` resets to `normal` after marathon completion or failure
- Codemap skip for greenfield: no source files = codemap generation skipped with log
- Marathon fail-fast: missing `bead_format` in config produces actionable error before planning starts

### Phase Ordering Rationale

- Codemaps before marathon: marathon's codemap lifecycle requires codemaps to work first; codemaps also independently useful in standard mode
- Marathon reuses all 9 existing templates: zero template changes in Phase 2, only orchestrator and CLI additions
- Integration testing as distinct phase: interaction surface (codemap paths through marathon orchestrator to templates, two-snapshot approach, config mode lifecycle) requires full pipeline runs to verify
- prd.md and deepen.md template modifications are Phase 1 work (same codemap injection pattern as research.md and review.md); do not defer to Phase 2

### Research Flags

Phases with well-documented patterns (skip additional research):
- **Phase 1 (Codemaps):** All source patterns read directly. Implementation is mechanical extension of existing `{{PHASE_FILES}}` pattern.
- **Phase 2 (Marathon):** Architecture fully resolved. "Marathon uses /clear + mode flag, not a separate orchestrator" is confirmed.
- **Phase 3 (Integration):** Standard test patterns from existing test files apply directly.

Open questions to resolve before Phase 1:
- `codemap_enabled` opt-in vs auto-detect default (research recommends opt-in to avoid surprising users)
- Post-exec codemap directory: `.planning/codebase-post-exec/` (separate) vs overwriting `.planning/codebase/` (simpler; recommend separate)

Open questions to resolve before Phase 2:
- Marathon deepen gate: gate on P1 findings only (recommended) vs auto-approve all
- Bead size ceiling for marathon-merge warning: 5000 tokens / ~20KB threshold needs validation against actual bead sizes

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All v1.0 source files read directly; zero new dependencies; all decisions extend existing proven patterns |
| Features | HIGH | Feature set from PROJECT.md requirements + actual v1.0 code; competitor analysis confirms table stakes |
| Architecture | HIGH | All lib/*.cjs modules, all 9 templates, SKILL.md, GSD map-codebase workflow — all read directly |
| Pitfalls | HIGH | Direct codebase analysis (time-budget.cjs lines 49-74 cited; 15% budget constraint verified in PROJECT.md); two Claude Code GitHub issues cited |

**Overall confidence:** HIGH

### Gaps to Address

- **`codemap_enabled` opt-in vs auto-detect:** Recommend opt-in for v1.1 to avoid surprising users, but revisit if feature adoption is low.
- **Post-exec codemap directory:** Separate `.planning/codebase-post-exec/` (recommended) vs overwrite; decide before Phase 1 completes to avoid rework.
- **Marathon deepen P1 gate:** Product decision — gate on P1 design findings vs auto-approve all planning phases. Affects user trust in marathon output quality.
- **Bead size warning threshold:** 5000 tokens / ~20KB ceiling needs validation against actual v1.0 bead files before implementing the check.

---

## Sources

### Primary (HIGH confidence — all read directly from codebase)
- `/Users/constantin/Code/skills/ralph-pipeline/SKILL.md` — orchestrator logic, auto-advance, phase gate mechanism, /clear boundary pattern
- `/Users/constantin/Code/skills/ralph-pipeline/ralph-tools.cjs` — CLI entry point, command routing
- `/Users/constantin/Code/skills/ralph-pipeline/lib/` — all 10 modules (core.cjs config schema, orchestrator.cjs fillTemplate/PIPELINE_PHASES, init.cjs compound init, time-budget.cjs scope limitation lines 49-74)
- All 9 `templates/*.md` — phase template structure, variable substitution, Task subagent dispatch
- `/Users/constantin/Code/skills/ralph-pipeline/.reference/get-shit-done/workflows/map-codebase.md` — 7-document output format, 4 parallel mapper agent structure
- `/Users/constantin/Code/skills/ralph-pipeline/.planning/codebase/*.md` — actual codemap output, 1383 lines baseline
- `/Users/constantin/Code/skills/ralph-pipeline/.planning/PROJECT.md` — v1.1 requirements and constraints

### Secondary (MEDIUM confidence — web research)
- Context Engineering for Coding Agents (Martin Fowler) — selective context injection per agent role
- SPARC Automated Development — plan-then-execute phase separation pattern
- Traycer YOLO Mode documentation — planning gate behavior in unattended pipeline runs
- Gas Town: Kubernetes for AI Agents — nondeterministic idempotence for resume-from-failure
- Addy Osmani LLM Workflow 2026 — planning-as-overhead framing
- Windsurf Codemaps (Cognition AI) — codemap freshness and selective loading
- Codified Context Infrastructure (arXiv 2602.20478) — keeping context infrastructure current

### Tertiary (documented platform limitations)
- Claude Code GitHub issue #13831 — headless `claude -p` irrecoverable context overflow
- Claude Code GitHub issue #29193 — background task orphaning after compaction

---
*Research completed: 2026-02-27*
*Ready for roadmap: yes*
