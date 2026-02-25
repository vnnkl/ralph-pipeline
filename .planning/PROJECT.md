# ralph-gsd

## What This Is

A Claude Code plugin system (skill + CLI tool + templates) that takes a feature idea from blank page to shipped code using GSD's orchestration patterns — `/clear` between phases, centralized state via CLI, auto-advance chains — but executes work through ralph-tui loops instead of inline code generation. ralph-tui can run 60+ beads overnight unattended, making this pipeline capable of shipping entire features hands-free.

## Core Value

Context isolation through `/clear` between phases combined with ralph-tui's ability to execute large batches of work unattended — the orchestrator stays lean while ralph-tui does the heavy lifting.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Plugin structure: skill files + ralph-tools.cjs CLI + templates directory
- [ ] `/clear` between phases for true context isolation (each phase is a fresh session)
- [ ] ralph-tools.cjs: Node.js CLI for all state mutations, config reads, commits, progress tracking
- [ ] Auto-advance chain: research → PRD → beads → execute → review → next phase, hands-free
- [ ] Wave-based phase execution: one ralph-tui loop per phase, multiple phases batchable
- [ ] Time budget mode: user specifies hours, pipeline auto-advances until budget expires (finishes current phase before stopping)
- [ ] Configurable depth: controls how many beads per phase (quick/standard/comprehensive)
- [ ] Execution gate per phase: user chooses headless (claude -p per bead) or manual (launch ralph-tui themselves)
- [ ] Chain existing skills: invoke /ralph-tui-prd for PRD creation, /ralph-tui-create-beads for conversion (don't reimplement)
- [ ] Parallel review agents post-execution (security, architecture, performance, simplicity)
- [ ] Research agents before PRD creation (repo-research, best-practices, framework-docs, learnings)
- [ ] Structured .planning/ directory: PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, config.json, research/
- [ ] Resumable state: pick up where you left off after crash, /clear, or new session

### Out of Scope

- Harvest phase (/choo-choo-ralph) — dropped from this version
- Codemaps integration (/update-codemaps) — not part of core pipeline
- Inlining PRD or bead skill logic — invoke as-is, don't reimplement
- Reusing gsd-tools.cjs directly — build ralph-tools.cjs purpose-built

## Context

**Current state:** ralph-pipeline exists as a single 800-line SKILL.md that runs all 9 phases in one session using subagents. It works but accumulates context. GSD solves this with `/clear` between phases — each phase invocation is a fresh session that reads state from disk.

**Key insight:** GSD's gsd-executor writes code directly in subagents. ralph-tui spawns independent Claude sessions per bead, each with fresh context and no memory of prior work. This means execution scales horizontally — 60 tasks overnight is routine. The pipeline should leverage this by packing more work into phases when the user has time.

**Dependencies (invoke, don't reimplement):**
- `/ralph-tui-prd` — PRD creation from research context
- `/ralph-tui-create-beads` — converts PRD to beads (Go CLI `bd`)
- `/ralph-tui-create-beads-rust` — converts PRD to beads (Rust CLI `br`)
- `/ralph-tui-create-json` — converts PRD to prd.json (no CLI needed)
- `compound-engineering` plugin — research + review agents
- `Context7` MCP — framework docs lookup during research

**Target audience:** Public skill for anyone with Claude Code + ralph-tui.

## Constraints

- **Skill format**: Must be installable as a Claude Code skill (markdown + supporting files)
- **No compiled deps**: ralph-tools.cjs must be a single .cjs file with zero npm dependencies (like gsd-tools.cjs)
- **Context budget**: Orchestrator must stay under 15% context usage — all heavy work in subagents or ralph-tui
- **Existing skills**: Must invoke /ralph-tui-prd, /ralph-tui-create-beads as-is — they're maintained separately

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Name: ralph-gsd | Signals GSD influence while keeping ralph identity | — Pending |
| Study GSD, don't clone | Extract patterns, implement fresh — cleaner than forking | — Pending |
| Node.js for ralph-tools.cjs | Match gsd-tools pattern: single .cjs, no deps, ships with skill | — Pending |
| Chain skills, don't inline | Skills maintained separately; chaining prevents duplication | — Pending |
| Time budget (not phase count) | Finishes current phase before stopping — clean boundaries | — Pending |
| Execution gate per phase | User chooses headless vs manual each time — flexibility | — Pending |

---
*Last updated: 2026-02-25 after initialization*
