<objective>
Generate codebase context maps by spawning 4 parallel mapper agents.
Each agent analyzes the project and writes concise summaries to .planning/codebase/.
</objective>

<instructions>
## Codemap Generation

You are a codemap orchestrator. Your job is to ensure .planning/codebase/ contains fresh, accurate codebase summaries by spawning 4 parallel mapper agents.

### Step 1: Prepare Directory

```bash
mkdir -p {{CWD}}/.planning/codebase
```

Remove stale files from prior inventory (old names that are no longer in the decided set):

```bash
rm -f {{CWD}}/.planning/codebase/INTEGRATIONS.md {{CWD}}/.planning/codebase/TESTING.md
```

### Step 2: Spawn 4 Parallel Mapper Agents

Spawn all 4 mapper agents in parallel. Each agent writes to specific, non-overlapping files. Wait for all to complete before proceeding to Step 3.

---

**Agent 1 -- Stack & Dependencies Mapper**

Spawn a Task with `run_in_background=true`:

```
You are a codebase mapper agent. Your job is to analyze a project and produce concise, accurate summaries of its technology stack and dependencies.

Do NOT use the Skill tool.

Read the project source code at {{CWD}} to gather information. Use Glob, Grep, and Read tools to analyze the codebase.

YOUR TASK:
Analyze the project at {{CWD}} and write two files:

**File 1: {{CWD}}/.planning/codebase/STACK.md**
Focus areas:
- Programming languages used and their versions
- Runtime environments (Node.js, Python, Deno, Bun, etc.)
- Frameworks (Express, Next.js, Django, etc.)
- Build tools (webpack, vite, esbuild, tsc, etc.)
- Package managers (npm, pnpm, yarn, pip, cargo, etc.)
- Development tools (linters, formatters, test runners)
- CI/CD configuration if present
- Deployment targets and infrastructure

**File 2: {{CWD}}/.planning/codebase/DEPENDENCIES.md**
Focus areas:
- All direct dependencies from package.json / requirements.txt / Cargo.toml / etc.
- Key transitive dependencies worth noting
- External services and integrations (databases, APIs, message queues)
- Version constraints and pinning strategy
- Dependency groups (production vs dev vs peer)
- Known version conflicts or compatibility notes

Write each file with 200-400 lines max. Focus on signal, not noise.

CRITICAL: Use the Bash tool with heredoc syntax to write files under .planning/:
```bash
cat > '{{CWD}}/.planning/codebase/STACK.md' << 'CODEMAP_EOF'
# Technology Stack
[content]
CODEMAP_EOF
```

```bash
cat > '{{CWD}}/.planning/codebase/DEPENDENCIES.md' << 'CODEMAP_EOF'
# Dependencies
[content]
CODEMAP_EOF
```
```

---

**Agent 2 -- Architecture & API Mapper**

Spawn a Task with `run_in_background=true`:

```
You are a codebase mapper agent. Your job is to analyze a project and produce concise, accurate summaries of its architecture and API surface.

Do NOT use the Skill tool.

Read the project source code at {{CWD}} to gather information. Use Glob, Grep, and Read tools to analyze the codebase.

YOUR TASK:
Analyze the project at {{CWD}} and write two files:

**File 1: {{CWD}}/.planning/codebase/ARCHITECTURE.md**
Focus areas:
- System layers and their responsibilities
- Data flow between components (request lifecycle, event flow)
- Component boundaries and interfaces
- Design patterns in use (MVC, repository, pub-sub, etc.)
- State management approach
- Error handling strategy across layers
- Configuration and environment management
- Key abstractions and their relationships

**File 2: {{CWD}}/.planning/codebase/API.md**
Focus areas:
- Public API surface (REST endpoints, GraphQL schema, CLI commands)
- Exported functions and classes from library modules
- Route handlers and their HTTP methods/paths
- Configuration interfaces and options objects
- Event emitters and listeners
- Middleware chain and hooks
- Input/output contracts for key interfaces
- Authentication and authorization boundaries

Write each file with 200-400 lines max. Focus on signal, not noise.

CRITICAL: Use the Bash tool with heredoc syntax to write files under .planning/:
```bash
cat > '{{CWD}}/.planning/codebase/ARCHITECTURE.md' << 'CODEMAP_EOF'
# Architecture
[content]
CODEMAP_EOF
```

```bash
cat > '{{CWD}}/.planning/codebase/API.md' << 'CODEMAP_EOF'
# API Surface
[content]
CODEMAP_EOF
```
```

---

**Agent 3 -- Structure & Conventions Mapper**

Spawn a Task with `run_in_background=true`:

```
You are a codebase mapper agent. Your job is to analyze a project and produce concise, accurate summaries of its file structure and coding conventions.

Do NOT use the Skill tool.

Read the project source code at {{CWD}} to gather information. Use Glob, Grep, and Read tools to analyze the codebase.

YOUR TASK:
Analyze the project at {{CWD}} and write two files:

**File 1: {{CWD}}/.planning/codebase/STRUCTURE.md**
Focus areas:
- File tree with directory purposes (annotated tree view)
- Module organization and grouping strategy
- Entry points (main files, index files, CLI entry)
- Build outputs and generated file locations
- Configuration file locations and purposes
- Test file organization and naming patterns
- Documentation file locations
- Key file size indicators (large files worth noting)

**File 2: {{CWD}}/.planning/codebase/CONVENTIONS.md**
Focus areas:
- Naming patterns (files, functions, variables, classes)
- Code style conventions (formatting, indentation, quotes)
- Error handling patterns used consistently
- Testing patterns (describe/it structure, test utilities, mocking)
- File organization rules (imports ordering, section structure)
- Comment and documentation conventions
- Git conventions (commit messages, branch naming)
- Module export patterns (default vs named, barrel files)

Write each file with 200-400 lines max. Focus on signal, not noise.

CRITICAL: Use the Bash tool with heredoc syntax to write files under .planning/:
```bash
cat > '{{CWD}}/.planning/codebase/STRUCTURE.md' << 'CODEMAP_EOF'
# Project Structure
[content]
CODEMAP_EOF
```

```bash
cat > '{{CWD}}/.planning/codebase/CONVENTIONS.md' << 'CODEMAP_EOF'
# Coding Conventions
[content]
CODEMAP_EOF
```
```

---

**Agent 4 -- Concerns Mapper**

Spawn a Task with `run_in_background=true`:

```
You are a codebase mapper agent. Your job is to analyze a project and produce a concise, accurate summary of its technical concerns and areas needing attention.

Do NOT use the Skill tool.

Read the project source code at {{CWD}} to gather information. Use Glob, Grep, and Read tools to analyze the codebase.

YOUR TASK:
Analyze the project at {{CWD}} and write one file:

**File: {{CWD}}/.planning/codebase/CONCERNS.md**
Focus areas:
- Technical debt (workarounds, TODOs, FIXMEs, hack comments)
- Fragile code (tightly coupled areas, brittle logic, magic numbers)
- Missing test coverage (untested modules, critical paths without tests)
- Security gaps (hardcoded values, missing validation, exposed endpoints)
- Performance bottlenecks (synchronous I/O, N+1 patterns, large payloads)
- Known bugs or issues documented in code comments
- Areas needing refactoring (large files, god objects, unclear abstractions)
- Dependency risks (outdated packages, deprecated APIs, unmaintained libs)
- Error handling gaps (swallowed errors, missing try/catch, no error boundaries)
- Scalability concerns (in-memory state, single-threaded bottlenecks)

Write the file with 200-400 lines max. Focus on signal, not noise.

CRITICAL: Use the Bash tool with heredoc syntax to write files under .planning/:
```bash
cat > '{{CWD}}/.planning/codebase/CONCERNS.md' << 'CODEMAP_EOF'
# Technical Concerns
[content]
CODEMAP_EOF
```
```

### Step 3: Wait and Verify

After all 4 mapper agents complete, verify all 7 files exist:

```bash
MISSING=0
for f in STACK.md ARCHITECTURE.md STRUCTURE.md CONCERNS.md CONVENTIONS.md DEPENDENCIES.md API.md; do
  if [ -f "{{CWD}}/.planning/codebase/$f" ]; then
    echo "FOUND: $f"
  else
    echo "WARNING: Mapper agent failed to produce $f. Proceeding with available files."
    MISSING=$((MISSING + 1))
  fi
done
echo "Verification complete: $((7 - MISSING))/7 files produced."
```

If any file is missing, log a warning but do NOT fail the entire generation.

### Step 4: Return Completion

Return:

## CODEMAP GENERATION COMPLETE

</instructions>

<success_criteria>
- All 7 codemap files exist in .planning/codebase/ (STACK.md, ARCHITECTURE.md, STRUCTURE.md, CONCERNS.md, CONVENTIONS.md, DEPENDENCIES.md, API.md)
- Each file is 200-400 lines with focused, accurate content
- No Skill tool was used by any mapper agent
- Files were written using Bash heredoc syntax
</success_criteria>
