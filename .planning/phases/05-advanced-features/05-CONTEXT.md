# Phase 5: Advanced Features - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

YOLO mode, auto-advance chain, and time budget for the existing 9-phase pipeline. Users can run the full pipeline hands-free. No new pipeline phases or capabilities — this layers automation onto the existing orchestrator.

</domain>

<decisions>
## Implementation Decisions

### YOLO Mode Activation
- Activated via --yolo flag at skill invocation
- Flag persists to config.json so it survives /clear boundaries
- Auto-approves ALL user gates without prompting (approve/redirect/replan all resolve to "approve")
- Conversion gate (Phase 7): uses `bead_format` from config.json (user sets default once)
- Execution gate (Phase 8): defaults to manual ralph-tui (not headless) — user wants to be present for execution
- Resolution gate (Phase 6): Claude auto-answers all [TBD]/[TODO]/[PLACEHOLDER] items instead of blocking
- Auto-resolved items tagged with [YOLO-RESOLVED] in PRD output for user review

### Auto-Advance Failure Handling
- Phase failure: auto-retry once, then stop pipeline and preserve state. User resumes manually.
- Bead execution failure: skip the failed bead and continue with remaining beads (don't stop batch). Review phase will flag the gap.
- Blocking gates in YOLO mode: Claude answers autonomously instead of blocking (see Resolution above)

### Time Budget
- User asked about time budget at pipeline start (not a flag — prompted via AskUserQuestion)
- Stored in config.json as `time_budget_expires` (absolute timestamp) and `time_budget_hours` (original value)
- Bead execution times recorded in config.json: `avg_bead_duration_ms` and `total_beads_executed` — running average updated after each bead completes
- At pipeline start: show estimate ("Budget: 4h ≈ ~12 beads based on avg 20min/bead") using historical data. First run uses a sensible default estimate.
- At each phase boundary: log remaining time and estimated phases left
- Hard stop at phase boundary when budget expired — current phase always finishes first
- Time budget persists across /clear via config.json

### Auto-Advance Chaining
- --auto flag works from any phase (not just Phase 1) — chains from current phase to completion
- Uses actual /clear + re-invoke for true context isolation (not Task subagent isolation)
- Claude Code SessionStart hook checks config.json for `auto_advance: true` and auto-invokes /ralph-pipeline
- Pipeline orchestrator sets `auto_advance: true` in config.json before triggering /clear
- After pipeline completes (or stops on failure/budget), orchestrator sets `auto_advance: false` in config.json
- Hook only fires when auto_advance is true — no interference with normal sessions

### Claude's Discretion
- SessionStart hook implementation details (registration, removal, guard logic)
- First-run default estimate for bead duration when no historical data exists
- Exact format of time remaining display at phase boundaries
- How to handle edge case where /clear happens mid-phase (crash recovery)

</decisions>

<specifics>
## Specific Ideas

- GSD reference files for implementation patterns: `.reference/get-shit-done/workflows/discuss-phase.md` (gate bypass patterns), `.reference/get-shit-done/workflows/plan-phase.md` (hands-free chaining)
- Time estimation should get more precise with each pipeline run — bead timing data accumulates across projects
- [YOLO-RESOLVED] tag makes it easy to grep for Claude's autonomous decisions during review

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-advanced-features*
*Context gathered: 2026-02-26*
