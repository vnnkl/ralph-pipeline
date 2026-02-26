# Phase 9: Integration Polish - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix SKILL.md {phase_name} variable ambiguity and add YOLO convert bead_format fallback. Eliminates two low-severity integration gaps (INT-03, INT-04) and the "User gate excerpt" flow issue from v1.0 audit.

</domain>

<decisions>
## Implementation Decisions

### YOLO bead_format fallback
- Prompt user once during init/preflight if bead_format is null in config and YOLO mode is active
- Show all three options: bd (Go beads), br (Rust beads), prd.json
- Save chosen format to .planning/config.json via config-set
- Per-project persistence: each project stores its own bead_format in .planning/config.json
- After set once, never re-ask for that project — user changes manually via `config-set` if needed
- Convert template no longer fails hard on null bead_format — init already handled it

### Variable naming clarity
- Rename `{phase_name}` to `{pipeline_phase}` in SKILL.md (pipeline slug: research, convert, etc.)
- Rename PIPELINE_PHASES object key from `name` to `slug` in lib/orchestrator.cjs
- Add `displayName` field to PIPELINE_PHASES (e.g. slug:'research', displayName:'Research')
- Update fillTemplate() to use `{pipeline_phase}` and `{pipeline_display_name}` instead of `{phase_name}`/`{Name}`
- All templates updated to use new variable names

### User gate excerpt behavior
- Missing output file: show "No output available" message, gate still functions (approve/retry/abort)
- Default excerpt size: 15-20 lines (increased from current 10)
- Skip path writes frontmatter only (completed: true), no body content
- Excerpt strips frontmatter before displaying — only content lines shown in gate prompt

### Claude's Discretion
- Exact wording of "No output available" message
- Whether to show 15 or 20 lines (pick best fit)
- Test structure and coverage approach
- Migration of existing references in template files

</decisions>

<specifics>
## Specific Ideas

- bead_format prompt during init means YOLO mode never gets interrupted mid-pipeline
- displayName in PIPELINE_PHASES gives clean user-facing labels without capitalize-the-slug hacks
- Per-project bead_format means polyglot users can have Go beads in one project and Rust in another

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-integration-polish*
*Context gathered: 2026-02-26*
