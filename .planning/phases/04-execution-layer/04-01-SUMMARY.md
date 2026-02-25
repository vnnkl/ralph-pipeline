---
phase: 04-execution-layer
plan: 01
subsystem: pipeline
tags: [convert, beads, skill-chaining, frontend-detection, AskUserQuestion]

requires:
  - phase: 03-phase-content
    provides: "PRD, deepen, resolve templates (upstream pipeline phases)"
provides:
  - "Production convert.md template for PRD-to-bead conversion"
affects: [04-02 execute template, 04-03 review template]

tech-stack:
  added: []
  patterns: [Skill tool chaining for bead creation, AskUserQuestion gate for format choice, frontend story auto-detection, bead validation with per-file error reporting]

key-files:
  created: []
  modified: [templates/convert.md]

key-decisions:
  - "Always ask bead format via AskUserQuestion -- no config default (locked decision)"
  - "UI keyword matching uses word boundary to prevent false positives (e.g. 'require' contains 'ui')"
  - "One retry allowed on zero-bead error before requiring manual intervention"

patterns-established:
  - "Bead format gate: 3-option AskUserQuestion (bd/br/prd.json) with skill mapping"
  - "Frontend story detection: keyword scan of PRD user stories with /frontend-design injection into matching beads"
  - "Bead validation: frontmatter + acceptance criteria check per file, fail-fast on invalid beads"

requirements-completed: [CONV-01, CONV-02, CONV-03, CONV-04]

duration: 4min
completed: 2026-02-25
---

# Phase 4 Plan 01: Convert Template Summary

**Production convert.md template with AskUserQuestion bead format gate, Skill tool chaining for 3 bead types, frontend story auto-detection with /frontend-design injection, and depth-aware granularity**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-25T22:02:37Z
- **Completed:** 2026-02-25T22:07:36Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced stub convert.md with production template (210 lines added)
- AskUserQuestion gate presents 3 bead format choices (bd Go / br Rust / prd.json)
- Skill tool invocation chains to /ralph-tui-create-beads, /ralph-tui-create-beads-rust, or /ralph-tui-create-json
- Frontend story auto-detection scans PRD for UI keywords and injects /frontend-design skill instruction
- Zero-bead error handling with retry/edit PRD/abort gate
- Per-bead validation ensures frontmatter and acceptance criteria exist
- Depth setting from config.json passed to skill for granularity control
- Completion file includes format, bead_count, frontend_beads, depth metadata

## Task Commits

Each task was committed atomically:

1. **Task 1: Write production convert.md template** - `ffe8c24` (feat)
2. **Task 2: Verify convert template structure** - no changes needed (verification-only, all checks passed)

## Files Created/Modified
- `templates/convert.md` - Production convert phase template replacing stub; orchestrates PRD-to-bead conversion

## Decisions Made
- Always ask bead format via AskUserQuestion -- no config default (per locked CONTEXT.md decision)
- Added Step 3.5 for "UI" keyword false positive handling (word boundary matching prevents matching "require", "build", "suite")
- One retry allowed on zero-bead error gate before requiring manual intervention (edit PRD or abort)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added UI keyword false positive prevention**
- **Found during:** Task 1 (Write production convert.md template)
- **Issue:** The keyword "UI" appears inside common English words like "require", "build", "suite" -- naive substring matching would produce false positives in frontend story detection
- **Fix:** Added Step 3.5 instructing the template agent to use word boundary matching for the "UI" keyword
- **Files modified:** templates/convert.md
- **Verification:** Step 3.5 present in template with clear word boundary instructions
- **Committed in:** ffe8c24 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Minor addition to prevent incorrect frontend story classification. No scope creep.

## Issues Encountered
- Task 2 verification grep -c counting lines rather than unique variable matches caused the plan's automated check to report 5 instead of 6 (PHASE_NAME and PHASE_ID share one line). Verified all 6 unique variables present via individual grep checks.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- convert.md template is ready for dispatch by SKILL.md orchestrator
- Template follows established patterns from prd.md, deepen.md, resolve.md
- Execute template (04-02) and review template (04-03) are next

## Self-Check: PASSED

- templates/convert.md: FOUND
- Commit ffe8c24: FOUND
- Stub references: 0 (clean)
- All 9 key patterns verified present (AskUserQuestion, 3 skills, frontend-design, config-get depth, completed: false, PHASE COMPLETE, PHASE FAILED)

---
*Phase: 04-execution-layer*
*Completed: 2026-02-25*
