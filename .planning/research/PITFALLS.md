# Pitfalls Research

**Domain:** Adding marathon mode (batch execution) and codemaps integration to existing phase-based pipeline
**Researched:** 2026-02-27
**Confidence:** HIGH (based on codebase analysis + documented Claude Code limitations + v1.0 pitfalls validation)

## Critical Pitfalls

### Pitfall 1: Merged Plan Exceeds Orchestrator Context Budget

**What goes wrong:**
Marathon mode merges all 9 phases of planning into one bead queue for a single execution run. The orchestrator currently stays under 15% context usage (PROJECT.md constraint) by dispatching each phase as an isolated Task subagent and never reading phase output content. If the marathon orchestrator tries to hold the merged plan, bead definitions, and execution state in its own context, it hits 200K token limits. A comprehensive-depth PRD with 20+ stories produces 20+ beads. The planning output from phases 2-7 (clarify through convert) easily totals 50K-100K tokens of raw content.

**Why it happens:**
The intuition behind marathon mode is "plan everything upfront, then execute." Developers interpret "upfront" as "load all plans into the orchestrator." But the current design achieves context isolation precisely by NOT loading phase outputs into the orchestrator. Marathon mode must preserve this invariant.

**How to avoid:**
- Marathon planning phases MUST still use Task subagents with `/clear` between them (same as standard mode). The only difference: user gates are auto-approved during planning.
- The "merge into one bead queue" step happens AFTER all planning phases complete. A new `marathon-merge` step reads bead file PATHS from `.beads/` directory -- never loads full bead content into the orchestrator. Writes ordered list to `.planning/pipeline/marathon-queue.json`.
- Marathon execution reuses the existing `execute.md` template unchanged. The execute phase already iterates beads one-at-a-time without loading all content.
- Key invariant: the orchestrator never holds more than one phase's summary at a time, even in marathon mode.

**Warning signs:**
- Orchestrator context usage exceeding 20% during marathon planning
- "Compaction triggered" messages during orchestration (not during subagent work)
- Any design that passes plan CONTENT (not file paths) between marathon steps
- Marathon orchestrator growing a new template distinct from standard templates

**Phase to address:**
Architecture/design phase -- structural decision that must be locked before implementation.

---

### Pitfall 2: Codemap Staleness During Long Marathon Execution

**What goes wrong:**
Codemaps are generated before research/PRD phases. In standard mode, execution takes 30-60 minutes for a handful of beads. Marathon mode could queue 20-40 beads executing over 4-8 hours. Each bead modifies files, adds modules, changes imports. The codemap becomes progressively stale. Review agents in phase 9 receive a codemap describing the codebase as it was BEFORE execution -- wrong file paths, outdated architecture, missing new modules.

Research confirms this is a documented pattern: LLM agents experience "attention drift" after 30+ minutes of execution, and codebase maps become stale as files change underneath. The existing `.planning/codebase/` output (7 files, 1383 lines for this project) describes file paths, patterns, and architecture that may no longer be accurate post-execution.

**Why it happens:**
The natural instinct is "generate codemap once, use everywhere." This works in standard mode where the gap between mapping and review is small. Marathon mode stretches this gap to hours. Developers underestimate how much the codebase changes during a 20-bead execution run.

**How to avoid:**
- Two codemap snapshots: PRE-execution (for research + PRD agents) and POST-execution (for review agents).
- POST-execution refresh is scoped: run only `arch` and `concerns` mapper agents (ARCHITECTURE.md, STRUCTURE.md, CONCERNS.md change most during code generation). Skip `tech` and `quality` mappers (STACK.md, CONVENTIONS.md, TESTING.md rarely change from bead execution).
- Store both snapshots: `.planning/codebase/` for pre-exec, `.planning/codebase-post-exec/` for post-exec. Review agents receive the post-exec path.
- Do NOT refresh codemap mid-execution. Each bead's changes are incremental; refreshing between beads adds 5-10 minutes per bead for marginal value.

**Warning signs:**
- Review agents flagging "file not found" for codemap paths
- Architecture review findings contradicting actual code structure
- STRUCTURE.md listing directories that no longer exist or missing new ones
- Review agents producing generic findings instead of file-specific ones

**Phase to address:**
Codemaps integration implementation phase -- designed into refresh strategy from the start.

---

### Pitfall 3: Marathon Mode Breaks Auto-Advance and SessionStart Hook Interaction

**What goes wrong:**
Current auto-advance relies on `/clear` + SessionStart hook re-invocation between phases. Marathon mode promises "one continuous run" but if it still uses `/clear` between planning phases, it is just auto-advance with auto-approved gates. If it skips `/clear`, context accumulates and the orchestrator degrades. The SessionStart hook has no mode awareness -- it re-invokes the standard pipeline regardless.

The config currently stores `auto_advance: true/false` and `mode: normal/yolo`. Marathon mode needs a third mode value, and the hook must distinguish between "auto-advance standard" and "marathon planning auto-advance."

**Why it happens:**
The tension between "continuous run" UX and "isolated context" architecture is the fundamental design challenge. Teams resolve this by sacrificing isolation, causing context degradation in later planning phases. The v1.0 architecture already solved this for standard auto-advance -- marathon must reuse that solution, not reinvent it.

**How to avoid:**
- Marathon mode STILL uses `/clear` between planning phases. The differences from standard auto-advance: (1) no user gates between phases 2-7, (2) time budget applies only to execution, (3) YOLO-like gate approval for planning phases.
- Marathon mode is `mode: marathon` in config (alongside `normal` and `yolo`). The existing auto-advance mechanism handles the `/clear` + re-invocation. Marathon is NOT a separate orchestrator.
- The SessionStart hook reads `mode` from config and adjusts gate behavior: `marathon` auto-approves planning phases (2-7), presents gates for execution (8) and review (9).
- Marathon mode must NOT be a separate SKILL.md entry point. It reuses the existing orchestrator with mode-specific conditionals.

**Warning signs:**
- Designing marathon as a separate orchestrator or SKILL.md (code duplication)
- Planning phases producing lower-quality output in marathon vs standard (context degradation)
- `/clear` not firing between marathon planning phases
- SessionStart hook entering infinite loop from unrecognized mode
- Two different code paths for "advance to next phase"

**Phase to address:**
Architecture phase -- marathon/standard mode switching must be designed before implementation.

---

### Pitfall 4: Codemap Token Budget Blows Up Subagent Prompts

**What goes wrong:**
The 7 codemap files total 1383 lines for this small project. For a production codebase, these files reach 3000-5000+ lines (15K-25K tokens). Research agents, PRD agents, and review agents each receive codemap content as context. If the full codemap is injected into each subagent prompt, it consumes 10-15% of their context window before work begins. Review agents are hit hardest: codemap (25K tokens) + git diff (10K-30K tokens) = 35K-55K tokens consumed before analysis starts.

**Why it happens:**
The codemap is designed to be comprehensive. The GSD codebase mapper agent spec itself includes a selective loading table: research gets STACK + ARCHITECTURE, not all 7 files. But the temptation is to "pass everything for completeness." Each redundant file wastes tokens across 4 parallel agents per phase, multiplied across research, deepen, and review phases = up to 12 agent instances receiving unnecessary codemap content.

**How to avoid:**
- Selective codemap injection per agent role, following GSD's own pattern:
  - Research agents: STACK.md + ARCHITECTURE.md (tech context)
  - PRD agent: ARCHITECTURE.md + STRUCTURE.md (system boundaries)
  - Deepen agents: security gets INTEGRATIONS.md + ARCHITECTURE.md; architecture gets ARCHITECTURE.md + STRUCTURE.md; simplicity gets CONVENTIONS.md; performance gets STACK.md + ARCHITECTURE.md
  - Review agents: same mapping but using post-exec codemap files
- Pass codemap as `<files_to_read>` paths in the template, not inline content. Subagents read files themselves. This matches the existing PHASE_FILES pattern in SKILL.md.
- Add a `CODEMAP_FILES` template variable computed per phase, analogous to `PHASE_FILES`. The mapping table lives in `orchestrator.cjs`.
- Budget ceiling: if total codemap exceeds 4000 lines, truncate each document to section headers + first 5 lines per section.

**Warning signs:**
- Subagent prompts exceeding 40K tokens before the agent starts working
- Research or review agents running out of context mid-analysis
- Codemap content appearing in compaction summaries (wasted budget)
- All 7 codemap files passed to every agent regardless of role
- Template filling embedding codemap CONTENT instead of PATH references

**Phase to address:**
Codemaps integration implementation -- selective injection table in `orchestrator.cjs` before template changes.

---

### Pitfall 5: Time Budget Semantics Change Silently Breaks Existing Behavior

**What goes wrong:**
In standard mode, the time budget covers the entire pipeline (planning + execution). In marathon mode, the spec says "budget applies to execution only, not planning phases." The same `time-budget start 4` command has different semantics depending on mode. If the mode flag gets lost (config corruption, `/clear` edge case), the budget applies to planning too, causing premature stops during planning phases.

The existing `time-budget check` at phase boundaries (Step 7a in SKILL.md) triggers during ALL phases. Marathon planning phases would be stopped by a budget meant only for execution.

**Why it happens:**
The time budget stores an absolute timestamp (`time_budget_expires` in config.json) with no field indicating what the budget applies to. The `cmdTimeBudgetCheck` function (line 49-74 in `time-budget.cjs`) simply compares `Date.now()` against expiry -- no concept of "execution-only budget."

**How to avoid:**
- Simplest approach (recommended): marathon mode defers calling `time-budget start` until the execute phase begins (after phase 7 convert completes). Planning phases run with no time budget. Budget starts when execution starts. This requires zero changes to the existing time-budget implementation.
- During marathon planning, the time budget display shows "Budget: {hours}h (starts at execution)" instead of a countdown.
- If a more complex approach is needed later: add `time_budget_scope: "pipeline" | "execution"` to config, and have `cmdTimeBudgetCheck` respect it. But the simple approach avoids this.

**Warning signs:**
- Time budget expiring during marathon planning phases
- `time_budget_expires` being set before phase 8 begins in marathon mode
- Users confused about when their budget "started counting"
- Marathon runs stopping during research phase due to budget

**Phase to address:**
Marathon mode implementation -- time budget deferral is part of the marathon command flow.

---

### Pitfall 6: Headless Execution Context Overflow Is Irrecoverable

**What goes wrong:**
In marathon mode with 20-40 beads executing headlessly via `claude -p`, each bead execution is an independent `claude -p` invocation (good -- isolated context). But if a single bead's prompt + quality gate suffix + the bead agent's tool call outputs exceed the context window, the headless session becomes irrecoverable. Unlike interactive Claude Code which has Esc+Esc rewind, `claude -p` has no recovery mechanism for context overflow.

This is documented as a known limitation: "When running Claude Code in noninteractive mode, if a single tool call returns output that exceeds the context limit, the session becomes irrecoverable" (GitHub issue #13831). Marathon mode increases the probability of hitting this because comprehensive-depth beads can be large, and the bead agent may read large files during execution.

**Why it happens:**
The existing execute.md template passes bead content via stdin to `claude -p` (correct pattern). But the bead content itself can be large, and the quality gate suffix instructs the agent to "run tests" and "run type checker" -- both of which can produce large stdout output that consumes context. A complex bead touching many files could trigger multiple large file reads and test suite output.

**How to avoid:**
- Bead content size check before execution: if bead file exceeds 5000 tokens (~20KB), warn and consider splitting.
- Use `--max-budget-usd` on `claude -p` calls to prevent runaway cost on single beads.
- For marathon mode specifically: if a bead fails with a context-related error, log it, mark as `status: failed`, and continue to the next bead (current YOLO behavior). Do NOT retry context overflow failures -- they will fail again with the same input.
- The execute.md template already uses `--output-format json` and `--dangerously-skip-permissions` which minimizes interactive overhead.

**Warning signs:**
- Single bead execution hanging for >30 minutes with no output
- `claude -p` returning non-zero exit code with truncation-related error messages
- Bead files exceeding 200 lines of instructions
- Beads with acceptance criteria requiring reading/modifying >10 files

**Phase to address:**
Marathon mode implementation -- bead size validation during the marathon-merge step.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Inline codemap content in subagent prompts | Simpler template filling, no extra read step | Token waste compounds across 4 agents x 3 phases = 12 instances; makes codemap updates require re-dispatching agents | Never -- always pass file paths |
| Single codemap snapshot for entire pipeline | Simpler implementation, one mapping step | Stale codemap for review agents, especially in marathon mode; review findings become unreliable | Only for standard mode with <10 beads |
| Marathon mode as separate SKILL.md entry point | Clear separation, no risk to existing flow | Duplicated orchestrator logic diverges over time; bug fixes applied twice; users confused about entry points | Never -- use mode flag on existing orchestrator |
| Skipping `/clear` between marathon planning phases | Truly "one continuous run" UX | Context degradation makes later planning phases lower quality; violates core architectural principle | Never -- `/clear` is non-negotiable |
| Global codemap injection (all 7 files to all agents) | Simple implementation, no mapping table | 15-25K tokens wasted per agent; review agents hit context limits with diff + codemap | Only for projects with <500 LOC codemap total |
| Time budget starts at marathon invocation | Simpler logic, one start point | Planning time eats execution budget; long research phase burns hours before first bead | Never in marathon mode |
| Storing marathon state in JavaScript variables | Avoid disk I/O | State lost on `/clear`; breaks resumability after crash | Never -- all state on disk via ralph-tools.cjs |

## Integration Gotchas

Common mistakes when connecting codemap + marathon to existing pipeline components.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Codemap + Research agents | Passing codemap as inline text in Task prompt (bloats orchestrator when filling template) | Add `CODEMAP_FILES` template variable analogous to `PHASE_FILES`; agents read files themselves |
| Codemap + Review agents (post-exec) | Using pre-execution codemap for post-execution review | Run scoped codemap refresh (arch + concerns mappers only) between execute and review phases |
| Marathon + `auto_advance` config | Setting `auto_advance: true` without distinguishing marathon from standard auto-advance | Add `mode: marathon` config value; auto_advance behavior varies by mode (marathon auto-approves planning gates) |
| Marathon + `phase_retry_count` | Marathon retrying individual planning phases breaks "plan all at once" contract | Marathon should retry the entire planning sequence from the failed phase forward, or skip with warning |
| Marathon + `bead_format` gate | Asking bead format during marathon interrupts unattended flow | Marathon requires `bead_format` pre-set in config; fail fast if not set |
| Marathon + SessionStart hook | Hook re-invokes pipeline without knowing marathon vs standard mode | Config persists `mode: marathon`; hook reads mode and adjusts gate behavior |
| Codemap + `fillTemplate()` | Template variable `{{CODEMAP_FILES}}` treated as single string; breaks if codemap paths contain special chars | Use same multiline format as PHASE_FILES (`- path\n- path`); fillTemplate already handles this |
| Marathon + time-budget `start` | Calling `time-budget start` at marathon invocation start | Defer `time-budget start` to execute phase entry; planning runs without budget constraint |

## Performance Traps

Patterns that work at small scale but fail as project/bead count grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full codemap refresh between every phase | Each refresh = 4 parallel mapper agents, 5-15 minutes | Only refresh at two points: pre-planning and pre-review | >5 phases; 25-75 minutes wasted |
| Loading all bead content into marathon orchestrator for merge | Context overflow, compaction, degraded orchestrator | Merge step reads bead file NAMES only; writes marathon-queue.json | >15 beads (~30K+ tokens of content) |
| Codemap documents growing unbounded | Subagent prompts exceed useful context | Cap each codemap doc at 300 lines; section-header summaries for overflow | Project >10K LOC with >50 source files |
| Codemap selective injection table hardcoded per phase | Works for 9 phases, breaks when phases change | Make injection table data-driven (lookup in PIPELINE_PHASES array) | When adding/removing pipeline phases |
| Running all 4 codemap mappers for post-exec refresh | 10-15 minutes for mappers that produce unchanged output | Only run `arch` + `concerns` mappers post-exec | Every marathon run wastes 5-10 minutes on unnecessary mappers |

## UX Pitfalls

Common user experience mistakes when adding marathon mode and codemaps.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Marathon silently falling back to standard mode on config error | User expects unattended 8-hour run, pipeline pauses at phase 2 gate | Fail fast: "Marathon requires bead_format in config. Set it first." |
| No progress visibility during marathon planning | User sees nothing for 30-60 minutes while planning runs | Log phase transitions: "Marathon planning: phase 3/7 (Research) starting..." |
| Codemap refresh blocking pipeline start for 10+ minutes | User invokes pipeline, waits with no feedback | Show "Mapping codebase (4 agents)..." with per-agent progress |
| Time budget display confusing in marathon mode | User sets 4h budget, sees countdown before execution starts | Show "Time budget: 4h (starts at execution)" during planning |
| Marathon producing different results than standard mode | User runs marathon expecting identical quality | Document: marathon auto-approves planning gates; results may differ from standard with user steering |
| Codemap generating when project has no source code yet | Greenfield project invokes pipeline with codemap enabled; 4 mappers find nothing | Check for source files before codemap generation; skip with log |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Codemap selective injection:** Often missing per-agent mapping -- verify each agent type receives only relevant codemap docs (not all 7). Check `CODEMAP_FILES` mapping in orchestrator.cjs.
- [ ] **Marathon `/clear` isolation:** Often missing `/clear` between planning phases -- verify context isolation preserved. Check for compaction warnings in marathon planning logs.
- [ ] **Marathon pre-exec commit:** Often missing -- verify `.claude/pipeline/pre-exec-commit.txt` is written before marathon execution starts. Review phase depends on this for diff scoping.
- [ ] **Time budget deferral:** Often starts too early -- verify `time-budget start` is not called until execute phase in marathon mode. Check config.json for premature `time_budget_expires` values.
- [ ] **Codemap post-exec refresh:** Often forgotten -- verify review agents receive post-exec codemap path, not pre-exec. Check `.planning/codebase-post-exec/` directory exists after marathon execution.
- [ ] **Marathon bead ordering:** Often scrambled during merge -- verify bead queue preserves tracer-bullet ordering from convert phase. Check first bead is US-001 related.
- [ ] **Config mode cleanup:** Often orphaned -- verify `mode: marathon` is reset to `normal` when marathon completes or fails. Test standard mode invocation after marathon completion.
- [ ] **SessionStart hook mode awareness:** Often ignores mode -- verify hook reads `mode` from config and adjusts gate behavior for marathon vs standard.
- [ ] **Codemap skip for greenfield:** Often runs pointlessly -- verify codemap generation is skipped when no source files exist yet.
- [ ] **Marathon fail-fast on missing config:** Often proceeds with defaults -- verify marathon mode checks for required config (`bead_format`, `depth`) before starting and fails with actionable error.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Context overflow in marathon orchestrator | LOW | `/clear` and re-invoke; state on disk means no work lost. Reduce codemap injection or switch to standard mode. |
| Stale codemap for review agents | MEDIUM | Run `/gsd:map-codebase` (or scoped arch+concerns refresh), then re-run review phase via `--skip-to 9`. |
| Time budget expired during marathon planning | LOW | Re-invoke with fresh budget; planning output preserved on disk; execution resumes from bead queue. |
| Marathon stuck in auto-advance loop | LOW | Kill process; `config-set mode normal && config-set auto_advance false`; re-invoke standard pipeline. |
| Bead ordering wrong in marathon queue | HIGH | Must re-run convert phase (phase 7); partial execution results need manual cleanup from `.claude/pipeline/bead-results/`. |
| Codemap blowing up subagent context | MEDIUM | Update `CODEMAP_FILES` mapping to inject fewer docs; re-run affected phase. |
| Marathon mode orphaned in config after failure | LOW | Run `config-set mode normal` manually; pipeline resumes standard behavior. |
| Headless bead hits irrecoverable context overflow | LOW (per bead) | Bead is marked `status: failed`; split the bead into smaller chunks; re-run via "Re-run bead X" in review gate. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Context overflow in marathon orchestrator | Architecture/design | Measure orchestrator context stays under 15% during marathon planning by checking filled template sizes |
| Codemap staleness | Codemaps implementation | Verify review agents receive post-exec codemap (check timestamps, compare STRUCTURE.md before/after execution) |
| Auto-advance/SessionStart conflict | Marathon architecture | Verify marathon uses same orchestrator with `mode: marathon`; verify hook reads mode from config |
| Codemap token budget explosion | Codemaps implementation | Verify selective injection mapping exists in orchestrator.cjs; measure subagent prompt size with codemap |
| Time budget semantics change | Marathon implementation | Verify `time-budget start` is not called until execute phase in marathon mode |
| Headless context overflow (irrecoverable) | Marathon implementation | Add bead size check in marathon-merge; verify oversized beads are flagged with warning |
| Lost-in-the-middle bead ordering | Marathon merge implementation | Verify bead queue preserves tracer-bullet order; test that bead 20 references bead 1 outputs correctly |
| Config mode cleanup | Marathon implementation | Verify mode resets on completion/failure; test standard mode after marathon |
| UX: no progress visibility | Marathon implementation | Verify phase transition logging during marathon planning |

## Sources

- Codebase analysis: `SKILL.md` -- orchestrator logic (445 lines), context isolation via `/clear`, auto-advance mechanism, time budget integration
- Codebase analysis: `lib/orchestrator.cjs` -- PIPELINE_PHASES array, fillTemplate, PHASE_FILES mapping pattern, scanPipelinePhases
- Codebase analysis: `lib/time-budget.cjs` -- `cmdTimeBudgetCheck` has no scope field (lines 49-74), stores absolute timestamp only
- Codebase analysis: `lib/core.cjs` -- config schema (line 111-125), no `mode: marathon` or `time_budget_scope` fields yet
- Codebase analysis: `templates/execute.md` -- bead execution loop, `claude -p` invocation pattern, quality gate suffix
- Codebase analysis: `templates/research.md` -- parallel agent spawning, `run_in_background=true` pattern
- Codebase analysis: `templates/review.md` -- post-exec review, pre_exec_commit diff scoping, 4 parallel agents
- GSD map-codebase: `~/.claude/commands/gsd/map-codebase.md` -- 7-document output, 4 parallel mapper agents
- GSD codebase mapper: `~/.claude/agents/gsd-codebase-mapper.md` -- selective document loading table per phase type
- Existing codemap size: `.planning/codebase/*.md` totals 1383 lines for ralph-pipeline (small project baseline)
- Claude Code context: 200K standard, 1M beta -- https://platform.claude.com/docs/en/build-with-claude/context-windows
- Headless context recovery limitation: https://github.com/anthropics/claude-code/issues/13831
- Background task orphaning after compaction: https://github.com/anthropics/claude-code/issues/29193
- Agent system prompt drift in long sessions: https://dev.to/nikolasi/solving-agent-system-prompt-drift-in-long-sessions-a-300-token-fix-1akh
- LLM lost-in-the-middle effect: https://demiliani.com/2025/11/02/understanding-llm-performance-degradation-a-deep-dive-into-context-window-limits/
- Context management with subagents: https://www.richsnapp.com/article/2025/10-05-context-management-with-subagents-in-claude-code
- Subagent context isolation design: https://code.claude.com/docs/en/sub-agents

---
*Pitfalls research for: marathon mode + codemaps integration into ralph-pipeline v1.1*
*Researched: 2026-02-27*
