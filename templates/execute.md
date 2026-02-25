<objective>
Execute {{PHASE_NAME}} phase ({{PHASE_ID}} of 9) for the current pipeline project.

Orchestrate bead execution -- either headless via claude -p per bead or manual via ralph-tui -- writing status-only result files and reporting progress. Presents an execution gate with manual as the default option.
</objective>

<files_to_read>
- {{STATE_PATH}}
- {{CONFIG_PATH}}
{{PHASE_FILES}}
</files_to_read>

<instructions>
## Execute Phase

You are an execution orchestrator. Your job is to present the execution gate (manual or headless), orchestrate bead execution, write status-only result files, and report progress.

### Step 1: Read Context

Read the files listed in files_to_read above.

Discover beads by listing the .beads/ directory:

```bash
ls .beads/*.md 2>/dev/null | sort
```

Count total beads. Store as `TOTAL_BEADS`.

If zero beads found:
- Return: `## PHASE FAILED\n\nNo beads found in .beads/. Run the convert phase first.`

Report: "Found {TOTAL_BEADS} beads ready for execution."

### Step 2: Present Execution Gate

Present the execution mode choice to the user. Manual is the DEFAULT option.

Use AskUserQuestion with these options:

1. **Manual** (DEFAULT) -- Launch ralph-tui for interactive execution. You control the process and signal back when done.
2. **Headless** -- Run claude -p per bead automatically. The pipeline executes each bead sequentially and reports progress.

Wait for the user's response.

### Step 3a: Manual Mode

If the user chooses **Manual** (or "1" or "manual"):

1. Show the ralph-tui launch command:
   ```
   To execute your beads interactively, run ralph-tui in your project directory:

     ralph-tui

   This will pick up the beads in .beads/ and let you execute them one by one with full visibility.

   When finished, signal back here with your results.
   ```

2. Wait for the user to respond. They will signal when done.

3. After the user signals, scan for result files:
   ```bash
   ls .claude/pipeline/bead-results/*.md 2>/dev/null
   ```

4. If result files exist, aggregate them (skip to Step 5).

5. If no result files exist, ask the user:
   ```
   No result files found in .claude/pipeline/bead-results/. How did execution go?

   1. **All passed** -- Mark all beads as passed
   2. **Let me specify** -- I will list which beads passed/failed
   ```

   If "All passed": create result files for each bead with `status: passed`.
   If "Let me specify": ask the user to provide the status for each bead, then write result files accordingly.

6. Skip to Step 5 (Aggregate Results).

### Step 3b: Headless Mode

If the user chooses **Headless** (or "2" or "headless"):

1. Record the pre-execution git commit for review phase scoping:
   ```bash
   PRE_EXEC_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "none")
   ```

2. Save the pre-exec commit for the review phase:
   ```bash
   mkdir -p .claude/pipeline
   echo "$PRE_EXEC_COMMIT" > .claude/pipeline/pre-exec-commit.txt
   ```

3. Create the results directory:
   ```bash
   mkdir -p .claude/pipeline/bead-results
   ```

4. Build the ordered list of beads from Glob results (sorted alphabetically).

5. Proceed to Step 4 (Sequential Bead Execution).

### Step 4: Sequential Bead Execution (headless only)

For each bead in the ordered list, execute sequentially. Track counters: `PASSED=0`, `FAILED=0`, `FAILED_BEAD=""`.

For each bead:

1. Extract the bead name:
   ```bash
   BEAD_NAME=$(basename "$bead" .md)
   ```

2. Report progress:
   ```
   Executing bead {i}/{TOTAL_BEADS}: {BEAD_NAME}
   ```

3. Read the bead file content.

4. Execute the bead via Bash. CRITICAL: Must use `env -u CLAUDECODE` to avoid nested session error (Pitfall 3 from research):
   ```bash
   cat "{{CWD}}/.beads/{BEAD_NAME}.md" | env -u CLAUDECODE claude -p \
     --allowedTools "Read,Edit,Bash,Grep,Glob,Write" \
     --output-format json \
     --dangerously-skip-permissions
   ```
   For large beads, use stdin piping as shown above rather than passing content as a command-line argument.

   IMPORTANT: Do NOT use `--max-turns` (deprecated). If cost control is needed, use `--max-budget-usd`.

5. Capture the exit code. Exit 0 = passed, non-zero = failed.

6. Write the result file to `.claude/pipeline/bead-results/{BEAD_NAME}.md`:
   ```bash
   cat > ".claude/pipeline/bead-results/${BEAD_NAME}.md" << 'RESULT_EOF'
   ---
   status: {passed|failed}
   bead: {BEAD_NAME}
   executed: {ISO8601 timestamp from date -u +"%Y-%m-%dT%H:%M:%SZ"}
   ---
   RESULT_EOF
   ```

7. Report result:
   ```
     -> {PASSED|FAILED}
   ```

8. If FAILED: STOP the batch immediately (locked decision). Report:
   ```
   Batch stopped. {PASSED}/{TOTAL_BEADS} beads passed, 1 failed.
   Failed bead: {BEAD_NAME}
   ```
   Set `FAILED_BEAD="{BEAD_NAME}"`. Do NOT continue to remaining beads.

After the loop completes (all passed or stopped on failure), proceed to Step 5.

### Step 5: Aggregate Results

After execution completes (all beads passed, or batch stopped on failure, or manual mode results collected):

1. Count results from result files:
   ```bash
   PASSED=$(grep -rl "status: passed" .claude/pipeline/bead-results/ 2>/dev/null | wc -l | tr -d ' ')
   FAILED=$(grep -rl "status: failed" .claude/pipeline/bead-results/ 2>/dev/null | wc -l | tr -d ' ')
   BLOCKED=$(grep -rl "status: blocked" .claude/pipeline/bead-results/ 2>/dev/null | wc -l | tr -d ' ')
   ```

2. Report summary:
   ```
   Execution Results: {PASSED} passed, {FAILED} failed, {BLOCKED} blocked out of {TOTAL_BEADS} beads.
   ```

3. If any bead failed, proceed to Step 6 (Handle Failure). Otherwise, skip to Step 7 (Write Completion File).

### Step 6: Handle Failure

If any bead failed, present the failure gate:

```
## Execution Failure Gate

{PASSED} passed, {FAILED} failed out of {TOTAL_BEADS} beads.
Failed bead: {FAILED_BEAD}

Choose one:

1. **Re-run {FAILED_BEAD}** -- Re-execute only the failed bead (targeted re-execution)
2. **Retry all** -- Re-run the entire batch from the start (clears all result files first)
3. **Proceed** -- Accept partial results and continue to the review phase
4. **Abort** -- Stop the pipeline
```

Wait for the user's response.

**If user selects "Re-run {FAILED_BEAD}" (or "1" or "re-run"):**
- Re-execute ONLY that specific bead using the same claude -p pattern from Step 4
- Update its result file in `.claude/pipeline/bead-results/{FAILED_BEAD}.md`
- Re-aggregate results (back to Step 5)

**If user selects "Retry all" (or "2" or "retry"):**
- Clear all existing result files:
  ```bash
  rm -f .claude/pipeline/bead-results/*.md
  ```
- Go back to Step 4 (re-run the entire batch from scratch)

**If user selects "Proceed" (or "3" or "proceed"):**
- Accept partial results and continue to Step 7

**If user selects "Abort" (or "4" or "abort"):**
- Write completion file with `completed: false`
- Return: `## PHASE FAILED\n\nPipeline aborted by user after bead failure.`

### Step 7: Write Completion File

Determine the execution mode (`headless` or `manual`) based on the gate choice from Step 2.

Read the pre-exec commit if in headless mode:
```bash
PRE_EXEC_COMMIT=$(cat .claude/pipeline/pre-exec-commit.txt 2>/dev/null || echo "none")
```

Write `.planning/pipeline/execute.md` with this structure:

```yaml
---
completed: true
mode: {headless|manual}
total_beads: {TOTAL_BEADS}
passed: {PASSED count}
failed: {FAILED count}
blocked: {BLOCKED count}
pre_exec_commit: {commit hash, or "none" for manual mode}
---
```

Body: Include a results table with per-bead status:

```markdown
## Execution Results

| Bead | Status | Executed |
|------|--------|----------|
| {BEAD_NAME} | {passed/failed/blocked} | {timestamp} |
| ... | ... | ... |

**Mode:** {headless|manual}
**Total:** {TOTAL_BEADS}
**Passed:** {PASSED}
**Failed:** {FAILED}
**Blocked:** {BLOCKED}
```

Build this table by reading each result file in `.claude/pipeline/bead-results/` and extracting the frontmatter fields.

### Step 8: Return Completion

- If all beads passed or user chose "Proceed" at the failure gate:
  Return: `## PHASE COMPLETE`

- If user chose "Abort" at the failure gate:
  Return: `## PHASE FAILED`

</instructions>

<success_criteria>
- Output file exists at .planning/pipeline/{{PHASE_SLUG}}.md with `completed: true` in frontmatter
- Execution gate presented manual (default) and headless options
- If headless: pre-exec commit recorded in .claude/pipeline/pre-exec-commit.txt
- If headless: each bead executed via `env -u CLAUDECODE claude -p` with `--allowedTools` and `--output-format json`
- Bead execution is sequential with stop-on-failure
- Result files written to .claude/pipeline/bead-results/{BEAD_NAME}.md with status-only YAML frontmatter
- Bead-level progress displayed during execution
- On failure: re-run bead X / retry all / proceed / abort gate presented
- Results aggregated with pass/fail/blocked counts
- No external quality gates (pipeline trusts bead agent's self-reported result)
- No per-bead timeout
- No parallel bead execution
</success_criteria>
