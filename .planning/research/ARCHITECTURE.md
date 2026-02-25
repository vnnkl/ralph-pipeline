# Architecture Research

**Domain:** Claude Code plugin system — multi-phase AI coding orchestration with `/clear` boundaries
**Researched:** 2026-02-25
**Confidence:** HIGH (primary sources: SKILL.md current implementation, GSD workflow source files, PROJECT.md decisions)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER INVOCATION LAYER                            │
│  /ralph-gsd [feature] — runs in Claude Code, fresh session per phase │
├─────────────────────────────────────────────────────────────────────┤
│                     ORCHESTRATOR (SKILL.md)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │  State Read  │  │ Phase Gate   │  │  Subagent Dispatch       │   │
│  │  (disk→mem)  │  │  (gate/auto) │  │  (Task per phase)        │   │
│  └──────┬───────┘  └──────┬───────┘  └─────────────┬────────────┘   │
│         │                 │                         │               │
├─────────┴─────────────────┴─────────────────────────┴───────────────┤
│                     ralph-tools.cjs (CLI)                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │   init   │ │  state   │ │  commit  │ │  config  │ │  phase   │   │
│  │ (detect) │ │ (mutate) │ │  (git)   │ │   set    │ │ complete │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                     DISK STATE (.planning/)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────────┐  │
│  │PROJECT.md│ │ROADMAP.md│ │ STATE.md │ │ config.json            │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ phases/{N}-{slug}/                                           │    │
│  │   {N}-CONTEXT.md  {N}-PLAN.md  {N}-SUMMARY.md               │    │
│  └──────────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ research/  STACK.md  FEATURES.md  ARCHITECTURE.md  PITFALLS  │    │
│  └──────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│                     EXECUTION LAYER (ralph-tui)                      │
│  ┌──────────────────────────┐  ┌──────────────────────────────────┐  │
│  │  Headless: claude -p     │  │  Manual: ralph-tui run           │  │
│  │  (one proc per bead)     │  │  (user-driven TUI)               │  │
│  └──────────────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| SKILL.md (Orchestrator) | Phase sequencing, gate logic, subagent dispatch, auto-advance chain | Markdown with embedded bash + Task tool calls |
| ralph-tools.cjs (CLI) | All state mutations, config reads, git commits, progress tracking | Single .cjs file, zero npm deps (mirrors gsd-tools.cjs pattern) |
| .planning/ (Disk State) | Cross-session persistence, /clear boundary survival, resumability | Flat markdown + JSON files, YAML frontmatter for status flags |
| Subagents (Task per phase) | Phase-scoped work: research, PRD creation, beads conversion, review | General-purpose Claude agents with fresh 200k context |
| ralph-tui (Executor) | Bead-by-bead code execution, overnight runs, headless or TUI | External CLI, not owned by this skill — invoked as-is |
| Chained skills | PRD creation, bead conversion formats | Separate skill files in ~/.claude/skills/; invoked via slash commands |

---

## Recommended Project Structure

```
ralph-gsd/
├── SKILL.md                    # Orchestrator — entry point, phase flow, gate logic
├── ralph-tools.cjs             # CLI — state mutations, config, git, progress
├── templates/
│   ├── project.md              # PROJECT.md template
│   ├── context.md              # Phase CONTEXT.md template
│   ├── plan.md                 # Phase PLAN.md template (if needed)
│   └── state.md                # STATE.md initial template
├── references/
│   ├── phases.md               # Phase definitions and flow documentation
│   ├── dependencies.md         # Required external skills + CLIs + version checks
│   └── headless-script.md      # Generated headless execution script template
└── README.md                   # Public-facing install/usage docs
```

**Runtime state (per project, not shipped):**
```
.planning/                      # Created per project by ralph-tools.cjs init
├── PROJECT.md
├── REQUIREMENTS.md
├── ROADMAP.md
├── STATE.md
├── config.json
├── research/
│   ├── STACK.md
│   ├── FEATURES.md
│   ├── ARCHITECTURE.md
│   └── PITFALLS.md
└── phases/
    └── {NN}-{slug}/
        ├── {NN}-CONTEXT.md
        ├── {NN}-PLAN.md        # Or PRD file
        └── {NN}-SUMMARY.md
```

### Structure Rationale

- **SKILL.md as single entry point:** Claude Code skills are invoked via slash command; one file = one invocable command. Orchestration logic lives here, never in ralph-tools.cjs.
- **ralph-tools.cjs single-file zero-dep:** Must be installable without npm. Mirrors gsd-tools.cjs exactly. All bash-heavy operations (git, file detection, state mutation) go through this CLI rather than embedded in markdown bash blocks — easier to test and extend.
- **templates/:** Separates content schema from orchestration logic. Agents read templates to understand expected output structure, same pattern as GSD's templates/ directory.
- **references/:** Documentation that agents can @-reference without it affecting invocation. Keeps SKILL.md lean.
- **.planning/ on disk:** The /clear boundary problem. All cross-session state lives on disk. After /clear, the next session reads .planning/STATE.md and resumes. This is the entire resilience model.

---

## Architectural Patterns

### Pattern 1: Thin Orchestrator + Phase Subagents

**What:** SKILL.md does no phase work itself. It reads state, dispatches a Task subagent for the current phase, verifies the output file exists with `completed: true`, updates state, then runs the gate. Subagents receive only the files they need.

**When to use:** Always. The orchestrator must stay under 15% context budget. Phase work (research, PRD creation, review) generates large context — confining it to subagents prevents overflow.

**Trade-offs:** Adds latency (subagent spin-up per phase). Eliminates context accumulation across phases.

**Example:**
```javascript
// ralph-tools.cjs state read pattern
const state = parseYamlFrontmatter(readFile('.planning/STATE.md'))
const phase = state.current_phase
// Orchestrator reads state -> dispatches Task -> verifies output -> updates state
```

---

### Pattern 2: Disk-Mediated Context Transfer Across /clear

**What:** Every piece of information that must survive a /clear boundary is written to disk before the session ends. The next session's first action is reading from disk. No in-memory state crosses /clear.

**When to use:** Between every phase. The `/clear` command wipes all in-context state — disk is the only persistence medium.

**Trade-offs:** Slightly more disk I/O than in-memory pipelines. Eliminates all context accumulation problems.

**Example:**
```markdown
# STATE.md frontmatter (written after each phase)
---
current_phase: 3
phase_name: create-prd
completed_phases: [research, orient, clarify]
last_updated: 2026-02-25
auto_advance: true
time_budget_expires: "2026-02-26T06:00:00Z"
---
```

---

### Pattern 3: YAML Frontmatter Completion Flags

**What:** Every phase output file has a `completed: true/false` flag in YAML frontmatter. Orchestrator checks this flag before marking the phase done. If `completed: false`, the phase is re-dispatched.

**When to use:** All phase output files. Enables crash recovery without additional state machinery.

**Trade-offs:** Minimal overhead. Requires all subagents to follow the protocol.

**Example:**
```yaml
---
phase: 2
name: research
completed: true
completed_at: 2026-02-25T14:30:00Z
---
## Research Summary
...actual content...
```

---

### Pattern 4: Auto-Advance Chain via Config Flag

**What:** `workflow.auto_advance: true` in config.json tells each phase to immediately spawn the next phase rather than stopping for user input. The flag is read by ralph-tools.cjs at the start of each phase. Time budget is checked before advancing — if expired, the chain stops after the current phase.

**When to use:** Overnight / unattended runs. Set time budget, enable auto-advance, walk away.

**Trade-offs:** Loses human gate checkpoints. Ideal for well-understood pipelines with a PRD already written.

**Example:**
```javascript
// ralph-tools.cjs config-get pattern
const autoAdvance = config.workflow?.auto_advance ?? false
const timeBudgetExpires = config.workflow?.time_budget_expires
const budgetExpired = timeBudgetExpires && new Date() > new Date(timeBudgetExpires)

if (autoAdvance && !budgetExpired) {
  // Spawn next phase as Task
} else if (budgetExpired) {
  // Write STATE.md: stopped_reason: time_budget_expired
  // Surface to user on next manual invocation
}
```

---

### Pattern 5: Headless Execution via claude -p per Bead

**What:** Instead of keeping one long session open for all beads, each bead spawns its own `claude -p` process. The bead context (requirements, PRD, state) is passed as prompt text. Results are written to `.planning/bead-results/{bead}.md`. The orchestrating bash loop is generated and run by the Phase 6 subagent.

**When to use:** Overnight runs with 20+ beads. Each bead gets fresh 200k context — no cross-bead context bleed.

**Trade-offs:** No shared context between beads (intentional). Slower than one-session execution for small bead counts. Better for large workloads.

**Example:**
```bash
# Generated headless script pattern (from references/headless-script.md template)
mkdir -p .planning/bead-results
for bead_file in ".beads"/*.md; do
  bead_name=$(basename "$bead_file" .md)
  claude -p "$(cat references/bead-prompt-template.md) $(cat "$bead_file")" \
    --allowedTools "Edit,Read,Write,Bash,Grep,Glob" \
    --max-turns 30 \
    > ".planning/bead-results/${bead_name}.md" 2>&1
done
```

---

## Data Flow

### Phase Execution Flow (with /clear boundaries)

```
Session N: /ralph-gsd research
    |
    +-- read .planning/STATE.md (current_phase = research)
    +-- ralph-tools.cjs init research
    +-- Dispatch Task -> research subagent
    |     reads: STATE.md, CONTEXT.md, codemaps
    |     writes: .planning/phases/02-research/02-SUMMARY.md (completed: true)
    +-- Verify completed: true
    +-- ralph-tools.cjs state advance (current_phase -> prd)
    +-- Gate: AskUserQuestion OR auto_advance check
    +-- Display: "/clear, then /ralph-gsd prd"

[USER RUNS /clear]

Session N+1: /ralph-gsd prd
    |
    +-- read .planning/STATE.md (current_phase = prd)  <- disk survives /clear
    +-- read 02-SUMMARY.md as research context
    +-- Dispatch Task -> PRD subagent
    |     reads: STATE.md, 02-SUMMARY.md, chained skills
    |     invokes: /ralph-tui-prd (external skill)
    |     writes: .planning/phases/03-prd/03-PRD.md (completed: true)
    +-- ...continues
```

### Auto-Advance Chain Flow (no /clear, no user gates)

```
Session (overnight):
    |
    +-- /ralph-gsd --auto (sets workflow.auto_advance: true in config.json)
    +-- Check time_budget_expires
    +-- Phase: research -> Task -> completed -> auto-advance check -> budget ok -> next
    +-- Phase: prd -> Task -> completed -> auto-advance check -> budget ok -> next
    +-- Phase: convert -> Task -> completed -> auto-advance check -> budget ok -> next
    +-- Phase: execute
    |     Option A (headless): generate + run bash loop -> claude -p per bead
    |     Option B (manual): pause here, surface command to user
    +-- Phase: review -> Task -> completed -> auto-advance check
    |     budget expired? -> STOP, write STATE.md: stopped_reason: time_budget_expired
    +-- User opens session next morning: reads STATE.md, sees where stopped
```

### State File as Source of Truth

```
ralph-tools.cjs init
    |
    v
Reads: STATE.md + config.json + ROADMAP.md + filesystem
    |
    v
Returns: JSON (phase_found, phase_dir, plans[], executor_model, auto_advance, etc.)
    |
    v
Orchestrator SKILL.md parses JSON
    |
    v
All subsequent decisions use this parsed snapshot
    | (after phase completes)
    v
ralph-tools.cjs state advance
    |
    v
Writes: STATE.md (current_phase, last_updated, completed_phases[])
    |
    v
Written BEFORE session ends -> survives /clear
```

---

## Component Boundaries

### What Belongs Where

| Concern | Owner | NOT in |
|---------|-------|--------|
| Phase sequencing logic | SKILL.md | ralph-tools.cjs |
| State file mutations | ralph-tools.cjs | SKILL.md bash blocks |
| Git commits | ralph-tools.cjs | Subagents directly |
| Config reads/writes | ralph-tools.cjs | Hardcoded in SKILL.md |
| Phase work (research, PRD, review) | Task subagents | SKILL.md |
| Bead execution | ralph-tui or headless bash | Subagents |
| PRD creation logic | /ralph-tui-prd (external skill) | SKILL.md |
| Bead format conversion | /ralph-tui-create-beads (external skill) | SKILL.md |
| Disk layout schema | ralph-tools.cjs init | Each phase reinventing |
| Time budget check | ralph-tools.cjs config-get | SKILL.md inline math |

### What Crosses Phase Boundaries (via disk only)

```
Phase N output file (.planning/phases/{N}-*/...)
    |  (only these files are passed to Phase N+1)
    v
Phase N+1 subagent reads exactly these files:
  - STATE.md (always)
  - Previous phase output (e.g. 02-SUMMARY.md for PRD phase)
  - config.json (for depth, model profile, auto_advance)
  - ROADMAP.md (for phase goals and requirement IDs)
```

Nothing else crosses the boundary. Subagents do not inherit the orchestrator's context.

---

## Build Order

The component dependency graph determines implementation order:

```
1. ralph-tools.cjs (init, state, config-get, config-set, commit, phase-complete)
        |
        v  everything depends on this CLI existing
2. .planning/ schema (STATE.md, config.json formats)
        |
        v  defined by ralph-tools.cjs; must be stable before writing SKILL.md
3. SKILL.md core (phase sequencing, gate logic, state read/advance)
        |
        v  shell of orchestrator, no phase content yet
4. Phase subagent prompts (one per phase, embedded in SKILL.md)
        |
        v  each phase can be added independently once shell exists
5. templates/ (phase output file formats)
        |
        v  needed before subagents can write correctly-structured output
6. Auto-advance + time budget (config flag + expiry check in ralph-tools.cjs)
        |
        v  layered on after basic sequencing works
7. Headless execution script (generated bash, references/headless-script.md)
           last -- depends on bead format from /ralph-tui-create-beads
```

**Minimum viable build (steps 1-3):** ralph-tools.cjs (init + state + commit) + SKILL.md (two phases: research + PRD) + STATE.md schema. This is testable end-to-end and validates the /clear boundary pattern before adding all phases.

---

## Anti-Patterns

### Anti-Pattern 1: State in Orchestrator Memory

**What people do:** Store phase results as variables in SKILL.md, pass them directly to the next phase prompt as inline text.

**Why it's wrong:** A /clear or context compaction wipes these variables. The entire pipeline collapses. More subtly, passing large findings inline bloats the orchestrator context — it hits the 15% budget and starts dropping earlier context.

**Do this instead:** Subagent writes findings to `phases/{N}-*/output.md`. Orchestrator only stores the file path. Next phase subagent reads the file. Orchestrator context stays thin.

---

### Anti-Pattern 2: Reimplementing Chained Skills

**What people do:** Copy PRD generation logic or bead conversion logic into SKILL.md to avoid a dependency.

**Why it's wrong:** `/ralph-tui-prd` and `/ralph-tui-create-beads` are maintained separately. Duplicating logic creates two diverging implementations. Any format change in the external skill breaks the inlined copy silently.

**Do this instead:** Invoke the external skill as a slash command from within the subagent. Accept the dependency — it is correct coupling.

---

### Anti-Pattern 3: Gate Logic Inside Subagents

**What people do:** Subagent calls AskUserQuestion mid-phase, then continues based on the answer.

**Why it's wrong:** Gates should live in the orchestrator so they can be bypassed centrally by auto-advance. If gates are scattered in subagents, auto-advance cannot skip them without each subagent needing its own auto-advance logic.

**Do this instead:** Subagents never call AskUserQuestion. They write results to disk and signal via return values. Orchestrator reads return, checks config, runs gate or auto-advances.

---

### Anti-Pattern 4: One Long Claude Session for All Phases

**What people do:** Run all phases in a single session to avoid /clear overhead.

**Why it's wrong:** This is exactly what the current ralph-pipeline SKILL.md does and why it needs replacing. A 9-phase pipeline in one session accumulates 100k+ tokens of context by phase 4. Phase 7 review agents get a context window already half-consumed by earlier phases.

**Do this instead:** /clear between phases. Each session reads state from disk, does one phase of work, writes to disk. Session length is bounded by phase complexity, not pipeline length.

---

### Anti-Pattern 5: ralph-tools.cjs with External Dependencies

**What people do:** Import chalk, inquirer, yaml, or any npm package to simplify CLI development.

**Why it's wrong:** The skill must be installable without npm. If ralph-tools.cjs requires node_modules, it fails silently in environments without the right packages.

**Do this instead:** Write all YAML parsing, color output, and file operations inline in vanilla Node.js. Use fs, path, child_process (built-ins only). See gsd-tools.cjs as the reference implementation.

---

## Integration Points

### External Skills (invoked from subagents)

| Skill | Invocation | What it produces | Notes |
|-------|-----------|------------------|-------|
| `/ralph-tui-prd` | From PRD phase subagent | `[PRD]...[/PRD]` formatted markdown | Reads research context files passed in subagent prompt |
| `/ralph-tui-create-beads` | From Convert phase subagent | `.beads/*.md` bead files | Requires `bd` CLI installed |
| `/ralph-tui-create-beads-rust` | From Convert phase subagent | `.beads/*.md` bead files | Requires `br` CLI installed |
| `/ralph-tui-create-json` | From Convert phase subagent | `prd.json` | No CLI required; fallback |
| `compound-engineering` agents | From Research and Review subagents | Research/review findings | Optional — checked in dependency pre-flight |

### Internal Boundaries (ralph-tools.cjs <-> SKILL.md)

| Boundary | Communication | Protocol |
|----------|---------------|----------|
| SKILL.md -> ralph-tools.cjs | Bash subprocess (`node ralph-tools.cjs <command>`) | JSON stdout, non-zero exit = error |
| ralph-tools.cjs -> disk | Node.js fs writes | Atomic where possible (write temp, rename) |
| SKILL.md -> subagent | Task tool call with prompt string | Files referenced by path, subagent reads with Read tool |
| Subagent -> disk | Subagent uses Write/Edit tools | Must end with `completed: true` in frontmatter |
| Subagent -> SKILL.md | Task return value (string) | Brief summary only; SKILL.md reads disk for full result |

### ralph-tui Integration

ralph-tui is treated as an external black box. The pipeline:
1. Generates bead files (via chained skills)
2. Either launches `ralph-tui run` for the user, or runs `claude -p` per bead in headless mode
3. Reads `.planning/bead-results/*.md` for headless status
4. ralph-tui's internal state (`.ralph-tui/`, `.beads/`) is not read directly by the pipeline

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-5 beads, one feature | Manual ralph-tui execution; /clear between phases; interactive gates |
| 10-30 beads, one overnight run | Headless execution; auto-advance with time budget; review in morning |
| 60+ beads, multi-phase overnight | Time budget across phases; wave-based bead grouping; STATE.md as checkpoint |
| Multiple projects | Each project has its own `.planning/`; ralph-tools.cjs scoped to cwd |

### Scaling Priorities

1. **First bottleneck:** Orchestrator context overflow — solved at design time by thin orchestrator + subagents. Not a runtime concern if the pattern is followed correctly.
2. **Second bottleneck:** Bead count in headless mode — 60 beads = 60 sequential `claude -p` processes. Wave-based parallelization (like GSD) is an option for v2 if single-bead sequential is too slow.

---

## Sources

- `/Users/constantin/Code/skills/ralph-pipeline/SKILL.md` — HIGH confidence (current working implementation, primary source)
- `/Users/constantin/.claude/get-shit-done/workflows/execute-phase.md` — HIGH confidence (GSD thin orchestrator + wave execution model)
- `/Users/constantin/.claude/get-shit-done/workflows/discuss-phase.md` — HIGH confidence (auto-advance chain, disk state, /clear boundary handling)
- `/Users/constantin/.claude/get-shit-done/workflows/new-project.md` — HIGH confidence (GSD initialization flow, config.json schema, gsd-tools.cjs pattern)
- `/Users/constantin/Code/skills/ralph-pipeline/.planning/PROJECT.md` — HIGH confidence (authoritative requirements source)

---
*Architecture research for: Claude Code plugin system — multi-phase AI coding orchestration*
*Researched: 2026-02-25*
