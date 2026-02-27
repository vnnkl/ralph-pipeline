---
phase: 04-execution-layer
plan: 03
subsystem: pipeline
tags: [review, parallel-agents, P1-P2-P3, compound-review, gh-pr-create, deduplication]

requires:
  - phase: 04-execution-layer
    provides: "Execute template with pre_exec_commit for diff scoping, bead-results for status aggregation"
  - phase: 03-phase-content
    provides: "Deepen template pattern (parallel review agents, P1/P2/P3 severity, gate options)"
provides:
  - "Production review.md template for post-execution compound code review"
  - "SKILL.md PHASE_FILES table verified complete for all 9 phases"
affects: [05-advanced-features, SKILL.md-orchestrator]

tech-stack:
  added: []
  patterns: [Post-execution code review via git diff, Cross-agent finding deduplication, 6-option review gate with PR creation and targeted bead re-execution]

key-files:
  created: []
  modified: [templates/review.md]

key-decisions:
  - "Execute PHASE_FILES stays empty (reads .beads/ directly via Glob)"
  - "Review PHASE_FILES stays empty (reads git diff and bead-results directly)"

patterns-established:
  - "Review diff scoping: pre_exec_commit...HEAD isolates bead-produced changes from prior commits"
  - "Manual fix checklist: P1/P2 findings presented as numbered checklist for user to fix (no auto-fix agent)"
  - "Re-run bead X: targeted bead re-execution via env -u CLAUDECODE claude -p from review gate"

requirements-completed: [REVW-01, REVW-02, REVW-03]

duration: 4min
completed: 2026-02-25
---

# Phase 4 Plan 03: Review Template Summary

**Production review.md template with 4 parallel code review agents against git diff, P1/P2/P3 categorization with deduplication, and 6-option review gate including draft PR creation and targeted bead re-execution**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-25T22:10:38Z
- **Completed:** 2026-02-25T22:14:44Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced stub review.md with production template (541 lines added)
- 4 parallel review agents (security-sentinel, architecture-strategist, code-simplicity-reviewer, performance-oracle) analyzing git diff of actual bead-produced code
- Review diff scoped via pre_exec_commit...HEAD with fallback to HEAD~{bead_count}
- Cross-agent finding deduplication keeping highest-severity instance
- 6-option review gate: fix P1s / fix P1+P2 / skip / re-run / create PR / re-run bead X
- Manual fix checklist for P1/P2 (no auto-fix agent per locked decision)
- Draft PR creation via gh pr create --draft with pipeline summary
- Re-run bead X for targeted re-execution with optional re-review
- Verified SKILL.md PHASE_FILES table correct for all 9 phases (execute and review stay empty)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write production review.md template** - `7876332` (feat)
2. **Task 2: Update SKILL.md PHASE_FILES and verify all templates** - no changes needed (verification-only, PHASE_FILES already correct)

## Files Created/Modified
- `templates/review.md` - Production review phase template replacing stub; orchestrates compound post-execution code review with parallel agents

## Decisions Made
- Execute PHASE_FILES stays empty: reads .beads/ directly via Glob, no upstream PHASE_FILES needed
- Review PHASE_FILES stays empty: reads git diff and bead-results directly from instructions, no orchestrator-injected files needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 3 execution layer templates are production-ready (convert.md, execute.md, review.md)
- SKILL.md orchestrator can dispatch all 9 phases with correct PHASE_FILES
- Phase 5 (Advanced Features) is next: YOLO mode, auto-advance, time budget

---
*Phase: 04-execution-layer*
*Completed: 2026-02-25*

## Self-Check: PASSED

- templates/review.md: FOUND
- 04-03-SUMMARY.md: FOUND
- Commit 7876332: FOUND
- Stub references: 0 (clean)
- All 8 key patterns verified present (security-sentinel, architecture-strategist, code-simplicity-reviewer, performance-oracle, gh pr create --draft, PHASE COMPLETE, re-run bead, deduplication)
