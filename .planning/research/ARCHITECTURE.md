# Architecture Patterns

**Domain:** Marathon mode + codemaps integration into existing ralph-pipeline skill
**Researched:** 2026-02-27
**Confidence:** HIGH (primary sources: SKILL.md, all lib/*.cjs modules, all 9 templates, GSD map-codebase workflow -- all read directly)

## Existing Architecture (Baseline)

The current v1.0 architecture:

- **SKILL.md** orchestrator (~450 lines): Step-by-step markdown instructions. Controls phase sequencing, state loading, position detection, template dispatch, completion verification, user gates, `/clear` boundaries. Calls ralph-tools.cjs via Bash for all state operations.
- **ralph-tools.cjs** (308 lines) + **lib/** modules (2054 lines, 10 files): Zero-dep Node.js CJS. Commands: `init pipeline`, `scan-phases`, `config-get/set`, `state get/set`, `phase-complete`, `time-budget *`, `excerpt`, `commit`, `preflight`.
- **PIPELINE_PHASES** array (in `lib/orchestrator.cjs`): 9 entries, each with `id`, `slug`, `displayName`, `template`, `gateOptions`. Single source of truth for phase identity.
- **9 templates** (one per phase in `templates/`): Dispatched as Task subagents via `fillTemplate()`. Variables: `{{CWD}}`, `{{RALPH_TOOLS}}`, `{{PIPELINE_DISPLAY_NAME}}`, `{{PIPELINE_PHASE}}`, `{{PHASE_ID}}`, `{{STATE_PATH}}`, `{{CONFIG_PATH}}`, `{{PHASE_FILES}}`.
- **State on disk**: `.planning/STATE.md` (position), `.planning/config.json` (preferences), `.planning/pipeline/*.md` (phase outputs). Config defaults in `lib/core.cjs:loadConfig()`.
- **PHASE_FILES mapping** (hardcoded in SKILL.md): Each phase gets specific upstream files. E.g., research gets `clarify.md`; PRD gets `clarify.md` + `research/SUMMARY.md`. Phases 8/execute and 9/review get no PHASE_FILES (they discover their own inputs).
- **Context isolation**: `/clear` between phases. Each phase runs as Task subagent with fresh context. Orchestrator passes file paths only -- never loads phase output content.

### Current Data Flow

```
User invokes skill
  -> SKILL.md Step 0-2: Resolve paths, load state via ralph-tools.cjs, detect position
  -> Step 3: Status banner
  -> Step 4: Read template file, fillTemplate(), dispatch as Task subagent
  -> Step 5: Verify completion (Task return message + file scan)
  -> Step 6: User gate (context-dependent options from gateOptions array)
  -> Step 7: /clear boundary + time budget check + auto-advance chain
  -> [next session]: Re-invoke -> load state -> resume from next phase
```

### Current Config Schema (from lib/core.cjs defaults)

```javascript
{
  mode: 'normal',              // 'normal' | 'yolo'
  depth: 'standard',           // 'quick' | 'standard' | 'comprehensive'
  model_profile: 'balanced',
  commit_docs: true,
  auto_advance: false,
  ide: null,
  time_budget_expires: null,
  time_budget_hours: null,
  avg_bead_duration_ms: null,
  total_beads_executed: 0,
  bead_format: null,           // 'bd' | 'br' | 'prd.json'
  phase_retry_count: 0,
  auto_advance_started_at: null,
}
```

### Key Constraints

1. Orchestrator <= 15% context usage -- all heavy work in subagents
2. Zero npm dependencies -- single .cjs files only
3. Must invoke `/ralph-tui-prd`, `/ralph-tui-create-beads` as-is
4. State on disk survives `/clear`
5. Templates use `{{VAR}}` substitution via `fillTemplate()`
6. Task subagents cannot use the Skill tool (noted explicitly in deepen/review templates)

---

## Recommended Architecture: Marathon Mode + Codemaps

### Design Principles

1. **Marathon mode is an alternative orchestration path in SKILL.md**, not a replacement for the existing per-phase flow. Both paths dispatch the SAME templates.
2. **Codemaps is a shared context layer** that feeds into existing templates via self-detection (templates check for `.planning/codebase/` themselves). Useful independently of marathon mode.
3. **Build codemaps first** because marathon depends on it but not vice versa.

### System Overview

```
                          +-----------+
                          | SKILL.md  |
                          | (entry)   |
                          +-----+-----+
                                |
                   +------------+------------+
                   |                         |
             [--marathon]              [standard mode]
                   |                         |
           +-------+--------+         (existing flow,
           | Marathon        |          phases 1-9,
           | Orchestrator    |          /clear between)
           | (new section    |
           |  in SKILL.md)   |
           +-------+---------+
                   |
    +--------------+----+------------+
    |                   |            |
 codemap (opt)     plan-all      execute+review
 .planning/        phases 1-7    merged queue
 codebase/         no /clear     single run
```

### Component Inventory: New vs Modified

| Component | Status | Changes | LOC Estimate |
|-----------|--------|---------|-------------|
| `SKILL.md` | **MODIFIED** | Add `--marathon` detection (Step 2c), Marathon Orchestrator section, conditional codemap dispatch in standard mode | +120-150 lines |
| `templates/codemap.md` | **NEW** | Codemap template: spawn 4 parallel mapper Tasks, verify output | ~120 lines |
| `lib/marathon.cjs` | **NEW** | Marathon CLI commands: `init`, `merge-queue`, `status` | ~180 lines |
| `lib/orchestrator.cjs` | **MODIFIED** | Add `codemapExists(cwd)` helper function | +15 lines |
| `lib/core.cjs` | **MODIFIED** | Add marathon + codemap config defaults to `loadConfig()` | +6 lines |
| `ralph-tools.cjs` | **MODIFIED** | Add `marathon` case to main switch | +15 lines |
| `templates/research.md` | **MODIFIED** | Add Step 1.5: conditionally load codemap files into agent prompts | +25 lines |
| `templates/review.md` | **MODIFIED** | Add Step 3.5: conditionally load codemap files into review agent prompts | +20 lines |
| `.planning/codebase/` | **NEW** (runtime) | 7 codemap documents generated by codemap template | Generated |
| `.planning/marathon/` | **NEW** (runtime) | Marathon state: `queue.json`, `status.json` | Generated |
| `tests/marathon.test.cjs` | **NEW** | Unit tests for marathon.cjs | ~150 lines |

**Unchanged**: `lib/config.cjs`, `lib/commands.cjs`, `lib/state.cjs`, `lib/phase.cjs`, `lib/frontmatter.cjs`, `lib/preflight.cjs`, `lib/init.cjs`, `lib/time-budget.cjs`, `templates/preflight.md`, `templates/clarify.md`, `templates/prd.md`, `templates/deepen.md`, `templates/resolve.md`, `templates/convert.md`, `templates/execute.md`.

---

## Detailed Architecture: Codemaps Integration

### What Codemaps Produce

The GSD `map-codebase` workflow spawns 4 parallel mapper agents writing 7 documents to `.planning/codebase/`:

| Document | Content | Consumed By |
|----------|---------|-------------|
| `STACK.md` | Languages, frameworks, deps | Research: framework-docs agent |
| `INTEGRATIONS.md` | External APIs, databases | Research: repo-research agent |
| `ARCHITECTURE.md` | Patterns, layers, data flow | Research + Review: architecture-strategist |
| `STRUCTURE.md` | Directory layout, key paths | All agents needing file context |
| `CONVENTIONS.md` | Code style, naming, patterns | Review: simplicity + architecture agents |
| `TESTING.md` | Test framework, coverage | Review: all agents; execute: quality gates |
| `CONCERNS.md` | Tech debt, security, fragile areas | Review: security + performance agents |

### Integration Point 1: Before Research (Standard + Marathon)

**Current**: Research agents (repo-research, best-practices, framework-docs) explore the codebase from scratch. Redundant if codemaps exist.

**Modified**: If `.planning/codebase/` exists, inject codemap file paths into research agent prompts.

**Implementation in `templates/research.md`** -- add Step 1.5:

```markdown
### Step 1.5: Load Codemap Context (if available)

Check for codemap files:
  ls .planning/codebase/*.md 2>/dev/null | wc -l

If codemap files exist (count > 0):
- Set CODEMAP_AVAILABLE=true
- Inject these files into each agent prompt context:
  - Agent 1 (repo-research): .planning/codebase/ARCHITECTURE.md, STRUCTURE.md
  - Agent 2 (best-practices): .planning/codebase/CONVENTIONS.md, CONCERNS.md
  - Agent 3 (framework-docs): .planning/codebase/STACK.md, INTEGRATIONS.md
  - Agent 4 (learnings): no codemap injection (reads docs/solutions/)
- Prefix each agent prompt with:
  "CODEBASE CONTEXT (from codemaps): Read these files first for existing
  codebase state, then focus your research on gaps and additions."

If count is 0: proceed as today (agents discover codebase themselves).
```

**Key decision**: Agents read codemap files directly via Read tool -- the template passes paths only. Preserves 15% orchestrator context budget.

### Integration Point 2: Before Review (Standard + Marathon)

**Current**: Review agents receive only the git diff. No broader codebase context.

**Modified**: If codemaps exist and codemap_enabled is not false, refresh codemaps before review, then inject into review agent prompts.

**Refresh mechanism**: Dispatch `templates/codemap.md` as a Task subagent before dispatching `templates/review.md`. The codemap template handles "refresh or reuse" internally (checks file freshness).

**Implementation in `templates/review.md`** -- modify agent prompts:

```markdown
### Step 3.5: Inject Codebase Context (if codemaps available)

Check: ls .planning/codebase/*.md 2>/dev/null | wc -l

If count > 0, add to each review agent prompt:
- Security Sentinel: + CONCERNS.md, INTEGRATIONS.md
- Architecture Strategist: + ARCHITECTURE.md, STRUCTURE.md
- Code Simplicity: + CONVENTIONS.md
- Performance Oracle: + STACK.md, CONCERNS.md

Prefix: "CODEBASE CONTEXT: Read these files for understanding existing
codebase patterns and known concerns. Your review diff follows: ..."
```

### Integration Point 3: Standard Mode Codemap Timing

Codemaps run **between clarify (phase 2) and research (phase 3)** in standard mode:

- Clarify provides stack context that helps mapper agents focus
- Research agents immediately benefit from codemap output
- Codemap is optional -- gated by `codemap_enabled` config flag

**SKILL.md modification** (new Step 4b):

```markdown
### Step 4b: Codemap Dispatch (between clarify and research)

If current pipeline phase is 3 (research) AND codemap_enabled is not false:
  Check if .planning/codebase/ exists with >= 5 files:
    If yes and files are < 24h old: skip codemap (reuse existing)
    If no or stale: dispatch templates/codemap.md as Task subagent
    Wait for completion
    Log: "Codemaps generated/refreshed."
```

### Codemap Template Design

**New file**: `templates/codemap.md`

The template inlines the GSD map-codebase logic (4 parallel mapper Tasks) rather than invoking `/gsd:map-codebase` as a Skill, because Task subagents cannot use the Skill tool.

Structure:
- Step 1: Check existing codemaps (freshness via mtime)
- Step 2: Create .planning/codebase/ directory
- Step 3: Spawn 4 parallel mapper Task subagents:
  - Agent 1 (Tech): writes STACK.md, INTEGRATIONS.md
  - Agent 2 (Architecture): writes ARCHITECTURE.md, STRUCTURE.md
  - Agent 3 (Quality): writes CONVENTIONS.md, TESTING.md
  - Agent 4 (Concerns): writes CONCERNS.md
- Step 4: Verify all 7 files exist and are non-empty
- Step 5: Write completion marker, return PHASE COMPLETE

Each mapper agent prompt includes: focus area, output file paths, instruction to explore the codebase thoroughly and write documents directly using Bash heredocs.

---

## Detailed Architecture: Marathon Mode

### What Marathon Mode Changes

| Aspect | Standard Mode | Marathon Mode |
|--------|--------------|---------------|
| Entry | `ralph-pipeline` (default) | `ralph-pipeline --marathon` |
| Planning | Phase-by-phase with `/clear` between | All phases 1-7 in one session, no `/clear` |
| User gates | After each phase | Auto-approve during planning (except deepen P1s) |
| Bead queue | Single convert phase | All beads merged into `.planning/marathon/queue.json` |
| Execution | One execute phase | Single execution run for merged queue |
| Time budget | Covers full pipeline | Covers execution only |
| Review | Reviews current phase changes | Reviews all changes from entire execution |
| Codemap | Optional, between clarify/research | Runs before planning AND refreshes before review |

### Marathon Collapse: 9 Phases -> 3 Mega-Phases

**Mega-Phase 1: Plan (interactive, no /clear)**

Dispatches phases 1-7 as Task subagents sequentially, auto-approving gates:

1. Codemap (if enabled)
2. Preflight
3. Clarify
4. Research (codemap-aware)
5. PRD
6. Deepen (GATE on P1 findings only)
7. Resolve
8. Convert
9. Merge queue

**Mega-Phase 2: Execute (hands-off)**

- Time budget starts NOW
- Dispatch templates/execute.md with merged queue
- Sequential headless execution (default) or manual option

**Mega-Phase 3: Review (interactive)**

- Refresh codemaps (if enabled)
- Dispatch templates/review.md
- Interactive review gate

### Marathon Entry Point in SKILL.md

Add between Step 2b and Step 3:

```markdown
### Step 2c: Marathon Mode Detection

If the user invoked with `--marathon`:
1. Set pipeline_mode: config-set pipeline_mode marathon
2. Log: "Marathon mode: planning all phases upfront, then single execution run."
3. Jump to Marathon Orchestrator section.
```

### Marathon Orchestrator Section

New section in SKILL.md (~120 lines). Key behaviors:

- **Same templates**: Dispatches `templates/{phase.template}` using the same `fillTemplate()` mechanism
- **No /clear during planning**: Sequential Task dispatch without session boundaries
- **Auto-approve gates**: Skip user gates for all planning phases except deepen with P1 findings
- **Merge after convert**: Call `ralph-tools.cjs marathon merge-queue`
- **Time budget at execution**: Budget prompt comes after all planning, applies only to execute phase
- **Resume-aware**: Uses `.planning/pipeline/*.md` completion files (same as standard mode) for crash recovery

### New CLI Module: lib/marathon.cjs

Three commands:

**`marathon init`**: Create `.planning/marathon/`, write initial `status.json`

```javascript
// status.json schema
{
  pipeline_mode: "marathon",
  planning_complete: false,
  planning_phases_done: [],     // ["preflight", "clarify", ...]
  execution_started_at: null,
  execution_complete: false,
  review_complete: false
}
```

**`marathon merge-queue`**: Read `.beads/*.md`, sort alphabetically, write `queue.json`

```javascript
// queue.json schema
{
  created: "2026-02-27T...",
  total_beads: 15,
  beads: [
    { name: "US-001-setup-db", file: ".beads/US-001-setup-db.md", order: 1 },
    // ...
  ]
}
```

**`marathon status`**: Read status.json + queue.json, return progress summary

### Config Schema Additions

Add to `loadConfig` defaults in `lib/core.cjs`:

```javascript
const defaults = {
  // ... existing 13 keys ...
  pipeline_mode: 'standard',          // 'standard' | 'marathon'
  codemap_enabled: null,              // null (auto) | true | false
  codemap_refreshed_at: null,         // ISO8601 timestamp
};
```

Marathon execution state lives in `.planning/marathon/status.json`, NOT in config.json. Config holds mode flags only; marathon dir holds execution state.

---

## Data Flow: Marathon Mode (Complete)

```
User: ralph-pipeline --marathon
  |
  v
SKILL.md: detect --marathon -> config-set pipeline_mode marathon
  |
  v
marathon init -> .planning/marathon/status.json
  |
  v
[codemap] -> .planning/codebase/*.md (7 files)
  |  Task subagent, 4 parallel mappers
  v
[preflight] -> .planning/pipeline/preflight.md
  |  Task subagent, auto-approve
  v
[clarify] -> .planning/pipeline/clarify.md
  |  Task subagent, auto-approve
  v
[research] -> .planning/research/*.md
  |  Task subagent, codemap-aware agents, auto-approve
  v
[prd] -> .planning/pipeline/prd.md
  |  Task subagent, auto-approve
  v
[deepen] -> .planning/pipeline/deepen.md
  |  Task subagent, GATE ON P1 FINDINGS
  v
[resolve] -> resolved PRD
  |  Task subagent, auto-approve
  v
[convert] -> .beads/*.md
  |  Task subagent, auto-approve
  v
[merge queue] -> .planning/marathon/queue.json
  |  ralph-tools.cjs marathon merge-queue
  v
--- TIME BUDGET STARTS HERE ---
  |
  v
[execute] -> .claude/pipeline/bead-results/*.md
  |  Task subagent, headless default
  v
[codemap refresh] -> .planning/codebase/*.md (updated)
  |  Task subagent (optional, if codemap_enabled)
  v
[review] -> .planning/pipeline/review-*.md
  |  Task subagent, INTERACTIVE GATE
  v
User gate: fix P1s / create PR / skip
```

---

## Patterns to Follow

### Pattern 1: Template Reuse (Marathon Shares Standard Templates)

**What**: Marathon dispatches the SAME `templates/*.md` files. Differences are in orchestrator behavior only (auto-approve, no /clear).

**Why**: Avoids duplication. Templates are self-contained.

### Pattern 2: Self-Detection for Codemap Availability

**What**: Templates detect codemap availability themselves via `ls .planning/codebase/*.md` rather than receiving paths through PHASE_FILES.

**Why**: PHASE_FILES is hardcoded per-phase in SKILL.md. Making it conditional would require orchestrator branching before template filling. Templates already have Bash access.

### Pattern 3: Separate State Directories

**What**: Marathon state in `.planning/marathon/`, codemaps in `.planning/codebase/`, pipeline outputs in `.planning/pipeline/`.

**Why**: Clean separation. Marathon and standard mode share `.planning/pipeline/` completion files but don't interfere with each other's state.

### Pattern 4: Config Flags for Feature Gating

**What**: `codemap_enabled` and `pipeline_mode` in config.json. Orchestrator checks. Templates stay unaware of feature flags.

**Why**: Centralized control plane. Templates are reusable across modes.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Loading Codemap Content into Orchestrator

**Why bad**: 7 files, 500+ lines each. Violates 15% context budget.
**Instead**: Pass file paths. Templates read files themselves.

### Anti-Pattern 2: Separate Marathon Templates

**Why bad**: 9 templates become 18. Duplication and drift.
**Instead**: Reuse existing templates. Orchestrator controls behavior.

### Anti-Pattern 3: Mutating PIPELINE_PHASES Array

**Why bad**: Breaks `scan-phases`, `phase-complete`, status banner.
**Instead**: Codemap is a pre-phase step. Marathon has its own sequencing.

### Anti-Pattern 4: Invoking /gsd:map-codebase as Nested Skill

**Why bad**: Task subagents cannot use the Skill tool.
**Instead**: Inline mapping logic in codemap template.

### Anti-Pattern 5: Marathon State in config.json

**Why bad**: Config is for preferences. Marathon state is transient and complex.
**Instead**: Marathon state in `.planning/marathon/status.json`.

---

## Build Order Summary

**Phase 1 (Codemaps -- no marathon dependency):**
1. `templates/codemap.md` (new)
2. `lib/core.cjs` (add config defaults)
3. `lib/orchestrator.cjs` (add helper)
4. `templates/research.md` (add codemap injection)
5. `templates/review.md` (add codemap injection)
6. `SKILL.md` (add Step 4b)

**Phase 2 (Marathon -- depends on Phase 1):**
1. `lib/marathon.cjs` (new)
2. `ralph-tools.cjs` (add routing)
3. `lib/core.cjs` (add pipeline_mode default)
4. `SKILL.md` (add Step 2c + Marathon Orchestrator)
5. Time budget adjustment for execution-only

**Phase 3 (Integration testing):**
1. Standard mode + codemaps
2. Marathon mode end-to-end
3. Marathon + codemap refresh
4. Time budget in marathon
5. Resume after interrupt

---

## Open Questions

1. **Codemap freshness**: Use file mtime (< 24h) or git-based staleness check? Recommend mtime for simplicity.

2. **Marathon deepen gate**: Auto-approve all or gate on P1? Recommend gate on P1 only -- design flaws are expensive post-execution.

3. **Marathon resume**: Resume from last completed planning phase or restart? Recommend resume via `.planning/pipeline/*.md` completion files.

4. **Codemap opt-in vs opt-out**: Require explicit `codemap_enabled: true` or default to auto-detect? Recommend opt-in for v1.1 to avoid surprising users.

## Sources

- `SKILL.md` (446 lines, read directly) -- HIGH confidence
- `ralph-tools.cjs` (308 lines, read directly) -- HIGH confidence
- `lib/orchestrator.cjs` (150 lines, read directly) -- HIGH confidence
- `lib/core.cjs` (162 lines, read directly) -- HIGH confidence
- `lib/init.cjs` (259 lines, read directly) -- HIGH confidence
- `lib/time-budget.cjs` (144 lines, read directly) -- HIGH confidence
- All 9 `templates/*.md` files (read directly) -- HIGH confidence
- GSD `workflows/map-codebase.md` (315 lines, read directly) -- HIGH confidence
- `.planning/PROJECT.md` (read directly) -- HIGH confidence
