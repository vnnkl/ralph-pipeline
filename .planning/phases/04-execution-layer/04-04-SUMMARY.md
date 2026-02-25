---
phase: 04-execution-layer
plan: 04
subsystem: templates
tags: [quality-gates, bead-execution, testing, type-checking]

requires:
  - phase: 04-execution-layer/04-01
    provides: convert.md template with bead creation and frontend injection
  - phase: 04-execution-layer/04-02
    provides: execute.md template with headless bead execution via claude -p
provides:
  - Quality gate instructions appended to bead invocation prompt in execute template
  - Quality gate acceptance criteria injection step in convert template
affects: [05-final-integration]

tech-stack:
  added: []
  patterns: [quality-gate-by-delegation, acceptance-criteria-injection]

key-files:
  created: []
  modified:
    - templates/execute.md
    - templates/convert.md

key-decisions:
  - "Quality gates enforced by delegation to bead agent, not external check (honors CONTEXT.md locked decision)"
  - "QUALITY_GATE_SUFFIX defined before loop, appended via stdin piping with echo"
  - "Step 6.5 in convert.md runs after frontend injection, before completion file write"
  - "Idempotent injection: skips beads already containing quality gate references"

patterns-established:
  - "Dual quality gate enforcement: prompt suffix (execute) + acceptance criteria (convert)"

requirements-completed: [CONV-01, CONV-02, CONV-03, CONV-04, EXEC-01, EXEC-02, EXEC-03, EXEC-04, REVW-01, REVW-02, REVW-03]

duration: 1min
completed: 2026-02-25
---

# Phase 4 Plan 4: Quality Gate Instructions Summary

**Dual quality gate enforcement via execute template prompt suffix and convert template acceptance criteria injection, ensuring bead agents are explicitly instructed to run tests and type checks**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-25T22:35:21Z
- **Completed:** 2026-02-25T22:36:36Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- execute.md now defines QUALITY_GATE_SUFFIX and appends it to each bead invocation prompt, instructing bead agents to run tests and type checks before reporting success
- convert.md now includes Step 6.5 that injects quality gate acceptance criteria into all beads during conversion
- Success criteria in execute.md updated to reflect quality gate enforcement by delegation
- EXEC-04 gap closed and ROADMAP Success Criterion 3 satisfied while honoring CONTEXT.md locked decision

## Task Commits

Each task was committed atomically:

1. **Task 1: Patch execute.md to append quality gate instructions to bead invocation prompt** - `1f8781f` (feat)
2. **Task 2: Patch convert.md to inject quality gate acceptance criteria into beads** - `0a9222b` (feat)

## Files Created/Modified
- `templates/execute.md` - Added QUALITY_GATE_SUFFIX definition and bead invocation pattern with suffix appended; updated success criteria
- `templates/convert.md` - Added Step 6.5 injecting quality gate acceptance criteria into all bead files

## Decisions Made
- Quality gates enforced by delegation to bead agent, not external check (honors CONTEXT.md locked decision that pipeline trusts bead exit code)
- QUALITY_GATE_SUFFIX defined once before the execution loop and appended via `(cat ...; echo "$SUFFIX")` stdin piping
- Step 6.5 placed between frontend design injection (Step 6) and completion file write (Step 7) for clean ordering
- Injection is idempotent: skips beads already containing "tests pass", "type check", or "quality gate" references

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 plans in Phase 4 (Execution Layer) complete
- Templates (convert, execute, review) all production-ready with quality gate enforcement
- Ready for Phase 5 (Final Integration)

---
*Phase: 04-execution-layer*
*Completed: 2026-02-25*

## Self-Check: PASSED
- 04-04-SUMMARY.md exists
- templates/execute.md exists with quality gate content
- templates/convert.md exists with Step 6.5
- Commit 1f8781f verified
- Commit 0a9222b verified
