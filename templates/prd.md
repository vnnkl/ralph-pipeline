<objective>
Execute {{PHASE_NAME}} phase ({{PHASE_ID}} of 9) for the current pipeline project.

Create a Product Requirements Document (PRD) by invoking the /ralph-tui-prd skill with research context, then validate the output structure, tracer bullet ordering, and extract open questions.
</objective>

<files_to_read>
- {{STATE_PATH}}
- {{CONFIG_PATH}}
{{PHASE_FILES}}
</files_to_read>

<instructions>
<!-- YOLO mode: gate bypass handled by orchestrator (SKILL.md Step 6) -->
## PRD Phase

You are a PRD orchestrator. Your job is to invoke the /ralph-tui-prd skill with research context, validate the PRD output, extract open questions, and write the completion file.

### Step 1: Read Context

Read the files listed in files_to_read above.

Read the depth setting from config:
```bash
node ralph-tools.cjs config-get depth
```

Based on the depth value, determine how much research context to load:

- **"comprehensive"**: Read ALL files in `.planning/research/` directory (every .md file)
- **"standard"** or **"quick"** (default): Read only `.planning/research/SUMMARY.md`

Also read `.planning/pipeline/clarify.md` for the project scope and stack context.

Combine all read content into a single `RESEARCH_CONTEXT` string that you will pass to the PRD skill.

### Step 2: Invoke /ralph-tui-prd

Use the **Skill tool** to invoke `/ralph-tui-prd`.

Pass the RESEARCH_CONTEXT as the skill's input context. This gives the PRD skill full awareness of the project's research findings, stack decisions, scope boundaries, and quality gates.

The skill will conduct its own clarifying questions flow and produce a PRD with `[PRD]...[/PRD]` markers.

Wait for the skill to complete and capture its full output.

### Step 3: Validate PRD Output

After /ralph-tui-prd completes, run these 4 validation checks. If ANY check fails, the phase FAILS -- no soft warnings.

---

**3a. Check [PRD]...[/PRD] markers**

Search the skill output for `[PRD]` and `[/PRD]` markers.

If either marker is missing, FAIL immediately:
- Write `.planning/pipeline/prd.md` with frontmatter `completed: false` and the error message
- Return: `## PHASE FAILED\n\nPRD markers not found. /ralph-tui-prd may have failed or produced malformed output.`

---

**3b. Count user stories**

Search for `### US-` pattern within the content between `[PRD]` and `[/PRD]` markers.

Count the total number of user stories found.

If fewer than 3:
- Write `.planning/pipeline/prd.md` with frontmatter `completed: false` and the error message
- Return: `## PHASE FAILED\n\nOnly {N} user stories found. Minimum is 3 for a valid PRD.`

---

**3c. Validate tracer bullet US-001**

This validation ensures US-001 is a true vertical slice through the project's declared architecture.

Step 1 -- Extract declared layers:
- Parse the PRD content for sections like "Technical Considerations", "Architecture", "Overview", "Technical Architecture", "System Architecture", or similar
- Identify the layers/components the PRD declares as in-scope (examples: "backend", "frontend", "database", "API", "CLI", "infrastructure", "tests", "worker", "queue")
- These are the DECLARED layers -- what the PRD says the project includes

Step 2 -- Check US-001 coverage:
- Find the US-001 section (between `### US-001` and the next `### US-` or end of PRD)
- Read both its Description and Acceptance Criteria
- Check if US-001 references each declared layer (use flexible matching -- "database" matches "DB", "data layer", "schema", "migration", etc.)

Step 3 -- Evaluate:
- If US-001 references ALL declared layers: PASS
- If US-001 misses any declared layers: FAIL
  - Write `.planning/pipeline/prd.md` with frontmatter `completed: false`
  - Return: `## PHASE FAILED\n\nUS-001 must be a vertical slice covering all declared layers: {layers}. Found coverage: {covered}. Missing: {missing}.`

**IMPORTANT:** Do NOT hardcode layers to "DB + backend + frontend". Validate against what THIS PRD declares. A CLI-only project declaring "backend" and "tests" should pass if US-001 covers both.

---

**3d. Validate story structure**

For each `### US-NNN` section within the [PRD] block:
- Verify it has a **Description** subsection (or descriptive text immediately after the heading)
- Verify it has an **Acceptance Criteria** subsection
- Collect all US-NNN IDs and check for duplicates

If any story lacks Description or Acceptance Criteria, or if duplicate IDs exist:
- Write `.planning/pipeline/prd.md` with frontmatter `completed: false`
- Return: `## PHASE FAILED\n\n{specific structural issues found}`

### Step 4: Extract Open Questions

Search the PRD output for a `## Open Questions` section.

If found, extract each question and write to `.planning/pipeline/open-questions.md`:

```yaml
---
resolved: false
count: {N}
---
```

```markdown
# Open Questions

- [ ] {question text} (source: PRD)
- [ ] {question text} (source: PRD)
```

If no Open Questions section is found, write the file with:

```yaml
---
resolved: true
count: 0
---
```

```markdown
# Open Questions

No open questions from PRD.
```

### Step 5: Write PRD Output

Extract the content between `[PRD]` and `[/PRD]` markers (the full PRD body).

Write to `.planning/pipeline/prd.md` with this frontmatter:

```yaml
---
completed: true
story_count: {N}
tracer_bullet_valid: true
open_questions: {count from Step 4}
---
```

Body: The full PRD content (everything between the [PRD] and [/PRD] markers).

### Step 6: Return Completion

Return:

## PHASE COMPLETE

</instructions>

<success_criteria>
- Output file exists at .planning/pipeline/{{PHASE_SLUG}}.md with `completed: true` in frontmatter
- PRD content contains valid [PRD]...[/PRD] markers with >= 3 user stories
- US-001 covers all layers declared in the PRD (tracer bullet validation)
- Each US-NNN has Description and Acceptance Criteria; no duplicate IDs
- .planning/pipeline/open-questions.md exists with extracted questions (or count: 0)
- PHASE FAILED returned on any validation failure (hard gate, not soft warning)
</success_criteria>
