# Phase 4: Execution Layer - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

The full conversion-to-review loop: converting PRD to beads (bd Go / br Rust / prd.json), executing beads headlessly via `claude -p`, enforcing quality gates, and running compound review with fix/re-run/PR options. Manual ralph-tui execution as an alternative to headless mode.

</domain>

<decisions>
## Implementation Decisions

### Conversion gate
- Always present bead format choice via AskUserQuestion (bd Go / br Rust / prd.json) — no config default
- If conversion produces zero beads: block with error, offer retry / edit PRD / abort — never proceed with empty .beads/
- Validate bead structure beyond existence: each .beads/*.md must have valid frontmatter and acceptance criteria — reject malformed beads
- Frontend stories auto-inject /frontend-design skill instruction — detect by tag/content, no user confirmation needed

### Execution behavior
- Execution gate always asks: headless (claude -p) or manual (ralph-tui) — manual is the default option
- Stop batch immediately on bead failure — surface error clearly, do not continue with remaining beads
- Show bead-level progress: which bead is running (e.g., "Executing bead 3/8: US-002-backend"), update on completion with pass/fail
- No per-bead timeout — trust claude -p to complete or fail on its own

### Quality gates
- Pipeline trusts the bead agent's self-reported result — beads have their own internal quality gates enforced by the executing agent
- No external quality check by the pipeline after each bead — the bead's exit determines pass/fail/blocked
- Result files are status-only: `status: passed|failed|blocked` written to `.claude/pipeline/bead-results/${BEAD_NAME}.md` — no summary or details

### Review gate
- Post-execution review spawns four parallel agents (security, architecture, performance, simplicity) categorizing findings as P1/P2/P3
- "Fix P1s" / "Fix P1+P2" presents findings as a checklist for the user to apply manually — no auto-fix agent
- After user signals fixes done, ask whether to re-run review or proceed as-is
- "Create PR" creates a draft PR — user promotes to ready after final check
- Add "re-run bead X" option for targeted re-execution of a specific problematic bead

### Claude's Discretion
- P1/P2/P3 threshold definitions for review categorization
- Result file directory structure within .claude/pipeline/
- How bead-level progress is displayed (format of status updates)
- Error message formatting when a bead fails

</decisions>

<specifics>
## Specific Ideas

- Execution result file schema matches existing pattern in `.claude/pipeline/bead-results/` (status: passed|failed|blocked at top)
- GSD reference `.reference/get-shit-done/workflows/execute-phase.md` defines headless execution patterns to follow
- CONCERNS.md already identified the aggregation problem (counting passed/failed/blocked after batch) — implement the fix approach from there

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-execution-layer*
*Context gathered: 2026-02-25*
