# Phase 1: Foundation - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

ralph-tools.cjs CLI, .planning/ schema, pre-flight checks, SKILL.md installability, and GSD reference setup. Everything subsequent phases depend on — the CLI that mutates state, the schema that persists it, and the pre-flight that validates the environment.

</domain>

<decisions>
## Implementation Decisions

### CLI command surface
- Mirror gsd-tools.cjs command pattern: init, state, commit, config-get, config-set, phase-complete, plus ralph-specific commands
- Compound init: single `init` call returns all project state (current phase, config, completion flags, file paths) in one JSON response
- JSON-only output for all commands — no human-readable mode, callers parse JSON
- JSON error objects with error codes: `{ error: true, message: '...', code: 'PHASE_NOT_FOUND' }` plus non-zero exit code

### State & config schema
- STATE.md tracks phases by integer number (names resolved via lookup)
- YAML frontmatter + markdown body format (STATE-05) — machine-parseable frontmatter, human-readable body
- Stage completion tracking: follow GSD's proven approach (Claude's discretion on boolean vs enum)
- config.json scoped to pipeline config only: mode (normal/yolo), depth (quick/standard/comprehensive), model_profile, time_budget, auto_advance
- Bead format and other per-run choices NOT stored in config — chosen at runtime gates

### Pre-flight experience
- Interactive installer: when dependencies are missing, offer to install them (not just report)
- IDE detection: ask user on first run, store choice in config.json (no auto-detection)
- Check ALL dependencies upfront at pipeline start (ralph-tui, bd/br CLIs, required skills, MCP servers) — fail early, fix everything at once
- Verify skill availability by checking .md files on disk in known paths (~/.claude/skills/ or project .claude/skills/)

### Reference repo setup
- Pre-flight checks if .reference/get-shit-done/ exists; if missing, clone from public GitHub repo
- Pin to specific GSD release tag (e.g., v2.1.0) for reproducible builds — update pin with ralph-pipeline releases
- Add .reference/ to .gitignore automatically
- Blocking error if clone fails — pipeline won't start without the reference

### Claude's Discretion
- Stage completion granularity (boolean vs multi-status enum) — follow what GSD does
- Exact command naming and argument patterns
- Internal file organization within ralph-tools.cjs
- Error code taxonomy

</decisions>

<specifics>
## Specific Ideas

- "Mirror gsd-tools.cjs" — user explicitly wants the proven GSD CLI pattern, not a novel design
- "Stick to what is proven by GSD" for state tracking — strong preference for battle-tested patterns over invention
- Interactive installer for dependencies — user wants a guided setup experience, not just error messages

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-25*
