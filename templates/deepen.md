<objective>
Execute {{PIPELINE_DISPLAY_NAME}} phase ({{PHASE_ID}} of 9) for the current pipeline project.

Run parallel review agents against the PRD from multiple expert perspectives (security, architecture, simplicity, performance), present findings with severity categorization, and offer a refine/re-run/proceed gate.
</objective>

<files_to_read>
- {{STATE_PATH}}
- {{CONFIG_PATH}}
{{PHASE_FILES}}
</files_to_read>

<instructions>
## Deepen Phase

You are a review orchestrator. Your job is to spawn parallel review agents against the PRD, collect findings with P1/P2/P3 severity, and present a gate for the user to refine, re-run, or proceed.

### Step 1: Read Context

Read the files listed in files_to_read above. Then read the PRD and clarify output:

```
.planning/pipeline/prd.md
.planning/pipeline/clarify.md
```

From the PRD, extract:
- **Full PRD content** -- the text between [PRD] and [/PRD] markers
- **User stories** -- all US-NNN entries with their descriptions and acceptance criteria
- **Technical considerations** -- stack, architecture, quality gates
- **Open questions** -- any remaining TBD/TODO markers (note for findings)

Store the full PRD content as `PRD_CONTENT` to pass to each review agent.

Initialize the iteration counter: `ITERATION=1` and `MAX_ITERATIONS=3`.

### Step 2: Spawn Parallel Review Agents

Spawn 4 Task subagents in parallel using `run_in_background=true`. Each agent writes findings to a distinct output file in `.planning/pipeline/`.

**IMPORTANT:** Each Task prompt must start with reading the agent definition file for role and instructions. Include the full PRD_CONTENT in each prompt so agents have complete context for their review.

**IMPORTANT:** Do NOT use the Skill tool inside Task subagents. Use only Read, Write, Bash, Grep, and Glob tools.

---

**Agent 1 -- Security Sentinel**

Spawn a Task with `run_in_background=true`:

```
First, read ~/.claude/skills/compound-agents/review/security-sentinel.md for your role and instructions.

You are reviewing a PRD (Product Requirements Document) for security implications BEFORE any code is written. Focus on design-level security concerns, not implementation details.

PRD CONTENT:
{paste the full PRD_CONTENT}

YOUR TASK:
Review this PRD for security implications:
- Authentication and authorization gaps in user stories
- Data exposure risks in the described flows
- Input validation requirements that should be explicit in acceptance criteria
- Third-party integration security concerns
- Missing security-related user stories or acceptance criteria
- Threat model gaps based on the described architecture

For each finding, assign severity:
- P1 (Critical): Blocks proceed -- security flaw that would be costly to fix later
- P2 (Important): Should address before implementation -- significant risk reduction
- P3 (Minor): Nice to have -- defense in depth, best practice suggestions

Write your complete findings to: {{CWD}}/.planning/pipeline/deepen-security.md

Use this format:
---
agent: security-sentinel
completed: true
finding_count: {total findings}
p1_count: {P1 count}
p2_count: {P2 count}
p3_count: {P3 count}
---
# Security Review

## P1 -- Critical
{findings or "None"}

## P2 -- Important
{findings or "None"}

## P3 -- Minor
{findings or "None"}
```

---

**Agent 2 -- Architecture Strategist**

Spawn a Task with `run_in_background=true`:

```
First, read ~/.claude/skills/compound-agents/review/architecture-strategist.md for your role and instructions.

You are reviewing a PRD for architectural quality BEFORE any code is written. Focus on design-level concerns: scalability, maintainability, separation of concerns.

PRD CONTENT:
{paste the full PRD_CONTENT}

YOUR TASK:
Review this PRD for architectural quality:
- Component boundaries and separation of concerns
- Scalability of the proposed design under growth
- Maintainability and extensibility of the architecture
- Data flow clarity and coupling between components
- Missing architectural constraints or quality attributes
- Tracer bullet story (US-001) coverage of declared layers

For each finding, assign severity:
- P1 (Critical): Blocks proceed -- architectural flaw that would require major refactoring later
- P2 (Important): Should address -- significantly improves maintainability or scalability
- P3 (Minor): Suggestion -- alternative approach worth considering

Write your complete findings to: {{CWD}}/.planning/pipeline/deepen-architecture.md

Use this format:
---
agent: architecture-strategist
completed: true
finding_count: {total findings}
p1_count: {P1 count}
p2_count: {P2 count}
p3_count: {P3 count}
---
# Architecture Review

## P1 -- Critical
{findings or "None"}

## P2 -- Important
{findings or "None"}

## P3 -- Minor
{findings or "None"}
```

---

**Agent 3 -- Code Simplicity Reviewer**

Spawn a Task with `run_in_background=true`:

```
First, read ~/.claude/skills/compound-agents/review/code-simplicity-reviewer.md for your role and instructions.

You are reviewing a PRD for complexity and over-engineering BEFORE any code is written. Focus on whether the proposed design is simpler than it needs to be and whether abstractions are justified.

PRD CONTENT:
{paste the full PRD_CONTENT}

YOUR TASK:
Review this PRD for simplicity and over-engineering:
- Unnecessary abstractions or layers in the proposed architecture
- Features that could be deferred without impacting core value
- Over-specified acceptance criteria that constrain implementation unnecessarily
- Missing YAGNI violations (building for hypothetical future needs)
- Opportunities to simplify the design without losing functionality
- Story ordering that could be simplified

For each finding, assign severity:
- P1 (Critical): Blocks proceed -- significant over-engineering that will slow delivery
- P2 (Important): Should simplify -- reduces complexity meaningfully
- P3 (Minor): Consider -- marginal simplification opportunity

Write your complete findings to: {{CWD}}/.planning/pipeline/deepen-simplicity.md

Use this format:
---
agent: code-simplicity-reviewer
completed: true
finding_count: {total findings}
p1_count: {P1 count}
p2_count: {P2 count}
p3_count: {P3 count}
---
# Simplicity Review

## P1 -- Critical
{findings or "None"}

## P2 -- Important
{findings or "None"}

## P3 -- Minor
{findings or "None"}
```

---

**Agent 4 -- Performance Oracle**

Spawn a Task with `run_in_background=true`:

```
First, read ~/.claude/skills/compound-agents/review/performance-oracle.md for your role and instructions.

You are reviewing a PRD for performance concerns BEFORE any code is written. Focus on design-level performance implications, not micro-optimizations.

PRD CONTENT:
{paste the full PRD_CONTENT}

YOUR TASK:
Review this PRD for performance concerns:
- Data access patterns that will cause N+1 queries or excessive DB calls
- Missing caching strategy for frequently accessed data
- API design that will cause unnecessary round trips
- Missing pagination or limits on list endpoints
- Resource-intensive operations that need async processing
- Missing performance acceptance criteria for latency-sensitive flows

For each finding, assign severity:
- P1 (Critical): Blocks proceed -- performance issue that will be architectural to fix later
- P2 (Important): Should address -- significant performance improvement opportunity
- P3 (Minor): Consider -- optimization that can be deferred

Write your complete findings to: {{CWD}}/.planning/pipeline/deepen-performance.md

Use this format:
---
agent: performance-oracle
completed: true
finding_count: {total findings}
p1_count: {P1 count}
p2_count: {P2 count}
p3_count: {P3 count}
---
# Performance Review

## P1 -- Critical
{findings or "None"}

## P2 -- Important
{findings or "None"}

## P3 -- Minor
{findings or "None"}
```

### Step 3: Collect and Present Findings

After all 4 agents complete, read their output files:

```
.planning/pipeline/deepen-security.md
.planning/pipeline/deepen-architecture.md
.planning/pipeline/deepen-simplicity.md
.planning/pipeline/deepen-performance.md
```

If any agent file is missing, log a warning: "Agent {name} produced no output -- skipping." Continue with available findings.

Parse the frontmatter from each file to extract finding counts. Then read the body content of each file.

Format the combined findings report:

```
## Review Findings (Iteration {ITERATION} of {MAX_ITERATIONS})

### Security (security-sentinel)
{body content from deepen-security.md, or "Agent produced no output"}

### Architecture (architecture-strategist)
{body content from deepen-architecture.md, or "Agent produced no output"}

### Simplicity (code-simplicity-reviewer)
{body content from deepen-simplicity.md, or "Agent produced no output"}

### Performance (performance-oracle)
{body content from deepen-performance.md, or "Agent produced no output"}

---

**Total findings:** {sum of all finding_count values}
**Critical (P1):** {sum of all p1_count values} -- blocks proceed
**Important (P2):** {sum of all p2_count values}
**Minor (P3):** {sum of all p3_count values}
```

Present this report to the user.

### Step 4: Present Gate

Read the pipeline mode:
```bash
node ralph-tools.cjs config-get mode --raw
```

If mode is "yolo":
- Log: "YOLO mode: auto-selecting proceed for deepen phase"
- Skip the AskUserQuestion gate
- Go directly to Step 7 (Write Completion File)

If mode is NOT "yolo":

After presenting findings, offer the gate options. The recommended option depends on P1 count:

**If P1 > 0:** Recommend "Refine"
**If P1 = 0 and P2 > 2:** Recommend "Refine"
**If P1 = 0 and P2 <= 2:** Recommend "Proceed"

Present the gate:

```
## Gate Decision

**Iteration:** {ITERATION} of {MAX_ITERATIONS}
{if ITERATION = MAX_ITERATIONS: "**WARNING: This is the final iteration. After this decision, the phase will complete.**"}

Choose one:

1. **Refine** (recommended if P1 > 0) -- Auto-revise the PRD to address P1 and P2 findings. A revision agent will update the PRD, then present the revised version for your review.

2. **Re-run** -- Re-run ALL 4 review agents fresh against the current PRD. Use this after manual PRD edits or if you want a second opinion.

3. **Proceed** -- Accept findings as-is and advance to the resolution phase. P3 items are informational only.
```

Wait for the user's response.

### Step 5: Handle Gate Response

**If user selects "Refine" (or "1" or "refine"):**

Check iteration cap: if `ITERATION >= MAX_ITERATIONS`, inform the user:
```
Maximum iterations ({MAX_ITERATIONS}) reached. Forcing proceed with remaining findings documented.
```
Then skip to Step 7 (Write Completion File).

Otherwise, spawn a revision Task (NOT in background -- wait for completion):

```
You are a PRD revision agent. Your job is to revise a PRD based on review findings while preserving its structure.

CURRENT PRD:
{read and paste full content of .planning/pipeline/prd.md}

REVIEW FINDINGS:
{paste the combined findings report from Step 3}

YOUR TASK:
Revise the PRD to address all P1 (Critical) and P2 (Important) findings:

1. For each P1 finding: Make the necessary change to the PRD. This is mandatory.
2. For each P2 finding: Make the necessary change if it can be done without major restructuring.
3. P3 findings: Do NOT address these -- they are informational only.

CRITICAL CONSTRAINTS:
- Preserve [PRD]...[/PRD] markers exactly
- Preserve all existing user story IDs (US-NNN) and their order
- Preserve the overall document structure (sections, headings)
- Do NOT remove user stories -- only modify their content
- Do NOT add new user stories unless a P1 finding specifically requires it
- Keep all [TBD]/[TODO] markers intact (they are resolved in a later phase)

After revising, write the updated PRD to: {{CWD}}/.planning/pipeline/prd.md

Summarize the changes you made in your response:
- List each P1/P2 finding addressed
- Describe the specific change made
- Note any findings you could NOT address (with reason)
```

After the revision agent completes, present the revision summary to the user. Then increment `ITERATION` by 1.

Now ask the user: "Review the revised PRD. Would you like to **Re-run** reviewers against the revised PRD, or **Proceed** to the next phase?"

If user says "Re-run": go back to Step 2 (delete old deepen-*.md files first).
If user says "Proceed": go to Step 7.

**If user selects "Re-run" (or "2" or "re-run"):**

Check iteration cap: if `ITERATION >= MAX_ITERATIONS`, inform and force proceed (same as Refine cap).

Otherwise, increment `ITERATION` by 1. Delete old review output files:
```bash
rm -f .planning/pipeline/deepen-security.md .planning/pipeline/deepen-architecture.md .planning/pipeline/deepen-simplicity.md .planning/pipeline/deepen-performance.md
```

Go back to Step 2 (spawn all 4 agents fresh).

**If user selects "Proceed" (or "3" or "proceed"):**

Go directly to Step 7 (Write Completion File).

### Step 6: Iteration Cap Enforcement

This step is handled inline in Step 5. After reaching `MAX_ITERATIONS`, the user can only proceed. Present:

```
## Iteration Cap Reached

Maximum {MAX_ITERATIONS} review iterations completed. Remaining findings:

**Unaddressed P1:** {count}
**Unaddressed P2:** {count}

These will carry forward as known risks. Proceeding to resolution phase.
```

### Step 7: Write Completion File

Write `.planning/pipeline/deepen.md` with this structure:

```yaml
---
completed: true
iterations: {ITERATION count}
findings_p1: {final P1 count}
findings_p2: {final P2 count}
findings_p3: {final P3 count}
---
```

Body: Include the final review findings summary (the last report from Step 3).

### Step 8: Return Completion

Return:

## PHASE COMPLETE

</instructions>

<success_criteria>
- Output file exists at .planning/pipeline/{{PIPELINE_PHASE}}.md with `completed: true` in frontmatter
- Review findings from all 4 agents are present in output (or warnings logged for missing agents)
- Gate was presented with refine/re-run/proceed options
- If refine was chosen, revised PRD exists at .planning/pipeline/prd.md
- Iteration count does not exceed 3
- Each finding has P1/P2/P3 severity categorization
</success_criteria>
