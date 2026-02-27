# Phase 14: Codemaps Foundation - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate 7 codebase context files in `.planning/codebase/` and selectively inject them into pipeline agents by role. Includes freshness detection, post-execution refresh, and CLI commands for codemap management. Marathon mode and integration testing are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Codemap file inventory
- 7 files total: STACK.md, ARCHITECTURE.md, STRUCTURE.md, CONCERNS.md, CONVENTIONS.md, DEPENDENCIES.md, API.md
- Each file is a concise summary (~200-400 lines) — signal without noise
- 4 parallel mapper agents generate all 7 files (agent-to-file split is Claude's discretion)

### Agent-to-codemap injection mapping
- Claude determines optimal mapping per agent role based on what each agent needs
- Requirements specify: research gets STACK + ARCHITECTURE, PRD/deepen get ARCHITECTURE + STRUCTURE, review gets CONCERNS + CONVENTIONS
- Claude may adjust or extend these mappings (e.g., adding DEPENDENCIES to research, API to PRD) based on agent needs
- Role-based filtering happens in templates/orchestrator, not in CLI

### Freshness behavior
- Staleness threshold: 4 hours
- Fresh codemaps (< 4h): auto-skip silently, no prompt, no log
- Stale codemaps (> 4h): auto-regenerate silently, no prompt, no log
- Missing codemaps: generate silently, no special first-run messaging
- No user prompts for freshness decisions — fully automatic

### Post-execution refresh
- Overwrites originals in `.planning/codebase/` (no separate post-exec directory)
- Full regeneration of all 7 files (not selective)
- Always bypasses freshness check — execution definitionally makes codemaps stale
- Uses same 4 parallel mapper agents as initial generation

### CLI output design
- JSON only — matches existing ralph-tools.cjs pattern
- `codemap check`: minimal `{exists, fresh}` — two booleans for branching
- `codemap paths`: returns all 7 absolute file paths
- `codemap age`: returns age information in hours

### Claude's Discretion
- How 4 mapper agents split responsibility for 7 files
- Exact codemap-to-agent-role mapping (extending beyond minimum requirements)
- Internal structure and headings within each codemap file
- Error handling for partial generation failures

</decisions>

<specifics>
## Specific Ideas

- Success criteria mentions "7 codemap files" — update to match the decided inventory (STACK, ARCHITECTURE, STRUCTURE, CONCERNS, CONVENTIONS, DEPENDENCIES, API)
- Freshness is entirely automatic — the CMAP-06 requirement's "offers skip/refresh/generate choice" should be interpreted as the pipeline making this choice internally, not prompting the user

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-codemaps-foundation*
*Context gathered: 2026-02-27*
