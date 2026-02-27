---
phase: 14-codemaps-foundation
plan: 01
subsystem: cli
tags: [codemap, freshness, mtime, filesystem]

requires:
  - phase: none
    provides: "standalone foundation -- no prior phase dependencies"
provides:
  - "lib/codemap.cjs with checkFreshness, getCodemapPaths, getCodemapAge pure functions"
  - "CLI commands: codemap check|paths|age via ralph-tools.cjs"
  - "Exported constants: CODEMAP_FILES, CODEMAP_DIR, STALENESS_THRESHOLD_MS"
affects: [14-02, 14-03, orchestrator]

tech-stack:
  added: []
  patterns: [pure-function-with-cli-wrapper, mtime-based-freshness]

key-files:
  created:
    - lib/codemap.cjs
    - tests/codemap.test.cjs
  modified:
    - ralph-tools.cjs

key-decisions:
  - "Pure functions (checkFreshness, getCodemapPaths, getCodemapAge) separated from CLI wrappers for testability"
  - "Age based on oldest file mtime (worst-case staleness) with 1-decimal rounding"

patterns-established:
  - "Pure function + CLI wrapper pattern: testable logic in pure functions, thin cmd* wrappers call output()"
  - "Codemap file inventory: 7 files in .planning/codebase/ with 4-hour staleness threshold"

requirements-completed: [CMAP-06, CMAP-07]

duration: 2min
completed: 2026-02-27
---

# Phase 14 Plan 01: Codemap CLI Commands Summary

**Codemap freshness detection via check/paths/age CLI commands with 4-hour staleness threshold over 7-file inventory**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-27T13:01:35Z
- **Completed:** 2026-02-27T13:03:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created lib/codemap.cjs with 3 pure functions, 3 CLI wrappers, and 3 exported constants
- Wrote 16 test cases covering all codemap commands, constants, and edge cases (all passing)
- Wired codemap subcommand routing into ralph-tools.cjs following time-budget pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Write tests for codemap CLI commands** - `e2de1b7` (test)
2. **Task 2: Implement lib/codemap.cjs and wire into ralph-tools.cjs** - `8b24e30` (feat)

## Files Created/Modified
- `lib/codemap.cjs` - Codemap freshness detection (3 pure functions + 3 CLI wrappers + 3 constants)
- `tests/codemap.test.cjs` - 16 test cases for all codemap functionality
- `ralph-tools.cjs` - Added codemap require and check|paths|age subcommand routing

## Decisions Made
- Pure functions separated from CLI wrappers for testability (checkFreshness vs cmdCodemapCheck)
- Age calculated from oldest file mtime (worst-case staleness), rounded to 1 decimal place

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- lib/codemap.cjs exports CODEMAP_FILES, CODEMAP_DIR, STALENESS_THRESHOLD_MS for Plan 02/03
- ralph-tools.cjs codemap routing ready for orchestrator integration
- Pure function pattern established for Plan 02 (generate command) to follow

---
*Phase: 14-codemaps-foundation*
*Completed: 2026-02-27*

## Self-Check: PASSED
