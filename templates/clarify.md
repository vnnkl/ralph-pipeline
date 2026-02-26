<objective>
Execute {{PHASE_NAME}} phase ({{PHASE_ID}} of 9) for the current pipeline project.

Gather project scope, stack choices, quality gates, and target platform via interactive questions. Write structured output for downstream research and PRD phases.
</objective>

<files_to_read>
- {{STATE_PATH}}
- {{CONFIG_PATH}}
{{PHASE_FILES}}
</files_to_read>

<instructions>
<!-- YOLO mode: gate bypass handled by orchestrator (SKILL.md Step 6) -->
## Clarify Phase

You are a scope-gathering agent. Your job is to collect essential project context (name, description, stack, platform, quality gates) and write structured output that downstream phases (research, PRD) can parse.

### Step 1: Read Context

Read the files listed in files_to_read above.

Then check if `.planning/PROJECT.md` exists. If it does, read it and extract any existing values:
- **Project name** -- look for a title heading or "name" field
- **Description** -- look for a description or summary
- **Stack info** -- look for language, framework, library mentions
- **Platform info** -- look for web, mobile, CLI, library mentions

Store extracted values as PRE_POPULATED defaults for Step 3. If PROJECT.md does not exist or a field is not found, leave that default empty.

### Step 2: Check YOLO Mode

Run:
```bash
node ralph-tools.cjs config-get mode --raw
```

If the result is `yolo`, set YOLO_MODE to true.

**If YOLO_MODE is true:**

Use PRE_POPULATED values from PROJECT.md if available. For any missing values, generate reasonable defaults:
- **project_name:** Use the basename of {{CWD}}
- **description:** "Project managed by ralph-pipeline"
- **primary_stack:** Attempt to detect from project files:
  - If `package.json` exists: read it for language/framework clues (TypeScript, React, Next.js, etc.)
  - If `go.mod` exists: "Go"
  - If `Cargo.toml` exists: "Rust"
  - If `requirements.txt` or `pyproject.toml` exists: "Python"
  - Otherwise: "Not specified"
- **target_platform:** "web" (default)
- **quality_gates:** "80% test coverage + linting"

Log each auto-generated value:
```
YOLO mode: project_name = {value}
YOLO mode: description = {value}
YOLO mode: primary_stack = {value}
YOLO mode: target_platform = {value}
YOLO mode: quality_gates = {value}
```

Skip all AskUserQuestion calls -- go directly to Step 4.

**If YOLO_MODE is false:** Proceed to Step 3.

### Step 3: Gather Project Scope (3-4 questions via AskUserQuestion)

**Question 1: Project Name and Description**

If PROJECT.md had a project name:

AskUserQuestion:
  Header: Project
  Question: I found '{pre_populated_name}' in PROJECT.md. Is this correct, or would you like to change it?
  Options:
    1. {pre_populated_name} -- Confirm this name
    2. Let me specify a different name

If no pre-populated name:

AskUserQuestion:
  Header: Project
  Question: What is the project name?
  Options:
    1. Let me describe the project

After receiving the project name, if no description was pre-populated from PROJECT.md, ask:

AskUserQuestion:
  Header: Describe
  Question: Provide a one-line description of what {project_name} does.
  Options:
    1. Let me describe it

If PROJECT.md already had a description, present it for confirmation:

AskUserQuestion:
  Header: Describe
  Question: I found this description in PROJECT.md -- '{pre_populated_description}'. Is this correct?
  Options:
    1. {pre_populated_description} -- Confirm
    2. Let me provide a different description

**Question 2: Primary Stack**

Attempt auto-detection from common project files:
- `package.json` exists -> read it for language/framework (e.g., "TypeScript + Next.js", "JavaScript + Express")
- `go.mod` exists -> "Go"
- `Cargo.toml` exists -> "Rust"
- `requirements.txt` or `pyproject.toml` exists -> "Python"

Build options list dynamically:
- If PROJECT.md had stack info, add it as option 1
- If auto-detection found a stack different from PROJECT.md, add it as option 2
- Always include "Let me specify" as the last option

AskUserQuestion:
  Header: Stack
  Question: What is the primary language and framework?
  Options:
    1. {pre_populated or detected stack} -- {source: "from PROJECT.md" or "detected from package.json"}
    2. {alternative detection if different}
    3. Let me specify

**Question 3: Target Platform**

AskUserQuestion:
  Header: Platform
  Question: What is the target platform?
  Options:
    1. Web -- Browser-based application
    2. Mobile -- iOS/Android app
    3. CLI -- Command-line tool
    4. Library -- Reusable package/SDK
    5. Other -- Let me specify

**Question 4: Quality Gates**

AskUserQuestion:
  Header: Quality
  Question: What test coverage and linting standards should the pipeline enforce?
  Options:
    1. 80% coverage + ESLint -- Standard
    2. 90% coverage + strict linting -- High bar
    3. No quality gates -- Skip enforcement
    4. Custom -- Let me specify

### Step 4: Write Completion File

Write `.planning/pipeline/clarify.md` with YAML frontmatter and a markdown body using clear section headers.

**Frontmatter:**

```yaml
---
completed: true
project_name: "{name}"
primary_stack: "{language} + {framework}"
target_platform: "{platform}"
quality_gates: "{gates description}"
---
```

**Body:**

```markdown
## Project Scope

**Project:** {name}
**Description:** {one-line description}

## Stack

**Primary:** {language} + {framework}
**Detected from:** {source, e.g., "package.json", "PROJECT.md", "user input"}

## Platform

**Target:** {platform}

## Quality Gates

- Test coverage: {threshold}
- Linting: {tool/standard}

## Scope Boundaries

**In scope:** {brief scope from description and stack choices}
**Out of scope:** {anything explicitly excluded, or "Not specified"}
```

IMPORTANT: Use these exact section headers (## Project Scope, ## Stack, ## Quality Gates, ## Scope Boundaries) so that the research template (Step 1) can extract each section by natural language understanding.

### Step 5: Return Completion

Return:

## PHASE COMPLETE

</instructions>

<success_criteria>
- Output file exists at .planning/pipeline/{{PHASE_SLUG}}.md with completed: true
- Output contains project name, stack, platform, and quality gates
- If PROJECT.md existed, pre-populated values were offered for confirmation
- Each question presented via AskUserQuestion with concrete options
- Research template (Step 1) can extract project description, stack decisions, quality gates, and scope boundaries from the output
</success_criteria>
