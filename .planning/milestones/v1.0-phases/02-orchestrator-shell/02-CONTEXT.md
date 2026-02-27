# Phase 2: Orchestrator Shell - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

SKILL.md can sequence pipeline phases, dispatch Task subagents, verify completion flags, and present user gates. The /clear boundary pattern works end-to-end for at least two phases. Covers requirements ORCH-03, ORCH-04, ORCH-05, STATE-07.

</domain>

<decisions>
## Implementation Decisions

### Phase Sequencing
- Linear phase order by default, with `--skip-to <phase>` flag for jumping ahead
- Completed phases auto-skipped silently (one-line log: "Phase X already complete, skipping")
- Phase position determined by STATE.md as primary + output file scan for validation (belt-and-suspenders, matching GSD pattern)
- On mismatch between STATE.md and file scan, trust the file scan (more recent truth)

### Subagent Dispatch
- Each pipeline phase has a prompt template file in `templates/` directory — orchestrator fills variables and dispatches
- SKILL.md stays lean (template separation mirrors GSD's workflow file separation)
- Dual completion verification: agent return message for immediate routing + `completed: true` in file frontmatter for /clear recovery
- On subagent failure: auto-retry once, then present user gate (Retry / Skip / Abort)

### User Gate Behavior
- Gates are context-dependent (not a fixed template) — options vary based on what just happened (matching GSD pattern)
- After successful phase: approve / redirect / skip / replan (contextual subset shown)
- After failure: retry / skip / abort
- Redirect mechanic: spawn fresh subagent with original prompt + existing output + user feedback (not resume — matches GSD's "fresh agent with explicit state" pattern)
- Gate display: summary + 2-3 key excerpts from output (not full content, not just file path)

### Resume after /clear
- On re-invoke: show status banner (pipeline progress, current position) then auto-dispatch next incomplete phase
- Orchestrator passes file paths only to subagents via `<files_to_read>` blocks — never loads content into its own context (stays lean)
- Manual mode: suggest `/clear first → fresh context window` before next phase
- Auto mode: dispatch next phase as Task subagent (inherently context-isolated, no /clear needed)

### Claude's Discretion
- Exact status banner format and content density
- Template file naming convention
- How much of the phase output to excerpt in gates
- Internal error classification logic for retry decisions

</decisions>

<specifics>
## Specific Ideas

- "Match GSD patterns" was the consistent theme — sequencing, dispatch, gates, and resume should mirror GSD's proven approaches adapted to ralph-pipeline's single-skill structure
- GSD reference code at `.reference/get-shit-done/workflows/` is the authoritative source for implementation patterns

</specifics>

<deferred>
## Deferred Ideas

- YOLO mode (ORCH-06) auto-approving all gates — Phase 5
- Auto-advance chain with --auto flag (ORCH-07) — Phase 5
- Time budget integration (TIME-01 through TIME-04) — Phase 5

</deferred>

---

*Phase: 02-orchestrator-shell*
*Context gathered: 2026-02-25*
