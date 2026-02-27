---
phase: 15-marathon-mode-orchestration
plan: 01
subsystem: orchestration
tags: [marathon, skill-file, phase-chaining, setup-wizard, yolo]

requires:
  - phase: 14-codemaps-foundation
    provides: codemap generation and freshness checking for research phase hook
provides:
  - MARATHON.md skill file for /ralph-marathon entry point
  - Setup wizard for marathon config (time budget, bead format, YOLO)
  - Phase chaining logic for phases 1-7 with /clear boundaries
  - Bead cleanup step before convert phase
affects: [15-02 bead review gate, standard pipeline marathon detection]

tech-stack:
  added: []
  patterns: [marathon skill mirrors SKILL.md orchestrator structure, setup wizard single-pass config]

key-files:
  created:
    - MARATHON.md
  modified: []

key-decisions:
  - "YOLO skip rule: skip wizard entirely if mode already yolo, only prompt for bead_format if missing"
  - "Step 8 placeholder for bead review gate (Plan 15-02) keeps MARATHON.md extensible"
  - "No time-budget start during planning -- deferred to execute phase via config flag"
  - "Clean .beads/ before convert prevents stale bead accumulation across marathon runs"

patterns-established:
  - "Marathon skill file structure: Steps 0-7 mirroring SKILL.md with marathon-specific additions"
  - "Setup wizard pattern: 3 sequential AskUserQuestion calls with YOLO fast-path"

requirements-completed: [MARA-01, MARA-02, MARA-04]

duration: 5min
completed: 2026-02-27
---

# Phase 15 Plan 01: Marathon Skill Entry Point Summary

**MARATHON.md skill file with setup wizard, phase 1-7 chaining via /clear, YOLO bypass, and codemap/bead-cleanup hooks**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-27T15:51:12Z
- **Completed:** 2026-02-27T15:55:58Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created MARATHON.md (433 lines) as the `/ralph-marathon` skill entry point
- Setup wizard collects time budget, bead format, and YOLO mode in one pass before any phase runs
- Phase chaining mirrors SKILL.md Steps 0-7 for phases 1-7 with identical dispatch, gate, and /clear logic
- YOLO skip rule fast-paths existing yolo-mode projects past the wizard
- Codemap generation hook before research phase (Step 3b) matches SKILL.md behavior
- Clean .beads/ step before convert phase prevents stale bead accumulation
- Step 8 placeholder prepared for bead inventory review gate (Plan 15-02)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create MARATHON.md skill file with setup wizard and phase chaining** - `8e95064` (feat)

## Files Created/Modified
- `MARATHON.md` - Marathon mode skill entry point with setup wizard and phase chaining for phases 1-7

## Decisions Made
- YOLO skip rule: skip wizard entirely if mode already yolo, only prompt for bead_format if missing
- Step 8 placeholder for bead review gate (Plan 15-02) keeps MARATHON.md extensible without premature implementation
- No time-budget start during planning -- deferred to execute phase via marathon_time_budget_hours config flag
- Clean .beads/ before convert prevents stale bead accumulation across marathon runs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- MARATHON.md ready for Plan 15-02 to add Step 8 (bead inventory review gate)
- All marathon-specific config keys documented in CLI Reference section
- Phase dispatch tables (PHASE_FILES, CODEMAP_FILES) match SKILL.md exactly

---
*Phase: 15-marathon-mode-orchestration*
*Completed: 2026-02-27*

## Self-Check: PASSED

- MARATHON.md: FOUND
- 15-01-SUMMARY.md: FOUND
- Commit 8e95064: FOUND
