---
phase: quick-2
plan: 01
subsystem: phase-lifecycle
tags: [bugfix, roadmap-fallback, phase-complete]
dependency_graph:
  requires: [lib/core.cjs, lib/state.cjs]
  provides: [findPhaseFromRoadmap, findNextPhaseFromRoadmap]
  affects: [cmdPhaseComplete]
tech_stack:
  patterns: [fallback-chain, regex-parsing]
key_files:
  modified: [lib/phase.cjs]
  created: [tests/phase.test.cjs]
decisions:
  - "Export findNextPhaseFromRoadmap in addition to findPhaseFromRoadmap for testability"
  - "Name extraction trims after dash separator to get clean phase names"
metrics:
  duration: 112s
  completed: "2026-02-27"
  tasks: 2
  tests_added: 12
---

# Quick Task 2: Fix phase-complete PHASE_NOT_FOUND -- Add ROADMAP.md Fallback

ROADMAP.md parsing fallback for cmdPhaseComplete so projects without .planning/phases/ directories can complete phases using ROADMAP content alone.

## What Changed

### lib/phase.cjs (+69 lines)

- **findPhaseFromRoadmap(cwd, phaseNumber)**: Reads ROADMAP.md, matches phase line via regex supporting bold and plain formats. Returns { number, name, directory: null, path: null } or null.
- **findNextPhaseFromRoadmap(roadmapContent, currentPhaseNum)**: Scans all phase lines, sorts by number, returns first phase after current.
- **cmdPhaseComplete**: Falls back to findPhaseFromRoadmap when findPhaseInternal returns null. Falls back to findNextPhaseFromRoadmap when phases dir scan finds no next phase.
- **Checkbox regex**: Updated to handle both bold and plain ROADMAP formats.

### tests/phase.test.cjs (new, 266 lines)

12 tests total:
- 5 unit tests for findPhaseFromRoadmap (bold, plain, missing phase, missing file, null fields)
- 5 unit tests for findNextPhaseFromRoadmap (next phase, last phase, null content, plain format)
- 2 integration tests for cmdPhaseComplete (ROADMAP-only project, last-phase boundary)

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- node tests/phase.test.cjs: 12 passed, 0 failed
- node tests/state.test.cjs: 14 passed, 0 failed (no regressions)
- Exports verified: cmdPhaseComplete, findNextPhaseFromRoadmap, findPhaseFromRoadmap, findPhaseInternal

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 83c5135 | feat(quick-2): add ROADMAP.md fallback for phase-complete |
| 2 | 294bc00 | test(quick-2): add unit and integration tests for ROADMAP fallback |
