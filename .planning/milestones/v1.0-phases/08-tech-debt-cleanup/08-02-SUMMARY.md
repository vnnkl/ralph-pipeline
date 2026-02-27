---
phase: 08-tech-debt-cleanup
plan: 02
subsystem: orchestration
tags: [clarify, template, AskUserQuestion, YOLO, scope-gathering]

requires:
  - phase: 02-orchestrator-shell
    provides: stub clarify template skeleton and template variable system
provides:
  - Functional clarify template that gathers project scope via AskUserQuestion
  - Structured output format with section headers parseable by research.md
  - YOLO mode auto-generation of scope defaults from PROJECT.md and file detection
affects: [research, PRD, pipeline]

tech-stack:
  added: []
  patterns: [AskUserQuestion scope gathering, PROJECT.md pre-population, YOLO auto-defaults]

key-files:
  created: []
  modified: [templates/clarify.md]

key-decisions:
  - "4 questions max: project name+description, stack, platform, quality gates"
  - "YOLO mode auto-detects stack from package.json/go.mod/Cargo.toml/requirements.txt"
  - "Clear section headers (## Project Scope, ## Stack, ## Quality Gates, ## Scope Boundaries) for research.md parsing"
  - "PRE_POPULATED pattern: read PROJECT.md first, confirm rather than re-ask"

patterns-established:
  - "Scope gathering via AskUserQuestion with PROJECT.md pre-population"
  - "YOLO defaults with per-field logging"

requirements-completed: [ORCH-03]

duration: 3min
completed: 2026-02-26
---

# Phase 08 Plan 02: Clarify Template Summary

**Functional clarify template replacing stub -- gathers project scope via 3-4 AskUserQuestion prompts with PROJECT.md pre-population and YOLO auto-defaults**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T17:39:36Z
- **Completed:** 2026-02-26T17:42:13Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced stub clarify template (immediately writes completed: true) with functional implementation
- Template gathers 3-4 scope questions: project name+description, primary stack, target platform, quality gates
- Pre-populates from .planning/PROJECT.md when available, confirming rather than re-asking
- YOLO mode auto-generates reasonable defaults from PROJECT.md context and file detection (package.json, go.mod, etc.)
- Output uses clear section headers (## Project Scope, ## Stack, ## Quality Gates, ## Scope Boundaries) for research.md Step 1 extraction

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace clarify stub template with functional implementation** - `d4a799c` (feat)

## Files Created/Modified
- `templates/clarify.md` - Functional clarify phase template with AskUserQuestion scope gathering, PROJECT.md pre-population, YOLO auto-defaults, and structured output format

## Decisions Made
- 4 questions max: project name+description, primary stack, target platform, quality gates
- YOLO mode auto-detects stack from package.json/go.mod/Cargo.toml/requirements.txt/pyproject.toml
- Output body uses clear ## section headers for natural language extraction by research.md Step 1
- PROJECT.md pre-population: extracted values presented as confirmation options rather than fresh prompts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Clarify template is functional -- closes ORCH-03 tech debt
- Research template (research.md Step 1) can parse the structured output via section headers
- No blockers for remaining phase 8 plans

---
*Phase: 08-tech-debt-cleanup*
*Completed: 2026-02-26*

## Self-Check: PASSED

- templates/clarify.md: FOUND
- Commit d4a799c: FOUND
- 08-02-SUMMARY.md: FOUND
