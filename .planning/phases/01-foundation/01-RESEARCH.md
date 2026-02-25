# Phase 1: Foundation - Research

**Researched:** 2026-02-25
**Domain:** Node.js CLI tooling, YAML frontmatter parsing, Claude Code skill packaging, disk-based state management
**Confidence:** HIGH

## Summary

Phase 1 builds the foundational CLI (`ralph-tools.cjs`) and `.planning/` schema that every subsequent phase depends on. The GSD reference implementation at `~/.claude/get-shit-done/` provides a fully battle-tested architecture: a main router (`gsd-tools.cjs`, ~590 lines) that delegates to modular `lib/*.cjs` files for state, config, phase ops, frontmatter, init compounds, and git commits. ralph-tools.cjs should mirror this architecture precisely -- same JSON-only output, same `output()`/`error()` patterns, same compound `init` commands that load all context in one call -- but scoped to ralph-pipeline's domain (pipeline phases, pre-flight checks, skill dependency verification).

The key technical risks are: (1) hand-rolling YAML frontmatter parsing instead of using GSD's proven regex-based `extractFrontmatter`/`reconstructFrontmatter` (just copy the pattern), (2) pre-flight dependency checking that warns instead of blocking (CONTEXT.md says blocking errors), and (3) the GSD reference repo setup which requires `git clone` with a pinned tag but GSD is not currently published as a standalone git repo (it's distributed through the Claude Code plugin system).

**Primary recommendation:** Model ralph-tools.cjs directly on gsd-tools.cjs architecture (router + lib modules), copy the frontmatter parser and state management patterns verbatim, and implement pre-flight as a blocking check that offers interactive installation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Mirror gsd-tools.cjs command pattern: init, state, commit, config-get, config-set, phase-complete, plus ralph-specific commands
- Compound init: single `init` call returns all project state (current phase, config, completion flags, file paths) in one JSON response
- JSON-only output for all commands -- no human-readable mode, callers parse JSON
- JSON error objects with error codes: `{ error: true, message: '...', code: 'PHASE_NOT_FOUND' }` plus non-zero exit code
- STATE.md tracks phases by integer number (names resolved via lookup)
- YAML frontmatter + markdown body format (STATE-05) -- machine-parseable frontmatter, human-readable body
- Stage completion tracking: follow GSD's proven approach (Claude's discretion on boolean vs enum)
- config.json scoped to pipeline config only: mode (normal/yolo), depth (quick/standard/comprehensive), model_profile, time_budget, auto_advance
- Bead format and other per-run choices NOT stored in config -- chosen at runtime gates
- Interactive installer: when dependencies are missing, offer to install them (not just report)
- IDE detection: ask user on first run, store choice in config.json (no auto-detection)
- Check ALL dependencies upfront at pipeline start (ralph-tui, bd/br CLIs, required skills, MCP servers) -- fail early, fix everything at once
- Verify skill availability by checking .md files on disk in known paths (~/.claude/skills/ or project .claude/skills/)
- Pre-flight checks if .reference/get-shit-done/ exists; if missing, clone from public GitHub repo
- Pin to specific GSD release tag (e.g., v2.1.0) for reproducible builds -- update pin with ralph-pipeline releases
- Add .reference/ to .gitignore automatically
- Blocking error if clone fails -- pipeline won't start without the reference

### Claude's Discretion
- Stage completion granularity (boolean vs multi-status enum) -- follow what GSD does
- Exact command naming and argument patterns
- Internal file organization within ralph-tools.cjs
- Error code taxonomy

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ORCH-01 | Plugin ships as installable Claude Code skill (SKILL.md + ralph-tools.cjs + templates/) | SKILL.md frontmatter format verified from existing skill; skill directory structure researched |
| ORCH-02 | Pre-flight detects IDE environment, checks relevant dependencies | Pre-flight architecture patterns documented; dependency check paths identified on disk |
| ORCH-08 | GSD repo cloned to .reference/get-shit-done/ and gitignored | GSD is distributed via plugin system (not git), current version 1.21.0; clone strategy needs resolution |
| STATE-01 | ralph-tools.cjs is a single .cjs file with zero npm dependencies | GSD architecture verified: uses only Node.js builtins (fs, path, child_process, os) |
| STATE-02 | ralph-tools.cjs handles all state mutations | GSD state.cjs patterns documented: stateExtractField/stateReplaceField/writeStateMd |
| STATE-03 | ralph-tools.cjs handles git commits with conditional logic | GSD cmdCommit pattern documented: checks commit_docs flag, checks gitignored, stages files |
| STATE-04 | ralph-tools.cjs provides compound init commands | GSD init.cjs patterns documented: each workflow gets a compound init that loads all context |
| STATE-05 | State persisted as YAML frontmatter + markdown body | GSD frontmatter.cjs parser documented: extractFrontmatter/reconstructFrontmatter/spliceFrontmatter |
| STATE-06 | Each phase output has completed: true/false flag | GSD uses frontmatter flags; ralph should do same with completed: true/false in phase output files |
| STATE-08 | config.json stores workflow preferences | GSD config.cjs patterns documented: loadConfig with defaults, dot-notation get/set |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js builtins only | v18+ (fs, path, child_process, os) | All CLI operations | GSD pattern: zero npm deps, single .cjs ships with skill |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| child_process.execSync | Node.js builtin | git operations, pre-flight clone | Synchronous for CLI commands |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled YAML parser | js-yaml npm package | Violates zero-dep constraint; GSD's regex parser handles the subset we need |
| Commander.js for CLI | Manual arg parsing | Violates zero-dep; GSD's switch/case router is simpler and proven |
| JSON state file | YAML frontmatter + markdown body | Frontmatter gives both machine + human readability per STATE-05 |

**Installation:**
```bash
# No installation needed -- zero npm dependencies
# Ralph-tools.cjs ships as a single file alongside SKILL.md
```

## Architecture Patterns

### Recommended Project Structure
```
ralph-pipeline/
├── SKILL.md                    # Claude Code skill entry point (frontmatter + instructions)
├── ralph-tools.cjs             # Main CLI router (mirrors gsd-tools.cjs)
├── lib/                        # Modular helpers (mirrors gsd-tools bin/lib/)
│   ├── core.cjs                # output(), error(), loadConfig(), execGit(), safeReadFile()
│   ├── state.cjs               # STATE.md CRUD, frontmatter sync, writeStateMd()
│   ├── config.cjs              # config.json CRUD, dot-notation get/set
│   ├── frontmatter.cjs         # YAML frontmatter extract/reconstruct/splice
│   ├── phase.cjs               # phase-complete, find-phase, phase lifecycle
│   ├── init.cjs                # Compound init commands (one per workflow)
│   ├── preflight.cjs           # Dependency checks, interactive installer
│   └── commands.cjs            # Standalone utilities (commit, slug, timestamp)
├── templates/                  # Phase output templates (future phases)
└── .planning/                  # Project state directory
    ├── PROJECT.md              # Project definition
    ├── REQUIREMENTS.md         # Requirement tracking
    ├── ROADMAP.md              # Phase roadmap
    ├── STATE.md                # Current position (YAML frontmatter + markdown)
    ├── config.json             # Workflow preferences
    └── phases/                 # Per-phase directories
        └── 01-foundation/      # Phase 1 artifacts
```

### Pattern 1: Router + Module Architecture (from GSD)
**What:** Main CLI file is a thin router that delegates to modular lib files via require().
**When to use:** Always -- this is the core architecture.
**Example:**
```javascript
// Source: ~/.claude/get-shit-done/bin/gsd-tools.cjs
// ralph-tools.cjs follows this exact pattern
const fs = require('fs');
const path = require('path');
const { error } = require('./lib/core.cjs');
const state = require('./lib/state.cjs');
const config = require('./lib/config.cjs');
const init = require('./lib/init.cjs');
const preflight = require('./lib/preflight.cjs');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'state': { /* delegate to state module */ break; }
    case 'init':  { /* delegate to init module */ break; }
    case 'commit': { /* delegate to commands module */ break; }
    case 'preflight': { preflight.cmdPreflight(cwd, raw); break; }
    // ...
  }
}
main();
```

### Pattern 2: JSON-Only Output with Error Objects
**What:** Every command outputs JSON to stdout. Errors go to stderr with non-zero exit code plus structured JSON error objects.
**When to use:** All command output.
**Example:**
```javascript
// Source: ~/.claude/get-shit-done/bin/lib/core.cjs
function output(result, raw, rawValue) {
  if (raw && rawValue !== undefined) {
    process.stdout.write(String(rawValue));
  } else {
    const json = JSON.stringify(result, null, 2);
    if (json.length > 50000) {
      const tmpPath = path.join(require('os').tmpdir(), `ralph-${Date.now()}.json`);
      fs.writeFileSync(tmpPath, json, 'utf-8');
      process.stdout.write('@file:' + tmpPath);
    } else {
      process.stdout.write(json);
    }
  }
  process.exit(0);
}

function error(message, code) {
  // Ralph extension: include error code
  const errObj = { error: true, message, code: code || 'UNKNOWN' };
  process.stderr.write(JSON.stringify(errObj) + '\n');
  process.exit(1);
}
```

### Pattern 3: Compound Init Commands
**What:** Each workflow gets a single init command that loads ALL context in one call -- config, state, phase info, file existence checks, computed values.
**When to use:** At the start of every skill invocation / workflow entry point.
**Example:**
```javascript
// Source: ~/.claude/get-shit-done/bin/lib/init.cjs
function cmdInitPipeline(cwd, raw) {
  const config = loadConfig(cwd);
  const phaseInfo = findPhaseInternal(cwd, currentPhase);

  const result = {
    mode: config.mode,
    depth: config.depth,
    commit_docs: config.commit_docs,
    current_phase: /* from STATE.md */,
    phase_dir: phaseInfo?.directory || null,
    preflight_passed: /* check cached result */,
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
  };

  output(result, raw);
}
```

### Pattern 4: YAML Frontmatter State Sync
**What:** Every STATE.md write syncs a YAML frontmatter block from the markdown body fields. Enables both human-readable markdown AND machine-parseable state json access.
**When to use:** All STATE.md mutations.
**Example:**
```javascript
// Source: ~/.claude/get-shit-done/bin/lib/state.cjs
function writeStateMd(statePath, content, cwd) {
  const synced = syncStateFrontmatter(content, cwd);
  fs.writeFileSync(statePath, synced, 'utf-8');
}

function buildStateFrontmatter(bodyContent, cwd) {
  const extractField = (fieldName) => {
    const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, 'i');
    const match = bodyContent.match(pattern);
    return match ? match[1].trim() : null;
  };
  // ... builds fm object from extracted fields
}
```

### Pattern 5: Pre-flight with Interactive Installation
**What:** Check all dependencies upfront, collect ALL missing items, then offer to install them in batch.
**When to use:** Pipeline start, before any phase work.
**Example:**
```javascript
// ralph-specific: preflight.cjs
function cmdPreflight(cwd, raw) {
  const missing = [];

  const skillPaths = [
    path.join(os.homedir(), '.claude', 'skills'),
    path.join(cwd, '.claude', 'skills'),
  ];
  const requiredSkills = ['ralph-tui-prd', 'ralph-tui-create-beads'];
  for (const skill of requiredSkills) {
    const found = skillPaths.some(base =>
      fs.existsSync(path.join(base, skill, 'SKILL.md'))
    );
    if (!found) missing.push({ type: 'skill', name: skill });
  }

  // Check CLIs (bd, br)
  // Check reference repo
  // Check MCP servers

  if (missing.length > 0) {
    output({
      passed: false,
      missing,
      install_available: true
    });
  }
}
```

### Anti-Patterns to Avoid
- **Mutation of state objects:** GSD always reads file, modifies string content, writes back. Never hold state in memory across commands.
- **Human-readable output:** JSON-only. No console.log('Phase complete!'). Callers format for display.
- **Monolithic single file:** GSD started as one file and split into lib/. Start with modules from day 1.
- **npm dependencies:** The constraint is absolute. Use Node.js builtins only.
- **Warning-only pre-flight:** CONTEXT.md explicitly says blocking errors. process.exit(1) for missing deps.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom YAML parser | Copy GSD's extractFrontmatter/reconstructFrontmatter from frontmatter.cjs | Handles the exact subset needed; battle-tested across 1000+ GSD operations |
| State field extraction | Custom state parser | Copy GSD's stateExtractField/stateReplaceField patterns from state.cjs | Regex-based **Field:** extraction is the proven GSD pattern |
| Git commit logic | Direct execSync('git commit') | Copy GSD's cmdCommit pattern from commands.cjs | Handles commit_docs flag, gitignore check, nothing-to-commit edge case |
| Config loading with defaults | Custom config reader | Copy GSD's loadConfig pattern from core.cjs | Handles missing file, nested sections, boolean coercion |
| Phase directory lookup | Custom finder | Copy GSD's findPhaseInternal from core.cjs | Handles padding, decimal phases, archived phases |

**Key insight:** GSD has already solved every "easy-looking but subtly complex" problem ralph-tools will face. Copying proven patterns is faster AND more reliable than reimplementing.

## Common Pitfalls

### Pitfall 1: Forgetting State Frontmatter Sync
**What goes wrong:** Writing STATE.md without syncing the YAML frontmatter block, causing state json to return stale data.
**Why it happens:** Direct fs.writeFileSync instead of using writeStateMd().
**How to avoid:** ALL STATE.md writes go through writeStateMd() which calls syncStateFrontmatter() automatically.
**Warning signs:** state json output doesn't match what's visible in STATE.md markdown body.

### Pitfall 2: Pre-flight That Warns Instead of Blocks
**What goes wrong:** Pipeline starts with missing dependencies, fails mid-phase with confusing errors.
**Why it happens:** Developer instinct to be "helpful" with warnings instead of hard stops.
**How to avoid:** Pre-flight returns { passed: false, ... } with non-zero exit code. Orchestrator MUST check this before proceeding.
**Warning signs:** Pipeline reaches Phase 3 before discovering /ralph-tui-prd is missing.

### Pitfall 3: Mutable State in Memory
**What goes wrong:** State changes in one command don't appear in subsequent commands because they were held in memory.
**Why it happens:** Reading state once and modifying the in-memory object instead of re-reading from disk.
**How to avoid:** Each command reads from disk, modifies, writes back. No shared mutable state between commands.
**Warning signs:** ralph-tools.cjs state json shows different data than what ralph-tools.cjs phase-complete just wrote.

### Pitfall 4: Error Output to stdout Instead of stderr
**What goes wrong:** Callers parsing JSON get error messages mixed into their data.
**Why it happens:** Using console.log or process.stdout.write for errors.
**How to avoid:** Errors always go to process.stderr.write() + process.exit(1). Success always goes to process.stdout.write() + process.exit(0).
**Warning signs:** JSON.parse fails on command output because it contains error text.

### Pitfall 5: GSD Reference Clone Assumes Git Repo
**What goes wrong:** git clone fails because GSD is distributed through the Claude Code plugin system, not as a standalone public git repo.
**Why it happens:** CONTEXT.md says "clone from public GitHub repo" but GSD may not be published that way yet.
**How to avoid:** Implement fallback: (1) check if ~/.claude/get-shit-done/ exists, (2) if yes, copy/symlink to .reference/, (3) if not, attempt git clone, (4) if clone fails, provide clear error with manual setup instructions.
**Warning signs:** git clone returns 404 or auth error.

### Pitfall 6: Relative require() Paths Break When CWD Changes
**What goes wrong:** require('./lib/core.cjs') fails because Node resolves relative to CWD, not to the script location.
**Why it happens:** Confusion between process.cwd() and __dirname.
**How to avoid:** GSD uses require('./lib/core.cjs') which resolves relative to the requiring file's __dirname. This works correctly. The --cwd flag only affects file operations, not require paths.
**Warning signs:** MODULE_NOT_FOUND errors when ralph-tools.cjs is invoked from a different directory.

## Code Examples

Verified patterns from the GSD reference implementation.

### State Field Extraction and Replacement
```javascript
// Source: ~/.claude/get-shit-done/bin/lib/state.cjs
function stateExtractField(content, fieldName) {
  const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, 'i');
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

function stateReplaceField(content, fieldName, newValue) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, 'i');
  if (pattern.test(content)) {
    return content.replace(pattern, (_match, prefix) => `${prefix}${newValue}`);
  }
  return null;
}
```

### Config Loading with Defaults
```javascript
// Source: ~/.claude/get-shit-done/bin/lib/core.cjs (adapted for ralph)
function loadConfig(cwd) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  const defaults = {
    mode: 'normal',
    depth: 'standard',
    model_profile: 'balanced',
    commit_docs: true,
    auto_advance: false,
    time_budget: null,
    ide: null,
  };

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}
```

### Git Commit with Conditional Logic
```javascript
// Source: ~/.claude/get-shit-done/bin/lib/commands.cjs
function cmdCommit(cwd, message, files, raw) {
  const config = loadConfig(cwd);

  if (!config.commit_docs) {
    output({ committed: false, reason: 'skipped_commit_docs_false' });
    return;
  }

  if (isGitIgnored(cwd, '.planning')) {
    output({ committed: false, reason: 'skipped_gitignored' });
    return;
  }

  const filesToStage = files.length > 0 ? files : ['.planning/'];
  for (const file of filesToStage) {
    execGit(cwd, ['add', file]);
  }

  const result = execGit(cwd, ['commit', '-m', message]);
  if (result.exitCode !== 0) {
    output({ committed: false, reason: 'nothing_to_commit' });
    return;
  }

  const hash = execGit(cwd, ['rev-parse', '--short', 'HEAD']);
  output({ committed: true, hash: hash.stdout });
}
```

### Phase Complete Logic
```javascript
// Source: ~/.claude/get-shit-done/bin/lib/phase.cjs (cmdPhaseComplete)
// Key operations:
// 1. Verify phase exists via findPhaseInternal()
// 2. Update ROADMAP.md: mark checkbox [x], update progress table
// 3. Update REQUIREMENTS.md: mark requirement IDs complete
// 4. Find next phase directory
// 5. Update STATE.md: advance current_phase, update status, write date
// 6. All writes go through writeStateMd() for frontmatter sync
```

### SKILL.md Frontmatter Format
```yaml
---
name: ralph-pipeline
description: "Orchestrates the full Ralph Loop workflow..."
---

# Skill Title

[Skill instructions follow as markdown]
```

### Skill Dependency Check
```javascript
// ralph-specific pattern for pre-flight
function checkSkillExists(skillName) {
  const homedir = require('os').homedir();
  const paths = [
    path.join(homedir, '.claude', 'skills', skillName, 'SKILL.md'),
  ];
  return paths.some(p => fs.existsSync(p));
}

// Verified skill locations on disk:
// ~/.claude/skills/ralph-tui-prd/SKILL.md         -- EXISTS
// ~/.claude/skills/ralph-tui-create-beads/SKILL.md -- EXISTS
// ~/.claude/skills/ralph-tui-create-json/SKILL.md  -- EXISTS
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single monolithic SKILL.md | SKILL.md + CLI + lib modules | GSD v1.0+ | Enables state management across /clear boundaries |
| In-memory state | Disk-persisted YAML frontmatter + markdown | GSD pattern | Survives /clear, context compaction, crashes |
| Manual phase tracking | CLI-driven phase-complete with auto-advance | GSD pattern | No human error in state transitions |
| Warning-only dep checks | Blocking pre-flight with interactive install | User decision | Fail-fast prevents mid-pipeline failures |

**Deprecated/outdated:**
- Single-session pipeline (the existing ralph-pipeline SKILL.md) -- being replaced by this multi-phase /clear-based architecture
- .claude/pipeline/ state directory -- being replaced by .planning/ to match GSD conventions

## Open Questions

1. **GSD Reference Repo Distribution**
   - What we know: GSD is currently installed at ~/.claude/get-shit-done/ via the Claude Code plugin system (not a git clone). VERSION is 1.21.0. There is no .git directory. A gsd-file-manifest.json exists at ~/.claude/ with SHA hashes.
   - What's unclear: Is GSD published as a public GitHub repo that can be git clone-d? The CONTEXT.md says "clone from public GitHub repo" but this may not exist yet.
   - Recommendation: Implement a fallback strategy: (1) if ~/.claude/get-shit-done/ exists, copy to .reference/get-shit-done/, (2) if not, attempt git clone with the configured URL/tag, (3) if that fails, error with clear instructions. Pin the VERSION file content (1.21.0) as the reference version. The planner should design this as a multi-path resolution with graceful degradation.

2. **Stage Completion Granularity**
   - What we know: GSD uses completed: true/false in SUMMARY.md frontmatter (boolean). It determines completion by checking if a matching SUMMARY.md exists for each PLAN.md.
   - What's unclear: Whether ralph needs richer states (e.g., pending/running/completed/failed) for pipeline phases.
   - Recommendation: Follow GSD's boolean pattern (completed: true/false) for Phase 1. The user said "follow GSD's proven approach." Multi-status can be added later if needed.

3. **Error Code Taxonomy**
   - What we know: CONTEXT.md specifies JSON error objects with error codes. GSD does not use error codes -- it just has a simple error(message) function that writes to stderr.
   - What's unclear: What specific error codes are needed.
   - Recommendation: Define a minimal initial set: PHASE_NOT_FOUND, STATE_NOT_FOUND, CONFIG_INVALID, PREFLIGHT_FAILED, CLONE_FAILED, SKILL_MISSING, COMMIT_FAILED. Extend as needed. The planner has discretion here per CONTEXT.md.

## Sources

### Primary (HIGH confidence)
- ~/.claude/get-shit-done/bin/gsd-tools.cjs -- Main CLI router, 589 lines, verified on disk
- ~/.claude/get-shit-done/bin/lib/core.cjs -- Output/error helpers, config loading, phase utilities, 411 lines
- ~/.claude/get-shit-done/bin/lib/state.cjs -- STATE.md operations, frontmatter sync, 680 lines
- ~/.claude/get-shit-done/bin/lib/init.cjs -- Compound init commands, 711 lines
- ~/.claude/get-shit-done/bin/lib/config.cjs -- Config CRUD, 163 lines
- ~/.claude/get-shit-done/bin/lib/phase.cjs -- Phase lifecycle including cmdPhaseComplete, 872 lines
- ~/.claude/get-shit-done/bin/lib/frontmatter.cjs -- YAML frontmatter parser, 300 lines
- ~/.claude/get-shit-done/bin/lib/commands.cjs -- Git commit logic, utilities
- ~/.claude/get-shit-done/VERSION -- Current version: 1.21.0
- ~/.claude/skills/ralph-tui-prd/SKILL.md -- Verified skill frontmatter format
- ~/.claude/skills/ralph-tui-create-beads/ -- Verified skill exists on disk
- ~/.claude/skills/ralph-tui-create-json/ -- Verified skill exists on disk

### Secondary (MEDIUM confidence)
- SKILL.md frontmatter format verified from multiple installed skills (ralph-tui-prd, pattern-refactor-report) -- consistent name: and description: fields in YAML frontmatter

### Tertiary (LOW confidence)
- GSD public GitHub repo availability -- user states it exists but could not be verified; implementation should handle both available and unavailable cases

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero-dep Node.js CJS is verified from GSD source
- Architecture: HIGH -- directly modeled on GSD's proven router + lib module architecture, all source files read
- Pitfalls: HIGH -- identified from reading actual GSD implementation patterns and understanding the constraint space
- Pre-flight: MEDIUM -- dependency check paths verified on disk, but interactive installer UX is new (GSD doesn't have one)
- GSD reference setup: MEDIUM -- current distribution mechanism verified but git clone path unverified

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable domain -- Node.js CJS patterns don't change frequently)
