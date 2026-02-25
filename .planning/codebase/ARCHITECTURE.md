# Architecture

**Analysis Date:** 2026-02-25

## Pattern Overview

**Overall:** Task-orchestration pipeline with subagent-per-phase delegation

**Key Characteristics:**
- Main agent acts as thin orchestrator (dispatches, gates, verifies)
- Heavy computation (research, PRD creation, review) delegated to isolated Task subagents
- Disk-based state persistence for context compaction resilience
- Sequential phase flow with interactive gates between phases
- Both interactive (Clarify, Resolve) and delegated (Orient, Research, PRD, Deepen, Convert, Review, Harvest) phases

## Layers

**Main Agent / Orchestrator Layer:**
- Purpose: Reads state, dispatches subagents, verifies completion, runs interactive gates (AskUserQuestion), updates state
- Location: Implicit in `SKILL.md` Phase 1, Phase 4.5, and main loop logic (lines 96-162)
- Contains: Dispatch logic, gate conditions, phase progression, state management
- Depends on: File I/O (state.md, phase files), AskUserQuestion for gates
- Used by: Invoked once per pipeline run via `/ralph-pipeline` trigger

**Phase 0 Orient Subagent:**
- Purpose: Generate or refresh codemaps for existing projects
- Location: Delegated via Task call (lines 328-342)
- Contains: Codemap freshness check, conditional invocation of `/update-codemaps`
- Depends on: `state.md`, optional codemaps in `docs/CODEMAPS/`
- Used by: Main agent to understand existing codebase

**Phase 1 Clarify (Main Agent - Interactive):**
- Purpose: Gather scope, stack, quality gates, agent selections, optional community research
- Location: Lines 350-394
- Contains: Three AskUserQuestion rounds for user input
- Depends on: `phase-0-orient.md`, direct user input
- Used by: Main agent accumulates decisions for subsequent phases

**Phase 2 Research Subagent:**
- Purpose: Launch parallel research agents, aggregate findings
- Location: Delegated via Task call (lines 398-425)
- Contains: Parallel Task dispatch for repo-research-analyst, best-practices-researcher, framework-docs-researcher, learnings-researcher
- Depends on: `state.md`, `phase-1-clarify.md`, `phase-0-orient.md`
- Used by: Phase 3 (PRD creation) consumes research findings

**Phase 3 PRD Creation Subagent:**
- Purpose: Generate tracer-bullet-ordered user stories via `/ralph-tui-prd`
- Location: Delegated via Task call (lines 430-493)
- Contains: `/ralph-tui-prd` invocation, tracer bullet validation, frontend-design/agent-browser instructions, open questions collection
- Depends on: `state.md`, `phase-2-research.md`, `phase-0-orient.md`
- Used by: Phase 4 (Deepen) reviews the PRD; Phase 5 (Convert) transforms it

**Phase 4 Deepen Subagent:**
- Purpose: Launch parallel review agents against PRD, incorporate feedback
- Location: Delegated via Task call (lines 499-522)
- Contains: Parallel Task dispatch for security-sentinel, architecture-strategist, code-simplicity-reviewer, performance-oracle
- Depends on: `state.md`, `phase-3-prd.md`
- Used by: Main agent runs gate; Phase 4.5 resolves open questions from deepening

**Phase 4.5 Resolve (Main Agent - Interactive):**
- Purpose: Present unresolved questions from phases 2-4, collect answers, update PRD
- Location: Lines 535-558
- Contains: Interactive AskUserQuestion rounds for question resolution
- Depends on: `state.md`, `open-questions.md`, `phase-3-prd.md` or `phase-4-deepen.md`
- Used by: Blocks Phase 5 until all questions answered

**Phase 5 Convert Subagent:**
- Purpose: Transform PRD to beads (bd/br) or prd.json format
- Location: Delegated via Task call (lines 561-586)
- Contains: Format gate (beads vs. json), conditional invocation of `/ralph-tui-create-beads`, `/ralph-tui-create-beads-rust`, or `/ralph-tui-create-json`, validation of item count and dependencies
- Depends on: `state.md`, `phase-3-prd.md` (or `phase-4-deepen.md`)
- Used by: Phase 6 (Execute) runs the generated items

**Phase 6 Execute:**
- Purpose: Run generated items/stories manually or headless
- Location: Lines 595-714 (Manual and headless execution patterns)
- Contains: Two execution modes: manual (user runs `ralph-tui` manually) or headless (each bead/story in its own `claude -p` session), tracer bullet verification, `/frontend-design` first instruction, end-to-end testing
- Depends on: `.beads/` directory or `prd.json`, quality gates defined in Phase 1
- Used by: Main agent provides execution instructions; gate determines how to proceed after execution

**Phase 7 Review Subagent:**
- Purpose: Run parallel review agents against actual code diff
- Location: Delegated via Task call (lines 717-735)
- Contains: `git diff main...HEAD` capture, parallel Task dispatch for security-sentinel, architecture-strategist, code-simplicity-reviewer, performance-oracle, P1/P2/P3 categorization
- Depends on: `state.md`, git repository with `main` branch
- Used by: Main agent runs gate to decide on fixes before proceeding

**Phase 8 Harvest Subagent:**
- Purpose: Capture learnings and refresh final codemaps
- Location: Delegated via Task call (lines 754-768)
- Contains: Invocation of `/harvest` (via `choo-choo-ralph` plugin), invocation of `/update-codemaps`
- Depends on: `state.md`, completed work in git history
- Used by: Final phase before pipeline completion

## Data Flow

**Phase Progression:**
1. User invokes `/ralph-pipeline`
2. Pre-flight (git init, dependency checks, `.claude/pipeline/` creation, `.ralph-tui/config.toml` init, SessionStart hook registration)
3. Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 4.5 → Phase 5 → Phase 6 → Phase 7 → Phase 8
4. Each phase writes output file with `completed: true/false`
5. Main agent verifies `completed: true` before proceeding
6. Gates (AskUserQuestion) allow user to refine, skip, or iterate

**State Persistence & Recovery:**
- **On compaction:** SessionStart hook injects `.claude/pipeline/state.md` + previous phase output + open-questions.md
- **Resume detection:** Read `state.md` for `current_phase`; read corresponding phase file for `completed` flag
- **Fallback (no state.md):** Filesystem inspection (look for codemaps, PRD markers, beads/json, review artifacts) to infer current phase

**Question Collection:**
- Agents in phases 2, 3, 4 append questions to `open-questions.md` as they arise
- Phase 4.5 blocks and presents all `- [ ]` items for resolution
- Resolved items marked `- [x]`; PRD updated with answers
- Phase 5 only proceeds if `open_questions_resolved: true`

**Execution Paths (Phase 6):**
- **Manual:** User runs `ralph-tui run [options]` themselves; pipeline waits for gate
- **Headless:** Each bead/story spawned as individual `claude -p` session with fresh context, alloted 30 turns per item
- Post-execution gate allows fixes, re-planning, or proceeding to review

## Key Abstractions

**State File (`.claude/pipeline/state.md`):**
- Purpose: Single source of truth for pipeline progress and configuration
- Example: `current_phase: 3`, `feature: "user authentication"`, `research_agents: [...]`, `review_agents: [...]`, `convert_format: null`
- Pattern: YAML frontmatter + metadata; read by all subagents and gates

**Phase Output Files (`.claude/pipeline/phase-[N]-[name].md`):**
- Purpose: Store results of each phase, marked `completed: true/false`
- Example: `phase-3-prd.md` contains `[PRD]...[/PRD]` markers, story list, validation checklist
- Pattern: YAML frontmatter with `phase`, `name`, `completed` fields; main body is phase-specific output

**Open Questions File (`.claude/pipeline/open-questions.md`):**
- Purpose: Collect decisions that need human input across phases
- Example: `- [ ] Which email provider? (SendGrid, Postmark, SES) — from: phase-2-research`
- Pattern: Markdown checklist; agents append unchecked items; Phase 4.5 presents and checks them off

**Subagent Dispatch Pattern:**
- Main agent creates Task with specific prompt that includes phase instructions and file list to read
- Subagent reads input files, does work, writes phase output file with `completed: false` initially
- Subagent appends questions to open-questions.md if needed
- Subagent marks phase output file `completed: true` when done
- Main agent reads phase output file, verifies `completed: true`, then proceeds

## Entry Points

**Main Entry Point:**
- Location: `/ralph-pipeline` skill trigger
- Triggers: User says "ralph pipeline", "full loop", "end to end plan", "pipeline", "run the full loop"
- Responsibilities: Pre-flight checks, read or detect state, dispatch appropriate phase, run gates, progress state, handle resumability

**Pre-flight Entry:**
- Responsibility: Check dependencies (skills, plugins, CLIs), auto-install what's possible, warn on missing, init git if needed, create `.gitignore`, init `.ralph-tui/config.toml`, register SessionStart hook

**Phase Subagent Entry:**
- Responsibility: Each subagent receives a `Task` call with phase-specific instructions; reads designated input files; writes phase output file with `completed: true/false`

## Error Handling

**Strategy:** Graceful degradation with user gates between phases; missing dependencies warn but allow continuation with fallbacks

**Patterns:**
- Missing skills → auto-install or display install instructions
- Missing plugins → warn, continue (some features may not work)
- Missing CLIs → warn, offer JSON fallback for Phase 5
- Incomplete phase (due to context overflow or interruption) → Phase detection re-runs incomplete phase after subagent returns with `completed: false`
- Unresolved questions → Phase 4.5 blocks conversion until all answered
- Failed story/bead execution → Phase 6 gate allows fixes or re-planning without losing prior work

## Cross-Cutting Concerns

**Logging:** Phase outputs capture summary findings; phases report counts (story count, P1/P2/P3 counts, learnings count)

**Validation:**
- Phase 3 validates PRD output (tracer bullet ordering, `/frontend-design` instructions, agent-browser references)
- Phase 5 validates item count vs. story count, US-001 has no dependencies
- Phase 7 categorizes findings by priority (P1/P2/P3)

**Authentication:** None — pipeline uses existing Claude Code session

**Tracer Bullet Ordering (Critical):**
- Every story must be a vertical slice (DB → backend → frontend) in the smallest increment
- Stories must be verified end-to-end after each execution before proceeding to the next
- No horizontal layering (never all-DB-first, then all-API, then all-UI)
- Each story leaves the system in a working, demoable state

---

*Architecture analysis: 2026-02-25*
