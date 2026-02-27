# Roadmap: ralph-pipeline

## Milestones

- ✅ **v1.0 ralph-pipeline** — Phases 1-13 (shipped 2026-02-27)
- 🚧 **v1.1 Marathon Mode + Codemaps** — Phases 14-16 (in progress)

## Phases

<details>
<summary>✅ v1.0 ralph-pipeline (Phases 1-13) — SHIPPED 2026-02-27</summary>

- [x] Phase 1: Foundation (5/5 plans) — completed 2026-02-25
- [x] Phase 2: Orchestrator Shell (2/2 plans) — completed 2026-02-25
- [x] Phase 3: Phase Content (2/2 plans) — completed 2026-02-25
- [x] Phase 4: Execution Layer (4/4 plans) — completed 2026-02-25
- [x] Phase 5: Advanced Features (3/3 plans) — completed 2026-02-25
- [x] Phase 6: Time Budget Init Integration (1/1 plan) — completed 2026-02-26
- [x] Phase 7: Preflight Cache + Skip-on-Resume (1/1 plan) — completed 2026-02-26
- [x] Phase 8: Tech Debt Cleanup (2/2 plans) — completed 2026-02-26
- [x] Phase 9: Integration Polish (2/2 plans) — completed 2026-02-26
- [x] Phase 10: Cosmetic Cleanup (1/1 plan) — completed 2026-02-26
- [x] Phase 11: Orchestrator State Sync (1/1 plan) — completed 2026-02-26
- [x] Phase 12: YOLO Time Budget Tracking (1/1 plan) — completed 2026-02-27
- [x] Phase 13: Quality Gate + Doc Polish (1/1 plan) — completed 2026-02-27

</details>

### 🚧 v1.1 Marathon Mode + Codemaps (In Progress)

**Milestone Goal:** Add codemaps as shared context for research/review agents, and marathon mode as plan-all-then-execute alternative to per-phase flow.

- [x] **Phase 14: Codemaps Foundation** - Codemap generation, selective injection per agent role, freshness detection, CLI commands (completed 2026-02-27)
- [ ] **Phase 15: Marathon Mode Orchestration** - Marathon entry point, auto-approved planning chain, bead inventory gate, YOLO compatibility
- [ ] **Phase 16: Integration Testing and Hardening** - End-to-end verification of codemaps + marathon interaction, edge cases, config lifecycle

## Phase Details

### Phase 14: Codemaps Foundation
**Goal**: Pipeline agents receive relevant codebase context -- research agents get stack/architecture, PRD agents get architecture/structure, review agents get post-execution concerns/conventions
**Depends on**: Phase 13 (v1.0 complete)
**Requirements**: CMAP-01, CMAP-02, CMAP-03, CMAP-04, CMAP-05, CMAP-06, CMAP-07, CMAP-08
**Success Criteria** (what must be TRUE):
  1. Running the pipeline generates 7 codemap files in `.planning/codebase/` before the research phase begins
  2. Research agents receive only STACK.md and ARCHITECTURE.md via `{{CODEMAP_FILES}}`; PRD/deepen agents receive only ARCHITECTURE.md and STRUCTURE.md; review agents receive post-execution CONCERNS.md and CONVENTIONS.md
  3. Pipeline detects existing codemaps, compares mtime against staleness threshold, and offers skip/refresh/generate choice
  4. `ralph-tools.cjs codemap check|paths|age` commands return correct status, file lists, and age in hours
  5. Codemap generation works via inlined mapper logic in `templates/codemap.md` without requiring the Skill tool
**Plans**: TBD

Plans:
- [x] 14-01: CLI commands and freshness detection
- [x] 14-02: Codemap generation template
- [ ] 14-03: TBD

### Phase 15: Marathon Mode Orchestration
**Goal**: Users can plan all phases upfront in a single unattended run, review the bead inventory, then execute -- with time budget applying only to execution
**Depends on**: Phase 14
**Requirements**: MARA-01, MARA-02, MARA-03, MARA-04, MARA-05
**Success Criteria** (what must be TRUE):
  1. User can start marathon mode via a dedicated command/flag and the pipeline chains phases 1-7 with auto-approved gates and /clear between each
  2. After the Convert phase produces beads, the pipeline pauses at a review gate showing the bead inventory before execution starts
  3. The `.beads/` directory contains the merged bead queue from all planning phases, ready for single-run execution
  4. Marathon mode combined with YOLO mode auto-approves the bead inventory review gate and proceeds to execution without user intervention
  5. Time budget expiry timestamp is not set until the execute phase begins (planning phases are never budget-constrained)
**Plans**: TBD

Plans:
- [ ] 15-01: TBD
- [ ] 15-02: TBD

### Phase 16: Integration Testing and Hardening
**Goal**: Both features verified working together end-to-end with edge cases handled -- standard mode + codemaps, marathon mode + codemaps, resume after failure, config cleanup
**Depends on**: Phase 15
**Requirements**: (cross-cutting verification of CMAP-01 through CMAP-08, MARA-01 through MARA-05)
**Success Criteria** (what must be TRUE):
  1. Standard mode pipeline run with codemaps produces correct selective injection per agent role (research, PRD, deepen, review each receive only their designated codemap files)
  2. Marathon mode end-to-end run completes: planning phases 1-7 with no user gates, bead inventory review, execution, review with post-execution codemaps
  3. After marathon execution, `.planning/codebase-post-exec/` contains refreshed codemaps and review agents receive the post-exec path (not pre-exec)
  4. After marathon completion or failure, `pipeline_mode` resets to `standard` and codemap state is clean for next invocation
**Plans**: TBD

Plans:
- [ ] 16-01: TBD

## Progress

**Execution Order:** Phases execute in numeric order: 14 -> 15 -> 16

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 5/5 | Complete | 2026-02-25 |
| 2. Orchestrator Shell | v1.0 | 2/2 | Complete | 2026-02-25 |
| 3. Phase Content | v1.0 | 2/2 | Complete | 2026-02-25 |
| 4. Execution Layer | v1.0 | 4/4 | Complete | 2026-02-25 |
| 5. Advanced Features | v1.0 | 3/3 | Complete | 2026-02-25 |
| 6. Time Budget Init | v1.0 | 1/1 | Complete | 2026-02-26 |
| 7. Preflight Cache | v1.0 | 1/1 | Complete | 2026-02-26 |
| 8. Tech Debt Cleanup | v1.0 | 2/2 | Complete | 2026-02-26 |
| 9. Integration Polish | v1.0 | 2/2 | Complete | 2026-02-26 |
| 10. Cosmetic Cleanup | v1.0 | 1/1 | Complete | 2026-02-26 |
| 11. State Sync | v1.0 | 1/1 | Complete | 2026-02-26 |
| 12. YOLO Time Budget | v1.0 | 1/1 | Complete | 2026-02-27 |
| 13. Quality Gate + Doc | v1.0 | 1/1 | Complete | 2026-02-27 |
| 14. Codemaps Foundation | 3/3 | Complete   | 2026-02-27 | - |
| 15. Marathon Orchestration | v1.1 | 0/2 | Not started | - |
| 16. Integration Hardening | v1.1 | 0/1 | Not started | - |
