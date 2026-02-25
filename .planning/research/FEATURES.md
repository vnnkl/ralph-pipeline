# Feature Research

**Domain:** AI coding orchestration pipeline (Claude Code skill, idea-to-shipped-code)
**Researched:** 2026-02-25
**Confidence:** HIGH — cross-verified against GSD source, ralph-pipeline source, multiple 2025-2026 ecosystem sources

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Resumable state | Pipeline runs crash, contexts compact, sessions end mid-phase; users expect to pick up where they left — "50 First Dates" problem is well-known | MEDIUM | Disk-persisted state.md / STATE.md is the established pattern; filesystem fallback for no state file |
| Phase-based execution | Users expect clear boundaries between planning and doing; all established systems (GSD, ralph-pipeline, cursor workflows) use phases | MEDIUM | Each phase = atomic unit of work with defined inputs/outputs |
| Dependency check / pre-flight | Pipeline fails silently if upstream tools are missing; users expect an upfront check | LOW | Check for ralph-tui, bd/br CLIs, required skills; offer install commands |
| Git integration (auto-init, commits, .gitignore) | Every serious coding pipeline commits work; users expect per-task commits and clean git state | MEDIUM | Auto-init repo, per-task commits, enforce .gitignore entries |
| Parallel agent execution (research/review) | Multiple independent agents running simultaneously is expected now; sequential-only feels slow | MEDIUM | Research agents in parallel; review agents in parallel — established pattern in GSD and ralph-pipeline |
| Disk-persisted phase outputs | Context compaction can wipe in-memory progress; users expect phase files to survive resets | LOW | YAML frontmatter with completed: true/false is the established pattern |
| User gates between phases | Automated pipelines without control points feel like "YOLO mode"; users expect to review and steer | LOW | AskUserQuestion between phases; approve/redirect/replan |
| Quality gate enforcement | Users expect that quality checks (tests, type checks) are baked in and enforced per-task | MEDIUM | Quality gates in acceptance criteria; run before commit |
| Skill chaining (invoke, don't reimplement) | /ralph-tui-prd, /ralph-tui-create-beads already exist; users expect composition not duplication | LOW | Skills invoked as-is; pipeline stays thin and orchestrates |
| Structured planning directory | .planning/ with PROJECT.md, ROADMAP, STATE, REQUIREMENTS is established convention | LOW | GSD and ralph-pipeline both use this; expected by users of either |
| Tracer bullet / thin vertical slices | Build smallest working end-to-end slice first (DB → backend → frontend); prevents horizontal layering | HIGH | Critical pattern from Pragmatic Programmer; enforced in PRD structure |
| Research before PRD creation | Users expect domain research, repo analysis, best-practices lookup before a PRD is written | MEDIUM | Parallel research agents: repo-research-analyst, best-practices-researcher, framework-docs-researcher |
| Compound review after execution | Post-execution review by specialized agents (security, architecture, performance, simplicity) | MEDIUM | Parallel P1/P2/P3 categorized findings |

### Differentiators (Competitive Advantage)

Features that set ralph-gsd apart. Not universally expected, but highly valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| /clear between phases for true context isolation | Orchestrator stays lean (~10-15% context) while each phase gets a fresh 200k window; prevents context rot across 9 phases | HIGH | Core insight of ralph-gsd: /clear is the isolation primitive. GSD uses subagents; ralph-gsd enforces it between major phases via fresh session invocation |
| ralph-tui as execution engine (60+ tasks overnight) | ralph-tui can run 60+ beads unattended; no other orchestration system leverages this scale | HIGH | Unique to ralph-pipeline ecosystem; the "overnight mode" differentiator |
| Headless execution gate (claude -p per bead) | User chooses per-phase whether to run headless (automated) or manual (interactive ralph-tui) | MEDIUM | Each bead gets fresh context, no context limit across tasks; scales horizontally |
| Time budget mode | User specifies hours; pipeline auto-advances through phases until budget expires, finishing current phase cleanly | MEDIUM | Unique to this pipeline; enables "run overnight for 8 hours" without over-running |
| Configurable depth (quick/standard/comprehensive) | Controls beads-per-phase; allows tradeoff between speed and thoroughness | LOW | Depth config feeds into bead count heuristics during PRD/conversion |
| Auto-advance chain (hands-free) | research → PRD → beads → execute → review → next phase with no human intervention | HIGH | GSD has --auto flag; ralph-gsd extends to ralph-tui execution phase |
| Wave-based phase execution | One ralph-tui loop per phase; multiple phases batchable into a single overnight run | MEDIUM | Wraps GSD's wave pattern into ralph-tui's execution model |
| Learnings harvest (post-pipeline) | Extract reusable patterns and decisions from completed work for future sessions | MEDIUM | /choo-choo-ralph:harvest + codemap refresh; closes the improvement loop |
| Execution gate per phase (headless vs manual) | Per-phase choice between automation and control; power users run headless at night, interactive during design | LOW | Flexibility that monolithic pipelines don't offer |
| Open questions resolution gate (Phase 4.5) | Blocking gate before conversion — no unresolved questions leak into execution | LOW | ralph-pipeline already has this; forces all decisions before bead creation |
| PRD express path (--prd flag) | Feed an existing PRD doc directly; skip interactive clarification; for teams with pre-written specs | MEDIUM | GSD has this; natural fit for ralph-gsd |
| Codemap integration as shared context | Codemaps in docs/CODEMAPS/ give all agents shared understanding of codebase without per-agent re-exploration | MEDIUM | Reduces per-agent context cost; ensures agents reference existing patterns |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem valuable but create concrete problems. Explicitly avoid building these.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Inlining skill logic (/ralph-tui-prd, /ralph-tui-create-beads) | Seems like it would simplify the pipeline | Duplicates logic maintained in separate skills; desyncs when upstream skills update | Invoke skills as-is; chain, never reimplement |
| Monolithic single-session execution (all 9 phases, one context) | Feels simpler; one command does everything | Context accumulates across phases, degrades quality by Phase 5+; well-documented "context rot" | /clear between phases; subagent per phase; fresh context per major unit |
| Real-time dashboard / live streaming | Appealing UX; users want to see everything happening | Adds significant complexity for marginal value in a CLI-first tool; ralph-tui already provides TUI | ralph-tui's TUI handles execution visibility; orchestrator provides phase summaries |
| Reusing gsd-tools.cjs directly | Saves building ralph-tools.cjs from scratch | Tightly coupled to GSD's planning structure and state format; will break as GSD evolves | Build ralph-tools.cjs purpose-built for ralph-gsd's state model; single .cjs, zero deps |
| Harvest phase in v1 (/choo-choo-ralph) | Captures learnings; completes the loop | Adds complexity to v1 before core pipeline is validated | Drop from v1; add in v1.x after core pipeline ships |
| Codemaps integration (/update-codemaps) in v1 | Provides context to agents | Not part of core pipeline value; adds dependency on tooling that may not be installed | Drop from v1; document as optional enhancement |
| Compiled dependencies in ralph-tools.cjs | Richer functionality possible with npm packages | Breaks zero-dep constraint; makes skill harder to install | Single .cjs file, Node.js built-ins only; ship with skill |
| Horizontal layering in PRD (all DB first, then all API, then all UI) | Seems organized; clear separation of concerns | Delays feedback; hides integration bugs until the end; violates tracer bullet principle | Enforce vertical slices: every story touches all layers (DB → backend → frontend) |
| Parallel execution without dependency awareness | Speed; run everything at once | Dependent tasks fail when predecessors are not complete; no dependency graph = chaotic execution | Wave-based grouping: parallel within a wave, sequential across waves |
| Agent autonomy without oversight gates | Fully hands-free is appealing | Bugs compound across phases; agents make locally sensible but globally inconsistent decisions | Per-phase gates; user can review, redirect, replan at each boundary |

---

## Feature Dependencies

```
[Disk-persisted phase outputs]
    └──requires──> [Resumable state]

[Auto-advance chain]
    └──requires──> [Disk-persisted phase outputs]
    └──requires──> [Phase-based execution]
    └──requires──> [Quality gate enforcement]

[Headless execution gate]
    └──requires──> [Phase-based execution]
    └──requires──> [ralph-tui as execution engine]

[Time budget mode]
    └──requires──> [Auto-advance chain]
    └──requires──> [Phase-based execution]

[Tracer bullet / thin vertical slices]
    └──requires──> [Research before PRD creation]
    └──enhances──> [Quality gate enforcement]

[Open questions resolution gate]
    └──requires──> [Research before PRD creation]
    └──blocks──> [Skill chaining: /ralph-tui-create-beads]

[Compound review after execution]
    └──requires──> [Parallel agent execution]
    └──requires──> [Git integration]

[Configurable depth]
    └──enhances──> [ralph-tui as execution engine]
    └──enhances──> [Time budget mode]

[/clear between phases]
    └──enables──> [Auto-advance chain]
    └──enables──> [Headless execution gate]

[Codemap integration]
    └──enhances──> [Research before PRD creation]
    └──enhances──> [Compound review after execution]
```

### Dependency Notes

- **Resumable state requires disk-persisted phase outputs:** Without phase files with completed: flags, resuming requires re-running completed work.
- **Auto-advance chain requires quality gates:** Auto-advance without gates produces garbage downstream; gates are what make automation trustworthy.
- **Open questions gate blocks conversion:** Intentional hard dependency — ambiguous specs produce ambiguous beads. No bypass.
- **Time budget mode requires auto-advance:** Budget expiry only makes sense when phases can advance without human input.
- **Headless execution requires ralph-tui:** The headless path (claude -p per bead) is a ralph-tui-adjacent pattern, not a replacement.

---

## MVP Definition

### Launch With (v1)

Minimum viable pipeline — what's needed to validate the core concept (context isolation + ralph-tui scale).

- [ ] Plugin structure: skill files + ralph-tools.cjs + templates directory — without this it is not installable
- [ ] /clear between phases (fresh session per phase) — the core thesis; without this it is just the old ralph-pipeline
- [ ] ralph-tools.cjs: Node.js CLI for state mutations, config reads, commits, progress tracking — needed by all phases
- [ ] Disk-persisted state with completed: flags — needed for resumability and /clear handoff
- [ ] Resumable state: read state.md on invocation, offer resume or restart — table stakes
- [ ] Phase-based execution: pre-flight, clarify, research, PRD, deepen, resolve, convert, execute, review
- [ ] Parallel research agents before PRD — differentiator that makes PRD quality worth it
- [ ] User gates between phases — safety net; enables interruption and steering
- [ ] Execution gate per phase (manual or headless) — core differentiator; enables overnight mode
- [ ] Skill chaining: invoke /ralph-tui-prd and /ralph-tui-create-beads as-is — keeps pipeline thin
- [ ] Open questions resolution gate (blocking before conversion) — prevents ambiguous beads
- [ ] Compound review after execution (parallel agents) — closes the quality loop
- [ ] Tracer bullet PRD structure enforcement — vertical slices; prevents horizontal layering

### Add After Validation (v1.x)

Features to add once core pipeline is working and validated.

- [ ] Time budget mode — trigger: users request "run X hours overnight" capability
- [ ] Configurable depth (quick/standard/comprehensive) — trigger: users find default bead count too many or too few
- [ ] Auto-advance chain (--auto flag) — trigger: users want fully hands-free overnight runs
- [ ] PRD express path (--prd flag) — trigger: teams with existing spec docs want to skip clarification
- [ ] Codemap integration as optional context enhancement — trigger: users with large codebases report agent confusion

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Learnings harvest (/choo-choo-ralph phase) — defer: harvest skill exists separately; add when core pipeline validated
- [ ] Wave-based multi-phase batch execution — defer: complex orchestration; validate single-phase flow first
- [ ] Time budget with phase-count override — defer: niche power-user feature

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| /clear between phases | HIGH | HIGH | P1 |
| Disk-persisted state + resumability | HIGH | MEDIUM | P1 |
| Phase-based execution (all 9 phases) | HIGH | HIGH | P1 |
| ralph-tools.cjs (zero-dep CLI) | HIGH | MEDIUM | P1 |
| Execution gate (headless vs manual) | HIGH | MEDIUM | P1 |
| Skill chaining (invoke existing skills) | HIGH | LOW | P1 |
| Parallel research agents | HIGH | MEDIUM | P1 |
| User gates between phases | HIGH | LOW | P1 |
| Tracer bullet PRD enforcement | HIGH | MEDIUM | P1 |
| Open questions resolution gate | MEDIUM | LOW | P1 |
| Compound review (parallel agents) | HIGH | MEDIUM | P1 |
| Headless execution (claude -p per bead) | HIGH | MEDIUM | P1 |
| Pre-flight dependency check | MEDIUM | LOW | P1 |
| Auto-advance chain (--auto) | HIGH | HIGH | P2 |
| Time budget mode | MEDIUM | MEDIUM | P2 |
| Configurable depth | MEDIUM | LOW | P2 |
| PRD express path (--prd) | MEDIUM | MEDIUM | P2 |
| Codemap integration | MEDIUM | MEDIUM | P2 |
| Learnings harvest phase | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | GSD | ralph-pipeline (v1) | ralph-gsd (target) |
|---------|-----|---------------------|---------------------|
| Context isolation between phases | Subagent per phase (shared session) | None (single 800-line session) | /clear between phases (true fresh session) |
| Disk-persisted state | STATE.md + phase files | .claude/pipeline/state.md | .planning/STATE.md (GSD-compatible) |
| Resumable state | Yes (STATE.md + ROADMAP.md) | Yes (state.md with current_phase) | Yes (state.md + completed: flags) |
| Parallel agent execution | Yes (wave-based) | Yes (parallel Task calls) | Yes (inherited) |
| Auto-advance chain | --auto flag + config.json | No | v1.x (P2) |
| ralph-tui integration | No (uses Task subagents) | Manual/headless gate | Native; execution gate per phase |
| Execution at scale (60+ beads) | No (bounded by context) | Yes (headless mode) | Yes (core differentiator) |
| Time budget mode | No | No | v1.x (P2) |
| Configurable depth | model_profile quality levels | No | v1.x (P2) |
| Skill chaining | Invokes gsd-agents | Invokes ralph-tui skills | Invokes ralph-tui skills |
| Compound review | Yes (security/arch/perf/simplicity) | Yes (parallel review agents) | Yes (inherited) |
| Tracer bullet enforcement | No (plans, not stories) | Yes (PRD structure) | Yes (enforced in PRD phase) |
| Open questions gate | CONTEXT.md discussion phase | Phase 4.5 (blocking) | Phase 4.5 (blocking) |
| Learnings harvest | No native | /choo-choo-ralph (Phase 8) | v2+ |
| Zero-dep CLI tool | gsd-tools.cjs (yes) | No CLI | ralph-tools.cjs (yes) |

---

## Sources

- GSD (Get Shit Done) GitHub: https://github.com/gsd-build/get-shit-done — Phase structure, auto-advance, disk state patterns — HIGH confidence (primary source)
- /Users/constantin/.claude/get-shit-done/workflows/execute-phase.md — Wave-based execution, context budget model — HIGH confidence (direct source)
- /Users/constantin/.claude/get-shit-done/workflows/plan-phase.md — Research → Plan → Verify loop, --auto flag — HIGH confidence (direct source)
- /Users/constantin/Code/skills/ralph-pipeline/SKILL.md — Existing pipeline phases, state format, skill chaining — HIGH confidence (direct source)
- Ralph TUI official site: https://ralph-tui.com/ — Execution capabilities, session persistence, beads integration — HIGH confidence
- Conductors to Orchestrators: The Future of Agentic Coding (O'Reilly): https://www.oreilly.com/radar/conductors-to-orchestrators-the-future-of-agentic-coding/ — Table stakes features, anti-patterns — MEDIUM confidence
- Addy Osmani: Future of Agentic Coding: https://addyosmani.com/blog/future-agentic-coding/ — Differentiating features, parallelization value — MEDIUM confidence
- RedMonk: 10 Things Developers Want from Agentic IDEs (2025): https://redmonk.com/kholterhoff/2025/12/22/10-things-developers-want-from-their-agentic-ides-in-2025/ — Developer expectations survey — MEDIUM confidence
- Cursor Parallel Agents Analysis: https://jduncan.io/blog/2025-11-01-cursor-parallel-agents/ — Parallel vs sequential tradeoffs — MEDIUM confidence
- AI Coding Agents: Coherence Through Orchestration (Mike Mason, 2026): https://mikemason.ca/writing/ai-coding-agents-jan-2026/ — Anti-patterns, quality concerns — MEDIUM confidence
- Claude Code Multi-Agent Guide (eesel.ai, 2026): https://www.eesel.ai/blog/claude-code-multiple-agent-systems-complete-2026-guide — Claude Code orchestration patterns — MEDIUM confidence

---

*Feature research for: AI coding orchestration pipeline (ralph-gsd)*
*Researched: 2026-02-25*
