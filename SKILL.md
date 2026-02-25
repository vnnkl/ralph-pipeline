---
name: ralph-pipeline
description: "Orchestrates the full Ralph Loop workflow from idea to shipped code through 9 phases with context isolation (/clear between phases). Uses ralph-tui for batch execution and ralph-tools.cjs for state management. Invoke to start or resume a pipeline. Triggers on: ralph pipeline, full loop, end to end plan, pipeline, run the full loop, ralph gsd."
---

# Ralph Pipeline

Orchestrate the full Ralph Loop from idea to shipped, reviewed code. Each phase runs in a fresh Claude session (/clear between phases) to avoid context overflow. State lives entirely on disk in `.planning/` so progress survives any session boundary.

## Quick Start

Check current pipeline state:

```bash
node ralph-tools.cjs init pipeline
```

This returns config, state, phase info, and file existence checks in one JSON call. Use the output to decide what to do next.

## Phases

1. **Pre-flight** -- Check/install missing skills, CLIs, GSD reference, .gitignore
2. **Clarify** -- Scope, stack, quality gates, agent selection
3. **Research** -- Parallel agents: repo-research, best-practices, framework-docs, learnings
4. **PRD** -- Create PRD via /ralph-tui-prd with tracer bullet story ordering
5. **Deepen** -- Parallel review agents against PRD (security, architecture, simplicity, performance)
6. **Resolve** -- Blocking gate: resolve all open questions before conversion
7. **Convert** -- Beads (bd/br) or prd.json via /ralph-tui-create-beads
8. **Execute** -- Manual ralph-tui or headless (claude -p per bead)
9. **Review** -- Compound review with parallel agents, P1/P2/P3 categorization

## CLI Reference

| Command | Description |
|---------|-------------|
| `init pipeline` | Load all project state in one call (config, state, phase info, file checks) |
| `init phase <N>` | Load phase-specific context (plan/summary counts, CONTEXT.md/RESEARCH.md existence) |
| `state get <field>` | Extract a field value from STATE.md |
| `state set <field> <value>` | Replace a field value in STATE.md (with frontmatter sync) |
| `state json` | Output STATE.md frontmatter as JSON |
| `config-get [key]` | Get config value by dot-notation key, or dump full config |
| `config-set <key> <value>` | Set config value with type coercion |
| `commit <message> [files]` | Git commit with conditional logic (respects commit_docs flag) |
| `phase-complete <N>` | Mark phase complete (updates ROADMAP.md + advances STATE.md) |
| `preflight` | Pre-flight dependency checks (skills, MCP servers, CLIs, GSD reference) |
| `setup-reference` | Copy GSD reference to .reference/ with version pinning |
| `setup-gitignore <pattern>` | Add pattern to .gitignore (idempotent) |
| `help` | List all available commands |

All commands accept `--cwd <path>` and `--raw` flags.

## Architecture

This skill uses /clear between phases. Each phase is a fresh Claude session. State lives on disk in `.planning/`. The orchestrator reads state at start and resumes from the last incomplete phase.

**Key files:**
- `.planning/STATE.md` -- Current phase, plan, status, progress
- `.planning/ROADMAP.md` -- Phase list with completion tracking
- `.planning/config.json` -- Workflow preferences (mode, depth, auto_advance)
- `ralph-tools.cjs` -- CLI entry point (zero npm dependencies)
- `lib/` -- Module directory (core, state, phase, config, preflight, init)

**State flow:**
1. Orchestrator calls `ralph-tools.cjs init pipeline` to load context
2. Determines current phase from STATE.md
3. Dispatches phase-specific subagent (Task tool)
4. Subagent completes, writes output with `completed: true`
5. Orchestrator advances STATE.md, presents user gate
6. /clear, next phase starts fresh

<!-- Phase 2 adds: phase sequencing, /clear boundary pattern, user gates, subagent dispatch -->
