# Phase 13: Quality Gate + Doc Polish - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the review re-run path to append QUALITY_GATE_SUFFIX to bead prompts, declare clarify.md in PHASE_FILES for all templates that read it, and add time-budget subcommands to SKILL.md CLI reference table. Closes the last flow gap and remaining doc-level tech debt.

</domain>

<decisions>
## Implementation Decisions

### Re-run suffix behavior
- Re-running a bead from review gate appends QUALITY_GATE_SUFFIX **plus** bead-specific review findings
- Standard quality gates (run tests, run type checker) always included — same as execute.md
- Review findings filtered to only P1/P2 items relevant to the specific bead being re-run (match by files modified)
- Findings appended inline in the suffix text so the bead agent sees exact issues to fix

### PHASE_FILES scope
- Fix the specific audit flag — add clarify.md to PHASE_FILES for all templates that read it inline
- Add to deepen (phase 5) and resolve (phase 6) in addition to wherever else the audit flagged
- Update both orchestrator code (lib/orchestrator.cjs) AND SKILL.md PHASE_FILES table to stay in sync
- No full audit of all 9 phases — just fix what's flagged

### CLI table detail
- Full flag/argument reference for each time-budget subcommand (not one-liners)
- Each entry includes signature + usage example (e.g., `node ralph-tools.cjs time-budget start 4`)
- Include YOLO mode documentation alongside standard subcommands (start, check, estimate)
- All time-budget functionality documented in one place in SKILL.md

</decisions>

<specifics>
## Specific Ideas

- The augmented suffix should include the standard QUALITY_GATE_SUFFIX from execute.md as the base, then append a "REVIEW FINDINGS" section with the filtered P1/P2 items
- PHASE_FILES table in SKILL.md is the source of truth — orchestrator code must match it

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-quality-gate-doc-polish*
*Context gathered: 2026-02-27*
