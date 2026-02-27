# Requirements: ralph-pipeline

**Defined:** 2026-02-27
**Core Value:** Context isolation through /clear between phases combined with ralph-tui's ability to execute large batches of work unattended

## v1.1 Requirements

Requirements for marathon mode + codemaps integration. Each maps to roadmap phases.

### Codemaps

- [x] **CMAP-01**: Pipeline generates codemap before research phase via 4 parallel mapper agents writing to `.planning/codebase/`
- [x] **CMAP-02**: Research agents receive selective codemap files (STACK.md + ARCHITECTURE.md) via `{{CODEMAP_FILES}}`
- [x] **CMAP-03**: PRD and deepen agents receive selective codemap files (ARCHITECTURE.md + STRUCTURE.md)
- [x] **CMAP-04**: Pipeline refreshes codemap after execution, before review phase
- [x] **CMAP-05**: Review agents receive post-execution codemap files (CONCERNS.md + CONVENTIONS.md)
- [x] **CMAP-06**: Pipeline detects existing codemap freshness via mtime and offers skip/refresh/generate
- [x] **CMAP-07**: `lib/codemap.cjs` provides check, paths, age CLI commands
- [x] **CMAP-08**: `templates/codemap.md` inlines mapper agent logic (no Skill tool dependency)

### Marathon

- [ ] **MARA-01**: User can invoke marathon mode via separate command entry point
- [ ] **MARA-02**: Marathon chains phases 1-7 with auto-approved gates and /clear between each
- [ ] **MARA-03**: After Convert phase, marathon presents bead inventory review gate before execution
- [ ] **MARA-04**: Marathon produces one merged bead queue from all planning phases (`.beads/` directory)
- [ ] **MARA-05**: Marathon mode works with YOLO mode (auto-approve review gate)

## v1.2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Execution

- **EXEC-01**: Resume-from-failure at bead level (scan bead-results, skip passed beads)
- **EXEC-02**: Time budget scoping to execution phase only in marathon mode

### Harvest

- **HARV-01**: Extract reusable patterns from completed work (/choo-choo-ralph)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Marathon dry-run mode | v1.1.x — natural extension after core works |
| Dependency-aware bead ordering | v1.1.x — alphabetical sufficient for now |
| Codemap diff for review agents | v2+ — complex diffing, unclear ROI |
| Incremental codemap refresh | v2+ — requires new mapper agent mode |
| Parallel bead execution | Merge conflicts, non-deterministic failures |
| Separate marathon SKILL.md | Duplicated logic diverges — use mode flag |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CMAP-01 | Phase 14 | Complete |
| CMAP-02 | Phase 14 | Complete |
| CMAP-03 | Phase 14 | Complete |
| CMAP-04 | Phase 14 | Complete |
| CMAP-05 | Phase 14 | Complete |
| CMAP-06 | Phase 14 | Complete |
| CMAP-07 | Phase 14 | Complete |
| CMAP-08 | Phase 14 | Complete |
| MARA-01 | Phase 15 | Pending |
| MARA-02 | Phase 15 | Pending |
| MARA-03 | Phase 15 | Pending |
| MARA-04 | Phase 15 | Pending |
| MARA-05 | Phase 15 | Pending |

**Coverage:**
- v1.1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 after roadmap creation*
