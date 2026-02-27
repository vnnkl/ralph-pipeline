<objective>
Execute {{PIPELINE_DISPLAY_NAME}} phase ({{PHASE_ID}} of 9) for the current pipeline project.

Run pre-flight environment checks, display results, handle setup actions interactively, and block pipeline if required dependencies are missing.
</objective>

<files_to_read>
- {{STATE_PATH}}
- {{CONFIG_PATH}}
{{PHASE_FILES}}
</files_to_read>

<instructions>
<!-- YOLO mode: gate bypass handled by orchestrator (SKILL.md Step 6) -->
## Pre-flight Phase

You are a pre-flight checker. Your job is to validate that all required dependencies are present before the pipeline starts, display results, handle setup actions, and block if anything required is missing.

### Step 1: Read Context

Read the files listed in files_to_read above.

### Step 1.5: Check YOLO Mode

Run:
```bash
node {{RALPH_TOOLS}} --cwd {{CWD}} config-get mode --raw
```

If the result is "yolo", set YOLO_MODE = true. Otherwise, set YOLO_MODE = false.

### Step 2: Run Preflight Checks

Run the preflight CLI command and capture both stdout and the exit code:

```bash
node {{RALPH_TOOLS}} --cwd {{CWD}} preflight --raw
```

**If exit code is 0 (passed):**

Parse the JSON from stdout. Extract counts and display a checklist summary:

```
## Pre-flight Results

- Skills: {found}/{total} found
- MCP servers: {found}/{total} found
- GSD reference: {version} ({source})
- IDE: {ide value or "not set"}
```

Count found items by subtracting missing required items of each type from the known totals (2 skills, 1 MCP server).

If the `missing` array contains any items with `required: false` (optional CLIs), display them as non-blocking warnings:

```
### Optional (non-blocking)

- {name}: {purpose} -- {install_hint}
```

Proceed to Step 3.

**If exit code is 1 (failed):**

Parse stdout (NOT stderr) for the full result JSON. The `passed` field will be `false`.

Extract all items from the `missing` array where `required: true`. Display each one:

```
## Pre-flight Failed

The following required dependencies are missing:

- [{type}] {name}: {purpose}
  Install: {install_hint}
```

If YOLO_MODE is true:
- Log: "YOLO mode cannot bypass missing required dependencies."
- Return: ## PHASE FAILED

If YOLO_MODE is false:
- Present via AskUserQuestion:
  - Header: "Pre-flight"
  - Question: "Required dependencies are missing. How would you like to proceed?"
  - Options:
    1. Install and retry -- Install the missing items, then re-run preflight
    2. Retry -- Re-run preflight checks without installing
    3. Abort pipeline -- Stop the pipeline

- If user selects option 1 or 2: Re-run `node {{RALPH_TOOLS}} --cwd {{CWD}} preflight --raw` (go back to the start of Step 2). Maximum 3 retries total. After 3 failed retries, return: ## PHASE FAILED
- If user selects option 3: Return: ## PHASE FAILED

### Step 3: Handle Setup Actions

From the preflight result JSON, iterate the `setup_actions` array. For each action:

**add_gitignore:**
```bash
node {{RALPH_TOOLS}} --cwd {{CWD}} setup-gitignore {pattern}
```
Log: "Added {pattern} to .gitignore"

**init_planning:**
```bash
mkdir -p .planning
```
For each file in the action's `missing_files` array, create the file if it does not already exist. Log: "Created .planning/{filename}"

For STATE.md specifically, use this exact template (replace `{today}` with today's date in YYYY-MM-DD format):

```markdown
# Pipeline State

## Current Position

Phase: 1 of 9 (Preflight)
Status: Starting
Last activity: {today}

Progress: [----------] 0%

## Session Continuity

Last session: {today}
Stopped at: Pipeline starting
```

For other files (ROADMAP.md, PROJECT.md), create a minimal placeholder with a heading.

**ask_ide:**

If YOLO_MODE is true:
- Default to "vscode" without asking:
  ```bash
  node {{RALPH_TOOLS}} --cwd {{CWD}} config-set ide vscode
  ```
  Log: "YOLO mode: defaulted IDE to vscode"

If YOLO_MODE is false:
- Present via AskUserQuestion:
  - Header: "IDE"
  - Question: "Which IDE/editor do you use?"
  - Options: Use the options array from the action (e.g., vscode, cursor, zed, neovim, other)
- Then run:
  ```bash
  node {{RALPH_TOOLS}} --cwd {{CWD}} config-set ide {user_choice}
  ```

If `setup_actions` is empty, log: "No setup actions needed."

### Step 4: Write Completion File

Write the completion output file to `.planning/pipeline/preflight.md` with this structure:

```yaml
---
completed: true
passed: true
missing_optional:
  - {list of optional missing item names, or empty array}
setup_actions_taken:
  - {list of setup action names performed, or empty array}
ide: {configured IDE value}
---
```

Body: Include a brief summary of the preflight results:

```
## Pre-flight Summary

All required dependencies present. Pipeline ready to proceed.

**Skills:** {count} found
**MCP Servers:** {count} found
**GSD Reference:** {version} ({source})
**IDE:** {ide}
```

### Step 5: Return Completion

Return:

## PHASE COMPLETE

</instructions>

<success_criteria>
- Output file exists at .planning/pipeline/{{PIPELINE_PHASE}}.md
- Output file has `completed: true` in frontmatter
- CLI was invoked via `node {{RALPH_TOOLS}} --cwd {{CWD}} preflight --raw`
- Results displayed as checklist summary
- Failures gated via AskUserQuestion with Install and retry / Retry / Abort options
- Setup actions handled (gitignore, planning dir, IDE preference)
- YOLO mode auto-executes setup actions, defaults IDE to vscode, still blocks on required failures
</success_criteria>
