---
phase: 01-foundation
plan: 03
subsystem: cli
tags: [node-cjs, preflight, dependency-check, mcp-servers, gitignore]

requires:
  - phase: 01-01
    provides: "lib/core.cjs: output(), error(), safeReadFile(), loadConfig(), saveConfig()"
provides:
  - "lib/preflight.cjs: cmdPreflight() -- checks skills, MCP servers, CLIs, GSD reference, .planning/, IDE"
  - "ralph-tools.cjs: preflight, setup-reference, setup-gitignore commands"
  - ".gitignore with .reference/ pattern"
affects: [01-04, phase-2]

tech-stack:
  added: [Node.js builtins only (fs, path, os, child_process)]
  patterns: [diagnostic-only-preflight, version-pinning, idempotent-gitignore]

key-files:
  created: [lib/preflight.cjs, .gitignore]
  modified: [ralph-tools.cjs]

key-decisions:
  - "Preflight is diagnostic only -- reports missing deps but does not install them"
  - "setup-reference pins EXPECTED_GSD_VERSION constant and reports version_matched boolean"
  - "Preflight writes error JSON to stderr + result JSON to stdout on failure, exit 1 for required missing"
  - "MCP server check reads both ~/.claude.json and ~/.claude/settings.json for mcpServers config"
  - "Skills checked in two paths: ~/.claude/skills/ then {cwd}/.claude/skills/"

patterns-established:
  - "Preflight collect-all pattern: never exit early, collect all missing deps then report"
  - "Install hints: every missing item includes actionable install_hint string"
  - "Setup commands: orchestrator calls preflight (diagnostic) then setup-* commands (action)"
  - "Version pinning: EXPECTED_GSD_VERSION constant in router, version_matched in output"

requirements-completed: [ORCH-02, ORCH-08]

duration: 4min
completed: 2026-02-25
---

# Phase 1 Plan 03: Pre-flight Dependency Checker Summary

**Environment validator checking skills, MCP servers, CLIs, GSD reference, .planning/ structure, and IDE preference with actionable install hints**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-25T15:58:07Z
- **Completed:** 2026-02-25T16:02:03Z
- **Tasks:** 2
- **Files created:** 2 (lib/preflight.cjs, .gitignore)
- **Files modified:** 1 (ralph-tools.cjs)

## Accomplishments
- Built lib/preflight.cjs with 7 check categories: skills, MCP servers, CLIs, GSD reference, .gitignore, .planning/ dir, IDE preference
- Every missing item includes actionable install_hint for copy-paste remediation
- Wired preflight, setup-reference, and setup-gitignore commands into ralph-tools.cjs router
- setup-reference copies GSD with version pinning (EXPECTED_GSD_VERSION constant)
- setup-gitignore is idempotent (returns added: false on duplicates)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/preflight.cjs -- dependency checks and GSD reference setup** - `4aecb75` (feat)
2. **Task 2: Wire preflight into router and add .reference/ gitignore helper** - `d8693a1` (feat)

## Files Created/Modified
- `lib/preflight.cjs` - Pre-flight checker: skills, MCP servers, CLIs, GSD reference, .gitignore, .planning/, IDE
- `ralph-tools.cjs` - Router updated with preflight, setup-reference, setup-gitignore commands
- `.gitignore` - Created with .reference/ pattern

## Decisions Made
- Preflight is diagnostic only -- reports what is missing but performs no installations or copies. The orchestrator handles interactive setup (Phase 2 scope).
- setup-reference uses EXPECTED_GSD_VERSION constant pinned at v2.1.0. Output includes version_matched boolean so orchestrator can warn on mismatch.
- Preflight failure mode: error JSON to stderr, full result JSON to stdout, exit 1. This ensures callers can always parse the result from stdout regardless of pass/fail.
- MCP server check is config-level only (is the server configured?), not a runtime connectivity check.
- Skills are searched in two locations: ~/.claude/skills/{name}/SKILL.md then {cwd}/.claude/skills/{name}/SKILL.md.

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness
- Preflight ready for orchestrator to call at pipeline start (Phase 2 scope)
- setup-reference and setup-gitignore ready for orchestrator's interactive installation flow
- Router has all Phase 1 commands wired; Plan 02 and 04 commands still stubbed as NOT_IMPLEMENTED

---
*Phase: 01-foundation*
*Completed: 2026-02-25*

## Self-Check: PASSED

All 3 files verified on disk. Both commit hashes (4aecb75, d8693a1) verified in git log.
