# Project Research Summary

**Project:** ralph-gsd — Claude Code skill for multi-phase AI coding orchestration
**Domain:** Claude Code plugin / skill system with context-isolated pipeline execution
**Researched:** 2026-02-25
**Confidence:** HIGH

## Executive Summary

ralph-gsd is a Claude Code skill that orchestrates a 9-phase idea-to-shipped-code pipeline. The defining architectural thesis is context isolation: each phase runs in a fresh Claude Code session (separated by `/clear`), preventing the context rot that degrades quality in single-session pipelines. The recommended approach is a thin SKILL.md orchestrator that does no phase work itself — it reads disk state, dispatches Task subagents, verifies completion flags, and advances state. A zero-dependency Node.js CLI (`ralph-tools.cjs`, mirroring `gsd-tools.cjs`) handles all state mutations, config reads, and git commits. All cross-session state lives on disk in `.planning/` — the only persistence medium that survives `/clear`.

The product differentiates from both GSD (which uses subagents within a shared session) and the existing ralph-pipeline (which runs all 9 phases in one 800-line session) by enforcing genuine context isolation and natively integrating ralph-tui as the execution engine. This combination enables overnight runs of 60+ beads: each bead receives a fresh 200k context window via `claude -p`, results are written to disk, and the next session reconstructs full context from disk state. The core stack is established and well-sourced: Claude Code Agent Skills (SKILL.md format), Node.js 18+ CJS (zero npm deps), YAML frontmatter in `.md` files for human-readable state, and `config.json` for machine-read configuration.

The primary risks cluster around state management and the `/clear` boundary assumption. Any implementation that relies on in-memory state crossing phase boundaries will fail silently. The fat orchestrator anti-pattern (orchestrator reads phase file contents instead of only checking completion flags) is the highest-probability failure mode and must be addressed in the first implementation phase. Pre-flight validation of chained skills (`/ralph-tui-prd`, `/ralph-tui-create-beads`) must be blocking — not advisory — because silent skill invocation failures produce `completed: true` with empty output that corrupts all downstream phases.

## Key Findings

### Recommended Stack

The stack is fully determined by a live reference implementation (`gsd-tools.cjs`) and official Claude Code skills documentation. No exploratory decisions are needed. Claude Code Agent Skills (SKILL.md frontmatter with `disable-model-invocation: true`, `context: fork` for subagent phases) provide the plugin entry point. A single `.cjs` file with `lib/*.cjs` modules and zero npm dependencies is mandatory — the skill must be installable without `npm install`. YAML frontmatter is parsed by a hand-rolled ~200-line parser (no `js-yaml` or `gray-matter`). All output goes through `process.stdout.write` (never `console.log`) with dual modes: JSON for skill workflows, `--raw` scalars for bash `$()` captures.

**Core technologies:**
- Claude Code Skills (SKILL.md): Plugin entry point, slash-command registration — official format, verified against docs
- Node.js 18+ CJS (`ralph-tools.cjs`): Zero-dep CLI for all state mutations — mirrors `gsd-tools.cjs` exactly; `require()` over ESM for simplicity
- YAML frontmatter in `.md` files: Cross-session state storage — human-readable, git-diff-friendly, no deps
- `config.json`: Machine-written project config — `depth`, `execution_mode`, `auto_advance`, `time_budget_expires`
- Hand-rolled YAML frontmatter parser: ~200 lines, handles `key: value`, inline arrays, multi-line arrays — no npm required
- Node.js built-ins only: `fs`, `path`, `child_process`, `os`, `process.argv`, `process.stdout.write`

### Expected Features

The feature set is well-defined with clear P1/P2/P3 prioritization. The MVP (v1) must prove the context isolation thesis and the ralph-tui scale advantage. Everything else is v1.x or v2+.

**Must have (table stakes):**
- Resumable state — disk-persisted `STATE.md` with `current_phase`, `completed_phases[]`; survive `/clear` and compaction
- Phase-based execution — 9 phases with defined inputs/outputs and `completed: true/false` flags on every phase file
- Dependency pre-flight — blocking gate: missing skill or CLI stops pipeline at Phase 0, not Phase 3
- Git integration — auto-init, per-task commits via `ralph-tools.cjs commit`
- Parallel research agents — `repo-research-analyst`, `best-practices-researcher`, `framework-docs-researcher` in parallel
- User gates between phases — `AskUserQuestion` in orchestrator (not in subagents); bypassed by `auto_advance`
- Quality gate enforcement — acceptance criteria baked into bead PRD; verified before commit
- Skill chaining — invoke `/ralph-tui-prd` and `/ralph-tui-create-beads` as-is; never reimplement
- Open questions resolution gate — Phase 4.5 blocks conversion; TBD/placeholder scan on PRD required
- Compound review — parallel security/architecture/performance/simplicity agents after execution
- Tracer bullet PRD enforcement — US-001 must include full-stack verification; horizontal-only slice is rejected
- `/clear` between phases — the core thesis; fresh 200k context per phase

**Should have (competitive):**
- Headless execution gate (manual vs `claude -p` per bead) — enables overnight mode; per-phase choice
- Auto-advance chain (`--auto` flag) — hands-free pipeline; requires quality gates to be trustworthy first
- Time budget mode — `time_budget_expires` in config; stops chain cleanly after budget expires
- Configurable depth (`quick/standard/comprehensive`) — controls bead count heuristics
- PRD express path (`--prd` flag) — skip clarification for teams with existing specs

**Defer (v2+):**
- Learnings harvest (`/choo-choo-ralph`) — separate skill exists; add after core pipeline validated
- Wave-based multi-phase batch execution — validate single-phase flow before batching
- Codemap integration — optional context enhancement; not core to pipeline value

### Architecture Approach

The architecture is a thin orchestrator + phase subagents pattern, with disk as the sole persistence layer across `/clear` boundaries. SKILL.md does no phase work — it reads `STATE.md`, dispatches a Task subagent for the current phase, verifies `completed: true` in the output file, advances state via `ralph-tools.cjs`, then runs the gate or auto-advances. Subagents receive only the specific files they need (paths, not contents) and write structured output to `.planning/phases/{N}-{slug}/`. The build order is strict: `ralph-tools.cjs` must exist before SKILL.md is written, because the CLI is the foundation every subsequent component depends on.

**Major components:**
1. SKILL.md (Orchestrator) — phase sequencing, gate logic, subagent dispatch, auto-advance chain; stays under 15% context budget
2. `ralph-tools.cjs` (CLI) — all state mutations, config reads, git commits, progress tracking; single `.cjs`, zero npm deps
3. `.planning/` (Disk State) — `STATE.md`, `config.json`, `phases/{N}-{slug}/` output files; everything that must survive `/clear`
4. Task subagents (Phase Workers) — fresh 200k context per phase; research, PRD creation, review; read files via paths
5. ralph-tui (Executor) — external black box; invoked as `ralph-tui run` or `claude -p` per bead in headless mode
6. Chained skills (`/ralph-tui-prd`, `/ralph-tui-create-beads`) — maintained externally; invoked as-is from phase subagents

### Critical Pitfalls

1. **Fat orchestrator (context bloat)** — orchestrator must NEVER read phase file contents; only verify `completed: true` via `ralph-tools.cjs`; pass file paths to subagents. Enforce from Phase 1 of implementation or every subsequent phase will compound the problem.

2. **State file ambiguity** — phase file `completed: true` must gate `STATE.md` advancement, not precede it. Protocol: subagent writes file with `completed: false` then does work then sets `completed: true` then orchestrator advances state. If `completed: false` is found at session start, offer re-run, not auto-advance.

3. **Compaction drops the thread** — every phase invocation must be self-contained; read all state from disk at start via `ralph-tools.cjs init`. The `init` command returning structured JSON replaces fragile hook injection as the primary context-load mechanism.

4. **Skill invocation without output validation** — pre-flight is a blocking gate; each skill invocation in a subagent prompt must be followed by structural validation (e.g., PRD contains `[PRD]...[/PRD]` markers and at least 3 user stories). Missing skill = pipeline stops with clear error, not `completed: true` with empty file.

5. **Open questions leaking to execution** — Phase 4.5 must run a grep scan for `[TBD]`, `[TODO]`, `TBD:`, `[PLACEHOLDER]` patterns before setting `open_questions_resolved: true`. Vague answers that satisfy the checklist but leave placeholders in the PRD will corrupt bead execution.

## Implications for Roadmap

Based on the component dependency graph from ARCHITECTURE.md and the pitfall-to-phase mapping from PITFALLS.md, the build order is clear. The CLI must precede the orchestrator, the state schema must precede the phase prompts, and auto-advance must layer on after basic sequencing is verified.

### Phase 1: Foundation — CLI and State Schema

**Rationale:** Everything depends on `ralph-tools.cjs` and a stable `.planning/` schema. Pitfalls 1, 2, 3, and 7 are all Phase 1 concerns — getting the state machine right before any phase work is built is non-negotiable. This is the highest-risk phase because a wrong state schema requires rewriting all subsequent phases.

**Delivers:** `ralph-tools.cjs` with `init`, `state`, `config-get`, `config-set`, `commit`, `phase-complete` commands; `STATE.md` schema; `config.json` schema; `.planning/` directory layout; disk-mediated `/clear` recovery verified end-to-end.

**Addresses:** Resumable state, disk-persisted phase outputs, git integration, pre-flight skeleton.

**Avoids:** Fat orchestrator (CLI mediates all state reads), state file ambiguity (completion-before-advancement protocol), compaction recovery (self-contained init from disk).

**Research flag:** Standard patterns — `gsd-tools.cjs` is the reference implementation. No additional research needed.

### Phase 2: Orchestrator Shell and Phase Execution Pattern

**Rationale:** Once the CLI exists, the SKILL.md shell (phase sequencing, gate logic, state read/advance) can be built. This phase implements the completion-flag verification pattern and the subagent dispatch model — establishing the template that all 9 phases will follow.

**Delivers:** SKILL.md entry point with compaction-recovery logic; phase dispatch template (read -> dispatch Task -> verify -> advance -> gate); 2-phase end-to-end test (research -> PRD) with `/clear` boundary crossing verified; `phase-validate` command in `ralph-tools.cjs` for structural content checks.

**Addresses:** Phase-based execution, user gates between phases, `/clear` between phases (core thesis).

**Avoids:** State in orchestrator memory (Task dispatch with paths only), gate logic inside subagents (all gates in orchestrator), one-long-session anti-pattern.

**Research flag:** Standard patterns — GSD `execute-phase.md` and `discuss-phase.md` are the reference. No additional research needed.

### Phase 3: Phase Content — Research, PRD, Resolution Gate

**Rationale:** With the orchestrator shell working, phase-specific subagent prompts can be written. Research and PRD are the highest-value phases and the most complex to get right (tracer bullet enforcement, TBD scan). The open questions resolution gate (Phase 4.5) belongs here because it is tightly coupled to PRD quality.

**Delivers:** Research phase subagent (parallel agents, capped output per agent); PRD phase subagent (invokes `/ralph-tui-prd`, validates `[PRD]...[/PRD]` markers, enforces tracer bullet US-001); Phase 4.5 resolution gate with TBD placeholder scan; `scan-placeholders` command in `ralph-tools.cjs`.

**Addresses:** Parallel research agents, tracer bullet PRD enforcement, open questions resolution gate, skill chaining (first external skill invocation).

**Avoids:** Open questions leaking to execution (TBD scan), tracer bullet degrading to horizontal layering (US-001 validator), skill invocation without output validation (PRD marker check).

**Research flag:** Verify `/ralph-tui-prd` output format against live skill before writing PRD validation logic. One-time check during planning.

### Phase 4: Execution Layer — Headless and Review

**Rationale:** Bead conversion and execution are the technically novel parts of ralph-gsd vs GSD. The headless execution pattern (one `claude -p` process per bead) and the bead-results status convention must be defined before implementation to avoid the "wakes up to unreadable pile of result files" pitfall. Compound review closes the quality loop.

**Delivers:** Convert phase subagent (invokes `/ralph-tui-create-beads`, validates `.beads/*.md` output); headless execution script generation (references/headless-script.md template); bead-results status convention (`status: passed|failed|blocked` first line); `summarize-bead-results` command in `ralph-tools.cjs`; compound review phase (parallel security/architecture/performance/simplicity agents).

**Addresses:** Headless execution gate, ralph-tui as execution engine, compound review after execution, quality gate enforcement.

**Avoids:** Headless execution without exit codes (bead-results format defined upfront), parallel beads sharing git working tree (sequential execution or disjoint file guarantee).

**Research flag:** Verify current `claude -p` CLI flags (`--max-turns`, `--allowedTools` syntax) before writing headless execution script template.

### Phase 5: Advanced Features — Auto-Advance, Time Budget, Depth

**Rationale:** Layer advanced features on after core pipeline is verified end-to-end. Auto-advance without working gates is dangerous; this phase is gated on Phases 2-4 being stable. Time budget and configurable depth are independent additions.

**Delivers:** Auto-advance chain (`--auto` flag, `workflow.auto_advance` config); time budget mode (`time_budget_expires` in config, budget check in `ralph-tools.cjs`); configurable depth (`quick/standard/comprehensive` controlling bead count heuristics); PRD express path (`--prd` flag bypassing clarification phase).

**Addresses:** Auto-advance chain, time budget mode, configurable depth, PRD express path.

**Avoids:** Auto-advance without quality gates (Phases 2-4 must be complete and verified first).

**Research flag:** Standard patterns — GSD `--auto` flag implementation is the reference. No additional research needed.

### Phase Ordering Rationale

- CLI before orchestrator: Every SKILL.md bash block calls `ralph-tools.cjs`; without the CLI the orchestrator cannot be tested
- State schema before phase prompts: Phase subagent prompts specify exact file paths to read/write; schema must be stable first
- 2-phase end-to-end test before all 9 phases: Validates the `/clear` boundary pattern with minimal complexity
- Research + PRD before Execution: Dependency chain — beads cannot exist without a PRD; PRD requires research context
- Core pipeline before auto-advance: Auto-advance without verified gates compounds errors; gates must be trusted first

### Research Flags

Phases needing deeper research during planning:
- **Phase 3:** Verify `/ralph-tui-prd` output format (what exactly does the skill write and where?) before writing PRD validation logic
- **Phase 4:** Verify current `claude -p` CLI flags (`--max-turns`, `--allowedTools` syntax) before writing headless execution script template

Phases with standard patterns (skip research-phase):
- **Phase 1:** `gsd-tools.cjs` is a complete reference implementation; replicate directly
- **Phase 2:** GSD `execute-phase.md` and `discuss-phase.md` encode the orchestrator shell pattern
- **Phase 5:** GSD `--auto` flag and config-based time budgeting are documented patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Live reference implementation (`gsd-tools.cjs`) + official Claude Code skills docs. No exploratory decisions required. |
| Features | HIGH | Cross-verified against GSD source, ralph-pipeline source, and multiple ecosystem sources. P1/P2/P3 prioritization is clear. |
| Architecture | HIGH | Primary sources: current `SKILL.md`, GSD workflow files, `PROJECT.md` design decisions. Component boundaries are explicit. |
| Pitfalls | HIGH | Derived from prior `CONCERNS.md` audit, GSD patterns, and direct analysis of existing ralph-pipeline failure modes. |

**Overall confidence:** HIGH

### Gaps to Address

- **`/ralph-tui-prd` output format:** The exact file path and content structure that the external skill produces is not fully documented in research. Verify before implementing PRD validation logic in Phase 3. Low risk — one-time check against live skill.
- **`claude -p` headless CLI flags:** The exact flags for `--max-turns`, `--allowedTools`, and output capture behavior may have changed since the research baseline. Verify during Phase 4 planning. Low risk — CLI help is authoritative.
- **bead-results status convention:** The `status: passed|failed|blocked` convention is proposed in research but not inherited from an existing system. Must be explicitly defined and enforced in Phase 4 before headless execution is implemented.
- **Compound-engineering agent names:** Agent names like `security-sentinel` and `architecture-strategist` are referenced in research but dynamic discovery is deferred. Hard-coded names in MVP; add discovery in v1.x.

## Sources

### Primary (HIGH confidence)
- `/Users/constantin/.claude/get-shit-done/bin/gsd-tools.cjs` — Complete reference CLI implementation
- `/Users/constantin/.claude/get-shit-done/bin/lib/core.cjs`, `frontmatter.cjs` — Core patterns (output modes, YAML parser)
- `/Users/constantin/.claude/get-shit-done/workflows/execute-phase.md` — Thin orchestrator, wave execution, lean context model
- `/Users/constantin/.claude/get-shit-done/workflows/discuss-phase.md` — Auto-advance chain, disk state, /clear boundary handling
- `/Users/constantin/Code/skills/ralph-pipeline/SKILL.md` — Existing implementation (anti-pattern baseline + pattern source)
- `/Users/constantin/Code/skills/ralph-pipeline/.planning/PROJECT.md` — Authoritative design requirements
- `/Users/constantin/Code/skills/ralph-pipeline/.planning/codebase/CONCERNS.md` — Prior concerns audit
- `https://code.claude.com/docs/en/skills` — Official Claude Code skills documentation (frontmatter fields, string substitutions)

### Secondary (MEDIUM confidence)
- `https://ralph-tui.com/` — Execution capabilities and session persistence
- `https://mikhail.io/2025/10/claude-code-skills/` — Structural patterns for Claude Code skills
- GSD GitHub + multiple 2025-2026 ecosystem sources — Feature landscape, orchestration anti-patterns

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*
