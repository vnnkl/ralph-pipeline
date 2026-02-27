# Phase 11: Orchestrator State Sync - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire `cmdPhaseComplete` into the SKILL.md orchestrator completion path so STATE.md stays current and ROADMAP checkboxes auto-update during pipeline runs. Eliminates mismatch warning noise on resume. No new CLI commands or state schema changes — this is wiring existing code into existing orchestration.

</domain>

<decisions>
## Implementation Decisions

### State update approach (GSD pattern)
- Keep existing `ralph-tools.cjs state set Status` calls in SKILL.md for sub-phase tracking (e.g., "research complete, running prd")
- Add one `ralph-tools.cjs phase-complete` call after the review phase (last pipeline phase) to mark the dev-phase done
- Phase field in STATE.md stays at dev-phase level (e.g., "Phase 11 of 13") throughout the pipeline run — no sub-phase detail in Phase field
- Status field continues to be updated per sub-phase (existing behavior)

### When to call phase-complete
- After review phase completes (the last pipeline sub-phase) — the full pipeline must finish before the dev-phase gets its ROADMAP checkbox
- This is a single `ralph-tools.cjs phase-complete <dev-phase-number>` call at the end of Step 7 (the /clear boundary step) or equivalent completion path
- Matches GSD's transition.md pattern: checkbox = dev-phase is truly done

### Mismatch elimination: prevent + auto-correct
- **Primary (prevent):** By calling phase-complete at pipeline end, STATE.md should never go stale
- **Fallback (auto-correct on resume):** On resume, if STATE.md Phase field doesn't match file scan position, auto-correct both STATE.md and ROADMAP.md to match file scan truth
- Auto-correct logs a brief info line: "STATE.md synced to phase N (pipeline-sub-phase)" — informational, not a warning
- Replace existing mismatch warning with this auto-correct behavior
- Auto-correct scope includes ROADMAP: if all 9 pipeline phases are complete on disk but ROADMAP checkbox is unchecked, call phase-complete to fix it

### ROADMAP stays binary
- ROADMAP progress table shows In Progress or Complete — no pipeline sub-phase granularity (no "6/9 phases")
- Pipeline sub-phase progress lives in STATE.md Status field and on-disk completion files
- Partial pipeline runs (abort, replan, time budget expired) leave ROADMAP unchanged — checkbox only gets marked when full pipeline completes

### Claude's Discretion
- Exact placement of phase-complete call in SKILL.md (likely after Step 6 gate but before Step 7 /clear, or within Step 7 before the /clear suggestion)
- How to detect "all pipeline phases complete on disk" for the auto-correct fallback (likely reuse existing scanPipelinePhases)
- Whether auto-correct should be in SKILL.md orchestrator logic or in a new ralph-tools.cjs subcommand

</decisions>

<specifics>
## Specific Ideas

- "How does GSD do it?" — user explicitly asked and decisions align with GSD patterns: prevention via phase-complete at transition, record-session for granular tracking
- Auto-correct should reuse the existing `scanPipelinePhases` infrastructure for file scan truth
- The mismatch warning path in SKILL.md Step 2 currently says "Position mismatch: STATE.md says phase {X}, file scan says phase {Y}. Using file scan." — this should be replaced with the auto-correct + info log behavior

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-orchestrator-state-sync*
*Context gathered: 2026-02-27*
