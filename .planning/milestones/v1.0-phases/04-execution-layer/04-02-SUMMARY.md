---
phase: 04-execution-layer
plan: 02
subsystem: execution
tags: [claude-p, headless, ralph-tui, bead-execution, result-files]

requires:
  - phase: 03-phase-content
    provides: "Template patterns (deepen.md, resolve.md) for gate and agent dispatch patterns"
  - phase: 02-orchestrator-shell
    provides: "Template skeleton with {{VAR}} placeholders, stub templates"
provides:
  - "Production execute.md template replacing stub"
  - "Headless claude -p bead execution pattern with env -u CLAUDECODE"
  - "Status-only result file schema in .claude/pipeline/bead-results/"
  - "Manual/headless execution gate pattern"
  - "Failure gate with re-run/retry/proceed/abort options"
affects: [review-template, SKILL.md-orchestrator]

tech-stack:
  added: [claude-p-headless, env-u-CLAUDECODE]
  patterns: [sequential-bead-execution, stop-on-failure, status-only-result-files, execution-gate, pre-exec-commit-recording]

key-files:
  created: []
  modified: [templates/execute.md]

key-decisions:
  - "EXEC-04 reconciliation: bead agent enforces tests/type checks internally; pipeline trusts exit code without external re-check"
  - "Stdin piping for large beads: cat bead.md | env -u CLAUDECODE claude -p instead of inline prompt argument"
  - "Manual mode scans for ralph-tui result files before asking user for pass/fail"

patterns-established:
  - "env -u CLAUDECODE claude -p pattern: always unset CLAUDECODE env var before spawning headless claude"
  - "Status-only result files: YAML frontmatter with status/bead/executed, no body content"
  - "Pre-exec commit recording: save git HEAD before execution for review phase diff scoping"

requirements-completed: [EXEC-01, EXEC-02, EXEC-03, EXEC-04]

duration: 3min
completed: 2026-02-25
---

# Phase 4 Plan 02: Execute Template Summary

**Production execute.md template with headless claude -p bead execution, manual ralph-tui fallback, status-only result files, and stop-on-failure with re-run/retry/proceed/abort gate**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T22:02:35Z
- **Completed:** 2026-02-25T22:05:47Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced stub execute.md with production template following established patterns
- Implemented headless mode with env -u CLAUDECODE safety for nested session prevention
- Implemented manual mode with ralph-tui launch and result file scanning
- Added failure gate with targeted re-run, retry all, proceed, and abort options
- Pre-exec commit recording for review phase diff scoping

## Task Commits

Each task was committed atomically:

1. **Task 1: Write production execute.md template** - `6b14138` (feat)
2. **Task 2: Verify execute template structure** - no changes needed (verification-only)

## Files Created/Modified
- `templates/execute.md` - Production execute phase template with headless/manual modes, bead-level progress, result aggregation

## Decisions Made
- EXEC-04 quality gate reconciliation: REQUIREMENTS.md says "tests pass, type checks pass" but CONTEXT.md locked decision says "pipeline trusts bead agent's self-reported result." Resolution: the bead agent itself enforces tests/type checks internally; the pipeline trusts that exit code without re-running checks externally
- Use stdin piping (cat bead.md | claude -p) rather than inline prompt for large bead content
- Manual mode scans .claude/pipeline/bead-results/ for ralph-tui result files before falling back to user self-report

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Execute template is production-ready, can be dispatched by SKILL.md orchestrator
- Review template (04-03) is next, which will use pre-exec-commit from execute phase for diff scoping
- PHASE_FILES mapping for execute phase may need updating in 04-03

---
*Phase: 04-execution-layer*
*Completed: 2026-02-25*

## Self-Check: PASSED
