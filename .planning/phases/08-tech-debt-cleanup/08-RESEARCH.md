# Phase 8: Tech Debt Cleanup - Research

**Researched:** 2026-02-26
**Domain:** Template implementation + dead export removal (Node.js CJS, Claude Code skill templates)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Template invokes `node ralph-tools.cjs preflight --raw` and parses JSON result
- On pass: show summary (skills found, MCP servers found, reference OK), write `completed: true`
- On fail: display each missing item with install hint, offer "Install and retry" / "Retry" / "Abort pipeline" via AskUserQuestion
- If setup_actions exist (gitignore, planning dir, IDE pref): handle them interactively before writing completion
- Match existing template structure (frontmatter completion flag, `## PHASE COMPLETE` return)
- Clarify gathers via AskUserQuestion: project name, one-line description, primary stack (language + framework), target platform (web/mobile/CLI/library), quality gates (test coverage threshold, linting)
- Write answers to .planning/pipeline/clarify.md with structured frontmatter
- Keep it to 3-4 questions max -- not a full PRD, just enough context for downstream phases
- If .planning/PROJECT.md already has stack/description info, pre-populate and confirm rather than re-asking
- Preflight failures hard-block the pipeline (exit code 1, no bypass)
- Required items (skills, MCP servers, GSD reference) are blocking; optional items (bd, br CLIs) show as warnings but don't block
- Remove `REQUIRED_SKILLS`, `REQUIRED_MCP_SERVERS`, `OPTIONAL_CLIS` from preflight.cjs exports (only used internally)
- Keep `cmdPreflight` (used by ralph-tools.cjs) and `CACHE_VERSION` (used by init.cjs)
- Audit all lib/*.cjs files for unused exports while we're at it -- same pass, minimal effort

### Claude's Discretion
- Exact AskUserQuestion phrasing and option labels for both templates
- How to format the preflight results display (table vs list)
- Whether to show timing info for preflight checks
- Error message wording

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ORCH-02 | Pre-flight detects IDE environment and checks only relevant dependencies | Preflight template now invokes `cmdPreflight` CLI and displays results interactively instead of stub |
| ORCH-03 | Pipeline executes phases sequentially: pre-flight -> clarify -> research -> ... | Clarify template now gathers real scope data instead of stub; templates integrate into pipeline flow |
</phase_requirements>

## Summary

This phase replaces two stub templates (`templates/preflight.md` and `templates/clarify.md`) with functional implementations and removes dead exports from `lib/preflight.cjs`. The stubs were created in Phase 2 (Orchestrator Shell) as placeholders that immediately write `completed: true` without doing real work. The v1.0 milestone audit flagged these as tech debt items.

The work is entirely internal to the existing codebase -- no new libraries, no architectural changes, no new CLI commands. The preflight template needs to invoke the already-working `cmdPreflight` via `node ralph-tools.cjs preflight --raw`, parse the JSON output, display results, and handle failures interactively. The clarify template needs to gather 3-4 scope questions via AskUserQuestion and write structured output. The dead export cleanup is a mechanical removal of 3 constants from `module.exports` in `preflight.cjs`, plus one additional dead export (`spliceFrontmatter`) found during the audit.

**Primary recommendation:** Follow the existing functional template patterns (research.md, resolve.md) for structure. Parse preflight JSON output using bash `node ralph-tools.cjs preflight --raw` and handle the exit code. Use AskUserQuestion pattern from SKILL.md Step 1b and resolve.md for the interactive flows.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js builtins | 18+ | ralph-tools.cjs CLI (fs, path, child_process) | Zero-dep constraint (STATE-01) |
| Claude Code Task tool | current | Template dispatch and subagent execution | Built-in tool for context-isolated phase execution |
| AskUserQuestion | current | Interactive user prompts in templates | Standard Claude Code pattern for user interaction |

### Supporting
No new libraries required. This phase modifies existing files only.

### Alternatives Considered
None -- the implementation approach is fully constrained by locked decisions in CONTEXT.md.

## Architecture Patterns

### Existing Template Structure
All functional templates follow this skeleton:
```
<objective>
Execute {{PHASE_NAME}} phase ({{PHASE_ID}} of 9) for the current pipeline project.
{one-line purpose}
</objective>

<files_to_read>
- {{STATE_PATH}}
- {{CONFIG_PATH}}
{{PHASE_FILES}}
</files_to_read>

<instructions>
<!-- YOLO mode: gate bypass handled by orchestrator (SKILL.md Step 6) -->
## Phase Name

### Step 1: Read Context
### Step 2-N: Phase-specific logic
### Step N+1: Write Completion File
### Step N+2: Return Completion
## PHASE COMPLETE
</instructions>

<success_criteria>
- Output file exists at .planning/pipeline/{{PHASE_SLUG}}.md
- Output file has `completed: true` in frontmatter
- {phase-specific criteria}
</success_criteria>
</output>
```

### Pattern 1: CLI Invocation and JSON Parsing
**What:** Templates invoke ralph-tools.cjs commands and parse JSON output
**When to use:** When the template needs data from the CLI (preflight results, config values, scan results)
**Example:**
```bash
# Invoke CLI
node ralph-tools.cjs preflight --raw
```
The `--raw` flag outputs compact JSON (no pretty-printing). Exit code 0 = success, exit code 1 = failure.

**Preflight JSON output structure (on success):**
```json
{
  "passed": true,
  "missing": [
    {"type": "cli", "name": "br", "purpose": "Rust bead CLI", "required": false, "install_hint": "..."}
  ],
  "setup_actions": [
    {"action": "ask_ide", "options": ["vscode","cursor","zed","neovim","other"]},
    {"action": "add_gitignore", "pattern": ".reference/"},
    {"action": "init_planning", "missing_files": ["STATE.md"]}
  ],
  "reference": {"available": true, "source": "project", "path": ".reference/get-shit-done/", "version": "1.21.0"},
  "config": {"ide": "vscode"}
}
```

**Preflight JSON output structure (on failure):**
```
stderr: {"error":true,"message":"Pre-flight failed: N required dependency(s) missing:\n  - ...","code":"PREFLIGHT_FAILED"}
stdout: {full result JSON as above, with passed: false}
exit code: 1
```

### Pattern 2: AskUserQuestion Usage
**What:** Present interactive choices to the user within template execution
**When to use:** When the template needs user decisions (preflight failure recovery, clarify scope gathering)
**Example from SKILL.md Step 1b:**
```
AskUserQuestion:
  Header: "Time Budget" (max 12 chars)
  Question: "How many hours should the pipeline run..."
  Options:
    1. 2 hours -- Short session
    2. 4 hours -- Standard session
    3. No limit -- Run until completion
    4. Custom -- I will specify
```

**Example from resolve.md Step 3c:**
```
- Header: Short label, maximum 12 characters
- Question: The unresolved item with context
- Options: 2-3 generated answers + "Let me explain my own answer"
```

### Pattern 3: Completion File Structure
**What:** Each phase writes a completion file with YAML frontmatter and markdown body
**When to use:** Final step of every template
**Example:**
```yaml
---
completed: true
{phase_specific_fields}: {values}
---
## Phase Summary
{content}
```

### Anti-Patterns to Avoid
- **Direct process.exit in templates:** Templates are executed as Task subagents; they return `## PHASE COMPLETE` or `## PHASE FAILED`, not exit codes
- **Reading phase output content into orchestrator:** The orchestrator passes file paths only via `<files_to_read>` blocks
- **Mutation of CLI data structures:** All state changes go through ralph-tools.cjs commands, never direct file writes to config.json or STATE.md

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Preflight checks | Custom check logic in template | `node ralph-tools.cjs preflight --raw` | cmdPreflight already validates skills, MCP servers, CLIs, GSD reference, gitignore, planning dir, IDE preference |
| Setup actions | Custom setup logic in template | `node ralph-tools.cjs setup-reference`, `node ralph-tools.cjs setup-gitignore <pattern>` | Already implemented as CLI commands in ralph-tools.cjs |
| Config reads/writes | Direct JSON file manipulation | `node ralph-tools.cjs config-get <key>`, `node ralph-tools.cjs config-set <key> <value>` | Handles type coercion, path resolution, and concurrent access |

**Key insight:** The preflight.cjs module and ralph-tools.cjs CLI already do all the heavy lifting. The template's job is to invoke the CLI, parse the result, present it to the user, handle interactive recovery, and write the completion file.

## Common Pitfalls

### Pitfall 1: Preflight Exit Code on Failure
**What goes wrong:** Template tries to run `node ralph-tools.cjs preflight --raw` and doesn't handle exit code 1
**Why it happens:** On failure, cmdPreflight writes to both stderr (error JSON) and stdout (full result JSON), then calls `process.exit(1)`. The template needs to capture stdout even when the command fails.
**How to avoid:** Run the command, check exit code. If exit code 1, parse stdout (NOT stderr) for the full result JSON. The `passed: false` field in the result indicates failure, and `missing` array contains all items that failed.
**Warning signs:** Template sees empty output or only error JSON after preflight failure.

### Pitfall 2: YOLO Mode in Preflight Template
**What goes wrong:** Forgetting that YOLO mode should auto-approve gates but preflight failures still hard-block
**Why it happens:** The CONTEXT.md says "Preflight failures hard-block the pipeline (exit code 1, no bypass)". YOLO mode bypasses user gates (handled by orchestrator Step 6), but the preflight template's internal failure logic should still block.
**How to avoid:** YOLO mode in the preflight template only affects setup_actions interactivity (auto-approve IDE selection, gitignore addition). It does NOT auto-approve missing required dependencies.
**Warning signs:** Pipeline proceeds with missing skills/MCP servers in YOLO mode.

### Pitfall 3: Clarify Pre-Population from PROJECT.md
**What goes wrong:** Template re-asks questions that PROJECT.md already answers, wasting user time
**Why it happens:** PROJECT.md may contain stack info and project description that the clarify template should detect and pre-populate
**How to avoid:** Read .planning/PROJECT.md first, extract project name, description, and stack info. Present pre-populated answers as confirmation ("I found X in PROJECT.md. Is this correct?") rather than asking from scratch.
**Warning signs:** User has to re-type information that's already on disk.

### Pitfall 4: Clarify Output Format Incompatibility
**What goes wrong:** Downstream phases (research, PRD) can't parse the clarify output
**Why it happens:** The research template reads `.planning/pipeline/clarify.md` and extracts project description, stack decisions, quality gates, scope boundaries. If the clarify template writes in a different format, research fails.
**How to avoid:** Study the research template Step 1 (lines 21-33 of research.md) to understand what fields it expects. Write clarify.md output with clear section headers that research.md can parse.
**Warning signs:** Research phase fails to extract context from clarify output.

### Pitfall 5: Dead Export Removal Breaking Tests
**What goes wrong:** Removing exports from preflight.cjs breaks test imports
**Why it happens:** Tests might import the constants for their own assertions
**How to avoid:** Verified: `REQUIRED_SKILLS`, `REQUIRED_MCP_SERVERS`, `OPTIONAL_CLIS` are NOT imported in any test file. Only `preflight.test.cjs` exists for this module, and it uses subprocess execution (execSync) exclusively. Safe to remove from exports.
**Warning signs:** Test files importing removed constants -- already verified this is not the case.

## Code Examples

### Preflight Template: CLI Invocation and Result Parsing
```markdown
### Step 1: Run Preflight Checks

Run the preflight CLI command:
\`\`\`bash
node ralph-tools.cjs preflight --raw
\`\`\`

Capture the JSON output and exit code.

If exit code is 0 (passed):
- Parse the JSON result
- Count items: skills found, MCP servers found, reference status
- Display summary to user

If exit code is 1 (failed):
- Parse stdout (NOT stderr) for the full result JSON
- Extract the `missing` array where `required: true`
- Display each missing item with its `install_hint`
```

### Preflight Template: Setup Actions Handling
```markdown
### Step 2: Handle Setup Actions

From the preflight result, check `setup_actions` array.

For each action:
- `add_gitignore`: Run `node ralph-tools.cjs setup-gitignore {pattern}`
- `init_planning`: Create missing files in .planning/ directory
- `ask_ide`: Present IDE options via AskUserQuestion, then `node ralph-tools.cjs config-set ide {choice}`
```

### Clarify Template: Scope Gathering Pattern
```markdown
### Step 2: Gather Project Scope

Present scope questions via AskUserQuestion (3-4 questions max):

Question 1: "Project Name"
  - If PROJECT.md has a name, pre-fill: "I found '{name}' in PROJECT.md. Confirm or edit."
  - Options: {pre-filled value}, "Let me specify"

Question 2: "Stack"
  - Header: "Stack" (5 chars)
  - Question: "Primary language + framework?"
  - Options: Pre-populated from PROJECT.md if available, plus "Let me specify"

Question 3: "Platform"
  - Header: "Platform" (8 chars)
  - Options: Web, Mobile, CLI, Library, Other

Question 4: "Quality"
  - Header: "Quality" (7 chars)
  - Question: "Test coverage threshold and linting?"
  - Options: "80% + ESLint", "90% + strict", "No gates", "Custom"
```

### Clarify Template: Output File Format
```yaml
---
completed: true
project_name: "{name}"
primary_stack: "{language} + {framework}"
target_platform: "{platform}"
quality_gates: "{gates}"
---
## Project Scope

**Project:** {name}
**Description:** {one-line description}

**Stack:** {language} + {framework}
**Platform:** {platform}

**Quality Gates:**
- Test coverage: {threshold}
- Linting: {tool}

**Scope:** {brief scope statement from user}
```

### Dead Export Removal
```javascript
// BEFORE (lib/preflight.cjs lines 373-379)
module.exports = {
  cmdPreflight,
  REQUIRED_SKILLS,
  REQUIRED_MCP_SERVERS,
  OPTIONAL_CLIS,
  CACHE_VERSION,
};

// AFTER
module.exports = {
  cmdPreflight,
  CACHE_VERSION,
};
```

### spliceFrontmatter Dead Export Removal
```javascript
// BEFORE (lib/frontmatter.cjs lines 245-249)
module.exports = {
  extractFrontmatter,
  reconstructFrontmatter,
  spliceFrontmatter,
};

// AFTER
module.exports = {
  extractFrontmatter,
  reconstructFrontmatter,
};
```

## Dead Export Audit Results

Full audit of all `lib/*.cjs` exports vs actual imports:

| File | Export | Imported By | Status |
|------|--------|-------------|--------|
| **lib/preflight.cjs** | | | |
| | `cmdPreflight` | ralph-tools.cjs | LIVE |
| | `CACHE_VERSION` | lib/init.cjs | LIVE |
| | `REQUIRED_SKILLS` | *(none)* | DEAD -- remove |
| | `REQUIRED_MCP_SERVERS` | *(none)* | DEAD -- remove |
| | `OPTIONAL_CLIS` | *(none)* | DEAD -- remove |
| **lib/frontmatter.cjs** | | | |
| | `extractFrontmatter` | lib/orchestrator.cjs, lib/state.cjs | LIVE |
| | `reconstructFrontmatter` | lib/state.cjs | LIVE |
| | `spliceFrontmatter` | *(none)* | DEAD -- remove |
| **lib/core.cjs** | | | |
| | `output` | multiple | LIVE |
| | `error` | multiple | LIVE |
| | `safeReadFile` | ralph-tools.cjs, lib/preflight.cjs | LIVE |
| | `execGit` | lib/commands.cjs | LIVE |
| | `pathExistsInternal` | lib/init.cjs | LIVE |
| | `loadConfig` | lib/config.cjs, lib/preflight.cjs, lib/init.cjs, lib/time-budget.cjs | LIVE |
| | `saveConfig` | lib/config.cjs, lib/time-budget.cjs | LIVE |
| **lib/config.cjs** | all exports | ralph-tools.cjs | LIVE |
| **lib/state.cjs** | all exports | ralph-tools.cjs, lib/init.cjs, lib/phase.cjs | LIVE |
| **lib/phase.cjs** | all exports | ralph-tools.cjs, lib/init.cjs | LIVE |
| **lib/commands.cjs** | all exports | ralph-tools.cjs | LIVE |
| **lib/init.cjs** | all exports | ralph-tools.cjs | LIVE |
| **lib/orchestrator.cjs** | all exports | ralph-tools.cjs, tests/ | LIVE |
| **lib/time-budget.cjs** | all exports | ralph-tools.cjs | LIVE |

**Summary:** 4 dead exports total across 2 files: 3 in preflight.cjs (per CONTEXT.md) + 1 in frontmatter.cjs (found during audit).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stub templates immediately write completed: true | Functional templates invoke CLI and gather real data | Phase 8 (this phase) | Closes ORCH-02, ORCH-03 tech debt |
| All internal constants exported | Only externally-consumed symbols exported | Phase 8 (this phase) | Cleaner module API surface |

**Deprecated/outdated:**
- The stub template pattern (write completed: true immediately) was Phase 2 scaffolding. After this phase, no stub templates remain.

## Open Questions

1. **Clarify output format: how does research.md parse it?**
   - What we know: research.md Step 1 reads `.planning/pipeline/clarify.md` and extracts "project description, stack decisions, quality gates, scope boundaries"
   - What's unclear: research.md does not specify a structured extraction method (no Grep pattern, no frontmatter field names) -- it uses natural language understanding to extract from the clarify output
   - Recommendation: Use clear markdown section headers (`## Stack`, `## Quality Gates`, etc.) that are unambiguous to parse. Include key data in both frontmatter (machine-readable) and body (human-readable). LOW risk -- Claude agents handle natural language extraction well.

2. **YOLO mode behavior in setup_actions**
   - What we know: YOLO bypasses user gates at orchestrator level (SKILL.md Step 6). Templates have YOLO comments.
   - What's unclear: Should the preflight template auto-handle setup_actions (gitignore, planning dir, IDE) in YOLO mode without asking, or always ask?
   - Recommendation: Auto-handle setup_actions in YOLO mode (run setup-gitignore, use "vscode" as default IDE, create planning files). This matches the YOLO philosophy of zero interaction. Required dependency failures still block regardless.

## Sources

### Primary (HIGH confidence)
- Direct inspection of project source files: `templates/preflight.md`, `templates/clarify.md`, `lib/preflight.cjs`, `templates/research.md`, `templates/resolve.md`, `SKILL.md`, `ralph-tools.cjs`, all `lib/*.cjs` files
- `.planning/v1.0-MILESTONE-AUDIT.md` -- tech debt inventory
- `.planning/phases/08-tech-debt-cleanup/08-CONTEXT.md` -- user decisions

### Secondary (MEDIUM confidence)
- Existing functional templates (research.md, resolve.md, deepen.md, convert.md, execute.md, review.md) -- pattern reference for template structure

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing project code inspected directly
- Architecture: HIGH -- following established template patterns already proven in 7 functional templates
- Pitfalls: HIGH -- all identified through direct code inspection and cross-referencing actual output formats
- Dead export audit: HIGH -- exhaustive grep of all lib/*.cjs module.exports vs all require() statements

**Research date:** 2026-02-26
**Valid until:** indefinite (internal codebase patterns, not external library versions)
