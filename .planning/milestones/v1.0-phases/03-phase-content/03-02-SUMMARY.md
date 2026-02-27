---
phase: 03-phase-content
plan: 02
subsystem: templates
tags: [deepen, resolve, review-agents, tbd-scanning, askuserquestion, phase-files]

requires:
  - phase: 02-orchestrator-shell
    provides: "SKILL.md orchestrator dispatch, fillTemplate(), 9 stub template files"
  - phase: 03-phase-content/01
    provides: "research.md template pattern (parallel agent dispatch + synthesis)"
provides:
  - "Deepen template with 4 parallel review agents, P1/P2/P3 categorization, refine/re-run/proceed gate"
  - "Resolve template with TBD scanning, one-by-one AskUserQuestion, inline resolution, re-scan validation"
  - "PHASE_FILES mapping table in SKILL.md for all 9 phases"
affects: [04-execution-layer, templates, orchestrator]

tech-stack:
  added: []
  patterns:
    - "Parallel review agent dispatch with distinct output files per agent"
    - "Gate pattern with refine/re-run/proceed options and iteration cap"
    - "One-by-one AskUserQuestion resolution with inline PRD writes"
    - "PHASE_FILES upstream dependency chain for template variable substitution"

key-files:
  created: []
  modified:
    - "templates/deepen.md"
    - "templates/resolve.md"
    - "SKILL.md"

key-decisions:
  - "Refine spawns a general-purpose revision Task (no dedicated agent definition needed)"
  - "Re-run always re-runs ALL 4 agents fresh (no selective re-runs)"
  - "Iteration cap at 3 with forced proceed on cap"
  - "Vague answer detection re-asks once then accepts (including DECISION_PENDING format)"
  - "Re-scan validation loop capped at 3 passes"

patterns-established:
  - "Gate pattern: present findings summary, offer branching options, enforce iteration cap"
  - "Resolution pattern: scan + present one-by-one + write inline + re-scan validation"

requirements-completed: [DEEP-01, DEEP-02, RSLV-01, RSLV-02, RSLV-03]

duration: 4min
completed: 2026-02-25
---

# Phase 3 Plan 2: Deepen + Resolve Templates + PHASE_FILES Summary

**Deepen template with 4 parallel review agents (security, architecture, simplicity, performance) and refine/re-run/proceed gate; Resolve template with TBD scanning, one-by-one AskUserQuestion, and inline PRD resolution; SKILL.md PHASE_FILES mapping for all 9 phases**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-25T20:52:12Z
- **Completed:** 2026-02-25T20:56:49Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Deepen template spawns 4 parallel review agents with P1/P2/P3 categorization and presents refine/re-run/proceed gate with 3-iteration cap
- Resolve template scans PRD + open-questions for unresolved markers, presents each one-by-one via AskUserQuestion with concrete options, writes answers inline immediately
- SKILL.md now has complete PHASE_FILES mapping table with upstream dependencies for all 9 pipeline phases

## Task Commits

Each task was committed atomically:

1. **Task 1: Write deepen.md template** - `864367d` (feat)
2. **Task 2: Write resolve.md template** - `68400f9` (feat)
3. **Task 3: Update SKILL.md PHASE_FILES** - `e86fa47` (feat)

## Files Created/Modified
- `templates/deepen.md` - Deepen phase subagent prompt: 4 parallel review agents, findings collection, refine/re-run/proceed gate
- `templates/resolve.md` - Resolve phase subagent prompt: TBD scanning, AskUserQuestion one-by-one, inline resolution, re-scan validation
- `SKILL.md` - Added PHASE_FILES per-phase mapping table and updated Architecture note

## Decisions Made
- Refine spawns a general-purpose revision Task (no dedicated agent definition file needed) -- keeps template self-contained
- Re-run always dispatches all 4 agents fresh (PRD may have changed, all perspectives need fresh review)
- Iteration cap at 3 iterations with forced proceed -- prevents infinite refine/re-run loops
- Vague answer detection re-asks once, then accepts including DECISION_PENDING format -- balances thoroughness with user control
- Re-scan validation loop capped at 3 passes -- catches stragglers without infinite loops

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 4 core pipeline templates (research, PRD stub, deepen, resolve) now have working content
- PRD template (prd.md) remains a stub pending Phase 4 plan or a separate Phase 3 plan
- Phase 4 (Execution Layer) can proceed -- convert, execute, and review templates need similar treatment
- PHASE_FILES mapping is complete for all 9 phases -- no further orchestrator dispatch changes needed

---
*Phase: 03-phase-content*
*Completed: 2026-02-25*
