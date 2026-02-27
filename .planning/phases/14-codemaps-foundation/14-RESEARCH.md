# Phase 14: Codemaps Foundation - Research

**Researched:** 2026-02-27
**Domain:** Codemap generation, selective agent injection, file freshness detection, CLI subcommands
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 7 files total: STACK.md, ARCHITECTURE.md, STRUCTURE.md, CONCERNS.md, CONVENTIONS.md, DEPENDENCIES.md, API.md
- Each file is a concise summary (~200-400 lines) -- signal without noise
- 4 parallel mapper agents generate all 7 files (agent-to-file split is Claude's discretion)
- Requirements specify: research gets STACK + ARCHITECTURE, PRD/deepen get ARCHITECTURE + STRUCTURE, review gets CONCERNS + CONVENTIONS
- Claude may adjust or extend these mappings (e.g., adding DEPENDENCIES to research, API to PRD) based on agent needs
- Role-based filtering happens in templates/orchestrator, not in CLI
- Staleness threshold: 4 hours
- Fresh codemaps (< 4h): auto-skip silently, no prompt, no log
- Stale codemaps (> 4h): auto-regenerate silently, no prompt, no log
- Missing codemaps: generate silently, no special first-run messaging
- No user prompts for freshness decisions -- fully automatic
- Post-execution refresh: overwrites originals in `.planning/codebase/`, full regeneration, always bypasses freshness, uses same 4 parallel mapper agents
- CLI: JSON only, `codemap check` returns `{exists, fresh}`, `codemap paths` returns 7 absolute paths, `codemap age` returns age in hours

### Claude's Discretion
- How 4 mapper agents split responsibility for 7 files
- Exact codemap-to-agent-role mapping (extending beyond minimum requirements)
- Internal structure and headings within each codemap file
- Error handling for partial generation failures

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CMAP-01 | Pipeline generates codemap before research phase via 4 parallel mapper agents writing to `.planning/codebase/` | Architecture pattern: new `templates/codemap.md` template dispatched as pre-phase step; 4 parallel Task subagents using `run_in_background=true`; mapper agent prompt structure |
| CMAP-02 | Research agents receive selective codemap files (STACK.md + ARCHITECTURE.md) via `{{CODEMAP_FILES}}` | Template variable injection: new `{{CODEMAP_FILES}}` variable in `fillTemplate`; computed per-phase from a role-to-files mapping in SKILL.md |
| CMAP-03 | PRD and deepen agents receive selective codemap files (ARCHITECTURE.md + STRUCTURE.md) | Same mechanism as CMAP-02; different file selection for phases 4 and 5 |
| CMAP-04 | Pipeline refreshes codemap after execution, before review phase | Orchestrator intercept between execute (phase 8) completion and review (phase 9) dispatch; re-runs codemap generation with freshness bypass |
| CMAP-05 | Review agents receive post-execution codemap files (CONCERNS.md + CONVENTIONS.md) | Same `{{CODEMAP_FILES}}` mechanism; phase 9 gets post-execution files |
| CMAP-06 | Pipeline detects existing codemap freshness via mtime and offers skip/refresh/generate | New `lib/codemap.cjs` with `checkFreshness()` using `fs.statSync().mtimeMs`; 4-hour threshold; fully automatic (no user prompt per CONTEXT.md decision) |
| CMAP-07 | `lib/codemap.cjs` provides check, paths, age CLI commands | Three new subcommands routed from `ralph-tools.cjs`; follows `time-budget` pattern |
| CMAP-08 | `templates/codemap.md` inlines mapper agent logic (no Skill tool dependency) | Template contains full mapper agent prompts as inlined Task subagent instructions; no `/update-codemaps` skill invocation |
</phase_requirements>

## Summary

Phase 14 adds codebase context awareness to the ralph-pipeline. The core pattern is straightforward: generate 7 markdown summary files via 4 parallel mapper agents, then selectively inject those files into pipeline phase templates based on agent role. The implementation involves three new artifacts: `lib/codemap.cjs` (CLI commands for freshness/paths/age), `templates/codemap.md` (inlined mapper agent prompts), and modifications to `SKILL.md` + `lib/orchestrator.cjs` for the new `{{CODEMAP_FILES}}` template variable and pre-phase/inter-phase dispatch hooks.

The existing codebase already has `.planning/codebase/` with 7 files (STACK, ARCHITECTURE, STRUCTURE, CONCERNS, CONVENTIONS, INTEGRATIONS, TESTING) from a prior manual run. The decided inventory replaces INTEGRATIONS with DEPENDENCIES and TESTING with API. The architecture closely mirrors existing patterns: `time-budget.cjs` as a model for the new `codemap.cjs` CLI module, `research.md` template as a model for parallel agent dispatch, and `fillTemplate()` for variable injection.

**Primary recommendation:** Implement as three incremental waves: (1) `lib/codemap.cjs` with CLI commands + tests, (2) `templates/codemap.md` with mapper agent prompts, (3) orchestrator integration (SKILL.md + template variables + pre-phase/inter-phase hooks).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js fs | builtin | File stat for mtime, readdir for path listing | Zero-dependency constraint -- project uses no npm packages |
| Node.js path | builtin | Absolute path resolution for codemap files | Same constraint; `path.join(cwd, '.planning', 'codebase', file)` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lib/core.cjs` | internal | `output()`, `error()`, `safeReadFile()`, `loadConfig()`, `saveConfig()` | All CLI command functions |
| `lib/orchestrator.cjs` | internal | `fillTemplate()` for `{{CODEMAP_FILES}}` variable | Template dispatch |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fs.statSync().mtimeMs` | `fs.statSync().mtime.getTime()` | Identical -- `mtimeMs` is simpler, available since Node 8 |
| Inlined mapper agents in template | Separate skill invocation | Skill tool adds dependency and context cost; inlining per CMAP-08 |

**Installation:**
```bash
# No installation needed -- zero npm dependencies
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
├── codemap.cjs          # NEW: check, paths, age CLI commands
├── core.cjs             # Shared utilities (output, error, safeReadFile, loadConfig)
├── commands.cjs         # Git commit logic
├── config.cjs           # Config get/set
├── time-budget.cjs      # Time budget (MODEL for codemap.cjs)
├── orchestrator.cjs     # MODIFIED: add CODEMAP_FILES to fillTemplate variables
└── ...

templates/
├── codemap.md           # NEW: 4 parallel mapper agent prompts
├── research.md          # MODIFIED: receives {{CODEMAP_FILES}}
├── prd.md               # MODIFIED: receives {{CODEMAP_FILES}}
├── deepen.md            # MODIFIED: receives {{CODEMAP_FILES}}
├── review.md            # MODIFIED: receives {{CODEMAP_FILES}}
└── ...

tests/
├── codemap.test.cjs     # NEW: tests for lib/codemap.cjs
└── ...
```

### Pattern 1: CLI Subcommand Module (follow `time-budget.cjs`)
**What:** Each CLI domain gets its own module exporting `cmd*()` functions, wired into `ralph-tools.cjs` via `switch/case`.
**When to use:** Any new CLI command group.
**Example:**
```javascript
// lib/codemap.cjs -- follows time-budget.cjs pattern exactly
const fs = require('fs');
const path = require('path');
const { output, error } = require('./core.cjs');

const CODEMAP_DIR = '.planning/codebase';
const CODEMAP_FILES = [
  'STACK.md', 'ARCHITECTURE.md', 'STRUCTURE.md',
  'CONCERNS.md', 'CONVENTIONS.md', 'DEPENDENCIES.md', 'API.md'
];
const STALENESS_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours

function cmdCodemapCheck(cwd) {
  const dir = path.join(cwd, CODEMAP_DIR);
  const allExist = CODEMAP_FILES.every(f => {
    try { fs.statSync(path.join(dir, f)); return true; } catch { return false; }
  });
  if (!allExist) {
    output({ exists: false, fresh: false });
    return;
  }
  const oldestMtime = Math.min(
    ...CODEMAP_FILES.map(f => fs.statSync(path.join(dir, f)).mtimeMs)
  );
  const age = Date.now() - oldestMtime;
  output({ exists: true, fresh: age < STALENESS_THRESHOLD_MS });
}
```

### Pattern 2: Template Variable Injection (`{{CODEMAP_FILES}}`)
**What:** The orchestrator computes `CODEMAP_FILES` per phase and passes it to `fillTemplate()` alongside existing variables like `PHASE_FILES`.
**When to use:** When phase agents need role-specific context files.
**Example:**
```javascript
// In SKILL.md Step 4 dispatch logic (orchestrator computes this):
const CODEMAP_MAPPING = {
  research: ['STACK.md', 'ARCHITECTURE.md'],
  prd:      ['ARCHITECTURE.md', 'STRUCTURE.md'],
  deepen:   ['ARCHITECTURE.md', 'STRUCTURE.md'],
  review:   ['CONCERNS.md', 'CONVENTIONS.md'],
};

// Compute CODEMAP_FILES value for template
const codemapFiles = (CODEMAP_MAPPING[phase.slug] || [])
  .map(f => `- .planning/codebase/${f}`)
  .join('\n');
```

### Pattern 3: Pre-Phase and Inter-Phase Hooks
**What:** The orchestrator runs codemap generation as a pre-step before the research phase (phase 3) and as an inter-step between execute (phase 8) and review (phase 9).
**When to use:** When the pipeline needs to perform setup work between phases.
**Example:**
```
// In SKILL.md, between Step 2 (position detection) and Step 4 (dispatch):
// Before phase 3 (research):
//   1. Run: codemap check
//   2. If not fresh: dispatch codemap.md template as Task subagent
//
// Between phase 8 complete and phase 9 dispatch:
//   1. Always dispatch codemap.md template (bypass freshness)
```

### Pattern 4: Parallel Mapper Agents (follow `research.md` template)
**What:** `templates/codemap.md` spawns 4 Task subagents with `run_in_background=true`, each writing to specific files in `.planning/codebase/`.
**When to use:** Codemap generation (initial and refresh).
**Recommended agent-to-file split (Claude's discretion):**

| Agent | Files | Focus |
|-------|-------|-------|
| Mapper 1: Stack & Deps | STACK.md, DEPENDENCIES.md | Languages, frameworks, runtime, package deps |
| Mapper 2: Architecture | ARCHITECTURE.md, API.md | Layers, data flow, component boundaries, API surface |
| Mapper 3: Structure & Conventions | STRUCTURE.md, CONVENTIONS.md | File tree, directory purposes, naming patterns, code style |
| Mapper 4: Concerns | CONCERNS.md | Bugs, tech debt, fragility, missing tests, security gaps |

### Anti-Patterns to Avoid
- **Mutating CODEMAP_FILES constant:** The mapping is per-phase, never mutate the base array. Use spread/map to create new arrays.
- **Blocking on codemap generation in orchestrator context:** Always dispatch as Task subagent to avoid consuming orchestrator context window with codebase analysis.
- **Prompting user for freshness decisions:** CONTEXT.md locked this as fully automatic. No AskUserQuestion for codemap freshness.
- **Using Skill tool for codemap generation:** CMAP-08 explicitly requires inlined mapper logic in `templates/codemap.md`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom YAML parser | `lib/frontmatter.cjs` (extractFrontmatter, reconstructFrontmatter) | Already handles the full subset needed; battle-tested in 5 existing modules |
| JSON CLI output | Custom JSON serialization | `lib/core.cjs` (output, error) | Handles raw mode, >50KB temp file fallback, consistent exit codes |
| Config persistence | Direct fs.writeFileSync to config.json | `lib/core.cjs` (loadConfig, saveConfig) | Handles defaults, missing file gracefully, consistent format |
| Temp directory creation | Manual mkdirSync | Existing pattern in tests (`fs.mkdtempSync`) | Project's test suite uses this consistently |
| Git operations | Direct execSync git calls | `lib/core.cjs` (execGit) | Handles escaping, exit code capture, stdio piping |

**Key insight:** This project has a strong internal library in `lib/core.cjs` that handles all common operations. Every new module follows the same pattern: import from core, export cmd* functions, wire into ralph-tools.cjs switch/case.

## Common Pitfalls

### Pitfall 1: Existing Codemap Files Have Different Names
**What goes wrong:** The existing `.planning/codebase/` has INTEGRATIONS.md and TESTING.md, but the decided inventory has DEPENDENCIES.md and API.md. If the planner doesn't account for this, the old files persist alongside new ones, confusing agents.
**Why it happens:** Codemaps were previously generated manually or by a different tool with a different file inventory.
**How to avoid:** First wave of implementation should either rename or delete old files. The `codemap check` command validates against the decided 7-file inventory, not whatever exists on disk.
**Warning signs:** `codemap check` returns `exists: false` even though files are present in the directory.

### Pitfall 2: Race Condition in Parallel Agent File Writes
**What goes wrong:** Two mapper agents assigned overlapping files could corrupt output.
**Why it happens:** Each agent writes to specific files, but if the split is ambiguous, two agents could write to the same file.
**How to avoid:** The agent-to-file mapping must be unambiguous. Each file is assigned to exactly one agent. The template must clearly specify which agent writes which files.
**Warning signs:** File content from one agent overwritten by another; truncated or mixed content.

### Pitfall 3: `fillTemplate` Throws on Empty `{{CODEMAP_FILES}}`
**What goes wrong:** For phases that don't receive codemaps (preflight, clarify, convert, execute), `CODEMAP_FILES` would be empty string. If the template doesn't have `{{CODEMAP_FILES}}`, `fillTemplate` ignores it. But if it does have the placeholder and the value is empty, the placeholder is replaced with empty string (fine). However, if `CODEMAP_FILES` is not provided as a key at all, `fillTemplate` throws "Unresolved template variables."
**Why it happens:** `fillTemplate` strictly validates that all `{{VAR}}` patterns are resolved.
**How to avoid:** Always pass `CODEMAP_FILES` key in the variables object, even as empty string for phases that don't need codemaps. Only add `{{CODEMAP_FILES}}` to templates that actually need it (research, prd, deepen, review).
**Warning signs:** Pipeline crashes at dispatch with "Unresolved template variables: {{CODEMAP_FILES}}".

### Pitfall 4: Staleness Check Uses Oldest File
**What goes wrong:** If 6 of 7 files are fresh but 1 is stale (e.g., from a partial previous run), the entire set is considered stale.
**Why it happens:** `codemap check` must use the oldest file's mtime to guarantee all files are fresh.
**How to avoid:** This is the correct behavior -- partial staleness means full regeneration. But the planner should be aware that `codemap check` reports on the set, not individual files.
**Warning signs:** Codemap regeneration happening more often than expected; one file consistently older than others.

### Pitfall 5: Post-Execution Refresh Timing
**What goes wrong:** If post-execution refresh is placed after the review gate approval (Step 6) instead of between execute completion and review dispatch, the review agents receive pre-execution codemaps.
**Why it happens:** The orchestrator's flow is: dispatch phase -> verify -> gate -> next phase. The refresh must happen in the "next phase" transition, specifically between execute and review.
**How to avoid:** The orchestrator hook must be: "if just-completed phase is execute (8), run codemap refresh before dispatching review (9)." Insert this in SKILL.md Step 4 dispatch, not in Step 6 gate.
**Warning signs:** Review agents see pre-execution CONCERNS.md that doesn't mention newly introduced issues.

### Pitfall 6: Config Mutation Pattern
**What goes wrong:** `loadConfig()` returns an object, and modifications to nested properties mutate the original.
**Why it happens:** JavaScript object spread is shallow.
**How to avoid:** The `codemap.cjs` module doesn't need to persist config (unlike `time-budget.cjs`). It only reads filesystem state. No `saveConfig` needed. But if future changes add config, use immutable patterns per project coding style.
**Warning signs:** N/A for this phase, but worth noting as a project convention.

## Code Examples

Verified patterns from the existing codebase:

### CLI Subcommand Registration (ralph-tools.cjs)
```javascript
// Source: ralph-tools.cjs lines 280-300 (time-budget pattern)
case 'codemap': {
  const sub = args[1];
  if (!sub) error('Usage: codemap <check|paths|age>', 'INVALID_ARGS');
  switch (sub) {
    case 'check':
      codemap.cmdCodemapCheck(cwd);
      break;
    case 'paths':
      codemap.cmdCodemapPaths(cwd);
      break;
    case 'age':
      codemap.cmdCodemapAge(cwd);
      break;
    default:
      error('Unknown codemap subcommand: ' + sub, 'UNKNOWN_SUBCOMMAND');
  }
  break;
}
```

### Parallel Task Subagent Dispatch (from templates/research.md)
```
Spawn a Task with `run_in_background=true`:

You are a codebase mapper agent. Your job is to analyze the project and write concise codebase summaries.

YOUR TASK:
Analyze the project at {{CWD}} and write:
1. {{CWD}}/.planning/codebase/STACK.md -- languages, frameworks, runtime, versions
2. {{CWD}}/.planning/codebase/DEPENDENCIES.md -- package deps, external services, integrations

Write each file with 200-400 lines max. Focus on signal, not noise.
```

### Template Variable Addition
```javascript
// In SKILL.md Step 4, add CODEMAP_FILES to the variables object:
// (This is orchestrator-level logic, not lib/ code)
const CODEMAP_ROLE_MAP = {
  research: ['STACK.md', 'ARCHITECTURE.md'],
  prd:      ['ARCHITECTURE.md', 'STRUCTURE.md'],
  deepen:   ['ARCHITECTURE.md', 'STRUCTURE.md'],
  review:   ['CONCERNS.md', 'CONVENTIONS.md'],
};

const codemapFilesList = CODEMAP_ROLE_MAP[phase.slug] || [];
const CODEMAP_FILES = codemapFilesList
  .map(f => `- .planning/codebase/${f}`)
  .join('\n');

// Pass to fillTemplate alongside existing vars
fillTemplate(templateContent, {
  CWD: projectCwd,
  RALPH_TOOLS: ralphToolsPath,
  PIPELINE_DISPLAY_NAME: phase.displayName,
  PIPELINE_PHASE: phase.slug,
  PHASE_ID: phase.id,
  STATE_PATH: '.planning/STATE.md',
  CONFIG_PATH: '.planning/config.json',
  PHASE_FILES: phaseFiles,
  CODEMAP_FILES: CODEMAP_FILES,  // NEW
});
```

### Test Pattern (from tests/orchestrator.test.cjs)
```javascript
// Source: tests/orchestrator.test.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// Helper: create temp directory with codemap files
function createTempCodebase(files) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-codemap-test-'));
  const codebaseDir = path.join(tmpDir, '.planning', 'codebase');
  fs.mkdirSync(codebaseDir, { recursive: true });
  for (const [filename, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(codebaseDir, filename), content, 'utf-8');
  }
  return tmpDir;
}

test('cmdCodemapCheck returns exists:false when directory missing', () => {
  // ...
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `/update-codemaps` skill invocation | Inlined mapper agents in `templates/codemap.md` | This phase (CMAP-08) | Eliminates Skill tool dependency; mapper prompts are self-contained |
| Codemaps stored in `docs/CODEMAPS/` | Codemaps stored in `.planning/codebase/` | Already migrated (existing files) | Standard location for pipeline artifacts |
| 7 files: INTEGRATIONS + TESTING | 7 files: DEPENDENCIES + API | This phase (CONTEXT.md decision) | Better agent utility; DEPENDENCIES covers npm/external, API covers surface area |

**Deprecated/outdated:**
- INTEGRATIONS.md: Replaced by DEPENDENCIES.md (broader scope: packages + external services)
- TESTING.md: Removed from codemap inventory (testing concerns folded into CONCERNS.md or agent-specific context)

## Open Questions

1. **How should partial generation failure be handled?**
   - What we know: 4 agents write 7 files. If one agent fails, some files will be missing.
   - What's unclear: Should the pipeline proceed with partial codemaps, or block until all 7 exist?
   - Recommendation: Proceed with available files. The `codemap check` command returns `exists: false` for partial sets, but the orchestrator can still inject whichever files exist. Log a warning. This is Claude's discretion per CONTEXT.md.

2. **Should `CODEMAP_FILES` be added to all 9 templates or only the 4 that use it?**
   - What we know: Only research (3), prd (4), deepen (5), review (9) receive codemaps per requirements.
   - What's unclear: Adding `{{CODEMAP_FILES}}` to unused templates would require passing empty string to avoid fillTemplate throwing.
   - Recommendation: Only add `{{CODEMAP_FILES}}` placeholder to the 4 templates that need it. This avoids passing empty values and keeps unused templates clean. The orchestrator only computes CODEMAP_FILES for these 4 phases.

3. **Should old INTEGRATIONS.md and TESTING.md be deleted during codemap generation?**
   - What we know: Existing `.planning/codebase/` has different files than the decided inventory.
   - What's unclear: Whether to clean the directory before generation or leave old files.
   - Recommendation: Clear the entire `.planning/codebase/` directory before generation, then write the 7 decided files. This prevents confusion from stale files with old names. The codemap template should include a cleanup step.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `lib/time-budget.cjs` -- model for CLI subcommand module
- Existing codebase: `lib/orchestrator.cjs` -- `fillTemplate()` function and variable injection pattern
- Existing codebase: `templates/research.md` -- parallel Task subagent dispatch pattern
- Existing codebase: `lib/core.cjs` -- shared utilities (output, error, safeReadFile, loadConfig)
- Existing codebase: `ralph-tools.cjs` -- switch/case routing pattern
- Existing codebase: `tests/orchestrator.test.cjs` -- test framework pattern (Node assert, no dependencies)

### Secondary (MEDIUM confidence)
- Existing files in `.planning/codebase/` -- content structure and heading patterns for codemap files
- `SKILL.md` -- PHASE_FILES mapping table as model for CODEMAP_FILES mapping

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero-dependency Node.js builtins, project patterns are well-established
- Architecture: HIGH -- follows existing patterns exactly (time-budget for CLI, research template for agents, fillTemplate for injection)
- Pitfalls: HIGH -- identified from direct codebase analysis (fillTemplate strict validation, existing file naming mismatch, race conditions)

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable -- internal project patterns, no external dependency drift)
