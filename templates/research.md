<objective>
Execute {{PIPELINE_DISPLAY_NAME}} phase ({{PHASE_ID}} of 9) for the current pipeline project.

Spawn parallel research agents to analyze the project from multiple angles, synthesize their findings, and produce a research summary that feeds PRD creation.
</objective>

<files_to_read>
- {{STATE_PATH}}
- {{CONFIG_PATH}}
{{PHASE_FILES}}
</files_to_read>

<instructions>
<!-- YOLO mode: gate bypass handled by orchestrator (SKILL.md Step 6) -->
## Research Phase

You are a research orchestrator. Your job is to spawn parallel research agents, wait for their outputs, then synthesize results into a unified summary.

### Step 1: Read Context

Read the files listed in files_to_read above. Then read the clarify output for project scope and stack decisions:

```
.planning/pipeline/clarify.md
```

From the clarify output, extract:
- **Project description** -- what the project does
- **Stack decisions** -- languages, frameworks, libraries chosen
- **Quality gates** -- testing, coverage, linting requirements
- **Scope boundaries** -- what is in/out of scope

Store these as the `PROJECT_CONTEXT` to pass to each research agent.

### Step 2: Create Research Directory

```bash
mkdir -p .planning/research
```

### Step 3: Check for Learnings Directory

Run:
```bash
ls docs/solutions/ 2>/dev/null
```

If the directory exists and contains files, set `INCLUDE_LEARNINGS=true`. You will spawn 4 agents.
If the directory does not exist or is empty, set `INCLUDE_LEARNINGS=false`. You will spawn 3 agents. Note "No prior learnings found -- docs/solutions/ directory absent" for inclusion in the synthesis step.

### Step 4: Spawn Parallel Research Agents

Spawn 3-4 Task subagents in parallel using `run_in_background=true`. Each agent writes to a distinct output file in `.planning/research/`.

**IMPORTANT:** Each Task prompt must start with reading the agent definition file for role and instructions. Include the PROJECT_CONTEXT (scope, stack, quality gates) in each prompt so agents have full project awareness.

---

**Agent 1 -- Repo Research Analyst**

Spawn a Task with `run_in_background=true`:

```
First, read ~/.claude/skills/compound-agents/research/repo-research-analyst.md for your role and instructions.

PROJECT CONTEXT:
{paste the PROJECT_CONTEXT extracted from clarify.md}

YOUR TASK:
Analyze the project repository at {{CWD}}.
- Examine the repository structure, conventions, and patterns
- Review documentation files (README, CONTRIBUTING, ARCHITECTURE, CLAUDE.md)
- Map organizational structure and design decisions
- Identify coding standards, testing patterns, and review processes
- Note any existing infrastructure, CI/CD, or deployment patterns

Write your complete findings to: {{CWD}}/.planning/research/repo-research.md

Use this format:
---
agent: repo-research-analyst
completed: true
---
# Repository Research

[your findings organized by category]
```

---

**Agent 2 -- Best Practices Researcher**

Spawn a Task with `run_in_background=true`:

```
First, read ~/.claude/skills/compound-agents/research/best-practices-researcher.md for your role and instructions.

PROJECT CONTEXT:
{paste the PROJECT_CONTEXT extracted from clarify.md}

YOUR TASK:
Research best practices for this project's domain and technology stack.
- Find industry standards and conventions for the chosen stack
- Identify recommended patterns, libraries, and tools
- Gather security best practices relevant to the project domain
- Document testing strategies and quality standards
- Note common pitfalls and anti-patterns to avoid

Write your complete findings to: {{CWD}}/.planning/research/best-practices.md

Use this format:
---
agent: best-practices-researcher
completed: true
---
# Best Practices Research

[your findings organized by category]
```

---

**Agent 3 -- Framework Docs Researcher**

Spawn a Task with `run_in_background=true`:

```
First, read ~/.claude/skills/compound-agents/research/framework-docs-researcher.md for your role and instructions.

PROJECT CONTEXT:
{paste the PROJECT_CONTEXT extracted from clarify.md}

YOUR TASK:
Gather documentation for the project's frameworks and libraries.
- Fetch official docs for each major dependency
- Identify version-specific constraints and deprecations
- Extract API references and implementation guides
- Document configuration options and recommended setups
- Note migration paths and upgrade considerations

Write your complete findings to: {{CWD}}/.planning/research/framework-docs.md

Use this format:
---
agent: framework-docs-researcher
completed: true
---
# Framework Documentation Research

[your findings organized by framework/library]
```

---

**Agent 4 -- Learnings Researcher (CONDITIONAL)**

Only spawn this agent if `INCLUDE_LEARNINGS=true` (docs/solutions/ exists and has files).

Spawn a Task with `run_in_background=true`:

```
You are a learnings researcher. Your job is to extract reusable patterns, lessons learned, and pitfalls to avoid from the project's existing solutions documentation.

PROJECT CONTEXT:
{paste the PROJECT_CONTEXT extracted from clarify.md}

YOUR TASK:
Read ALL files in {{CWD}}/docs/solutions/ directory.
For each file:
- Extract reusable patterns and approaches that worked well
- Identify lessons learned and mistakes to avoid
- Note any architectural decisions with their rationale
- Capture performance insights and optimization strategies
- Document integration patterns and API design choices

Write your complete findings to: {{CWD}}/.planning/research/learnings.md

Use this format:
---
agent: learnings-researcher
completed: true
---
# Learnings from Prior Solutions

## Reusable Patterns
[patterns that worked well]

## Lessons Learned
[mistakes and corrections]

## Pitfalls to Avoid
[things that caused problems]

## Architectural Insights
[design decisions with rationale]
```

If this agent was skipped, do NOT create a learnings.md file. The synthesizer will note the absence.

### Step 5: Wait for All Agents

All agents were spawned with `run_in_background=true`. Wait for all of them to complete before proceeding.

After all agents finish, verify each output file exists:

```bash
ls -la .planning/research/repo-research.md .planning/research/best-practices.md .planning/research/framework-docs.md
```

If `INCLUDE_LEARNINGS=true`, also verify:
```bash
ls -la .planning/research/learnings.md
```

If any file is missing, log a warning but continue with available files. Do NOT fail the entire phase because one agent produced no output.

### Step 6: Synthesize Research

Spawn a synthesis Task (NOT in background -- wait for completion):

```
First, read ~/.claude/agents/gsd-research-synthesizer.md for your role and instructions.

Read ALL files in {{CWD}}/.planning/research/ directory (every .md file present).

Synthesize the research outputs into a unified summary. The downstream consumer of your SUMMARY.md is the PRD creation phase, which needs:
- Clear understanding of the project domain and stack
- Key technical constraints and patterns to follow
- Security considerations and quality requirements
- Architectural recommendations
- Risks and pitfalls to mitigate

{if INCLUDE_LEARNINGS was false, add: "Note: No prior learnings were available (docs/solutions/ directory was absent). The learnings-researcher agent was skipped."}

Write your synthesis to: {{CWD}}/.planning/research/SUMMARY.md

IMPORTANT: Also commit all research files in .planning/research/ using git.
```

After the synthesizer completes, verify:
```bash
ls -la .planning/research/SUMMARY.md
```

### Step 7: Write Completion File

Write the completion output file to `.planning/pipeline/research.md` with this exact structure:

```yaml
---
completed: true
agents_spawned: {3 or 4, depending on whether learnings-researcher was included}
learnings_included: {true or false}
---
```

Body: Include the first 20 lines of SUMMARY.md content (after its frontmatter) as a brief excerpt of key findings.

### Step 8: Return Completion

Return:

## PHASE COMPLETE

</instructions>

<success_criteria>
- Output file exists at .planning/pipeline/{{PIPELINE_PHASE}}.md
- Output file has `completed: true` in frontmatter
- .planning/research/SUMMARY.md exists and contains synthesized findings
- At least 3 individual research files exist in .planning/research/ (repo-research.md, best-practices.md, framework-docs.md)
- If docs/solutions/ existed, learnings.md also present in .planning/research/
- All research files have `completed: true` in their frontmatter
</success_criteria>
