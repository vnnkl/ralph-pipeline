# Phase 8: Tech Debt Cleanup - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace two stub templates (preflight.md, clarify.md) with functional implementations and remove dead exports from lib/preflight.cjs. No new capabilities — this closes tech debt from the v1.0 audit.

</domain>

<decisions>
## Implementation Decisions

### Preflight template reporting
- Template invokes `node ralph-tools.cjs preflight --raw` and parses JSON result
- On pass: show summary (skills found, MCP servers found, reference OK), write `completed: true`
- On fail: display each missing item with install hint, offer "Install and retry" / "Retry" / "Abort pipeline" via AskUserQuestion
- If setup_actions exist (gitignore, planning dir, IDE pref): handle them interactively before writing completion
- Match existing template structure (frontmatter completion flag, `## PHASE COMPLETE` return)

### Clarify template scope gathering
- Gather via AskUserQuestion: project name, one-line description, primary stack (language + framework), target platform (web/mobile/CLI/library), quality gates (test coverage threshold, linting)
- Write answers to .planning/pipeline/clarify.md with structured frontmatter
- Keep it to 3-4 questions max — this isn't a full PRD, just enough context for downstream phases
- If .planning/PROJECT.md already has stack/description info, pre-populate and confirm rather than re-asking

### Failure behavior
- Preflight failures hard-block the pipeline (exit code 1, no bypass)
- Required items (skills, MCP servers, GSD reference) are blocking
- Optional items (bd, br CLIs) show as warnings but don't block
- This matches existing cmdPreflight behavior — template just surfaces it properly

### Dead export cleanup
- Remove `REQUIRED_SKILLS`, `REQUIRED_MCP_SERVERS`, `OPTIONAL_CLIS` from preflight.cjs exports (only used internally)
- Keep `cmdPreflight` (used by ralph-tools.cjs) and `CACHE_VERSION` (used by init.cjs)
- Audit all lib/*.cjs files for unused exports while we're at it — same pass, minimal effort

### Claude's Discretion
- Exact AskUserQuestion phrasing and option labels for both templates
- How to format the preflight results display (table vs list)
- Whether to show timing info for preflight checks
- Error message wording

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches that match existing template patterns (research.md, prd.md, etc.)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-tech-debt-cleanup*
*Context gathered: 2026-02-26*
