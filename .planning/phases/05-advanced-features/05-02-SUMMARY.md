---
phase: 05-advanced-features
plan: 02
subsystem: orchestrator
tags: [yolo, gate-bypass, auto-approve, pipeline-automation]

requires:
  - phase: 04-execution-layer
    provides: "Complete template suite with user gates and quality gate injection"
provides:
  - "YOLO mode flag detection in SKILL.md (--yolo, --auto)"
  - "Orchestrator gate bypass when mode is yolo (Step 6)"
  - "Template-level YOLO bypass for deepen, resolve, convert, execute, review"
affects: [05-advanced-features]

tech-stack:
  added: []
  patterns: ["YOLO mode bypass pattern: read config-get mode, branch on yolo vs normal"]

key-files:
  created: []
  modified:
    - SKILL.md
    - templates/preflight.md
    - templates/clarify.md
    - templates/research.md
    - templates/prd.md
    - templates/deepen.md
    - templates/resolve.md
    - templates/convert.md
    - templates/execute.md
    - templates/review.md

key-decisions:
  - "YOLO bypass at orchestrator level (Step 6) handles preflight/clarify/research/prd gates"
  - "Template-internal YOLO bypass for deepen/resolve/convert/execute/review (phase-specific behavior)"
  - "Execute YOLO defaults to manual mode per locked decision"
  - "Execute YOLO skips failed beads and continues instead of stopping batch"
  - "Resolve YOLO auto-answers with [YOLO-RESOLVED] prefix tag"
  - "Convert YOLO requires bead_format pre-set in config, fails if missing"
  - "Review YOLO auto-selects skip (accept all findings)"

patterns-established:
  - "YOLO bypass pattern: config-get mode --raw check before every user gate"
  - "Two-tier gate bypass: orchestrator (Step 6) for standard gates, template-internal for custom gates"

requirements-completed: [ORCH-06]

duration: 2min
completed: 2026-02-26
---

# Phase 05 Plan 02: YOLO Mode Summary

**YOLO mode gate bypass across SKILL.md orchestrator and all 9 pipeline templates, enabling fully unattended pipeline runs**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-26T08:53:50Z
- **Completed:** 2026-02-26T08:56:10Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- SKILL.md Step 2 detects --yolo and --auto flags, persists mode/auto_advance to config.json
- SKILL.md Step 6 bypasses user gate when mode is yolo, auto-approving phases
- All 9 templates have YOLO mode handling with template-specific defaults per locked decisions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add YOLO flag detection and gate bypass to SKILL.md** - `1d9b22b` (feat)
2. **Task 2: Add YOLO bypass to all 9 pipeline templates** - `4d89b69` (feat)

## Files Created/Modified
- `SKILL.md` - Added --yolo/--auto flag detection (Step 2) and YOLO gate bypass (Step 6)
- `templates/preflight.md` - YOLO comment (orchestrator handles gate)
- `templates/clarify.md` - YOLO comment (orchestrator handles gate)
- `templates/research.md` - YOLO comment (orchestrator handles gate)
- `templates/prd.md` - YOLO comment (orchestrator handles gate)
- `templates/deepen.md` - YOLO auto-selects proceed, skips review gate
- `templates/resolve.md` - YOLO auto-answers with [YOLO-RESOLVED] tags, skips vague detection
- `templates/convert.md` - YOLO reads bead_format from config, fails if not set
- `templates/execute.md` - YOLO defaults to manual, skips failed beads and continues
- `templates/review.md` - YOLO auto-selects skip, accepts all findings

## Decisions Made
- Two-tier bypass: orchestrator handles 4 simple gates (preflight/clarify/research/prd), templates handle 5 complex gates with custom YOLO behavior
- Execute YOLO mode defaults to manual (locked decision -- user wants to be present for execution)
- Execute YOLO continues past failed beads instead of stopping batch (review phase flags gaps)
- Resolve YOLO tags answers with [YOLO-RESOLVED] prefix for traceability
- Convert YOLO fails hard if bead_format not pre-configured (no guessing)
- Review YOLO auto-skips all findings (accept as-is)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- YOLO mode fully wired across orchestrator and all templates
- Ready for 05-03 (auto-advance chaining) which builds on auto_advance flag detected here

---
*Phase: 05-advanced-features*
*Completed: 2026-02-26*

## Self-Check: PASSED
