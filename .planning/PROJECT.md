# ralph-pipeline

## What This Is

A Claude Code skill that orchestrates a 9-phase idea-to-code pipeline — from research through PRD, bead conversion, headless execution, and compound review — using `/clear` between phases for context isolation and ralph-tui as the execution engine. Ships as a single installable skill with a zero-dependency Node.js CLI (ralph-tools.cjs) and 9 subagent templates.

## Core Value

Context isolation through `/clear` between phases combined with ralph-tui's ability to execute large batches of work unattended — the orchestrator stays lean while ralph-tui does the heavy lifting.

## Requirements

### Validated

- ✓ Plugin structure: skill files + ralph-tools.cjs CLI + templates directory — v1.0
- ✓ `/clear` between phases for true context isolation — v1.0
- ✓ ralph-tools.cjs: Node.js CLI for all state mutations, config reads, commits — v1.0
- ✓ Auto-advance chain: phases advance hands-free with SessionStart hook — v1.0
- ✓ Time budget mode: user specifies hours, pipeline stops at phase boundary — v1.0
- ✓ Configurable depth: controls bead granularity (quick/standard/comprehensive) — v1.0
- ✓ Execution gate per phase: headless (claude -p) or manual (ralph-tui) — v1.0
- ✓ Chain existing skills: /ralph-tui-prd, /ralph-tui-create-beads invoked as-is — v1.0
- ✓ Parallel review agents post-execution (security, architecture, performance, simplicity) — v1.0
- ✓ Research agents before PRD creation (repo-research, best-practices, framework-docs, learnings) — v1.0
- ✓ Structured .planning/ directory: all state on disk, machine + human readable — v1.0
- ✓ Resumable state: pick up after crash, /clear, or new session — v1.0
- ✓ YOLO mode: auto-approve all gates for unattended pipeline runs — v1.0

### Active

- [ ] Harvest phase (/choo-choo-ralph): extract reusable patterns from completed work
- [ ] Codemaps integration: use as shared context for research and review agents
- [ ] Multi-phase batching: batch multiple phases into single overnight run

### Out of Scope

- Inlining PRD or bead skill logic — invoke as-is, don't reimplement
- Reusing gsd-tools.cjs directly — build ralph-tools.cjs purpose-built
- Real-time dashboard / live streaming — ralph-tui's TUI handles execution visibility
- Compiled npm dependencies — breaks zero-dep constraint

## Context

Shipped v1.0 with 3,309 LOC Node.js CJS across 13 phases and 26 plans.
Tech stack: Node.js CJS (zero dependencies), YAML frontmatter + markdown state, Claude Code skills.
Four milestone audits drove systematic gap closure (42/42 requirements satisfied).
Known gap: `/frontend-design` skill referenced but not yet created (external dependency).

## Constraints

- **Skill format**: Must be installable as a Claude Code skill (markdown + supporting files)
- **No compiled deps**: ralph-tools.cjs must be a single .cjs file with zero npm dependencies
- **Context budget**: Orchestrator must stay under 15% context usage — all heavy work in subagents
- **Existing skills**: Must invoke /ralph-tui-prd, /ralph-tui-create-beads as-is

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Name: ralph-pipeline | Signals GSD influence while keeping ralph identity | ✓ Good |
| Study GSD, don't clone | Extract patterns, implement fresh — cleaner than forking | ✓ Good |
| Node.js CJS for ralph-tools.cjs | Match gsd-tools pattern: single .cjs, no deps, ships with skill | ✓ Good |
| Chain skills, don't inline | Skills maintained separately; chaining prevents duplication | ✓ Good |
| Time budget (not phase count) | Finishes current phase before stopping — clean boundaries | ✓ Good |
| Execution gate per phase | User chooses headless vs manual each time — flexibility | ✓ Good |
| YOLO mode auto-approve all gates | Enables unattended overnight runs | ✓ Good |
| Auto-advance via SessionStart hook | /clear + hook re-invocation for true context isolation | ✓ Good |
| Trust file scan over STATE.md | File system is ground truth; STATE.md can lag | ✓ Good |
| Quality gates by delegation | QUALITY_GATE_SUFFIX appended to bead prompt, not external check | ✓ Good |
| Absolute timestamp for budget expiry | Survives /clear without recalculation | ✓ Good |
| 4 iterative milestone audits | Systematic convergence: each audit drives gap-closure phases | ✓ Good |

---
*Last updated: 2026-02-27 after v1.0 milestone*
