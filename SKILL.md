---
name: ralph-pipeline
description: "Orchestrates the full Ralph Loop workflow from idea to shipped code through 9 phases with context isolation (/clear between phases). Uses ralph-tui for batch execution and ralph-tools.cjs for state management. Invoke to start or resume a pipeline. Triggers on: ralph pipeline, full loop, end to end plan, pipeline, run the full loop, ralph gsd."
---

# Ralph Pipeline

Orchestrate the full Ralph Loop from idea to shipped, reviewed code. Each phase runs in a fresh Claude session (/clear between phases) to avoid context overflow. State lives entirely on disk in `.planning/` so progress survives any session boundary.

## Quick Start

Check current pipeline state:

```bash
node /path/to/ralph-pipeline/ralph-tools.cjs --cwd /path/to/your/project init pipeline
```

`--cwd` is required when invoked from outside the project directory. The orchestrator resolves paths automatically via Step 0 below.

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

### Step 0: Resolve Paths

Extract the skill base directory from the "Base directory for this skill:" header at the top of this file.

Set these two variables for all subsequent commands:
- **RALPH_TOOLS** = `{base_dir}/ralph-tools.cjs` (absolute path to the CLI)
- **PROJECT_CWD** = current working directory (the user's project, NOT the skill directory)

All `node ralph-tools.cjs` commands below MUST be invoked as:
```bash
node {RALPH_TOOLS} --cwd {PROJECT_CWD} <command> [args]
```

This prevents state leakage between projects when the skill is invoked from a different directory.

### Step 1: Load State

```bash
node {RALPH_TOOLS} --cwd {PROJECT_CWD} init pipeline
```

Parse the JSON output. Extract these fields:
- `current_phase` -- phase number from STATE.md
- `phase_name` -- human-readable name
- `status` -- current status string
- `mode` -- workflow mode (e.g., "yolo")
- `preflight_passed` -- whether preflight checks passed

### Step 1b: Time Budget Prompt (first run only)

If `time_budget_expires` is null (no budget set yet) AND mode is NOT "yolo":

1. Ask via AskUserQuestion:
   - **Header:** "Time Budget"
   - **Question:** "How many hours should the pipeline run before auto-pausing? Leave blank for no limit."
   - **Options:**
     1. **2 hours** -- Short session
     2. **4 hours** -- Standard session
     3. **8 hours** -- Extended session
     4. **No limit** -- Run until completion
     5. **Custom** -- I will specify

2. If user selects a number (or custom):
   - Run: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} time-budget start {hours}`
   - Run: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} time-budget estimate`
   - Parse the estimate output
   - Log: "Budget: {hours}h. Estimated ~{estimated_beads_remaining} beads based on avg {avg_bead_duration_display}/bead."
   - If is_first_run: Log: "(First run -- using 20min/bead default estimate)"

3. If user selects "No limit": Skip time budget. Log: "No time budget set."

If mode is "yolo":
- Skip the prompt. If `time_budget_hours` is set in config, it was configured before YOLO was enabled. Log the budget status.
- If no budget: Log: "YOLO mode: no time budget set. Pipeline will run to completion."

### Step 2: Position Detection and --skip-to

Check if the user invoked the skill with `--skip-to <phase>`. If so, jump directly to that phase number (skip all prior phases regardless of completion status).

Check if the user invoked the skill with `--yolo`. If so:
1. Set mode to yolo: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set mode yolo`
2. Log: "YOLO mode enabled: all gates will be auto-approved."

Check if the user invoked the skill with `--auto`. If so:
1. Set auto_advance to true: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set auto_advance true`
2. Record start time: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set auto_advance_started_at {Date.now()}`
3. Log: "Auto-advance enabled: pipeline will chain through phases."

Otherwise, scan the disk for the actual pipeline position:

```bash
node {RALPH_TOOLS} --cwd {PROJECT_CWD} scan-phases
```

Parse the JSON array output. Find the first phase where `completed` is false. Compare with `current_phase` from Step 1.

- **If they match:** Continue normally.
- **If mismatch:** Auto-correct STATE.md to match file scan:
  1. Run: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} state set Status "Pipeline phase {file_scan_phase}/9 ({pipeline_display_name})"`
  2. Log: "STATE.md synced to pipeline phase {file_scan_phase} ({pipeline_display_name})"
  3. Use the file scan position for dispatch (files are more recent truth).
- **If all phases complete:**
  1. Clear auto_advance: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set auto_advance false`
  2. **ROADMAP guard:** Check if the ROADMAP checkbox for the current dev-phase is already marked. Run: `grep -c "\- \[x\].*Phase ${current_phase}[:\s]" .planning/ROADMAP.md`
     - If result is 0 (checkbox unchecked): Run `node {RALPH_TOOLS} --cwd {PROJECT_CWD} phase-complete {current_phase}` to sync ROADMAP. Log: "ROADMAP synced: dev-phase {current_phase} marked complete."
     - If result is >= 1 (checkbox already checked): Skip phase-complete. ROADMAP is already current.
  3. Show the completion banner and stop:

```
## Pipeline Complete

All 9 phases finished. Pipeline output is in .planning/pipeline/.
```

### Step 2b: YOLO Bead Format Check

If mode is "yolo":
  Read bead_format: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-get bead_format --raw`
  If bead_format is null or empty:
    Ask via AskUserQuestion:
      - **Header:** "Bead Format (YOLO Setup)"
      - **Question:** "YOLO mode needs a bead format for the convert phase. Choose once for this project:"
      - **Options:**
        1. **bd** -- Go beads via /ralph-tui-create-beads
        2. **br** -- Rust beads via /ralph-tui-create-beads-rust
        3. **prd.json** -- JSON format via /ralph-tui-create-json
    Run: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set bead_format {choice}`
    Log: "Bead format set to '{choice}' for this project."

### Step 3: Status Banner

Display the pipeline progress before dispatching:

```
## Pipeline Status

**Phase:** {id} of 9 ({pipeline_display_name})
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

Auto-skip completed phases silently. For each already-completed phase before the current one, log a single line: `Phase {id} ({pipeline_display_name}): already complete, skipping.`

Then auto-dispatch the next incomplete phase (Step 3b or Step 4).

### Step 3b: Codemap Generation (before research)

If the current phase is 3 (research):

1. Check codemap freshness:
   ```bash
   node {RALPH_TOOLS} --cwd {PROJECT_CWD} codemap check
   ```

2. Parse JSON output: `{exists, fresh}`

3. If `fresh` is true: codemaps are current, proceed to Step 4.

4. If `fresh` is false (stale or missing):
   - Read the codemap template: `templates/codemap.md`
   - Fill template variables (`CWD`, `RALPH_TOOLS` only -- codemap.md has no `PHASE_FILES`/`CODEMAP_FILES`)
   - Dispatch as Task subagent (subagent_type: "general-purpose")
   - Wait for completion
   - Log: "Codemaps generated in .planning/codebase/"

No user prompts, no skip/refresh choice -- fully automatic.

If the current phase is NOT 3: skip this step entirely.

### Step 4: Phase Dispatch

Read the template file for the current phase:

```
templates/{phase.template}
```

Fill template variables using the `fillTemplate` function from `lib/orchestrator.cjs`. `PIPELINE_DISPLAY_NAME` comes from `phase.displayName` and `PIPELINE_PHASE` comes from `phase.slug` in the PIPELINE_PHASES array:

| Variable | Value |
|----------|-------|
| `{{CWD}}` | Current working directory (PROJECT_CWD from Step 0) |
| `{{RALPH_TOOLS}}` | Absolute path to `ralph-tools.cjs` (RALPH_TOOLS from Step 0) |
| `{{PIPELINE_DISPLAY_NAME}}` | Pipeline phase display name from PIPELINE_PHASES (e.g., "Research", "PRD", "Pre-flight") |
| `{{PIPELINE_PHASE}}` | Pipeline phase slug from PIPELINE_PHASES (e.g., "research", "prd", "preflight") |
| `{{PHASE_ID}}` | Phase number (1-9) |
| `{{STATE_PATH}}` | `.planning/STATE.md` |
| `{{CONFIG_PATH}}` | `.planning/config.json` |
| `{{PHASE_FILES}}` | Phase-specific upstream dependency files (computed per phase, see table below) |
| `{{CODEMAP_FILES}}` | Role-specific codemap file paths (computed per phase, see CODEMAP_FILES table below) |

**PHASE_FILES per phase:**

| Phase | PHASE_FILES Value |
|-------|-------------------|
| 1 - preflight | *(empty)* |
| 2 - clarify | *(empty)* |
| 3 - research | `- .planning/pipeline/clarify.md` |
| 4 - prd | `- .planning/research/SUMMARY.md\n- .planning/pipeline/clarify.md` |
| 5 - deepen | `- .planning/pipeline/prd.md\n- .planning/pipeline/clarify.md` |
| 6 - resolve | `- .planning/pipeline/prd.md\n- .planning/pipeline/open-questions.md\n- .planning/pipeline/clarify.md` |
| 7 - convert | `- .planning/pipeline/prd.md` |
| 8 - execute | *(empty)* |
| 9 - review | *(empty)* |

**CODEMAP_FILES per phase:**

| Phase | CODEMAP_FILES Value |
|-------|---------------------|
| 1 - preflight | *(not used -- template has no {{CODEMAP_FILES}} placeholder)* |
| 2 - clarify | *(not used)* |
| 3 - research | `- .planning/codebase/STACK.md\n- .planning/codebase/ARCHITECTURE.md` |
| 4 - prd | `- .planning/codebase/ARCHITECTURE.md\n- .planning/codebase/STRUCTURE.md` |
| 5 - deepen | `- .planning/codebase/ARCHITECTURE.md\n- .planning/codebase/STRUCTURE.md` |
| 6 - resolve | *(not used)* |
| 7 - convert | *(not used)* |
| 8 - execute | *(not used)* |
| 9 - review | `- .planning/codebase/CONCERNS.md\n- .planning/codebase/CONVENTIONS.md` |

Pass `CODEMAP_FILES` to `fillTemplate` alongside existing variables (`PHASE_FILES`, `CWD`, etc.) for phases 3, 4, 5, and 9. For other phases, omit `CODEMAP_FILES` from the variables object -- their templates do not have the `{{CODEMAP_FILES}}` placeholder, so no substitution occurs.

Dispatch the filled template content as a **Task subagent** with `subagent_type: "general-purpose"`. This ensures the phase agent has full tool access including nested Task calls for phases that spawn parallel agents (research, deepen, review). The Task tool provides inherent context isolation -- the subagent runs in its own context window.

**Anti-pattern:** NEVER load phase output content into the orchestrator's own context. Pass file paths only.

**File write method:** Before dispatching, append this block to the end of every filled template:

> **CRITICAL — .planning/ file writes:** When writing ANY files under `.planning/` (completion files, output files, pipeline files), use the **Bash tool** with heredoc syntax, NOT the Write tool. The Write tool may be blocked by environment hooks for `.md` files. Example:
> ```bash
> cat > ".planning/pipeline/example.md" << 'PIPELINE_EOF'
> ---
> completed: true
> ---
> Content here
> PIPELINE_EOF
> ```

### Step 5: Completion Verification (Dual Check)

After the Task subagent returns, verify completion using both signals:

1. **Message check:** Look for `## PHASE COMPLETE` or `## PHASE FAILED` heading in the Task return message.
2. **File check:** Run `node {RALPH_TOOLS} --cwd {PROJECT_CWD} scan-phases` and check the phase's `completed` field.

**If both agree on complete:** Proceed to Step 6 (User Gate).

**If PHASE FAILED or completed is false:**
- Auto-retry once: re-dispatch the same phase as a fresh Task subagent (subagent_type: "general-purpose").
- If retry also fails: proceed to Step 6 with the failure gate.

### Step 6: User Gate

**YOLO Mode Bypass:**

Read mode from config (already available from Step 1 init output).

If mode is "yolo":

1. Skip AskUserQuestion entirely. Auto-approve the phase.
2. Run: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} state set Status "Phase {id} complete"`
3. Log: "YOLO mode: auto-approved phase {id} ({pipeline_display_name})"
4. Reset phase_retry_count: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set phase_retry_count 0`
5. **If phase {id} is 9 (review):** Run `node {RALPH_TOOLS} --cwd {PROJECT_CWD} phase-complete {current_phase}` and log: "Dev-phase {current_phase} marked complete."
6. Proceed directly to Step 7

If mode is NOT "yolo":

Gates are context-dependent -- options come from the phase's `gateOptions` array in `PIPELINE_PHASES`.

**For successful completion:**

First, get a summary excerpt of the phase output:

```bash
node {RALPH_TOOLS} --cwd {PROJECT_CWD} excerpt .planning/pipeline/{pipeline_phase}.md 20
```

If the excerpt command fails (file not found) or returns an empty excerpt:
  Set excerpt to: "No output available for this phase."

Then present the gate with the excerpt and context-dependent options:

```
## Phase {id}: {pipeline_display_name} Complete

{excerpt from phase output}

**Next steps:**
```

Show only the options defined in the phase's `gateOptions`:

- **approve** -- Accept output. Run: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} state set Status "Phase {id} complete"`. Then proceed to Step 7.
- **redirect** -- Spawn a **fresh** Task subagent (subagent_type: "general-purpose") with the original template content + the path to the existing output file + user feedback. Never resume a previous agent.
- **skip** -- Mark phase as completed (write `.planning/pipeline/{pipeline_phase}.md` with frontmatter only: `completed: true`), then proceed to Step 7.
- **replan** -- Clear auto_advance: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set auto_advance false`. Return to planning mode. Show: "Returning to planning. Re-invoke the pipeline when ready to resume."
- **retry** -- Re-dispatch the same phase as a fresh Task subagent (subagent_type: "general-purpose").
- **abort** -- Clear auto_advance: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set auto_advance false`. Stop the pipeline, preserve all state on disk. Show: "Pipeline paused at phase {id}. Re-invoke to resume."

**Phase Failure Auto-Retry (YOLO or auto mode):**

When a phase subagent returns a failure (completion file has `completed: false`):

Read mode and auto_advance from config:
```bash
MODE=$(node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-get mode --raw)
AUTO=$(node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-get auto_advance --raw)
RETRY_COUNT=$(node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-get phase_retry_count --raw)
```

If mode is "yolo" OR auto_advance is true:

1. Check retry count:
   - If phase_retry_count is null or 0: this is the first failure
     - Set phase_retry_count to 1: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set phase_retry_count 1`
     - Log: "Phase {id} ({pipeline_display_name}) failed. Auto-retrying once (attempt 2/2)..."
     - Re-dispatch the same phase (go back to Step 3 for the same phase_id)
   - If phase_retry_count >= 1: this is the second failure (retry exhausted)
     - Set auto_advance to false: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set auto_advance false`
     - Reset phase_retry_count to 0: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set phase_retry_count 0`
     - Log: "Phase {id} ({pipeline_display_name}) failed after retry. Pipeline stopped. State preserved for manual resume."
     - Stop the pipeline. Do NOT proceed to Step 7.
     - Show: "Pipeline paused (phase failed after retry). Re-invoke to resume from phase {id}."

2. On phase SUCCESS: always reset phase_retry_count to 0:
   `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set phase_retry_count 0`

If mode is NOT "yolo" AND auto_advance is NOT true:

**For failure (after auto-retry failed):**

Present failure-specific options:
- **retry** -- Re-dispatch same phase.
- **skip** -- Mark skipped, advance.
- **abort** -- Stop pipeline, preserve state.

### Step 6b: Dev-Phase Completion (after pipeline phase 9 only)

If the just-approved pipeline phase is phase 9 (review) -- meaning the full pipeline is done:

1. Get the dev-phase number from `current_phase` (from Step 1 init pipeline output). This is the dev-phase number (e.g., 11), NOT the pipeline phase number (9).
2. Run: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} phase-complete {current_phase}`
3. Parse output JSON: `{ completed, next_phase, date }`
4. Log: "Dev-phase {current_phase} marked complete. ROADMAP updated."
5. Reset phase_retry_count: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set phase_retry_count 0`

If the just-approved phase is NOT phase 9: skip this step entirely. Dev-phase completion only happens when the full pipeline finishes.

**Why only after phase 9:** ROADMAP checkbox is binary (complete/not complete). The dev-phase is only "done" when all 9 pipeline phases finish. Calling phase-complete mid-pipeline would prematurely mark the ROADMAP checkbox and advance STATE.md to the next dev-phase.

### Step 7: /clear Boundary (with Time Budget and Auto-Advance)

After a phase is approved or skipped:

**Step 7a: Time Budget Check**

If `time_budget_expires` is set in config:

```bash
node {RALPH_TOOLS} --cwd {PROJECT_CWD} time-budget check
```

Parse JSON output: `{ has_budget, expired, remaining_ms, remaining_display }`

If expired:
- Set auto_advance to false: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set auto_advance false`
- Log: "Time budget expired. Pipeline paused after phase {id} ({pipeline_display_name})."
- Stop -- do not dispatch next phase. Show:
  "Pipeline paused (time budget expired). Re-invoke to resume."

If not expired:
- Log: "Time remaining: {remaining_display}"
- Run: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} time-budget estimate`
- Log: "Estimated {estimated_beads_remaining} more beads possible."
- Continue to Step 7b.

If no time budget set: continue to Step 7b.

**Step 7b: Post-Execution Codemap Refresh**

If the just-completed phase is 8 (execute) and the next phase to dispatch is 9 (review):

1. Always refresh codemaps (bypass freshness check -- execution definitionally makes codemaps stale):
   - Read the codemap template: `templates/codemap.md`
   - Fill template variables (`CWD`, `RALPH_TOOLS`)
   - Dispatch as Task subagent (subagent_type: "general-purpose")
   - Wait for completion
   - Log: "Codemaps refreshed after execution"

This ensures review agents receive post-execution context (updated CONCERNS.md reflecting any new issues introduced by bead execution).

If the just-completed phase is NOT 8: skip this step.

**Step 7c: /clear Boundary**

Check the workflow mode (auto_advance from Step 1 init output):

**Manual mode** (auto_advance is false, default): Suggest a context boundary:
```
Phase {id} ({pipeline_display_name}) is complete. Run /clear for fresh context, then re-invoke the pipeline to continue with Phase {next_id} ({next_pipeline_display_name}).
```

**Auto mode** (auto_advance is true):
1. Set auto_advance to true in config (ensure it persists): `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set auto_advance true`
2. Log: "Auto-advance: proceeding to phase {next_id} ({next_pipeline_display_name})"
3. Suggest /clear: "Run /clear now. The auto-advance hook will re-invoke the pipeline automatically."
   Note: In auto mode, the user should not need to do anything after /clear. The SessionStart hook handles re-invocation.

**Auto-Advance Cleanup:**

When the pipeline stops for ANY reason, clear auto_advance:
- Pipeline complete (all 9 phases done): `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set auto_advance false`
- Phase failure after auto-retry: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set auto_advance false`
- User selects abort at any gate: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set auto_advance false`
- Time budget expired (handled in Step 7a): already clears auto_advance
- User selects replan: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set auto_advance false`

This prevents the SessionStart hook from entering an infinite restart loop.

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
| `time-budget start <hours>` | Start a time budget. Sets absolute expiry timestamp in config.json. Example: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} time-budget start 4` |
| `time-budget check` | Check budget status. Returns JSON: `has_budget`, `expired`, `remaining_ms`, `remaining_display`. Used at phase boundaries (Step 7a) |
| `time-budget record-bead <ms>` | Record bead execution duration in milliseconds. Updates weighted running average for future estimates. Example: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} time-budget record-bead 120000` |
| `time-budget estimate` | Estimate remaining beads within budget. Returns `estimated_beads_remaining`, `avg_bead_duration_ms`, `avg_bead_duration_display`. Uses recorded history or 20-min default on first run |
| `codemap check` | Check codemap freshness. Returns JSON: `exists`, `fresh` |
| `codemap paths` | List all 7 codemap file paths |
| `codemap age` | Get codemap age info: `exists`, `age_hours`, `oldest_file`, `youngest_file` |
| `help` | List all available commands |

**YOLO mode** uses the same time-budget subcommands: `start` is called if `time_budget_hours` is pre-configured; `check` runs at phase boundaries; `record-bead` runs after each headless bead execution; `estimate` runs after budget check. No YOLO-specific subcommands exist.

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
