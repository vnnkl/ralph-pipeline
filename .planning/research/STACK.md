# Stack Research

**Domain:** Claude Code plugin/skill system for multi-phase CLI workflow orchestration
**Researched:** 2026-02-25
**Confidence:** HIGH (core patterns verified against official Claude Code docs + live reference implementation)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Claude Code Skills (SKILL.md) | Current (Agent Skills open standard) | Plugin entry point, slash-command registration, invocation control | Official format. Skills superset `.claude/commands/` — add frontmatter, supporting files, `context: fork`. Verified from official docs. |
| Node.js (CJS, no npm) | System Node (any v18+) | CLI state management via `ralph-tools.cjs` | gsd-tools.cjs proves the pattern: single `.cjs` entry + `lib/*.cjs` modules, zero npm deps, ships with the skill. `require()` over ESM because bundling/packaging tools work better with CJS. |
| YAML frontmatter in `.md` files | — | State files (`STATE.md`, phase files) | Established GSD pattern. Parseable with 30-line hand-rolled parser (see `frontmatter.cjs`). Human-readable, git-diff-friendly, no deps. |
| JSON (config.json) | — | Project config | Machine-written, machine-read, no schema library needed. GSD uses `config.json` for all boolean flags and string templates. |
| Bash (inline in SKILL.md) | — | CLI invocation, git ops, dependency checks | Used for `node ralph-tools.cjs <cmd>` calls in skill workflows. Avoid complex bash; push logic into `ralph-tools.cjs`. |

### Supporting Libraries (Zero External Dependencies)

All of these are Node.js built-ins — no `npm install` ever required for `ralph-tools.cjs`:

| Built-in | Purpose | When to Use |
|----------|---------|-------------|
| `fs` | File I/O — read/write state, phase, config files | All state operations |
| `path` | Cross-platform path joining, `--cwd` resolution | Every file operation |
| `child_process.execSync` | Git commands, shell invocations | `commit`, `git` operations in the CLI |
| `os` | `os.homedir()` for global config paths | Detecting user-level config/API keys |
| `process.argv` | CLI arg parsing | Entry point routing |
| `process.stdout.write` | JSON output or `--raw` scalar output | All output (never `console.log`) |
| `process.exit` | Exit codes after output | After every command handler |

### Claude Code Skill Frontmatter Fields

These are the verified frontmatter fields from official docs (as of 2026):

| Field | Required | Purpose |
|-------|----------|---------|
| `name` | No (defaults to dir name) | Slash-command name. Lowercase, hyphens, max 64 chars. |
| `description` | Recommended | Claude uses this to auto-invoke. Write as trigger phrases: "Use when..." |
| `disable-model-invocation` | No | `true` = only user can invoke via `/name`. Use for stateful workflows. |
| `user-invocable` | No | `false` = hidden from `/` menu (Claude-only). Use for background context skills. |
| `context` | No | `fork` = runs skill in isolated subagent. Skill content becomes the task prompt. |
| `agent` | No | With `context: fork`, specifies agent type: `Explore`, `Plan`, `general-purpose`, or custom from `.claude/agents/`. |
| `allowed-tools` | No | Tools Claude can use without approval when skill is active. |
| `model` | No | Model override when skill is active. |
| `argument-hint` | No | Autocomplete hint, e.g., `[phase-number]`. |
| `hooks` | No | Hooks scoped to this skill's lifecycle. |

**String substitutions available in SKILL.md content:**
- `$ARGUMENTS` — all args passed to the skill
- `$ARGUMENTS[N]` / `$N` — positional args (0-indexed)
- `${CLAUDE_SESSION_ID}` — current session ID

### Skill Directory Structure (Canonical Layout)

```
ralph-gsd/
├── SKILL.md                    # Entry point, frontmatter, main orchestration instructions
├── bin/
│   └── ralph-tools.cjs         # CLI entry point (single file, zero deps, chmod +x)
│   └── lib/
│       ├── core.cjs            # Shared: output(), error(), loadConfig(), execGit()
│       ├── state.cjs           # STATE.md CRUD operations
│       ├── phase.cjs           # Phase directory operations
│       ├── config.cjs          # config.json CRUD
│       ├── frontmatter.cjs     # YAML frontmatter parse/serialize (hand-rolled)
│       ├── template.cjs        # Template fill operations
│       └── commands.cjs        # Standalone utility commands
├── templates/
│   ├── STATE.md                # STATE.md template
│   └── phase-file.md           # Phase output file template
└── references/
    └── dependencies.md         # Dependency table for pre-flight checks
```

Skill is installed to `~/.claude/skills/ralph-gsd/` or `.claude/skills/ralph-gsd/` (project-local).

### State File Formats

#### STATE.md (YAML frontmatter + markdown body)

```yaml
---
feature: "user authentication system"
current_phase: 2
started: 2026-02-08
depth: standard
time_budget_hours: null
execution_mode: headless
convert_format: null
research_agents: [repo-research-analyst, best-practices-researcher]
review_agents: [security-sentinel, architecture-strategist]
---

## Current Position
Phase: 2 of 6 (Research)
...
```

The body is human-readable prose. The frontmatter is machine-parsed by `ralph-tools.cjs state json`.

#### Phase Output Files

```yaml
---
phase: 2
name: research
completed: true
---
## Research Summary
...actual phase output...
```

GSD uses PLAN.md + SUMMARY.md pairs. ralph-gsd simplifies to single phase files with a `completed` flag.

#### config.json (project-level, no schema library)

```json
{
  "depth": "standard",
  "execution_mode": "headless",
  "time_budget_hours": null,
  "commit_docs": true,
  "brave_search": false
}
```

### gsd-tools.cjs Architecture: Key Patterns to Replicate

**1. Dual output modes (JSON vs --raw)**

Every command supports two output modes. Skill workflows use JSON for rich data; bash `$()` captures use `--raw` for scalar values:

```bash
INIT=$(node ralph-tools.cjs state json)
CURRENT_PHASE=$(node ralph-tools.cjs state get current_phase --raw)
```

Implementation: `output(result, raw, rawValue)` in `core.cjs`. Always call `process.exit(0)` after `output()`.

**2. Large payload protection (>50KB)**

Claude Code's Bash tool buffers ~50KB. When JSON payload exceeds this, write to tmpfile and return `@file:/tmp/ralph-xxx.json`. Callers detect the `@file:` prefix and read the file.

```javascript
if (json.length > 50000) {
  const tmpPath = path.join(os.tmpdir(), `ralph-${Date.now()}.json`);
  fs.writeFileSync(tmpPath, json, 'utf-8');
  process.stdout.write('@file:' + tmpPath);
} else {
  process.stdout.write(json);
}
```

**3. `--cwd` flag for sandboxed subagents**

Subagents run in different working directories. The CLI must accept `--cwd=<path>` or `--cwd <path>` to resolve file paths relative to the project root.

**4. `init` compound commands**

`init <workflow>` loads all context in a single call, returning a fat JSON object. This replaces 5-10 individual CLI calls at workflow start:

```bash
INIT=$(node ralph-tools.cjs init start-phase 2)
```

This is the primary context-loading pattern — one call per workflow start.

**5. Hand-rolled YAML frontmatter parser**

No `js-yaml` or `gray-matter`. The parser in `frontmatter.cjs` handles:
- Simple `key: value`
- Inline arrays `key: [a, b, c]`
- Multi-line arrays with `- item`
- Nested objects (2-3 levels)

Approximately 200 lines. No YAML library needed.

**6. Stderr for errors, stdout for data**

```javascript
function error(message) {
  process.stderr.write('Error: ' + message + '\n');
  process.exit(1);
}
```

Stderr goes to Claude's error display. Stdout is captured by Bash `$()`. Never mix them.

### Markdown Template Generation Patterns

GSD uses string interpolation in `template.cjs`, not a template engine. The `template fill` command builds an object, serializes with a hand-rolled YAML serializer (`reconstructFrontmatter(obj)`), then splices into file content with `spliceFrontmatter(content, newObj)`.

For ralph-tools.cjs: build object, serialize with hand-rolled YAML serializer, write to disk. No Handlebars, Mustache, or similar needed.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Node.js built-in (no test runner) | No formal test suite needed | CLI tools in this class are validated by use in workflows |
| `chmod +x` | Make CLI executable | Required for direct invocation |
| `#!/usr/bin/env node` | Shebang | First line of `ralph-tools.cjs` |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Hand-rolled YAML frontmatter parser | `js-yaml` / `gray-matter` | Never — would require npm install, breaking zero-dep constraint |
| CJS (`.cjs`) | ESM (`.mjs`) | ESM only if targeting Node 22+ with native module support and no bundling concern; CJS simpler for `require()` of lib modules |
| Single `.cjs` entry + `lib/*.cjs` modules | True single-file | Single-file viable at <500 lines; gsd-tools chose modular for maintainability at ~1500 lines |
| YAML frontmatter in `.md` | Separate `.json` state files | JSON state files if you need machine-mutation speed; `.md` if humans read the state files |
| `process.stdout.write` | `console.log` | `console.log` adds trailing newline and interferes with `$()` capture in some shells |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any npm package in ralph-tools.cjs | Breaks zero-dep constraint; skill would require `npm install` before use | Node.js built-ins only |
| `console.log` in CLI output paths | Adds `\n` to stdout, interferes with `$()` shell capture | `process.stdout.write()` |
| ESM `import`/`export` syntax | Requires `.mjs` extension or `"type": "module"` in package.json; complicates zero-dep single-file pattern | `require()` / `module.exports` |
| Template engines (Handlebars, Mustache, ejs) | Unnecessary dep; string interpolation suffices for markdown generation | JS template literals or `reconstructFrontmatter()` |
| `async/await` for file I/O | Unnecessary complexity in a CLI tool; sync fs ops are fine | `fs.readFileSync`, `fs.writeFileSync` |
| `yargs` / `commander` for arg parsing | Adds dependency; manual arg parsing pattern is 20 lines and sufficient | `process.argv.slice(2)` + `args.indexOf()` |

---

## Stack Patterns by Variant

**If skill is user-invoked only (stateful workflow):**
- Set `disable-model-invocation: true` in frontmatter
- Prevents Claude from auto-triggering a pipeline mid-conversation

**If a phase needs context isolation (research, PRD, review):**
- Use `context: fork` in a sub-skill OR spawn via Task subagent from SKILL.md
- GSD uses the Task subagent pattern (not `context: fork`) because it passes specific files via the prompt

**If skill ships CLI that does git ops:**
- Use `execSync` from `child_process` in `core.cjs`
- Always handle errors: return `{ exitCode, stdout, stderr }` struct, never throw

**If config needs user-level defaults (before project config exists):**
- Read `~/.ralph-gsd/defaults.json` (parallel to GSD's `~/.gsd/defaults.json`)
- Merge with hardcoded defaults; project `config.json` overrides both

---

## Version Compatibility

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | 18+ | Required for `fs.existsSync`, `os.tmpdir()` used throughout; 20+ preferred |
| Claude Code | Current (Agent Skills open standard) | `context: fork`, `$ARGUMENTS[N]`, `allowed-tools` all require current Claude Code release |
| ralph-tui skills | As installed via `bunx add-skill subsy/ralph-tui --all` | No version pinning; invoke as-is |
| gsd-tools.cjs | N/A (reference, not a dependency) | Study the pattern; do not import |

---

## Sources

- `https://code.claude.com/docs/en/skills` — Official Claude Code skills documentation. Verified: SKILL.md format, all frontmatter fields, string substitutions, `context: fork`, `agent`, `allowed-tools`, `disable-model-invocation`, `user-invocable`, `$ARGUMENTS[N]`. **Confidence: HIGH**
- `/Users/constantin/.claude/get-shit-done/bin/gsd-tools.cjs` — Live reference implementation. Verified: CLI router pattern, `--cwd` flag, dual output modes, `@file:` tmpfile fallback, `init` compound commands. **Confidence: HIGH**
- `/Users/constantin/.claude/get-shit-done/bin/lib/core.cjs` — Verified: `output()`, `error()`, `loadConfig()`, `execGit()`, `MODEL_PROFILES`, 50KB buffer guard. **Confidence: HIGH**
- `/Users/constantin/.claude/get-shit-done/bin/lib/frontmatter.cjs` — Verified: hand-rolled YAML frontmatter parser/serializer pattern (~300 lines, zero deps). **Confidence: HIGH**
- `/Users/constantin/Code/skills/ralph-pipeline/SKILL.md` — Existing skill format: frontmatter fields, state.md YAML format, phase file format, subagent dispatch pattern. **Confidence: HIGH**
- `https://mikhail.io/2025/10/claude-code-skills/` — Structural patterns for Claude Code skills. Confirms: CLI invocation via markdown instructions, state management via disk files. **Confidence: MEDIUM** (secondary source, consistent with official docs)
- Node.js v25 docs (`https://nodejs.org/api/modules.html`) — CJS `require()` still fully supported. **Confidence: HIGH**

---

*Stack research for: ralph-gsd Claude Code plugin system*
*Researched: 2026-02-25*
