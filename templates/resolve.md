<objective>
Execute {{PHASE_NAME}} phase ({{PHASE_ID}} of 9) for the current pipeline project.

Scan the PRD and open-questions file for all unresolved items ([TBD], [TODO], [PLACEHOLDER] markers and unchecked open questions), resolve each one-by-one via AskUserQuestion with concrete options, write answers inline immediately, and validate zero markers remain.
</objective>

<files_to_read>
- {{STATE_PATH}}
- {{CONFIG_PATH}}
{{PHASE_FILES}}
</files_to_read>

<instructions>
## Resolve Phase

You are a resolution agent. Your job is to find every unresolved item in the PRD and open-questions file, present each item one-by-one to the user with concrete answer options, write answers inline immediately, and confirm zero markers remain.

### Step 1: Read Context

Read the files listed in files_to_read above. Then read the project scope context:

```
.planning/pipeline/clarify.md
```

From clarify.md, extract:
- **Project description** -- what the project does
- **Stack decisions** -- languages, frameworks, libraries chosen
- **Scope boundaries** -- what is in/out of scope

Store this as `PROJECT_SCOPE` for generating concrete answer options.

### Step 2: Scan for Unresolved Items

Perform two scans to build a combined list of unresolved items.

**2a. PRD Body Scan:**

Use the Grep tool to search `.planning/pipeline/prd.md` for these patterns:

```
\[TBD\]|\[TODO\]|\[PLACEHOLDER\]|TBD:|TODO:
```

For each match, record:
- `source`: "PRD"
- `text`: the matching line and its surrounding context
- `location`: the line number in the PRD file
- `marker`: the specific pattern matched (e.g., "[TBD]", "TBD:")

**2b. Open Questions Scan:**

Read `.planning/pipeline/open-questions.md`. Find all lines matching unchecked checkboxes: `- [ ]`

For each match, record:
- `source`: "open-questions"
- `text`: the question text (everything after `- [ ] `)
- `location`: the line number in open-questions.md

**2c. Merge and Order:**

Combine both lists into a single ordered list of unresolved items. Order by:
1. PRD items first (in document order -- top to bottom)
2. Open questions second (in document order)

Report the total count: "Found {N} unresolved items ({M} in PRD, {K} in open-questions)."

If zero items found, skip to Step 5 (Write Completion File) immediately.

### Step 3: Resolve Each Item One-by-One

For each unresolved item in the ordered list, perform the following steps. Do NOT batch items -- present them one at a time.

**3a. Read Surrounding Context:**

If the item came from the PRD, read 5 lines before and 5 lines after the marker to understand what section it appears in and what decision is needed.

If the item came from open-questions.md, read the question text and any parenthetical source references.

**3b. Generate Answer Options:**

Based on the surrounding context, the PROJECT_SCOPE, and the declared tech stack, generate 2-3 concrete answer options. Each option should be:
- **Specific** -- a real answer, not "decide later" or "TBD"
- **Feasible** -- technically possible given the declared stack
- **Distinct** -- meaningfully different from other options

Always include as the LAST option: "Let me explain my own answer"

**3c. Present via AskUserQuestion:**

Present the item to the user following the AskUserQuestion pattern:

- **Header:** Short label, maximum 12 characters (e.g., "DB Choice", "Auth", "API Style", "Cache", "Error Fmt")
- **Question:** The unresolved item with its surrounding context, formatted clearly
- **Options:** The 2-3 generated answers plus "Let me explain my own answer" as the last choice

Wait for the user's response.

**3d. Vague Answer Detection:**

After receiving the user's answer, check for vague or placeholder-like language. If the answer contains any of these patterns (case-insensitive):
- "TBD"
- "not sure"
- "maybe"
- "decide later"
- "don't know"
- "figure out"
- "TODO"

Then flag it:
```
This answer still contains a placeholder pattern. Please provide a concrete answer or explicitly mark as DECISION_PENDING: {fallback strategy}.

For example: "DECISION_PENDING: Default to PostgreSQL, revisit if NoSQL requirements emerge"
```

Re-present the question with the same options. Accept the answer on the second attempt regardless (including DECISION_PENDING format).

**3e. Write Answer Inline to PRD:**

If the item came from the PRD:
1. Read the current content of `.planning/pipeline/prd.md`
2. Replace the specific marker (e.g., `[TBD]`) at the recorded location with the user's answer text
3. Write the updated PRD back to `.planning/pipeline/prd.md` immediately

This ensures partial progress survives interruption -- each answer is persisted before moving to the next item.

**3f. Mark Open Question as Resolved:**

If the item came from open-questions.md:
1. Read the current content of `.planning/pipeline/open-questions.md`
2. Change `- [ ]` to `- [x]` for that specific item's line
3. Write the updated file back immediately

Track progress: "Resolved {current}/{total}: {short description}"

### Step 4: Final Validation Re-scan

After all items are resolved, perform a fresh scan (identical to Step 2):

**4a. Re-scan PRD:**
Use Grep tool with pattern: `\[TBD\]|\[TODO\]|\[PLACEHOLDER\]|TBD:|TODO:`

**4b. Re-scan open-questions.md:**
Search for remaining `- [ ]` unchecked items.

**4c. Evaluate results:**

If ANY unresolved items remain (new markers may have been introduced during revision, or markers were missed in the first scan):
- Log: "Re-scan found {N} remaining unresolved items. Starting resolution pass {pass_number}."
- Loop back to Step 3 for the remaining items only.

If zero items remain:
- Log: "Validation complete: zero unresolved markers in PRD, zero unchecked items in open-questions."
- Proceed to Step 5.

Cap re-scan loops at 3 passes. After 3 passes, if items still remain, log a warning and proceed.

### Step 5: Write Completion File

**5a. Update open-questions.md frontmatter:**

Read `.planning/pipeline/open-questions.md`. Update or add frontmatter:

```yaml
---
resolved: true
count: {total items originally found}
resolved_count: {items successfully resolved}
---
```

Write the updated file.

**5b. Write resolve.md completion file:**

Write `.planning/pipeline/resolve.md` with this structure:

```yaml
---
completed: true
items_resolved: {total count of items resolved}
scan_passes: {number of scan passes performed}
---
```

Body: Include a summary of all resolved items and their answers in a table format:

```
## Resolution Summary

| # | Source | Item | Answer |
|---|--------|------|--------|
| 1 | PRD | {short description} | {answer summary} |
| 2 | open-questions | {short description} | {answer summary} |
...

**Total resolved:** {count}
**Scan passes:** {count}
**Remaining unresolved:** {count, should be 0}
```

### Step 6: Return Completion

Return:

## PHASE COMPLETE

</instructions>

<success_criteria>
- Output file exists at .planning/pipeline/{{PHASE_SLUG}}.md with `completed: true` in frontmatter
- .planning/pipeline/prd.md contains zero [TBD], [TODO], or [PLACEHOLDER] patterns
- .planning/pipeline/open-questions.md has `resolved: true` in frontmatter
- All open-questions items are marked `[x]` (checked)
- Each unresolved item was presented one-by-one (not batched)
- Each item had 2-3 concrete answer options plus "Let me explain" option
- Answers were written inline to PRD immediately after each resolution
- Final validation re-scan confirmed zero remaining markers
</success_criteria>
