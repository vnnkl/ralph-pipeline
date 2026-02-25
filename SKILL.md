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

---

## Orchestrator Logic

When this skill is invoked, follow these steps in order. The orchestrator NEVER reads phase output file content -- it passes file paths only via `<files_to_read>` blocks to Task subagents.

### Step 1: Load State

```bash
node ralph-tools.cjs init pipeline
```

Parse the JSON output. Extract these fields:
- `current_phase` -- phase number from STATE.md
- `phase_name` -- human-readable name
- `status` -- current status string
- `mode` -- workflow mode (e.g., "yolo")
- `preflight_passed` -- whether preflight checks passed

### Step 2: Position Detection and --skip-to

Check if the user invoked the skill with `--skip-to <phase>`. If so, jump directly to that phase number (skip all prior phases regardless of completion status).

Otherwise, scan the disk for the actual pipeline position:

```bash
node ralph-tools.cjs scan-phases
```

Parse the JSON array output. Find the first phase where `completed` is false. Compare with `current_phase` from Step 1.

- **If they match:** Continue normally.
- **If mismatch:** Log a one-line warning: `Position mismatch: STATE.md says phase {X}, file scan says phase {Y}. Using file scan.` Use the file scan position (files are more recent truth).
- **If all phases complete:** Show the completion banner and stop:

```
## Pipeline Complete

All 9 phases finished. Pipeline output is in .planning/pipeline/.
```

### Step 3: Status Banner

Display the pipeline progress before dispatching:

```
## Pipeline Status

**Phase:** {id} of 9 ({name})
**Status:** Ready to dispatch
**Progress:** [{progress_bar}] {percent}%

Phase 1: Pre-flight -- {done|pending|skipped}
Phase 2: Clarify -- {done|pending|skipped}
Phase 3: Research -- {done|pending|skipped}
Phase 4: PRD -- {done|pending|skipped}
Phase 5: Deepen -- {done|pending|skipped}
Phase 6: Resolve -- {done|pending|skipped}
Phase 7: Convert -- {done|pending|skipped}
Phase 8: Execute -- {done|pending|skipped}
Phase 9: Review -- {done|pending|skipped}
```

The progress bar uses `#` for completed phases and `-` for remaining. Example: `[####-----]` for 4/9 complete = 44%.

Auto-skip completed phases silently. For each already-completed phase before the current one, log a single line: `Phase {id} ({name}): already complete, skipping.`

Then auto-dispatch the next incomplete phase (Step 4).

### Step 4: Phase Dispatch

Read the template file for the current phase:

```
templates/{phase.template}
```

Fill template variables using the `fillTemplate` function from `lib/orchestrator.cjs`:

| Variable | Value |
|----------|-------|
| `{{CWD}}` | Current working directory |
| `{{PHASE_NAME}}` | Capitalized phase name (e.g., "Research") |
| `{{PHASE_SLUG}}` | URL-safe phase name (e.g., "research") |
| `{{PHASE_ID}}` | Phase number (1-9) |
| `{{STATE_PATH}}` | `.planning/STATE.md` |
| `{{CONFIG_PATH}}` | `.planning/config.json` |
| `{{PHASE_FILES}}` | Phase-specific upstream dependency files (computed per phase, see table below) |

**PHASE_FILES per phase:**

| Phase | PHASE_FILES Value |
|-------|-------------------|
| 1 - preflight | *(empty)* |
| 2 - clarify | *(empty)* |
| 3 - research | `- .planning/pipeline/clarify.md` |
| 4 - prd | `- .planning/research/SUMMARY.md\n- .planning/pipeline/clarify.md` |
| 5 - deepen | `- .planning/pipeline/prd.md` |
| 6 - resolve | `- .planning/pipeline/prd.md\n- .planning/pipeline/open-questions.md` |
| 7 - convert | `- .planning/pipeline/prd.md` |
| 8 - execute | *(empty)* |
| 9 - review | *(empty)* |

Dispatch the filled template content as a **Task subagent**. The Task tool provides inherent context isolation -- the subagent runs in its own context window.

**Anti-pattern:** NEVER load phase output content into the orchestrator's own context. Pass file paths only.

### Step 5: Completion Verification (Dual Check)

After the Task subagent returns, verify completion using both signals:

1. **Message check:** Look for `## PHASE COMPLETE` or `## PHASE FAILED` heading in the Task return message.
2. **File check:** Run `node ralph-tools.cjs scan-phases` and check the phase's `completed` field.

**If both agree on complete:** Proceed to Step 6 (User Gate).

**If PHASE FAILED or completed is false:**
- Auto-retry once: re-dispatch the same phase as a fresh Task subagent.
- If retry also fails: proceed to Step 6 with the failure gate.

### Step 6: User Gate

Gates are context-dependent -- options come from the phase's `gateOptions` array in `PIPELINE_PHASES`.

**For successful completion:**

First, get a summary excerpt of the phase output:

```bash
node ralph-tools.cjs excerpt .planning/pipeline/{phase_name}.md 10
```

Then present the gate with the excerpt and context-dependent options:

```
## Phase {id}: {Name} Complete

{excerpt from phase output}

**Next steps:**
```

Show only the options defined in the phase's `gateOptions`:

- **approve** -- Accept output. Run: `node ralph-tools.cjs state set Status "Phase {id} complete"`. Then proceed to Step 7.
- **redirect** -- Spawn a **fresh** Task subagent with the original template content + the path to the existing output file + user feedback. Never resume a previous agent.
- **skip** -- Mark phase as completed (write `.planning/pipeline/{phase_name}.md` with `completed: true` frontmatter), then proceed to Step 7.
- **replan** -- Return to planning mode. Show: "Returning to planning. Re-invoke the pipeline when ready to resume."
- **retry** -- Re-dispatch the same phase as a fresh Task subagent.
- **abort** -- Stop the pipeline, preserve all state on disk. Show: "Pipeline paused at phase {id}. Re-invoke to resume."

**For failure (after auto-retry failed):**

Present failure-specific options:
- **retry** -- Re-dispatch same phase.
- **skip** -- Mark skipped, advance.
- **abort** -- Stop pipeline, preserve state.

### Step 7: /clear Boundary

After a phase is approved or skipped, check the workflow mode:

**Manual mode** (default): Suggest a context boundary before the next phase:

```
Phase {id} ({name}) is complete. Run /clear for fresh context, then re-invoke the pipeline to continue with Phase {next_id} ({next_name}).
```

**Auto mode** (when `config.auto_advance` is true): Dispatch the next incomplete phase directly as a Task subagent (inherently context-isolated). Loop back to Step 2 for position detection.

**Anti-pattern:** NEVER store pipeline position in JavaScript variables that won't survive /clear. Always re-read from disk via `ralph-tools.cjs init pipeline`.

---

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
| `scan-phases` | Scan pipeline phases: completion status of all 9 phases |
| `excerpt <file> [N]` | Extract first N non-frontmatter lines from a file |
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
- `lib/orchestrator.cjs` -- Pipeline scanning, position detection, template filling, excerpts
- `templates/` -- Phase template stubs (9 files, one per phase)

**State flow:**
1. Orchestrator calls `ralph-tools.cjs init pipeline` to load context
2. Runs `ralph-tools.cjs scan-phases` to detect position from disk
3. Compares file scan with STATE.md, trusts file scan on mismatch
4. Reads template from `templates/{phase}.md`, fills variables via `fillTemplate` (`PHASE_FILES` computed per phase from upstream dependency chain)
5. Dispatches filled template as Task subagent (context-isolated)
6. Verifies completion: checks Task return message + scans output files
7. Presents context-dependent user gate (options from `PIPELINE_PHASES[phase].gateOptions`)
8. Suggests `/clear` (manual mode) or auto-dispatches next phase (auto mode)
