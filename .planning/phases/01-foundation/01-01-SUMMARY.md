---
phase: 01-foundation
plan: 01
subsystem: cli
tags: [node-cjs, yaml-frontmatter, config, cli-router]

requires:
  - phase: none
    provides: first plan in project
provides:
  - "lib/core.cjs: output(), error(), safeReadFile(), execGit(), pathExistsInternal(), loadConfig(), saveConfig()"
  - "lib/frontmatter.cjs: extractFrontmatter(), reconstructFrontmatter(), spliceFrontmatter()"
  - "lib/config.cjs: cmdConfigGet(), cmdConfigSet() with dot-notation and type coercion"
  - "ralph-tools.cjs: main CLI router with switch/case command dispatch"
affects: [01-02, 01-03, 01-04, phase-2]

tech-stack:
  added: [Node.js builtins only (fs, path, child_process, os)]
  patterns: [router-plus-lib-modules, json-only-output, error-codes-to-stderr]

key-files:
  created: [ralph-tools.cjs, lib/core.cjs, lib/frontmatter.cjs, lib/config.cjs]
  modified: []

key-decisions:
  - "Error objects include { error: true, message, code } per CONTEXT.md -- extends GSD pattern"
  - "loadConfig defaults match ralph-pipeline domain: mode, depth, model_profile, commit_docs, auto_advance, time_budget, ide"
  - "Frontmatter parser coerces types (bool, number, null) during extraction"
  - "reconstructFrontmatter takes (frontmatter, body) as two args -- cleaner API than GSD single-arg"

patterns-established:
  - "Router pattern: ralph-tools.cjs delegates to lib/*.cjs via require/switch"
  - "Output pattern: JSON stdout (exit 0) / JSON stderr with error code (exit 1)"
  - "Config pattern: dot-notation get/set with type coercion through loadConfig/saveConfig"
  - "Immutable splice: spliceFrontmatter uses spread to merge updates without mutation"

requirements-completed: [STATE-01, STATE-05, STATE-08]

duration: 3min
completed: true
completed_date: 2026-02-25
---

# Phase 1 Plan 01: Core Infrastructure Summary

**CLI router shell with JSON output/error, YAML frontmatter parser, and config CRUD using zero npm dependencies**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T15:52:04Z
- **Completed:** 2026-02-25T15:55:03Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- Built lib/core.cjs with output/error helpers, git utilities, config load/save, and path checking
- Built lib/frontmatter.cjs with hand-rolled YAML subset parser supporting strings, numbers, booleans, null, inline/block arrays, and nested objects
- Built lib/config.cjs with dot-notation get/set and automatic type coercion
- Built ralph-tools.cjs as executable CLI router with --cwd and --raw flags, command dispatch, and placeholder commands for future plans

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/core.cjs and lib/frontmatter.cjs** - `db0733a` (feat)
2. **Task 2: Create lib/config.cjs and ralph-tools.cjs router** - `97efe0f` (feat)

## Files Created/Modified
- `ralph-tools.cjs` - Main CLI router with switch/case command dispatch
- `lib/core.cjs` - Shared helpers: output, error, safeReadFile, execGit, pathExistsInternal, loadConfig, saveConfig
- `lib/frontmatter.cjs` - YAML frontmatter extract/reconstruct/splice
- `lib/config.cjs` - Config CRUD: cmdConfigGet (dot-notation + full dump), cmdConfigSet (type coercion)

## Decisions Made
- Error function writes structured JSON `{ error: true, message, code }` to stderr (extends GSD's simple string error pattern per CONTEXT.md decision on error codes)
- loadConfig defaults scoped to ralph-pipeline domain: mode, depth, model_profile, commit_docs, auto_advance, time_budget, ide
- reconstructFrontmatter takes two arguments (frontmatter, body) rather than GSD's single-arg pattern for cleaner separation
- Frontmatter parser coerces values during extraction (not just during config-set)

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness
- lib/core.cjs ready for import by all subsequent lib modules (state, phase, commands, init, preflight)
- lib/frontmatter.cjs ready for state.cjs frontmatter sync operations
- ralph-tools.cjs router ready to wire new commands as they are built in plans 02-04

---
*Phase: 01-foundation*
*Completed: 2026-02-25*

## Self-Check: PASSED

All 4 files verified on disk. Both commit hashes (db0733a, 97efe0f) verified in git log.
