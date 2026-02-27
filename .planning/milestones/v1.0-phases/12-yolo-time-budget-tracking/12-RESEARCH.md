# Phase 12: YOLO Time Budget Tracking - Research

**Researched:** 2026-02-27
**Domain:** Template modification (execute.md), time-budget CLI integration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- YOLO execution mode: YOLO presents the same manual/headless gate as non-YOLO but **defaults to headless** (currently defaults to manual). User can still pick manual. Update `execute.md` Step 2: flip the YOLO default from manual to headless. Remove the "locked decision from CONTEXT.md" comment that mandated manual for YOLO.
- YOLO failure handling (headless): YOLO headless skips failed beads and continues to the next. Duration recorded for all beads including failed ones. After all beads complete, if any failed, auto-select "Proceed".
- Duration capture -- headless: Already works (Step 4 item 8 calls `ralph-tools.cjs time-budget record-bead $BEAD_DURATION`). No changes needed.
- Duration capture -- manual: Best-effort from consecutive `executed` timestamps in bead result files. After user signals done, orchestrator reads result files and computes per-bead durations: duration(N) = executed(N) - executed(N-1). First bead uses execution start timestamp as baseline (record start time when execute phase begins). If no result files exist (user chose "All passed" without files), skip duration tracking for this run. Call `record-bead` for each computed duration.
- Non-YOLO behavior: Unchanged -- still presents manual/headless gate with manual as default. Duration tracking in headless already works.

### Claude's Discretion
- Where to store execution start timestamp (config vs local variable)
- Exact sorting of result files for consecutive timestamp calculation
- Whether to also enable manual duration capture for non-YOLO (if trivial to add)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TIME-03 | Current phase always finishes before stopping (clean phase boundaries) | Already enforced at orchestrator level (Step 7a checks budget at phase boundaries). This phase ensures the bead duration data that feeds budget estimates is accurate, making TIME-03's "current phase finishes" semantics more reliable. |
| TIME-04 | Time remaining persisted to config.json (survives /clear between phases) | `record-bead` already writes `avg_bead_duration_ms` and `total_beads_executed` to config.json via `saveConfig()`. This phase ensures YOLO paths actually call `record-bead`, so the persisted data is populated with real durations instead of the 20-min default. |
</phase_requirements>

## Summary

This phase has two concerns: (1) flip the YOLO execute default from manual to headless, and (2) add manual-mode duration capture using timestamp diffs from result files. The headless duration capture already works (Step 4 item 8 in execute.md). The changes are entirely within `templates/execute.md` -- no library code changes needed.

The `time-budget record-bead` CLI and the `cmdTimeBudgetRecordBead` function in `lib/time-budget.cjs` are complete and tested: they accept a duration in ms, update the weighted running average in config.json, and persist `avg_bead_duration_ms` + `total_beads_executed`. The `time-budget estimate` function already uses `avg_bead_duration_ms` when available and falls back to 20-min default only when `total_beads_executed` is 0. No changes needed in `lib/time-budget.cjs` or `ralph-tools.cjs`.

**Primary recommendation:** Modify `templates/execute.md` in three places: (1) flip Step 2 YOLO default to headless and remove the "locked decision" comment, (2) record execution start timestamp at the top of the phase for manual mode baseline, (3) add a manual-mode duration computation block after Step 3a result collection that reads result file timestamps, computes per-bead durations from consecutive `executed` timestamps, and calls `record-bead` for each.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ralph-tools.cjs | current | CLI entry point for `time-budget record-bead` | Already wired, zero changes needed |
| lib/time-budget.cjs | current | `cmdTimeBudgetRecordBead` weighted avg logic | Already implemented and correct |
| lib/core.cjs | current | `loadConfig`/`saveConfig` with defaults for `avg_bead_duration_ms`, `total_beads_executed` | Defaults already include both fields |

### Supporting
No new libraries or tools needed. All infrastructure exists.

### Alternatives Considered
None -- the existing CLI is the correct integration point. No new code needed beyond template edits.

## Architecture Patterns

### Pattern 1: YOLO Default Flip (Step 2)
**What:** Change YOLO execute default from manual to headless
**When to use:** Step 2 of execute.md when mode is "yolo"
**Current code in execute.md Step 2:**
```
If mode is "yolo":
- Default to manual mode (locked decision from CONTEXT.md: user wants to be present for execution)
- Log: "YOLO mode: defaulting to manual execution (ralph-tui)"
- Skip AskUserQuestion, proceed to Step 3a (Manual Mode)
```
**New code:**
```
If mode is "yolo":
- Present the execution mode choice (same as non-YOLO) but default to headless
- Log: "YOLO mode: defaulting to headless execution"
- Skip AskUserQuestion, proceed to Step 3b (Headless Mode)
```

### Pattern 2: Manual Duration Capture (After Step 3a result collection)
**What:** Compute per-bead durations from consecutive `executed` timestamps in result files
**When to use:** After Step 3a aggregates results (manual mode), before Step 5
**Algorithm:**
1. Record `EXEC_START_TIME` (epoch ms) at phase entry (Step 1, before any mode gate)
2. After manual mode result collection (end of Step 3a), list result files sorted by `executed` timestamp
3. For each result file, extract the `executed:` YAML frontmatter field
4. Compute duration(N) = executed(N) - executed(N-1), where executed(0) = EXEC_START_TIME
5. Call `node ralph-tools.cjs time-budget record-bead $DURATION` for each computed duration
6. If no result files or no `executed` timestamps: skip duration tracking silently

### Pattern 3: YOLO Headless Failure Continuation with Duration Recording
**What:** Already works: Step 4 item 8 records duration, Step 6 YOLO path continues past failures
**When to use:** Headless YOLO execution
**Verification:** Duration is recorded in item 8 BEFORE the failure check in item 10. Failed beads DO get their duration recorded. This matches the CONTEXT.md decision: "Duration recorded for all beads including failed ones."

### Anti-Patterns to Avoid
- **Recording duration only for passed beads:** CONTEXT.md explicitly says "Duration recorded for all beads including failed ones." The current headless path already does this correctly (item 8 before item 10).
- **Storing execution start in config.json:** Unnecessary persistence overhead. A bash variable (`EXEC_START_TIME=$(date +%s%3N)`) at phase entry suffices since it never needs to survive /clear.
- **Computing manual durations from wall-clock time:** Use `executed` timestamps from result files, not system time at the moment of reading. Result files may have been written minutes or hours before the user signals done.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bead duration averaging | Custom averaging logic | `time-budget record-bead` CLI | Already handles weighted running average, count tracking, config persistence |
| Budget estimate with actual data | Custom estimate calculation | `time-budget estimate` CLI | Already uses `avg_bead_duration_ms` when available, falls back to 20-min default |
| Timestamp parsing | Custom date parser | bash `date -d` or ISO8601 direct comparison | Result files use standard ISO8601 format |

**Key insight:** All time-budget logic exists in `lib/time-budget.cjs`. This phase is purely a wiring task in `templates/execute.md`.

## Common Pitfalls

### Pitfall 1: YOLO Step 6 Override vs Step 4 Item 10
**What goes wrong:** Step 4 item 10 says "If FAILED: STOP the batch immediately." Step 6 says "In YOLO mode: skip the failed bead and continue." These appear contradictory.
**Why it happens:** The template was written with YOLO as an afterthought. Step 4 describes the default (non-YOLO) behavior. Step 6 describes the YOLO override.
**How to avoid:** When flipping YOLO to headless default, ensure Step 4 checks mode before stopping on failure. The current template already handles this: Step 6 modifies the loop behavior. But the planner must verify the control flow is consistent after the default flip.
**Warning signs:** If tests show YOLO headless stops on first failure, the Step 4/Step 6 interaction wasn't updated correctly.

### Pitfall 2: Manual Mode Timestamp Ordering
**What goes wrong:** Result files read in wrong order, producing negative or wildly wrong durations.
**Why it happens:** `ls` sorting is alphabetical by filename, not by `executed` timestamp. If beads are named `01-setup.md` and `02-api.md`, alphabetical order happens to match execution order. But if names don't sort cleanly, durations will be wrong.
**How to avoid:** Sort result files by the `executed` timestamp value from YAML frontmatter, not by filename.
**Warning signs:** Negative duration values, or durations that don't sum to approximately the total session time.

### Pitfall 3: First Bead Duration Baseline
**What goes wrong:** No baseline timestamp means first bead duration can't be computed, or it's computed as zero.
**Why it happens:** Manual mode doesn't record a start time anywhere.
**How to avoid:** Record `EXEC_START_TIME` in a bash variable at phase entry (Step 1). Use as baseline for first bead.
**Warning signs:** First bead always shows 0ms duration.

### Pitfall 4: No Result Files in Manual Mode
**What goes wrong:** User chose "All passed" without result files, code tries to parse empty directory.
**Why it happens:** ralph-tui might not write result files if the user skips that workflow.
**How to avoid:** CONTEXT.md explicitly says: "If no result files exist (user chose 'All passed' without files), skip duration tracking for this run." Guard with a file existence check before the duration computation loop.
**Warning signs:** Error messages about missing files or empty arrays during manual aggregation.

### Pitfall 5: Stale "locked decision" Comment
**What goes wrong:** Future readers see "locked decision from CONTEXT.md: user wants to be present" but the behavior now defaults to headless.
**Why it happens:** Comment not updated when behavior changes.
**How to avoid:** CONTEXT.md explicitly says to "Remove the 'locked decision from CONTEXT.md' comment that mandated manual for YOLO." The planner must include this in the task.

## Code Examples

### Record Bead Duration (headless, already works)
```bash
# Step 4 item 8 in execute.md (existing, no changes)
BEAD_END=$(date +%s%3N)
BEAD_DURATION=$((BEAD_END - BEAD_START))
node ralph-tools.cjs time-budget record-bead $BEAD_DURATION
```

### Capture Execution Start Time (new, at phase entry)
```bash
# At the top of the execute phase (Step 1), before mode gate
EXEC_START_TIME=$(date +%s%3N)
```

### Manual Mode Duration Computation (new, after Step 3a result collection)
```bash
# After result files are collected in Step 3a, before Step 5
# Read result files sorted by executed timestamp
RESULT_FILES=$(ls .claude/pipeline/bead-results/*.md 2>/dev/null)
if [ -n "$RESULT_FILES" ]; then
  PREV_TS=$EXEC_START_TIME
  for f in $(grep -l "executed:" .claude/pipeline/bead-results/*.md | sort); do
    EXEC_TS=$(grep "^executed:" "$f" | head -1 | sed 's/executed: //')
    # Convert ISO8601 to epoch ms (platform-dependent)
    EPOCH_MS=$(date -d "$EXEC_TS" +%s%3N 2>/dev/null || date -jf "%Y-%m-%dT%H:%M:%SZ" "$EXEC_TS" +%s 2>/dev/null)000
    if [ -n "$EPOCH_MS" ] && [ "$EPOCH_MS" != "000" ]; then
      DURATION=$((EPOCH_MS - PREV_TS))
      if [ "$DURATION" -gt 0 ]; then
        node ralph-tools.cjs time-budget record-bead $DURATION
      fi
      PREV_TS=$EPOCH_MS
    fi
  done
fi
```
Note: The exact bash for ISO8601 conversion depends on macOS vs Linux. The template is a Claude prompt (not directly-executed bash), so the agent will adapt. The critical logic is: sort by timestamp, compute consecutive diffs, call record-bead for each.

### YOLO Default Flip (Step 2 replacement)
```markdown
If mode is "yolo":
- Default to headless mode
- Log: "YOLO mode: defaulting to headless execution"
- Skip AskUserQuestion, proceed to Step 3b (Headless Mode)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| YOLO defaults to manual | YOLO defaults to headless (this phase) | Phase 12 | YOLO can run fully unattended |
| No manual duration capture | Timestamp-diff duration capture (this phase) | Phase 12 | Budget estimates improve even for manual execution |
| 20-min default for YOLO first run | Actual data after first headless run | Phase 5 (existing) | Estimates become accurate within one phase |

## Open Questions

1. **macOS vs Linux date command for ISO8601 parsing**
   - What we know: macOS uses `date -jf`, Linux uses `date -d`. The template is a Claude prompt that an LLM agent interprets, not a directly-executed script.
   - What's unclear: Whether the Claude agent executing the template will handle cross-platform date parsing correctly.
   - Recommendation: The template should describe the INTENT (convert ISO8601 to epoch ms) and let the executing agent choose the correct platform command. Include a comment noting the platform difference. This is LOW risk since the agent has bash access and can detect the OS.

2. **Whether to enable manual duration capture for non-YOLO**
   - What we know: CONTEXT.md marks this as Claude's discretion ("Whether to also enable manual duration capture for non-YOLO (if trivial to add)").
   - What's unclear: Whether it adds complexity that isn't justified.
   - Recommendation: YES, add it. The code is identical -- capture start time + post-collection timestamp diff loop. The start-time capture is already at phase entry (before mode gate). The duration computation block can be placed after ALL manual result collection (Step 3a), regardless of YOLO mode. This makes the code simpler (no YOLO check in the duration block) and improves estimates for all users.

## Sources

### Primary (HIGH confidence)
- `lib/time-budget.cjs` -- Read full source. Confirmed `cmdTimeBudgetRecordBead` handles weighted running average correctly. `cmdTimeBudgetEstimate` uses `avg_bead_duration_ms` when available, falls back to 20-min default when `total_beads_executed` is 0.
- `lib/core.cjs` -- Read full source. Confirmed `loadConfig` defaults include `avg_bead_duration_ms: null` and `total_beads_executed: 0`.
- `templates/execute.md` -- Read full source. Confirmed Step 4 item 8 already calls `record-bead` for headless. Step 2 YOLO defaults to manual. Step 6 YOLO continues past failures.
- `ralph-tools.cjs` -- Read full source. Confirmed `time-budget record-bead` routing to `cmdTimeBudgetRecordBead`.
- `SKILL.md` -- Read full source. Confirmed orchestrator Step 7a checks time budget at phase boundaries.

### Secondary (MEDIUM confidence)
- Phase 5 CONTEXT.md -- Original time budget and YOLO decisions. Confirmed this phase overrides the "Execute YOLO defaults to manual" decision.
- Phase 12 CONTEXT.md -- All locked decisions for this phase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all code read directly, no external libraries involved
- Architecture: HIGH - template modification pattern well-established across 11 prior phases
- Pitfalls: HIGH - control flow traced through execute.md, edge cases identified from CONTEXT.md decisions

**Research date:** 2026-02-27
**Valid until:** indefinite (internal codebase, no external dependency changes)
