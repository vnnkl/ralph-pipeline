---
phase: quick-1
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - templates/execute.md
autonomous: true
requirements: [QUICK-1]
must_haves:
  truths:
    - "When manual mode finds no result files, pipeline queries bd tracker for closed beads before asking the user"
    - "Closed beads from bd tracker get auto-generated result files with status: passed"
    - "Open beads from bd tracker get auto-generated result files with status: failed"
    - "If bd command fails or bead_format is prd.json, falls through to existing user prompt"
    - "If ALL beads accounted for via tracker, user prompt is skipped entirely"
  artifacts:
    - path: "templates/execute.md"
      provides: "Updated Step 3a with bd tracker auto-detection between points 4 and 5"
      contains: "bd list --status closed --json"
  key_links:
    - from: "templates/execute.md Step 3a point 4.5"
      to: "bd list --status closed --json"
      via: "bead_format config check"
      pattern: "bd list --status closed --json"
---

<objective>
Add bd tracker auto-detection to execute template's manual mode. When no result files exist in bead-results/, query `bd list --status closed --json` to check which beads were closed by ralph-tui, auto-generate result files, and only fall back to asking the user if the bd query fails or returns no data.

Purpose: Eliminates unnecessary user interaction when ralph-tui already tracked bead completion via the beads tracker.
Output: Updated templates/execute.md
</objective>

<execution_context>
@/Users/constantin/.claude/get-shit-done/workflows/execute-plan.md
@/Users/constantin/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@templates/execute.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add bd tracker auto-detection to Step 3a</name>
  <files>templates/execute.md</files>
  <action>
In templates/execute.md, modify Step 3a (Manual Mode) by inserting a new point between the current point 4 and point 5. Renumber subsequent points accordingly (current 5 becomes 6, current 6 becomes 7).

The new point 5 should contain this logic:

```
5. If no result files exist, attempt to auto-detect completion from the bead tracker:

   First, ensure the results directory exists:
   ```bash
   mkdir -p .claude/pipeline/bead-results
   ```

   Read the bead format from config:
   ```bash
   node {{RALPH_TOOLS}} --cwd {{CWD}} config-get bead_format --raw
   ```

   If format is "bd" or "br" (beads tracker formats):

   a. Query closed beads from the tracker:
      ```bash
      bd list --status closed --json 2>/dev/null
      ```

   b. If the command succeeds and returns a non-empty JSON array:
      - Parse the JSON array. Each element has `id` and `title` fields.
      - Compare against the bead files discovered in Step 1 (from `.beads/` directory).
        Match by checking if a bead filename (`{BEAD_NAME}.md`) corresponds to a closed issue title.
        Use case-insensitive substring matching: a bead is "closed" if any closed issue title contains the bead name (with hyphens treated as spaces/separators).
      - For each bead that matches a closed issue: create a result file at `.claude/pipeline/bead-results/{BEAD_NAME}.md` with:
        ```yaml
        ---
        status: passed
        bead: {BEAD_NAME}
        executed: {current ISO8601 timestamp}
        ---
        ```
      - For each bead that does NOT match any closed issue: create a result file with:
        ```yaml
        ---
        status: failed
        bead: {BEAD_NAME}
        executed: {current ISO8601 timestamp}
        ---
        ```
      - Log: "Auto-detected {N} closed beads from tracker, {M} still open"
      - If ALL beads are accounted for (result files now exist for every bead), skip the user prompt and proceed to Step 7 (previously Step 6).

   c. If the `bd list` command fails (non-zero exit code) or returns empty/invalid JSON:
      - Log: "Could not auto-detect bead status from tracker. Asking user."
      - Fall through to point 6 (user prompt).

   If format is "prd.json" or null:
   - Fall through to point 6 (user prompt). prd.json format has no tracker to query.
```

The current point 5 (user prompt) becomes point 6. Update its text to remain unchanged.
The current point 6 ("Proceed to Step 3a.1") becomes point 7. Update the reference text accordingly.

IMPORTANT: Do NOT modify any other steps. Only touch Step 3a points 4-6 (renumbering and inserting).
  </action>
  <verify>
Verify the changes:
1. `grep -n "bd list --status closed --json" templates/execute.md` returns a match
2. `grep -n "Auto-detected" templates/execute.md` returns a match
3. `grep -n "Could not auto-detect" templates/execute.md` returns a match
4. `grep -c "Step 3a.1" templates/execute.md` returns at least 2 (the section header + the "Proceed to" reference)
5. The file still contains "No result files found" user prompt (now as point 6, fallback)
  </verify>
  <done>
templates/execute.md Step 3a has 7 points (was 6). New point 5 queries bd tracker for closed beads when no result files exist. Points 6-7 are the renumbered originals. The bd tracker query only runs for bd/br formats, falls through to user prompt on failure, and skips the user prompt entirely when all beads are accounted for.
  </done>
</task>

</tasks>

<verification>
1. Read templates/execute.md and confirm Step 3a flows: points 1-4 unchanged, new point 5 (bd auto-detect), point 6 (user prompt fallback), point 7 (proceed to duration tracking)
2. Confirm the bd query is wrapped in error handling (2>/dev/null + exit code check)
3. Confirm mkdir -p for bead-results dir is present before writing result files
4. Confirm prd.json format falls through without attempting bd query
</verification>

<success_criteria>
- templates/execute.md contains bd tracker auto-detection logic in Step 3a
- The auto-detection only triggers when bead_format is "bd" or "br"
- Failed bd commands fall through gracefully to user prompt
- All beads accounted for via tracker skips user interaction
- Existing fallback user prompt preserved as point 6
</success_criteria>

<output>
After completion, create `.planning/quick/1-execute-stage-should-check-project-folde/1-SUMMARY.md`
</output>
