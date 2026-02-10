# Ralph Pipeline

A Claude Code skill that orchestrates the full journey from feature idea to shipped, reviewed, harvested code. One command — `/ralph-pipeline` — chains 9 phases of planning, research, PRD creation, execution, review, and learning capture.

## Install

```bash
git clone git@github.com:vnnkl/ralph-pipeline.git ~/.claude/skills/ralph-pipeline
```

## Quick Start

```
/ralph-pipeline
```

Describe your feature when prompted. The pipeline handles everything else — dependency checks, codebase orientation, research, PRD generation, review, and more. You control the pace through gates between every phase.

## Why This Exists

Building a real feature with Claude Code typically means juggling multiple skills manually — generate a PRD, pick research agents, run reviews, convert to tasks, harvest learnings. Each step requires context from the previous one, and if the context window compacts mid-session, you lose decisions, research findings, and progress.

Ralph Pipeline solves four problems:

1. **Orchestration** — chains 9 phases in the right order, passing context between them automatically
2. **Context overflow** — each phase runs in its own Task subagent with a fresh context window, so research/PRD/review phases never blow up the main agent's context
3. **Compaction resilience** — persists all state to disk (`.claude/pipeline/`), so context compaction never loses progress
4. **Decision tracking** — collects open questions as they arise and resolves them all before execution begins

## The Pipeline

```
PRE-FLIGHT  Check dependencies, init git, register compaction hook
     |
Phase 0     Orient — generate or refresh codemaps
     |
Phase 1     Clarify — scope, stack, quality gates, agent selection
     |
Phase 2     Research — parallel agents investigate docs, patterns, best practices
     |
Phase 3     Create PRD — tracer bullet story structure with vertical slices
     |
Phase 4     Deepen — review agents critique the PRD for gaps
     |
Phase 4.5   Resolve — block until every open question has an answer
     |
Phase 5     Convert — transform PRD into beads or prd.json for ralph-tui
     |
Phase 6     Execute — manual ralph-tui or headless (claude -p per bead)
     |
Phase 7     Review — parallel review agents against the full diff
     |
Phase 8     Harvest — capture learnings, refresh codemaps
```

Every phase has a gate. You decide when to proceed, go back, or skip ahead.

## Tracer Bullet Ordering

Stories follow the tracer bullet cycle: build → test → feedback → iterate. Build the tiniest end-to-end slice, verify it works, then expand.

Each story follows DB → backend → frontend order in the smallest possible increment. After every story, the system works — just with less functionality. No horizontal layering (never all-DB-first, then all-API, then all-UI).

Critically, every story must be verified end-to-end before the next one starts. Don't build US-002 on an unverified US-001. The whole point is early feedback — if the architecture is wrong, you find out on story 1, not story 10.

## Compaction Resilience

Long pipeline runs burn through the context window. When Claude compacts prior messages, it can lose which phase you're in, what the user chose, and whether a phase actually finished.

Ralph Pipeline writes everything to `.claude/pipeline/`:

```
.claude/pipeline/
  state.md              Current phase, all user decisions
  open-questions.md     Unresolved questions from any phase
  phase-0-orient.md     Codemap summaries
  phase-1-clarify.md    User answers, agent selections
  phase-2-research.md   Aggregated research findings
  phase-3-prd.md        The PRD
  phase-4-deepen.md     Review insights + enhanced PRD
  phase-4.5-resolve.md  Question resolution record
  phase-5-convert.md    Format choice, file paths
  phase-7-review.md     P1/P2/P3 findings
  phase-8-harvest.md    Harvest summary
```

Every phase file has YAML frontmatter with `completed: true/false`. After compaction, the pipeline reads `state.md`, checks the current phase file, and either re-runs an incomplete phase or continues to the next.

A SessionStart hook auto-injects state after every compaction — no manual intervention needed.

## Open Questions Gate

Research and PRD phases often surface decisions that need human input (email provider, deployment target, storage backend). Instead of losing these in the context window, agents append them to `open-questions.md`.

Phase 4.5 is a blocking gate: every unchecked question gets presented to you before conversion begins. Answers flow back into the PRD. No unresolved decisions leak into execution.

## Phase Details

### Pre-flight

Checks for required skills (`ralph-tui-prd`, `compound-agents`, `last30days`), plugins (`everything-claude-code`, `choo-choo-ralph`, `compound-engineering`), and CLIs (`ralph-tui`, `bd`, `br`). Auto-installs what it can, warns about the rest.

Also initializes git if not already in a repo and registers the compaction hook.

### Phase 0: Orient

Generates or refreshes codemaps so all subsequent agents understand the existing codebase without re-exploring it. Skipped for greenfield projects.

### Phase 1: Clarify

Three rounds of questions: scope and stack, optional community research via `/last30days`, and agent selection (which research and review agents to use). You pick the agents that matter for your feature.

### Phase 2: Research

Launches your selected research agents in parallel — repo analysis, best practices, framework docs, institutional learnings. Results aggregate into a research summary that feeds the PRD.

### Phase 3: Create PRD

Invokes `/ralph-tui-prd` with research context. Enforces tracer bullet ordering: US-001 is the thinnest vertical slice, each subsequent story expands incrementally. Stories that include UI work must run `/frontend-design` as their first instruction before implementation. Stories needing browser testing use [agent-browser](https://github.com/vercel-labs/agent-browser) as the preferred tool.

### Phase 4: Deepen

Review agents (security, architecture, simplicity, performance) critique the PRD in parallel. Feedback gets incorporated, new stories added for gaps.

### Phase 4.5: Resolve Open Questions

Blocking gate. Presents every unresolved question collected during phases 2-4. Your answers update the PRD. Only then does conversion proceed.

### Phase 5: Convert

Transforms the PRD into the format ralph-tui needs: beads via `bd` (Go) or `br` (Rust), or `prd.json` if no CLI is installed. Validates story count, dependencies, and quality gates.

### Phase 6: Execute

Two modes: **manual** (run `ralph-tui` yourself) or **headless** (each bead gets its own `claude -p` session with fresh context — good for overnight/batch runs). Both modes remind you to verify the tracer bullet (US-001) end-to-end before continuing. Frontend stories run `/frontend-design` first; browser testing uses [agent-browser](https://github.com/vercel-labs/agent-browser).

### Phase 7: Review

The same review agents from Phase 4 now run against the actual code diff (`git diff main...HEAD`). Findings are categorized as P1 (must fix), P2 (should fix), P3 (nice-to-have).

### Phase 8: Harvest

Invokes `/harvest` to capture learnings from the completed work, then refreshes codemaps. Knowledge compounds for next time.

## Dependencies

| Dependency | Type | Required |
|-----------|------|----------|
| [ralph-tui skills](https://github.com/subsy/ralph-tui) | Skills | Yes |
| [compound-engineering](https://github.com/EveryInc/compound-engineering-plugin) | Plugin | Yes (for review/research agents) |
| [everything-claude-code](https://github.com/affaan-m/everything-claude-code) | Plugin | Yes (for codemaps) |
| [choo-choo-ralph](https://github.com/subsy/choo-choo-ralph) | Plugin | Yes (for harvest) |
| [last30days](https://github.com/mvanhorn/last30days-skill) | Skill | Optional |
| [agent-browser](https://github.com/vercel-labs/agent-browser) | CLI | Optional (for browser testing) |
| ralph-tui CLI | CLI | Optional (for Phase 6) |
| bd or br CLI | CLI | Optional (for Phase 5 beads) |

The pre-flight phase auto-installs missing skills and warns about missing plugins/CLIs.

## Design Decisions

**Why subagent-per-phase?** Research, PRD creation, deepening, and review phases generate massive context. Running them all in the main agent overflows the context window. Each phase runs in its own Task subagent with a fresh context window, receiving only the files it needs. The main agent stays thin — it reads state, dispatches, verifies output, and runs gates. Only interactive phases (Clarify, Resolve) stay in the main agent because they need AskUserQuestion.

**Why disk state instead of relying on context?** Context compaction is unpredictable. A pipeline run can span hours and hit compaction multiple times. Disk state means the pipeline always knows where it is.

**Why a blocking questions gate?** Without it, agents surface questions ("which email provider?") that get lost in the context window. By Phase 5, you're converting a PRD with unresolved decisions. The gate forces resolution before execution.

**Why tracer bullet ordering?** Horizontal layering (build all DB, then all API, then all UI) delays feedback. You don't discover integration issues until the end. Tracer bullets give you a working system after every story.

**Why /frontend-design first?** UI stories that skip design end up with ad-hoc layouts that need rework. Making `/frontend-design` the first instruction (not just an acceptance criterion) ensures design happens before code.

**Why agent-browser for testing?** [agent-browser](https://github.com/vercel-labs/agent-browser) provides headless browser automation purpose-built for AI agents. It's the preferred tool for browser-based testing, visual verification, and E2E checks.

**Why parallel agents?** Research and review agents are independent. Running them sequentially wastes time. Parallel execution gets results faster without sacrificing quality.

**Why gates between every phase?** The pipeline is opinionated about order but not about pace. You might want to refine the PRD three times, skip the review, or jump straight to harvest. Gates give you that control.
