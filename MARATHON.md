---
name: ralph-marathon
description: "Marathon planning mode -- chains phases 1-7 (preflight through convert) in a single unattended run with /clear between phases. Produces a complete bead inventory for review before execution. Invoke to plan everything upfront. Triggers on: ralph marathon, marathon mode, plan everything, marathon plan, ralph marathon mode."
---

# Ralph Marathon

Chain all planning phases (1-7) in one marathon run with /clear between each phase. Marathon mode plans everything upfront -- it never executes beads. Time budget is stored but not started until execution begins separately via the standard pipeline.

## Phases

1. **Pre-flight** -- Check/install missing skills, CLIs, GSD reference, .gitignore
2. **Clarify** -- Scope, stack, quality gates, agent selection
3. **Research** -- Parallel agents: repo-research, best-practices, framework-docs, learnings
4. **PRD** -- Create PRD via /ralph-tui-prd with tracer bullet story ordering
5. **Deepen** -- Parallel review agents against PRD (security, architecture, simplicity, performance)
6. **Resolve** -- Blocking gate: resolve all open questions before conversion
7. **Convert** -- Beads (bd/br) or prd.json via /ralph-tui-create-beads

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

### Step 1b: Setup Wizard

**YOLO skip rule:** If mode is already `"yolo"`, skip the full wizard. Use existing config values. Only prompt for `bead_format` if not already set (check via `config-get bead_format --raw` -- if it errors with CONFIG_KEY_NOT_FOUND, prompt for it). After skipping, jump directly to setting the marathon flag.

If `config.marathon` is not `true` (first marathon run or fresh start), present three questions sequentially:

**Question 1: Time Budget**

AskUserQuestion:
- **Header:** "Time Budget"
- **Question:** "How many hours for execution? (Planning has no time limit)"
- **Options:**
  1. **2 hours** -- Short session
  2. **4 hours** -- Standard session
  3. **8 hours** -- Extended session
  4. **No limit** -- Run until completion
  5. **Custom** -- I will specify

If user selects a number: Store via `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set marathon_time_budget_hours {hours}`
If user selects "No limit": Skip storage. Log: "No time budget set. Planning has no time limit regardless."
If user selects "Custom": Ask follow-up for the number of hours, then store.

**CRITICAL:** Do NOT call `time-budget start`. The time budget is deferred until the execute phase begins (outside marathon scope). Only store the desired hours in config.

**Question 2: Bead Format**

AskUserQuestion:
- **Header:** "Bead Format"
- **Question:** "Which bead output format?"
- **Options:**
  1. **bd** -- Go beads via /ralph-tui-create-beads
  2. **br** -- Rust beads via /ralph-tui-create-beads-rust
  3. **prd.json** -- JSON format via /ralph-tui-create-json

Store via `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set bead_format {format}`

**Question 3: YOLO Mode**

AskUserQuestion:
- **Header:** "Mode"
- **Question:** "Auto-approve all planning gates?"
- **Options:**
  1. **Yes** -- YOLO mode (fully unattended planning)
  2. **No** -- Interactive (pause at each gate)

If "Yes": `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set mode yolo`
If "No": `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set mode normal`

**After wizard (or YOLO skip), set the marathon flag:**

```bash
node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set marathon true
```

Log: "Marathon mode active. Chaining phases 1-7."

### Step 2: Position Detection

Scan the disk for the actual pipeline position:

```bash
node {RALPH_TOOLS} --cwd {PROJECT_CWD} scan-phases
```

Parse the JSON array output. **Filter to phases 1-7 only** (ids 1 through 7). Find the first phase where `completed` is false.

- **If a phase is incomplete:** Set that as the current dispatch target.
- **If all 7 are complete:** Skip directly to the bead review gate (proceed to Step 8: Bead Inventory Review Gate below).

Marathon is resumable: if phases 1-3 are complete, resume from phase 4.

### Step 3: Status Banner

Display marathon-specific progress:

```
## Marathon Planning Status

**Phase:** {id} of 7 ({pipeline_display_name})
**Mode:** Marathon (planning only)
**Progress:** [{progress_bar}] {percent}%

Phase 1: Pre-flight -- {done|pending}
Phase 2: Clarify -- {done|pending}
Phase 3: Research -- {done|pending}
Phase 4: PRD -- {done|pending}
Phase 5: Deepen -- {done|pending}
Phase 6: Resolve -- {done|pending}
Phase 7: Convert -- {done|pending}
```

The progress bar uses `#` for completed phases and `-` for remaining. Example: `[###----]` for 3/7 complete = 43%.

Auto-skip completed phases with a log line each: `Phase {id} ({pipeline_display_name}): already complete, skipping.`

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

Fill template variables using `fillTemplate` logic. `PIPELINE_DISPLAY_NAME` comes from `phase.displayName` and `PIPELINE_PHASE` comes from `phase.slug` in the PIPELINE_PHASES array:

| Variable | Value |
|----------|-------|
| `{{CWD}}` | Current working directory (PROJECT_CWD from Step 0) |
| `{{RALPH_TOOLS}}` | Absolute path to `ralph-tools.cjs` (RALPH_TOOLS from Step 0) |
| `{{PIPELINE_DISPLAY_NAME}}` | Pipeline phase display name from PIPELINE_PHASES (e.g., "Research", "PRD", "Pre-flight") |
| `{{PIPELINE_PHASE}}` | Pipeline phase slug from PIPELINE_PHASES (e.g., "research", "prd", "preflight") |
| `{{PHASE_ID}}` | Phase number (1-7) |
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

Pass `CODEMAP_FILES` to `fillTemplate` alongside existing variables for phases 3, 4, and 5. For other phases, omit `CODEMAP_FILES` from the variables object -- their templates do not have the `{{CODEMAP_FILES}}` placeholder, so no substitution occurs.

Dispatch the filled template content as a **Task subagent** with `subagent_type: "general-purpose"`. This ensures the phase agent has full tool access including nested Task calls for phases that spawn parallel agents (research, deepen).

**Anti-pattern:** NEVER load phase output content into the orchestrator's own context. Pass file paths only.

**File write method:** Before dispatching, append this block to the end of every filled template:

> **CRITICAL -- .planning/ file writes:** When writing ANY files under `.planning/` (completion files, output files, pipeline files), use the **Bash tool** with heredoc syntax, NOT the Write tool. The Write tool may be blocked by environment hooks for `.md` files. Example:
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
5. Proceed directly to Step 6b then Step 7.

**Important:** Do NOT call `phase-complete`. Marathon never marks dev-phases complete. Do NOT check for phase 9 -- marathon stops at phase 7.

If mode is NOT "yolo":

Gates are context-dependent -- options come from the phase's `gateOptions` array in PIPELINE_PHASES.

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

- **approve** -- Accept output. Run: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} state set Status "Phase {id} complete"`. Then proceed to Step 6b then Step 7.
- **redirect** -- Spawn a **fresh** Task subagent (subagent_type: "general-purpose") with the original template content + the path to the existing output file + user feedback. Never resume a previous agent.
- **skip** -- Mark phase as completed (write `.planning/pipeline/{pipeline_phase}.md` with frontmatter only: `completed: true`), then proceed to Step 6b then Step 7.
- **replan** -- Return to planning mode. Show: "Returning to planning. Re-invoke marathon when ready to resume."
- **retry** -- Re-dispatch the same phase as a fresh Task subagent (subagent_type: "general-purpose").
- **abort** -- Stop the pipeline, preserve all state on disk. Show: "Marathon paused at phase {id}. Re-invoke to resume."

**Phase Failure Auto-Retry:**

When a phase subagent returns a failure (completion file has `completed: false`):

Read mode from config:
```bash
MODE=$(node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-get mode --raw)
RETRY_COUNT=$(node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-get phase_retry_count --raw)
```

If mode is "yolo":

1. Check retry count:
   - If phase_retry_count is null or 0: this is the first failure
     - Set phase_retry_count to 1: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set phase_retry_count 1`
     - Log: "Phase {id} ({pipeline_display_name}) failed. Auto-retrying once (attempt 2/2)..."
     - Re-dispatch the same phase (go back to Step 3b/Step 4 for the same phase_id)
   - If phase_retry_count >= 1: this is the second failure (retry exhausted)
     - Reset phase_retry_count to 0: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set phase_retry_count 0`
     - Log: "Phase {id} ({pipeline_display_name}) failed after retry. Marathon stopped. State preserved for manual resume."
     - Stop the marathon. Do NOT proceed to Step 7.
     - Show: "Marathon paused (phase failed after retry). Re-invoke to resume from phase {id}."

2. On phase SUCCESS: always reset phase_retry_count to 0:
   `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set phase_retry_count 0`

If mode is NOT "yolo":

**For failure (after auto-retry failed):**

Present failure-specific options:
- **retry** -- Re-dispatch same phase.
- **skip** -- Mark skipped, advance.
- **abort** -- Stop marathon, preserve state.

### Step 6b: Clean .beads/ before Convert

If the **next** phase to dispatch is 7 (convert), clear stale beads from a previous marathon run:

```bash
rm -f {PROJECT_CWD}/.beads/*.md 2>/dev/null
```

This prevents stale beads from a previous marathon run mixing with fresh beads. Log: "Cleared stale beads before convert phase."

If the next phase is NOT 7: skip this step.

### Step 7: /clear Boundary

After a phase is approved or skipped:

**No time budget check.** Planning is never budget-constrained. Marathon stores the time budget but does not start or check it.

**No post-execution codemap refresh.** Marathon never executes, so there is no execution-triggered codemap staleness.

**Loop termination check:** If the just-completed phase is 7 (convert), do NOT continue the loop. Proceed to Step 8: Bead Inventory Review Gate (see below).

**If the just-completed phase is NOT 7:**

Read mode from config (already available):

**Manual mode** (mode is NOT "yolo"): Suggest a context boundary:
```
Phase {id} ({pipeline_display_name}) is complete. Run /clear for fresh context, then re-invoke marathon to continue with Phase {next_id} ({next_pipeline_display_name}).
```

**YOLO mode** (mode is "yolo"):
1. Log: "YOLO: proceeding to phase {next_id} ({next_pipeline_display_name})"
2. Suggest /clear: "Run /clear now. Re-invoke marathon to continue."
   Note: In YOLO mode, all gates are auto-approved, but /clear still provides fresh context.

After /clear, the marathon loop continues -- re-invoking marathon will pick up from the next incomplete phase via scan-phases (Step 2).

**Anti-pattern:** NEVER store pipeline position in JavaScript variables that won't survive /clear. Always re-read from disk via `ralph-tools.cjs init pipeline` and `scan-phases`.

---

## Step 8: Bead Inventory Review Gate

After phase 7 (convert) completes and is approved, present the bead inventory for review.

**8.1 List bead files:**

```bash
ls {PROJECT_CWD}/.beads/*.md 2>/dev/null | sort
```

If zero beads found:
- Log: "No beads found after convert phase. Something went wrong."
- Clean up config: `node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set marathon false`
- Stop marathon with error message. Do NOT continue.

**8.2 Build inventory table:**

For each bead file, read its content and extract:
- **Bead name:** From filename, strip `.md` extension
- **Type:** Check if filename contains `bd` or `br` pattern, or read `type` from frontmatter if present
- **Estimated complexity:** Count non-frontmatter lines (body lines). If frontmatter has a `complexity` field, use that instead. Otherwise: <20 lines = Low, 20-50 lines = Medium, >50 lines = High
- **Source:** Extract `story_id` from frontmatter, or parse story ID from filename (e.g., "US-001" from "US-001-auth-flow.md")

Use `extractFrontmatter()` logic (parse `---` delimited YAML at top of file) to read frontmatter fields. Count body lines (everything after the closing `---`) for complexity estimation.

**8.3 Present the inventory:**

```
## Bead Inventory Review

| # | Bead | Type | Complexity | Source |
|---|------|------|------------|--------|
| 1 | US-001-auth-flow | bd | Medium | US-001 |
| 2 | US-002-dashboard | bd | High | US-002 |
...

**Total:** {N} beads
**Estimated execution time:** {estimate}h (based on {low_count} Low, {med_count} Medium, {high_count} High)
```

Time estimate heuristic: Low = 10min, Medium = 20min, High = 40min per bead. Sum and convert to hours.

**8.4 Check YOLO mode:**

```bash
node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-get mode --raw
```

**If YOLO:**
- Auto-approve all beads
- Log: "YOLO mode: auto-approved all {N} beads"
- Skip directly to Step 10 (Marathon Complete)

**If NOT YOLO:**

Present options via AskUserQuestion:
- **Header:** "Bead Inventory Review"
- **Question:** "Review the bead inventory above. Choose how to proceed:"
- **Options:**
  1. **Approve all** -- Accept all beads and stop marathon
  2. **Drop beads** -- Specify which beads to exclude from execution
  3. **Reject** -- Return to Resolve phase to fix open questions, then re-run Convert

Handle responses:

**If "Approve all" (or "1"):** Proceed to Step 10 (Marathon Complete).

**If "Drop beads" (or "2"):**
- Ask: "Which beads should be dropped? Enter bead numbers (e.g., '2, 5, 7') or bead names:"
- Parse user response to identify which beads to remove
- Delete the specified bead files from `.beads/`:
  ```bash
  rm -f {PROJECT_CWD}/.beads/{BEAD_NAME}.md
  ```
- Log: "Dropped {N} beads. {remaining} beads remain."
- Re-display the updated inventory table (without dropped beads)
- Re-present the same 3 options (user may want to drop more or approve)

**If "Reject" (or "3"):** Proceed to Step 9 (Reject-to-Resolve Loop).

---

## Step 9: Reject-to-Resolve Loop

When user rejects the bead inventory:

**9.1 Reset resolve and convert phase outputs** to force re-execution:

```bash
rm -f {PROJECT_CWD}/.planning/pipeline/resolve.md
rm -f {PROJECT_CWD}/.planning/pipeline/convert.md
```

**9.2 Clear stale beads:**

```bash
rm -f {PROJECT_CWD}/.beads/*.md 2>/dev/null
```

**9.3** Log: "Returning to Resolve phase. Fix open questions, then Convert will re-run."

**9.4 Re-enter the marathon phase loop** starting from Step 2 (Position Detection). The `scan-phases` check will see phase 6 (resolve) as incomplete (file deleted) and dispatch it, followed by phase 7 (convert, also deleted), which will produce new beads and return to Step 8 (bead review gate).

**IMPORTANT:** The loop re-entry point is Step 2 (Position Detection) -- scan-phases will naturally find phase 6 as the first incomplete phase and resume from there. Do NOT clean up `config.marathon` on rejection -- the loop continues.

---

## Step 10: Marathon Complete

After bead review is approved (or auto-approved by YOLO):

**10.1 Log final summary:**

```
## Marathon Planning Complete

All 7 planning phases finished. Bead inventory approved.

**Beads ready:** {N} beads in .beads/
**Bead format:** {format from config}
**Time budget:** {marathon_time_budget_hours}h (will start when execution begins)

To execute, run the standard pipeline:
  /ralph-pipeline

The pipeline will detect marathon-completed planning (phases 1-7 done),
skip to phase 8 (execute), and start the time budget at that point.
```

**10.2 Clean up marathon-specific config:**

```bash
node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set marathon false
```

Note: Do NOT clear `marathon_time_budget_hours` -- the standard pipeline needs this value to start the time budget when execution begins. Do NOT clear `bead_format` -- it persists for the project.

**10.3 Clear auto_advance if set:**

```bash
node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set auto_advance false
```

**10.4 Stop.** Marathon never dispatches execute or review phases.

---

## Config Cleanup on Any Stop

Whenever marathon stops for ANY reason (completion, abort, error), ensure `config.marathon` is set to false:

```bash
node {RALPH_TOOLS} --cwd {PROJECT_CWD} config-set marathon false
```

This prevents the standard pipeline from seeing stale marathon state.

**Exception:** The reject-to-resolve loop (Step 9) does NOT clean up marathon -- it re-enters the loop and marathon remains active.

**Terminal stop scenarios that require cleanup:**
- Step 10: Marathon Complete (normal finish)
- Step 8.1: No beads found (error stop)
- YOLO retry exhaustion (phase failed after retry)
- User selects "abort" at any gate
- Any unrecoverable error during phase dispatch

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `init pipeline` | Load all project state in one call (config, state, phase info, file checks) |
| `scan-phases` | Scan pipeline phases: completion status of all 9 phases |
| `config-get [key]` | Get config value by dot-notation key, or dump full config |
| `config-set <key> <value>` | Set config value with type coercion |
| `state set <field> <value>` | Replace a field value in STATE.md (with frontmatter sync) |
| `excerpt <file> [N]` | Extract first N non-frontmatter lines from a file |
| `codemap check` | Check codemap freshness. Returns JSON: `exists`, `fresh` |
| `help` | List all available commands |

**Marathon-specific config keys:**

| Key | Type | Description |
|-----|------|-------------|
| `marathon` | boolean | Whether marathon mode is active. Set to `true` at marathon start. |
| `marathon_time_budget_hours` | number | Deferred time budget for execution phase. Stored but NOT started during planning. |
| `bead_format` | string | Bead output format: `bd`, `br`, or `prd.json`. |
| `mode` | string | Workflow mode: `yolo` (auto-approve all gates) or `normal` (interactive). |
| `phase_retry_count` | number | Tracks auto-retry attempts for the current phase. Reset to 0 on success. |

All commands accept `--cwd <path>` and `--raw` flags.

## Architecture

This skill uses /clear between phases. Each phase runs in a fresh Claude session (/clear between phases). State lives on disk in `.planning/` so progress survives any session boundary.

**Key files:**
- `.planning/STATE.md` -- Current phase, plan, status, progress
- `.planning/config.json` -- Workflow preferences (mode, depth, marathon flags)
- `ralph-tools.cjs` -- CLI entry point (zero npm dependencies)
- `lib/orchestrator.cjs` -- Pipeline scanning, position detection, template filling
- `templates/` -- Phase template stubs (reused from standard pipeline, phases 1-7)

**State flow:**
1. Orchestrator calls `ralph-tools.cjs init pipeline` to load context
2. Setup wizard collects config (time budget, bead format, YOLO) in one pass
3. Sets `config.marathon = true` to signal marathon mode
4. Runs `ralph-tools.cjs scan-phases` to detect position from disk (phases 1-7 only)
5. Reads template from `templates/{phase}.md`, fills variables via `fillTemplate`
6. Dispatches filled template as Task subagent (context-isolated)
7. Verifies completion: checks Task return message + scans output files
8. Presents context-dependent user gate (YOLO auto-approves, otherwise phase-specific options)
9. Suggests `/clear` for fresh context, then loop continues from next incomplete phase
10. After phase 7 (convert) completes, proceeds to bead inventory review gate (Step 8)
