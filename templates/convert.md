<objective>
Execute {{PHASE_NAME}} phase ({{PHASE_ID}} of 9) for the current pipeline project.

Convert the PRD into beads by presenting a bead format choice (bd Go / br Rust / prd.json), invoking the appropriate chained skill, validating bead output, detecting frontend stories for /frontend-design injection, and writing the completion file.
</objective>

<files_to_read>
- {{STATE_PATH}}
- {{CONFIG_PATH}}
{{PHASE_FILES}}
</files_to_read>

<instructions>
## Convert Phase

You are a conversion orchestrator. Your job is to present the bead format choice, invoke the correct bead creation skill, validate output, inject frontend design instructions where needed, and write the completion file.

### Step 1: Read Context

Read the files listed in files_to_read above.

Read the depth setting from config:
```bash
node ralph-tools.cjs config-get depth
```

Store the depth value (one of: "quick", "standard", "comprehensive") for passing to the bead creation skill.

Read `.planning/pipeline/prd.md` for the full PRD content. Extract all text after the YAML frontmatter (after the closing `---`). Store this as `PRD_CONTENT`.

### Step 2: Present Bead Format Gate

Present the bead format choice to the user via AskUserQuestion. There is no config default -- always ask.

- **Header:** "Bead Format"
- **Question:** "Choose the bead output format for converting the PRD into implementation beads:"
- **Options:**
  1. **bd** -- Go beads via /ralph-tui-create-beads. Standard Go bead format for ralph-tui execution.
  2. **br** -- Rust beads via /ralph-tui-create-beads-rust. Rust bead format for ralph-tui execution.
  3. **prd.json** -- JSON format via /ralph-tui-create-json. Machine-readable JSON bead format.

Wait for the user's response. Map the response to the chosen skill:
- "bd" or "1" or "go" -> `/ralph-tui-create-beads`
- "br" or "2" or "rust" -> `/ralph-tui-create-beads-rust`
- "prd.json" or "3" or "json" -> `/ralph-tui-create-json`

Store the user's choice as `CHOSEN_FORMAT` (one of: "bd", "br", "prd.json") and `CHOSEN_SKILL` (the skill path).

### Step 3: Detect Frontend Stories

Before invoking the bead creation skill, scan the PRD_CONTENT for frontend-related user stories. This detection is automatic -- no user confirmation needed.

For each user story section (identified by `### US-` headings), check if the story description or acceptance criteria contains any of these keywords (case-insensitive):
- "frontend"
- "UI"
- "interface"
- "component"
- "page"
- "view"
- "layout"
- "screen"
- "dashboard"

Record the list of frontend story IDs (e.g., ["US-003", "US-005"]) as `FRONTEND_STORIES`.

Log: "Detected {N} frontend stories: {list}" or "No frontend stories detected."

### Step 3.5: Handle "UI" Keyword False Positives

When matching the keyword "UI", ensure it is a standalone word (not part of words like "require", "build", "suite"). Match "UI" only when it appears:
- At a word boundary (preceded/followed by whitespace, punctuation, or line start/end)
- As part of "UI/UX" or similar compound terms

This prevents false positives from common English words containing "ui".

### Step 4: Invoke Bead Creation Skill

Use the **Skill tool** to invoke the `CHOSEN_SKILL`.

Pass the following as the skill's input context:

```
PRD CONTENT:
{PRD_CONTENT}

DEPTH INSTRUCTION:
The depth setting is "{depth value}".
- "quick" = produce fewer, larger beads covering broader scope per bead
- "standard" = balanced granularity (default)
- "comprehensive" = produce more granular beads with finer-grained scope per bead

Apply this depth level when determining how to split the PRD into beads.
```

Wait for the skill to complete.

**If the Skill tool invocation fails:** Fall back to describing what the skill should do as a natural language instruction. Log the error and proceed to validation -- the skill may have partially produced output.

### Step 5: Validate Bead Output

After the skill completes, validate the output.

**5a. Check .beads/ directory exists:**

Use the Glob tool to search for `.beads/*.md` files.

If ZERO bead files are found:

Write `.planning/pipeline/convert.md` with:
```yaml
---
completed: false
error: "No bead files produced by skill invocation"
---
```

Present an error gate to the user via AskUserQuestion:

- **Header:** "Zero Beads"
- **Question:** "The bead creation skill produced no output files in .beads/. Choose how to proceed:"
- **Options:**
  1. **Retry** -- Re-invoke the bead creation skill with the same settings
  2. **Edit PRD** -- Edit .planning/pipeline/prd.md manually, then re-run the convert phase
  3. **Abort** -- Fail this phase and return to the orchestrator

Handle the response:
- "Retry" or "1": Go back to Step 4 (re-invoke the skill). Only allow ONE retry.
- "Edit PRD" or "2": Return `## PHASE FAILED` with message: "Edit .planning/pipeline/prd.md and re-run the convert phase."
- "Abort" or "3": Return `## PHASE FAILED` with message: "Convert phase aborted by user."

**5b. Validate each bead file:**

For each `.beads/*.md` file found:

1. Read the file content
2. Check for YAML frontmatter: the file must start with `---` on the first line and contain a closing `---` marker
3. Check for an acceptance criteria section: search for "acceptance criteria" (case-insensitive) in the file content

Collect validation results:
- `VALID_BEADS`: list of bead files that pass both checks
- `INVALID_BEADS`: list of bead files with specific error per bead (e.g., "missing frontmatter", "no acceptance criteria")

If ANY beads are invalid:

Log each invalid bead with its specific error:
```
Invalid bead: {filename} -- {error reason}
```

Write `.planning/pipeline/convert.md` with `completed: false` and the list of invalid beads in the body.

Return: `## PHASE FAILED` with message listing each invalid bead and its error.

### Step 6: Inject Frontend Design Skill

For each bead file whose story ID matches one of the `FRONTEND_STORIES` detected in Step 3:

1. Read the bead file content
2. Find the acceptance criteria section (look for a line containing "acceptance criteria" case-insensitive, or a heading like "## Acceptance Criteria")
3. Insert the following instruction at the beginning of the acceptance criteria content (after the heading, before the first criterion):

```
- First, invoke /frontend-design for design guidance before implementing any UI.
```

4. Write the updated bead file back

**Matching logic:** A bead matches a frontend story if the bead filename or frontmatter contains the story ID (e.g., a bead file named `US-003-user-profile.md` or containing `story: US-003` matches the frontend story "US-003").

Track the count of beads injected as `FRONTEND_BEAD_COUNT`.

Log: "Injected /frontend-design into {N} frontend beads: {list}" or "No frontend beads to inject."

### Step 6.5: Inject Quality Gate Acceptance Criteria

For ALL bead files (not just frontend beads), ensure quality gate requirements are present in acceptance criteria.

For each bead file in .beads/*.md:

1. Read the bead file content
2. Find the acceptance criteria section (same detection as Step 6)
3. If the acceptance criteria do NOT already contain "tests pass" or "type check" or "quality gate":
   - Append the following to the end of the acceptance criteria:

   ```
   - Quality gates: All relevant tests must pass and type checks must succeed before marking this bead complete.
   ```

4. Write the updated bead file back

Log: "Injected quality gate acceptance criteria into {N} beads."

### Step 7: Write Completion File

Count the total validated bead files:
```bash
ls {{CWD}}/.beads/*.md 2>/dev/null | wc -l
```

Write `.planning/pipeline/convert.md` with:

```yaml
---
completed: true
format: {CHOSEN_FORMAT}
bead_count: {total count of valid bead files}
frontend_beads: {FRONTEND_BEAD_COUNT}
depth: {depth value used}
---
```

Body: List all bead files with their story IDs in a table:

```markdown
## Bead Inventory

| # | File | Story ID | Frontend |
|---|------|----------|----------|
| 1 | {filename} | {story ID from frontmatter or filename} | {yes/no} |
| 2 | {filename} | {story ID from frontmatter or filename} | {yes/no} |
...

**Format:** {CHOSEN_FORMAT}
**Depth:** {depth value}
**Total beads:** {count}
**Frontend beads:** {FRONTEND_BEAD_COUNT}
```

### Step 8: Return Completion

Return:

## PHASE COMPLETE

</instructions>

<success_criteria>
- Output file exists at .planning/pipeline/{{PHASE_SLUG}}.md with `completed: true` in frontmatter
- User was presented with bead format choice (bd / br / prd.json) via AskUserQuestion
- The correct chained skill was invoked based on user choice
- .beads/*.md files exist and each has valid frontmatter and acceptance criteria
- Frontend stories detected automatically and /frontend-design injected into matching beads
- Zero-bead case handled with retry/edit/abort gate and completed: false written
- Depth setting from config.json passed to bead creation skill
- PHASE FAILED returned on any validation failure (invalid beads, zero beads after retry)
</success_criteria>
