# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — ralph-pipeline

**Shipped:** 2026-02-27
**Phases:** 13 | **Plans:** 26
**Timeline:** 19 days (2026-02-08 to 2026-02-27)
**Execution time:** 1.13 hours (avg 3min/plan)

### What Was Built
- Zero-dep ralph-tools.cjs CLI (3,309 LOC) with state mutations, config, commits, compound init
- SKILL.md orchestrator with 9-phase sequencing, /clear context isolation, user gates
- 9 subagent templates: preflight, clarify, research, PRD, deepen, resolve, convert, execute, review
- YOLO mode, auto-advance chain via SessionStart hook, time budget tracking
- Parallel research agents (4) and review agents (4) with compound dispatch

### What Worked
- GSD pattern study first, implement fresh — avoided forking complexity while getting proven patterns
- TDD approach for core CLI — tests caught regressions during 8 gap-closure phases
- Iterative milestone audits (4 rounds) — systematic convergence from gaps to 42/42 satisfied
- Small focused gap-closure phases (1-2 plans each) — fast execution, clear scope
- Parallel subagent dispatch for research and review — significant time savings

### What Was Inefficient
- Initial 5-phase plan was too optimistic — needed 8 more phases for integration gaps
- SKILL.md grew to 800 lines before orchestrator rewrite compressed it to 72 lines
- Some tech debt items (stub templates) shipped in early phases and required cleanup phases
- detectPosition function built but never wired to CLI route — dead code from day 1

### Patterns Established
- Chain skills, don't inline — invoke /ralph-tui-prd and /ralph-tui-create-beads as-is
- Trust file scan over STATE.md on mismatch — file system is ground truth
- Quality gates by delegation — append suffix to bead prompt rather than external check
- Absolute timestamp for budget expiry — survives /clear without recalculation
- YOLO two-tier bypass — orchestrator-level for standard gates, template-internal for custom gates

### Key Lessons
1. Plan for integration gaps — a 5-phase core build needed 8 more phases for wiring and polish
2. Iterative auditing works — 4 audit rounds systematically closed every gap
3. Stub templates are tech debt — write real implementations or mark explicitly as TODO
4. File-based state is powerful — YAML frontmatter + markdown body enables both CLI and human access
5. SessionStart hooks enable auto-advance without process management — elegant /clear isolation

### Cost Observations
- Model mix: mostly sonnet for execution, haiku for parallel subagents
- 26 plans at 3min avg = 1.13 hours total execution
- Gap-closure phases averaged 1-2min per plan — much faster than core phases

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 13 | 26 | GSD-pattern skill build with iterative audit convergence |

### Top Lessons (Verified Across Milestones)

1. Iterative auditing drives systematic convergence — ship core, audit, close gaps, repeat
2. File-based state with YAML frontmatter enables CLI tooling and human readability simultaneously
