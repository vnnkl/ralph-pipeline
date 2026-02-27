# Phase 15: Marathon Mode Orchestration - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Dedicated marathon entry point that chains planning phases 1-7, presents a bead inventory review gate, then stops before execution. Users plan everything upfront, review the merged bead queue, then separately start execution. Time budget applies only to execution, never to planning.

</domain>

<decisions>
## Implementation Decisions

### Entry point & invocation
- Separate `/ralph-marathon` skill (own skill file, not a flag on `/ralph-pipeline`)
- Dedicated setup wizard at launch: asks time budget, bead format, YOLO on/off in one pass
- Resumable: detects completed planning phases via scan-phases, resumes from first incomplete
- Sets `config.marathon = true` so downstream `/ralph-pipeline` knows beads came from marathon

### Phase chaining & gates
- Chains phases 1-7 (preflight through convert) with /clear between each phase
- Gate behavior identical to standard pipeline: auto-approve if YOLO, pause for user input otherwise
- Failure handling same as standard pipeline: auto-retry once, then pause for user
- Marathon stops after phase 7 (convert) + bead review gate -- never dispatches execute or review

### Bead inventory review gate
- Presented after Convert phase completes
- Shows summary table: bead name, type (bd/br), estimated complexity, source phase, total count + time estimate
- User can drop individual beads from the queue (partial selection)
- Approved beads written to `.beads/` directory (same location as standard pipeline)
- Rejection sends user back to Resolve phase (phase 6) to fix open questions, then re-runs Convert

### YOLO + marathon interaction
- YOLO auto-approves all gates including the bead review gate
- Even with YOLO, marathon still stops before execution (phase 8) -- marathon = planning only
- Time budget expiry timestamp is NOT set until Execute phase begins -- planning phases are never budget-constrained

### Claude's Discretion
- Setup wizard UX details (question ordering, defaults)
- State file structure for marathon-specific tracking
- How to present the bead summary table (formatting, sorting)
- Error messages and progress logging between phases

</decisions>

<specifics>
## Specific Ideas

- "The idea is to get a big plan to work on, not rushing to the plan without user input or clarification" -- marathon gates should feel deliberate, not bypassed (unless YOLO)
- YOLO + marathon is the fully unattended planning mode -- plan everything, auto-approve beads, stop before execution
- Standard marathon (no YOLO) pauses at every gate like normal pipeline -- the value is chaining, not skipping review

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 15-marathon-mode-orchestration*
*Context gathered: 2026-02-27*
