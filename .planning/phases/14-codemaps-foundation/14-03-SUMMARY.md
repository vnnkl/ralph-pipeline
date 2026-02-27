---
phase: 14-codemaps-foundation
plan: 03
subsystem: orchestrator
tags: [codemap, template-injection, orchestrator-hooks, phase-dispatch]

requires:
  - phase: 14-codemaps-foundation-01
    provides: "lib/codemap.cjs with checkFreshness, codemap CLI commands"
  - phase: 14-codemaps-foundation-02
    provides: "templates/codemap.md with 4 parallel mapper agents"
provides:
  - "SKILL.md codemap generation hooks (pre-research freshness check, post-execution bypass refresh)"
  - "CODEMAP_FILES template variable with per-phase role mapping"
  - "4 phase templates with codemap file injection (research, prd, deepen, review)"
affects: [pipeline-orchestrator, research, prd, deepen, review]

tech-stack:
  added: []
  patterns: [per-role-codemap-injection, freshness-gated-generation, post-execution-refresh]

key-files:
  created: []
  modified:
    - SKILL.md
    - templates/research.md
    - templates/prd.md
    - templates/deepen.md
    - templates/review.md

key-decisions:
  - "CODEMAP_FILES passed only to phases 3,4,5,9 whose templates have the placeholder; other phases omit it"
  - "Post-execution refresh (Step 7b) always bypasses freshness -- execution definitionally makes codemaps stale"
  - "Pre-research hook (Step 3b) is freshness-gated with 4h threshold via codemap check CLI"
  - "Codemap guidance in templates is conditional ('If codemap files are listed...') for graceful degradation"

patterns-established:
  - "Role-to-files mapping: research=STACK+ARCHITECTURE, prd/deepen=ARCHITECTURE+STRUCTURE, review=CONCERNS+CONVENTIONS"
  - "Two-trigger codemap generation: freshness-gated before research, forced after execution"

requirements-completed: [CMAP-02, CMAP-03, CMAP-04, CMAP-05]

duration: 4min
completed: 2026-02-27
---

# Phase 14 Plan 03: Orchestrator Integration Summary

**Codemap generation hooks in SKILL.md orchestrator (pre-research freshness check + post-execution forced refresh) with per-role CODEMAP_FILES injection into research/prd/deepen/review templates**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-27T13:06:51Z
- **Completed:** 2026-02-27T13:10:29Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added CODEMAP_FILES template variable with per-phase role mapping table to SKILL.md
- Added Step 3b (pre-research codemap generation) with freshness-gated automatic dispatch
- Added Step 7b (post-execution codemap refresh) that always bypasses freshness check
- Injected {{CODEMAP_FILES}} into exactly 4 phase templates with conditional usage guidance
- Added codemap check|paths|age commands to CLI Reference table

## Task Commits

Each task was committed atomically:

1. **Task 1: Add codemap generation hooks to SKILL.md** - `2c0677d` (feat)
2. **Task 2: Add {{CODEMAP_FILES}} to the 4 phase templates** - `92aa8cf` (feat)

## Files Created/Modified
- `SKILL.md` - Codemap generation hooks (Step 3b, Step 7b), CODEMAP_FILES variable table, CLI Reference
- `templates/research.md` - {{CODEMAP_FILES}} in files_to_read + STACK/ARCHITECTURE guidance
- `templates/prd.md` - {{CODEMAP_FILES}} in files_to_read + ARCHITECTURE/STRUCTURE guidance
- `templates/deepen.md` - {{CODEMAP_FILES}} in files_to_read + ARCHITECTURE/STRUCTURE guidance
- `templates/review.md` - {{CODEMAP_FILES}} in files_to_read + CONCERNS/CONVENTIONS guidance

## Decisions Made
- CODEMAP_FILES only passed to fillTemplate for phases 3, 4, 5, 9 (templates with placeholder)
- Post-execution refresh always bypasses freshness (execution makes codemaps stale by definition)
- Pre-research hook is fully automatic (no user prompt, no skip/refresh choice)
- Template guidance uses conditional phrasing for graceful degradation when codemaps absent

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 plans in Phase 14 (Codemaps Foundation) complete
- Full codemap pipeline wired: CLI (Plan 01) -> Template (Plan 02) -> Orchestrator (Plan 03)
- Ready for pipeline execution with automatic codemap generation and per-role injection

---
*Phase: 14-codemaps-foundation*
*Completed: 2026-02-27*

## Self-Check: PASSED
