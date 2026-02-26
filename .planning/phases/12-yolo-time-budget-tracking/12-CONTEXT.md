# Phase 12: YOLO Time Budget Tracking - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire `record-bead` into the YOLO execute path so `time-budget estimate` uses actual bead duration data instead of the 20-minute default. Covers both headless and manual execution modes in YOLO.

</domain>

<decisions>
## Implementation Decisions

### YOLO execution mode
- YOLO presents the same manual/headless gate as non-YOLO, but **defaults to headless** (currently defaults to manual)
- User can still pick manual if they want to run ralph-tui
- Update `execute.md` Step 2: flip the YOLO default from manual to headless
- Remove the "locked decision from CONTEXT.md" comment that mandated manual for YOLO

### YOLO failure handling (headless)
- YOLO headless skips failed beads and continues to the next (matches current YOLO Step 6 semantics)
- Duration recorded for all beads including failed ones
- After all beads complete, if any failed, auto-select "Proceed" (already described in execute.md Step 6 YOLO section)

### Duration capture — headless
- Already works: Step 4 item 8 calls `ralph-tools.cjs time-budget record-bead $BEAD_DURATION`
- No changes needed for headless duration capture

### Duration capture — manual
- Best-effort from consecutive `executed` timestamps in bead result files
- After user signals done, orchestrator reads result files and computes per-bead durations: duration(N) = executed(N) - executed(N-1)
- First bead uses execution start timestamp as baseline (record start time when execute phase begins)
- If no result files exist (user chose "All passed" without files), skip duration tracking for this run
- Call `record-bead` for each computed duration

### Non-YOLO behavior
- Unchanged — still presents manual/headless gate with manual as default
- Duration tracking in headless already works

### Claude's Discretion
- Where to store execution start timestamp (config vs local variable)
- Exact sorting of result files for consecutive timestamp calculation
- Whether to also enable manual duration capture for non-YOLO (if trivial to add)

</decisions>

<specifics>
## Specific Ideas

- YOLO is about skipping gates, not about a specific execution mode — user should still choose how beads run
- Duration data quality matters more than perfect per-bead accuracy — approximate from timestamps is fine

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-yolo-time-budget-tracking*
*Context gathered: 2026-02-27*
