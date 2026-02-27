# Feature Research

**Domain:** Marathon mode + codemaps integration for AI coding pipeline orchestrator
**Researched:** 2026-02-27
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist when a pipeline offers "marathon mode" or "codemap integration." Missing these = product feels broken or half-baked.

#### Marathon Mode Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Upfront planning for all phases | Core value prop of marathon mode -- plan-then-execute is the defining pattern. Every plan-and-execute system (SPARC, Traycer, Cursor Plan Mode) separates thinking from doing. Users expect to see and approve the full plan before execution begins. | MEDIUM | Reuse existing templates for phases 1-7 but run them sequentially without /clear between them. Planning = phases 1-7; execution = phase 8; review = phase 9. Existing SKILL.md Step 7b handles /clear -- marathon skips it for planning phases. |
| Single merged bead queue | Users expect one flat ordered list of all beads to execute, not per-phase batches. The phase 7 (convert) output already produces `.beads/*.md`. Marathon treats this as one execution run. No structural change to bead format needed. | LOW | Already produced by convert phase. Marathon just frames it as "the queue." No new data structures. |
| Time budget applies to execution only | Users budget hours for actual coding work, not planning overhead. Planning is "free" context overhead. Addy Osmani calls this "waterfall in 15 minutes" -- the spec phase is fast, execution is expensive. | LOW | Existing `time-budget start` command just needs to be called after planning completes (before phase 8) instead of at pipeline start. Move time-budget prompt from SKILL.md Step 1b to after phase 7 gate. |
| Progress reporting during execution | Users expect bead-by-bead progress: "Executing 7/23: setup-database -> PASSED". Standard for any batch tool (AWS CodePipeline, Azure Pipelines, CI/CD). | LOW | Already implemented in execute.md template Step 4. No changes needed. |
| Stop-on-failure with resume | When a bead fails, stop. When re-invoked, resume from the failed bead, not restart from scratch. Standard CI/CD expectation. SnapLogic calls these "resumable pipelines." | MEDIUM | Current execute template stops on failure but restarts from scratch on retry. Marathon needs resume-from-failure: read existing result files in `.claude/pipeline/bead-results/`, skip beads with `status: passed`. Dep: existing result file format supports this. |
| Planning output review gate | After all planning phases complete, show the full bead inventory for approval before execution starts. "Let me see everything before you touch code." Traycer's YOLO mode has plan review; SPARC has phase-transition gates. | LOW | Natural gate between phase 7 (convert) and phase 8 (execute). Reuse existing gate mechanism from SKILL.md Step 6. Show bead count, estimated time, bead list. |
| YOLO compatibility | Marathon mode should work with YOLO mode (auto-approve all gates, auto-advance). Power users want marathon + YOLO for overnight runs. | LOW | Existing YOLO gate bypass in SKILL.md Step 6 applies to marathon's planning review gate too. No new logic needed. |

#### Codemaps Integration Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Run codemap before research phase | Users expect the pipeline to understand their codebase before doing research or writing a PRD. Windsurf Codemaps, codemap CLI, and GSD map-codebase all position themselves as "run first, then plan." Martin Fowler's context engineering article emphasizes pre-loading codebase context. | MEDIUM | GSD's map-codebase produces 7 files in `.planning/codebase/` via 4 parallel mapper agents. Need to invoke it (or equivalent) before phase 3. Two approaches: (a) invoke /gsd:map-codebase skill, or (b) build equivalent mapper agents into ralph-pipeline. Option (a) is simpler but adds external skill dependency. |
| Codemap output as shared context for research agents | Research agents (repo-research, best-practices, framework-docs) should receive codemap files. The repo-research agent especially benefits from ARCHITECTURE.md and STRUCTURE.md -- it already explores the repo, but codemap gives it a head start. | LOW | Add `.planning/codebase/ARCHITECTURE.md` and `.planning/codebase/STACK.md` to PHASE_FILES for phase 3 (research). Template already uses `{{PHASE_FILES}}` -- just expand the file list. |
| Codemap output as shared context for PRD agent | PRD creation should know the existing codebase architecture so it generates stories that fit the actual structure, not a hypothetical one. | LOW | Add `.planning/codebase/ARCHITECTURE.md` and `.planning/codebase/STACK.md` to PHASE_FILES for phase 4 (PRD). |
| Refresh codemap after execution for review | After beads execute and change code, review agents should see the updated codebase state. Stale codemaps would give review agents wrong architectural context. The "Codified Context" paper emphasizes keeping context infrastructure current. | MEDIUM | Re-run codemap generation between phase 8 (execute) and phase 9 (review). This means the review phase PHASE_FILES gets updated codemap paths. |
| Codemap freshness awareness | Users should know when the codemap was generated and whether it is stale. Codemap CLI uses deterministic hashes for cache reuse; GSD's map-codebase checks `has_maps` and `codebase_dir_exists`. | LOW | Check `.planning/codebase/` existence and file timestamps during pipeline init. Log "Codemap: found (generated X hours ago)" or "Codemap: not found, will generate." |
| Selective codemap documents per phase | Not every phase needs all 7 codemap documents. Research needs STACK.md + ARCHITECTURE.md. Review needs CONCERNS.md + CONVENTIONS.md + TESTING.md. Martin Fowler: "keep context as small as possible." Sending everything wastes context budget. | LOW | Define per-phase codemap file lists in the PHASE_FILES table in SKILL.md, same pattern as existing upstream dependency mapping. |

### Differentiators (Competitive Advantage)

Features that set ralph-pipeline apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Planning phase collapse with context continuity | In marathon mode, phases 1-7 run in one orchestrator session without /clear. Context accumulates across planning phases. Eliminates 6x cold-start cost of reloading context. No competitor does this -- they either use /clear everywhere (GSD) or run everything in one monolithic session (SPARC). Marathon is a deliberate middle ground. | HIGH | Requires new orchestrator mode that skips /clear for phases 1-7. Core change to SKILL.md Step 7b. Risk: accumulated context may exceed 15% budget. Mitigation: orchestrator passes file paths only (existing anti-pattern rule). |
| Marathon dry-run mode | Show the full plan (all phases, all beads, estimated time) without executing anything. "What would marathon do?" preview. No competitor offers this. | LOW | Run phases 1-7 normally, display bead inventory from convert output + time estimate, then stop. Natural extension of planning review gate. |
| Resume-from-failure at bead level | When marathon re-invoked after failure, skip already-passed beads. Gas Town uses "nondeterministic idempotence" for this. Most AI pipelines restart from scratch. Bead-level resume saves hours on large projects. | MEDIUM | Read `.claude/pipeline/bead-results/*.md` at execution start. Filter bead queue to exclude beads with `status: passed`. Execute remaining beads only. |
| Codemap diff for review agents | Instead of sending full refreshed codemap, send only what changed between pre-execution and post-execution codemaps. Focused context = better review quality. No competitor does this. | HIGH | Requires diffing two codemap snapshots. Could git diff `.planning/codebase/` between pre-exec and post-exec commits. |
| Bead queue visualization with time estimates | Before execution, show a table of beads with per-bead estimated duration and cumulative total. "Here is your execution plan, estimated 2h 15m." | LOW | Use existing `time-budget estimate` data. Format as markdown table. |
| Dependency-aware bead ordering | Instead of flat alphabetical ordering, analyze bead dependencies and sort topologically. If bead B depends on A's output, A executes first. | MEDIUM | Parse bead frontmatter for `depends_on` field. Topological sort with cycle detection. Fall back to alphabetical if no deps declared. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems in the ralph-pipeline context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Parallel bead execution in marathon | "Run multiple beads at once" | Beads modify overlapping files. Parallel execution causes merge conflicts and non-deterministic failures. Gas Town built an entire Refinery/merge queue for this -- enormous complexity that violates zero-dep constraint. | Keep sequential execution. LLM API throughput is the bottleneck, not parallelism. |
| Auto PRD revision during marathon planning | "If deepen finds P1s, auto-fix without asking" | Breaks "review before execute" contract. Users may not notice scope-altering changes. Marathon is about efficiency, not removing oversight for critical decisions. | Present planning review gate showing P1 findings. Auto-fix only in YOLO mode (already implemented). |
| Full codebase content as context | "Give every agent the entire codebase" | Exceeds context windows. Burns tokens. Agents perform worse with irrelevant noise. Martin Fowler: "keep context as small as possible." | Selective codemap documents per phase. Only pass what each phase needs. |
| Live codemap updates during execution | "Update codemap after every bead" | Each codemap generation takes 5-10 minutes (4 parallel agents). Per-bead updates double execution time. ROI near-zero since review happens after all beads. | Single refresh after execution, before review. |
| Marathon replacing standard pipeline | "Marathon should be the only mode" | Standard per-phase /clear is essential for large projects where context overflow is real. Marathon works for small-to-medium (< 30 beads). | Keep both modes. Marathon is `--marathon` flag, not default. |
| Codemap as MCP server | "Expose codemap via MCP" | Adds external dependency. Violates zero-dep constraint. MCP servers require running processes. Overengineered for sequential pipeline. | File-based codemap in `.planning/codebase/`. Simple, stateless, survives /clear. |
| Auto codemap without user awareness | "Silently generate codemaps" | 5-10 minute step feels like pipeline is stuck if silent. Codemap may already exist and be fresh -- regenerating wastes time. | Check for existing codemap, offer refresh/skip/generate. Log progress. |

## Feature Dependencies

```
[Marathon mode command]
    |
    +--requires--> [All existing pipeline phases 1-9 working]
    |                  (already built in v1.0 -- SATISFIED)
    |
    +--requires--> [Modified orchestrator loop for marathon]
    |                  (skip /clear between phases 1-7)
    |
    +--requires--> [Planning review gate after phase 7]
    |                  (approve bead inventory before execution)
    |
    +--requires--> [Time budget scoping change]
    |                  (start budget after planning, not at pipeline start)
    |
    +--enhances--> [Resume-from-failure execution]
                       (critical for marathon due to larger bead counts)

[Codemaps integration]
    |
    +--requires--> [Codemap generation capability]
    |                  (invoke GSD map-codebase or build equivalent)
    |
    +--requires--> [PHASE_FILES update for codemap paths]
    |                  (add .planning/codebase/ files to phases 3, 4, 9)
    |
    +--requires--> [Codemap refresh trigger between phases 8-9]
                       (re-map after execution, before review)

[Marathon mode] --enhances--> [Codemaps integration]
    (marathon generates codemap once at start, refreshes once at end)

[Resume-from-failure] --enhances--> [Marathon mode]
    (critical: marathon may have 20-50 beads, full restart unacceptable)

[Codemap refresh] --requires--> [Pre-execution codemap exists]
    (need "before" snapshot to know what to refresh)

[Planning phase collapse] --conflicts--> [Context isolation via /clear]
    (marathon explicitly trades isolation for continuity in phases 1-7)

[Marathon dry-run] --requires--> [Marathon command entry point]
    (variant that stops after phase 7)

[Bead queue visualization] --enhances--> [Planning review gate]
    (shows time estimates alongside bead inventory)

[Dependency-aware bead ordering] --enhances--> [Single merged bead queue]
    (better ordering reduces failure rate)
```

### Dependency Notes

- **Marathon requires all v1.0 phases:** Does not add new phases. Runs same 9 phases but changes chaining (no /clear between planning phases 1-7, single execution run for phase 8). All existing templates reused as-is.
- **Codemaps requires generation capability:** Either invoke GSD `/gsd:map-codebase` (skill dependency) or build equivalent mapper logic. Recommendation: invoke GSD if installed, fall back to simplified built-in mapper if not.
- **Marathon enhances codemaps:** Clean lifecycle -- codemap at start, refresh at end. Standard mode has same integration points but across /clear boundaries.
- **Planning phase collapse conflicts with context isolation:** Fundamental trade-off. 15% context budget constraint means orchestrator must NOT load phase output content -- pass file paths only (existing anti-pattern rule). If maintained, 7 phases of orchestration overhead stays small.
- **Resume-from-failure critical for marathon:** Standard pipeline usually has < 10 beads. Marathon may have 20-50. Full restart wastes hours. Must read existing result files and skip passed beads.

## MVP Definition

### Launch With (v1.1)

Minimum viable marathon mode + codemaps integration.

- [ ] **Marathon command entry point** -- New `--marathon` flag on pipeline invocation activating marathon orchestrator loop. Dep: existing SKILL.md Step 2 command parsing.
- [ ] **Planning phase chain (no /clear for phases 1-7)** -- Modified Step 7b: if marathon mode, skip /clear and auto-dispatch next planning phase. Dep: existing auto-advance logic.
- [ ] **Planning review gate after phase 7** -- After convert completes, present bead inventory with approve/abort before execution. Dep: existing gate mechanism (Step 6).
- [ ] **Time budget scoping** -- In marathon, prompt for budget after planning (before phase 8), not at pipeline start (Step 1b). Dep: existing time-budget commands.
- [ ] **Resume-from-failure execution** -- Execute phase scans `.claude/pipeline/bead-results/` for passed results, skips those beads. Dep: existing result file format.
- [ ] **Codemap generation before research** -- Pre-phase step: check `.planning/codebase/`, generate if missing. Dep: mapper agent availability.
- [ ] **Codemap files in PHASE_FILES** -- Update PHASE_FILES table in SKILL.md for phases 3 (research), 4 (PRD), 9 (review). Dep: existing template variable system.
- [ ] **Codemap refresh after execution** -- Between phases 8 and 9, re-run codemap generation. Dep: codemap generation capability.

### Add After Validation (v1.1.x)

- [ ] **Marathon dry-run** -- `--marathon --dry-run` stops after phase 7. Trigger: users want preview.
- [ ] **Bead queue visualization** -- Table with time estimates at planning review gate. Trigger: "how long?"
- [ ] **Dependency-aware bead ordering** -- Topological sort from `depends_on`. Trigger: ordering-caused failures.
- [ ] **Codemap freshness check** -- Warn if codemap older than threshold. Trigger: stale map usage.
- [ ] **Codemap skip option** -- `--no-codemap` flag. Trigger: small projects where mapping overhead not worth it.

### Future Consideration (v2+)

- [ ] **Incremental codemap refresh** -- Re-map only changed files. Defer: requires new mapper agent mode.
- [ ] **Codemap diff for review** -- Send only changes. Defer: complex diffing, unclear ROI.
- [ ] **Context budget monitoring** -- Dynamic /clear if context exceeds threshold. Defer: no introspection API.
- [ ] **Marathon for multi-milestone** -- Chain milestones into single run. Defer: out of scope.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Marathon command entry point | HIGH | MEDIUM | P1 |
| Planning phase chain (no /clear) | HIGH | MEDIUM | P1 |
| Planning review gate | HIGH | LOW | P1 |
| Time budget scoping | MEDIUM | LOW | P1 |
| Resume-from-failure execution | HIGH | MEDIUM | P1 |
| Codemap generation before research | HIGH | MEDIUM | P1 |
| Codemap files in PHASE_FILES | HIGH | LOW | P1 |
| Codemap refresh after execution | MEDIUM | MEDIUM | P1 |
| Marathon dry-run | MEDIUM | LOW | P2 |
| Bead queue visualization | LOW | LOW | P2 |
| Dependency-aware bead ordering | MEDIUM | MEDIUM | P2 |
| Codemap freshness check | LOW | LOW | P2 |
| Codemap skip option | LOW | LOW | P2 |
| Incremental codemap refresh | LOW | HIGH | P3 |
| Codemap diff for review | LOW | HIGH | P3 |
| Context budget monitoring | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.1 launch
- P2: Should have, add in v1.1.x patches
- P3: Nice to have, defer to v2+

## Competitor Feature Analysis

| Feature | GSD (map-codebase) | SPARC (claude-flow) | Traycer (YOLO Mode) | Gas Town (Polecats) | ralph-pipeline v1.1 |
|---------|---------------------|---------------------|---------------------|---------------------|---------------------|
| Upfront planning | /gsd:new-project per-milestone | 5 SPARC phases sequential | Phase planning with smart YOLO | Molecules with acceptance criteria | Marathon: phases 1-7 upfront, then execute |
| Batch execution | Phase-by-phase with /clear | BatchTool for within-phase ops | Parallel independent items | Polecats from queue, Refinery merges | Sequential from merged queue |
| Codemap/context | 7-doc `.planning/codebase/` via 4 mappers | Memory Bank hot/cold storage | N/A | Git-backed state | GSD mapper output, selective per phase |
| Resume after failure | Phase-level via scan-phases | Dependency-tracked tasks | Smart YOLO adapts | Nondeterministic idempotence | Bead-level: skip passed, retry failed |
| Context sharing | File-based, agents write directly | Memory Bank across sessions | Agent handoff templates | Git-backed shared state | `.planning/codebase/` in PHASE_FILES |
| Time budgets | No | No | No | No | Yes -- execution only in marathon |
| Plan-then-execute | No (interleaved) | Yes (SPARC phases) | Yes (Smart YOLO) | No (continuous) | Yes (phases 1-7 plan, 8 execute) |

## Sources

- GSD map-codebase workflow -- LOCAL `.reference/get-shit-done/workflows/map-codebase.md` -- HIGH confidence
- Existing ralph-pipeline templates -- LOCAL `templates/` -- HIGH confidence
- Existing ralph-pipeline SKILL.md -- LOCAL -- HIGH confidence
- Context Engineering for Coding Agents (Martin Fowler) -- https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html -- HIGH confidence
- Windsurf Codemaps (Cognition AI) -- https://cognition.ai/blog/codemaps -- MEDIUM confidence
- SPARC Automated Development -- https://gist.github.com/ruvnet/e8bb444c6149e6e060a785d1a693a194 -- MEDIUM confidence
- Traycer YOLO Mode -- https://docs.traycer.ai/tasks/yolo-mode -- MEDIUM confidence
- Gas Town: Kubernetes for AI Agents -- https://cloudnativenow.com/features/gas-town-what-kubernetes-for-ai-coding-agents-actually-looks-like/ -- MEDIUM confidence
- Addy Osmani LLM Workflow 2026 -- https://addyosmani.com/blog/ai-coding-workflow/ -- MEDIUM confidence
- codemap CLI (GitHub) -- https://github.com/JordanCoin/codemap -- MEDIUM confidence
- Plan-and-Execute Agent Pattern -- https://www.ema.co/additional-blogs/addition-blogs/build-plan-execute-agents -- MEDIUM confidence
- Planning Mode in AI Coding Assistants -- https://mer.vin/2025/12/planning-mode-in-ai-coding-assistants/ -- MEDIUM confidence
- Codified Context Infrastructure (arXiv) -- https://arxiv.org/html/2602.20478 -- MEDIUM confidence
- Codebase Context Specification (GitHub) -- https://github.com/Agentic-Insights/codebase-context-spec -- MEDIUM confidence

---
*Feature research for: Marathon mode + codemaps integration (ralph-pipeline v1.1)*
*Researched: 2026-02-27*
