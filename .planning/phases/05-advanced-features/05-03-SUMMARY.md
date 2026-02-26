---
phase: 05-advanced-features
plan: 03
subsystem: orchestrator
tags: [auto-advance, session-hook, time-budget, phase-boundary, yolo-retry]

# Dependency graph
requires:
  - phase: 05-advanced-features
    provides: "time-budget CLI commands (05-01), YOLO mode gate bypass and --auto flag detection (05-02)"
provides:
  - "SessionStart hook for auto-advance re-invocation after /clear"
  - "Time budget prompt at pipeline start (Step 1b)"
  - "Phase boundary time budget check (Step 7a)"
  - "Auto-advance /clear logic with hook re-invocation (Step 7b)"
  - "Auto-advance cleanup on all exit paths"
  - "Phase failure auto-retry once in YOLO/auto mode (phase_retry_count)"
  - "Bead duration recording in execute template"
affects: [orchestrator, execute-template]

# Tech tracking
tech-stack:
  added: []
  patterns: [session-start-hook-with-staleness-guard, immutable-config-in-hook, phase-boundary-budget-check]

key-files:
  created: [.claude/hooks/ralph-auto-advance.js, .claude/settings.json]
  modified: [SKILL.md, templates/execute.md]

key-decisions:
  - "SessionStart hook reads config.json directly (not via ralph-tools.cjs) for speed and path independence"
  - "12-hour staleness guard auto-clears auto_advance to prevent infinite restart after crash"
  - "Hook silently exits 0 on any error to never break session startup"
  - "Auto-advance uses /clear + SessionStart hook re-invocation for true context isolation"
  - "Phase boundary is the only place budget is checked (never mid-phase)"

patterns-established:
  - "SessionStart hook pattern: read stdin for hook input, check source, read config, output additionalContext JSON"
  - "Phase boundary check pattern: time-budget check -> estimate -> log remaining -> continue or stop"
  - "Exit path cleanup: every pipeline stop clears auto_advance via config-set"

requirements-completed: [ORCH-07, TIME-02, TIME-03]

# Metrics
duration: 3min
completed: 2026-02-26
---

# Phase 5 Plan 3: Auto-Advance and Time Budget Integration Summary

**SessionStart hook for /clear-based auto-advance chaining, time budget prompts and phase boundary checks in SKILL.md, and bead duration recording in execute template**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T08:59:21Z
- **Completed:** 2026-02-26T09:02:35Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created SessionStart hook (.claude/hooks/ralph-auto-advance.js) that checks auto_advance, staleness (12h), and time budget on startup/clear, outputting additionalContext for auto-invocation
- Registered hook in .claude/settings.json so it fires on every session start
- Added Step 1b (time budget prompt), Step 7a (phase boundary budget check), Step 7b (auto-advance /clear logic), and auto-advance cleanup on all exit paths to SKILL.md
- Added phase failure auto-retry once in YOLO/auto mode using phase_retry_count in Step 6
- Added bead duration recording via time-budget record-bead after each headless bead execution in execute.md

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SessionStart hook and register in settings.json** - `87cdc96` (feat)
2. **Task 2: Add time budget, phase boundary checks, auto-advance /clear, and bead recording** - `c0eada7` (feat)

## Files Created/Modified
- `.claude/hooks/ralph-auto-advance.js` - SessionStart hook: auto_advance check, 12h staleness guard, time budget expiry, additionalContext output
- `.claude/settings.json` - Hook registration for SessionStart with 5s timeout
- `SKILL.md` - Step 1b (time budget prompt), Step 6 (phase failure auto-retry), Step 7a/7b (time budget + auto-advance /clear), cleanup on all exit paths
- `templates/execute.md` - Bead start time capture and duration recording via time-budget record-bead

## Decisions Made
- Hook reads config.json directly (not ralph-tools.cjs) because hook runs from .claude/hooks/ and ralph-tools.cjs may not be on PATH
- 12-hour staleness guard prevents infinite restart loops if Claude crashes mid-orchestrator
- Hook silently exits 0 on any error -- never breaks session startup
- Auto-advance ensures auto_advance persists to config before suggesting /clear so SessionStart hook picks it up
- Budget checked at phase boundary only (Step 7a), never mid-phase, per locked decision

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 5 plans complete: time budget CLI (05-01), YOLO mode (05-02), auto-advance + time integration (05-03)
- Full pipeline automation stack is ready: --yolo for gate bypass, --auto for phase chaining, time budget for session limits
- SessionStart hook registered and will fire on next session start/clear when auto_advance is true

---
*Phase: 05-advanced-features*
*Completed: 2026-02-26*

## Self-Check: PASSED
