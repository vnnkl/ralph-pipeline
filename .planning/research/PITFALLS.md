# Pitfalls Research

**Domain:** Multi-phase AI coding orchestration system with context-isolated pipelines and CLI state management
**Researched:** 2026-02-25
**Confidence:** HIGH (derived from existing SKILL.md analysis, CONCERNS.md audit, GSD execute-phase.md patterns, and direct system comparison)

---

## Critical Pitfalls

### Pitfall 1: Orchestrator Context Bloat (The Fat Orchestrator)

**What goes wrong:**
The orchestrator accumulates subagent outputs directly into its own context. After 3-4 phases it has research findings, PRD text, review feedback, and all previous phase content in memory — hitting context limits before reaching execution.

**Why it happens:**
Intuitive approach: have the main agent "read" each phase result to verify it. Reading = context accumulation. By Phase 4, the orchestrator has loaded research (5-10KB), PRD (10-15KB), and review feedback (5-10KB) — that is 30KB+ just in phase outputs before any tool calls.

**How to avoid:**
The orchestrator must NEVER read phase file contents — only verify they exist and contain `completed: true`. Pass file paths to subagents, not file contents. GSD execute-phase.md explicitly enforces: "Pass paths only — executors read files themselves with their fresh 200k context. This keeps orchestrator context lean (~10-15%)."

Use a CLI tool (ralph-tools.cjs) for all state reads that return only the fields needed: `completed` status, `current_phase`, not full file content.

**Warning signs:**
- Orchestrator prompt includes "read the research and summarize it"
- Phase output files are loaded into orchestrator context to decide next phase
- Orchestrator context usage exceeds 20% by Phase 3
- Phase subagent prompts embed the previous phase's full output inline

**Phase to address:**
Phase 1 (Core Orchestrator) — the `completed: true` verification pattern and CLI-mediated state reads must be established before any phase work is written.

---

### Pitfall 2: State File as Source of Ambiguity

**What goes wrong:**
`state.md` says `current_phase: 3` but `phase-3-prd.md` has `completed: false`. The orchestrator cannot tell if the subagent is still running, crashed mid-write, or was interrupted by compaction. It either re-runs the phase (losing idempotent guarantees) or skips it (proceeding on incomplete output).

**Why it happens:**
Two-file state (state.md + phase file) creates a window for inconsistency. The main agent writes `current_phase: 3` to state.md before the subagent finishes writing phase-3-prd.md. If anything interrupts between those two writes, the state is permanently ambiguous.

**How to avoid:**
State advancement must be a consequence of `completed: true` in the phase file, not a precondition. Protocol: (1) Subagent writes phase file with `completed: false`. (2) Subagent does work. (3) Subagent sets `completed: true`. (4) Main agent reads `completed: true`, THEN writes new `current_phase` to state.md. The phase file is authoritative; state.md is a cached index.

Add a "recovery phase" in the orchestrator's entry logic: if `phase-N.md` exists with `completed: false`, offer to re-run phase N (do not auto-advance). Distinguish between "file written but work incomplete" (needs re-run) and "file missing entirely" (needs fresh run).

**Warning signs:**
- state.md `current_phase` is advanced before the subagent returns
- No explicit check: "does phase file have `completed: true`?"
- Recovery path for `completed: false` is undefined in orchestrator spec
- Phase file creation and state advancement happen in the same agent turn

**Phase to address:**
Phase 1 (Core Orchestrator) — state machine transition protocol must be explicit: phase file `completed: true` gates state.md advancement.

---

### Pitfall 3: Compaction Drops the Thread Without Reliable Recovery

**What goes wrong:**
Claude compacts context during a long pipeline run. The SessionStart hook re-injects `state.md` content, but the re-injected text is just a string at the start of the new session — the orchestrator has no entry-point logic that parses this marker and jumps to the correct phase. It restarts from Phase 0 instead of resuming at Phase 3.

**Why it happens:**
Hook-injected state is passive — it appears in the context but the orchestrator must actively check for it. If the SKILL.md entry point logic only checks "is there a state.md on disk?" but does not handle "has state been injected via hook?", the hook is decorative.

**How to avoid:**
The orchestrator's FIRST action on every invocation must be: (1) Check for `--- RALPH PIPELINE STATE` marker in current context. (2) If found, parse `current_phase` from it and jump to that phase. (3) If not found, check disk for state.md. (4) If neither, start fresh.

The hook is a fallback signal, not the primary mechanism. The primary mechanism is always reading state.md from disk at session start.

The GSD approach is stronger — a CLI tool (`gsd-tools.cjs init`) that reads all state in a single bash call, returning structured JSON. This replaces fragile hook injection with an explicit, testable initialization step.

**Warning signs:**
- SKILL.md entry point has no explicit "check for compaction re-injection" step
- Hook injects state but orchestrator does not have matching parse logic
- Pipeline has been tested for fresh starts but never tested after a forced compaction
- No "Resuming from compaction, Phase X" log output in orchestrator

**Phase to address:**
Phase 1 (Core Orchestrator) — entry-point logic and the ralph-tools.cjs `init` command must handle compaction-resume before any phase work is implemented.

---

### Pitfall 4: Skill Chaining Without Verified Invocation

**What goes wrong:**
The pipeline calls `/ralph-tui-prd`, `/ralph-tui-create-beads`, `/frontend-design`, and `/harvest` as if they are always available and always succeed. When one fails silently (skill not installed, invocation syntax changed, no output generated), the phase subagent marks itself `completed: true` anyway because it reached the end of its instructions.

**Why it happens:**
Skill invocations do not have standard return values. A subagent calling `/ralph-tui-prd` cannot easily detect "did this produce a valid PRD?" vs "did this fail silently?" unless there is explicit output validation logic in the subagent prompt.

**How to avoid:**
Every skill invocation must be followed by explicit validation: "After invoking `/ralph-tui-prd`, verify that the output contains `[PRD]...[/PRD]` markers and at least 3 user stories. If not, write `completed: false` with a failure reason and stop."

Pre-flight must be a BLOCKING gate: if a critical skill is missing, the pipeline stops before Phase 0, not after Phase 2 fails. ralph-tools.cjs should expose a `validate-deps` command that returns a structured list of missing skills/CLIs.

**Warning signs:**
- No validation step after each skill invocation in subagent prompts
- Pre-flight "warns" about missing skills but allows pipeline to continue
- Phase 3 subagent prompt does not specify what to do if `/ralph-tui-prd` produces empty output
- No expected output format documented for each skill

**Phase to address:**
Phase 0 (Pre-flight) — blocking dependency validation. Phase 2 (Skill Invocation Layer) — output validation after every skill call.

---

## Moderate Pitfalls

### Pitfall 5: Open Questions Leaking into Execution

**What goes wrong:**
Phase 4.5 presents questions to the user and marks them `[x]` after any user response — including "TBD", "not sure", or "maybe S3". The `open_questions_resolved: true` flag is set, PRD goes into conversion with `[TBD: email provider]` placeholders, and execution beads fail when they hit the placeholder.

**Why it happens:**
The resolution gate validates presence of answers, not quality of answers. Vague answers satisfy the checklist condition.

**How to avoid:**
Add a post-resolution scan: after Phase 4.5, run a grep on the PRD for `\[TBD\]`, `\[TODO\]`, `TBD:`, `[PLACEHOLDER]` patterns. If found, present those specific placeholders back to the user: "These placeholders remain unresolved. Answer or explicitly defer to execution with `DECISION_PENDING:`." Only set `open_questions_resolved: true` after the scan returns clean.

**Warning signs:**
- Phase 4.5 accepts "TBD" as a resolved answer
- No post-resolution content scan on PRD files
- Beads fail in Phase 6 with "what provider should I use?" type errors
- `open_questions_resolved: true` set immediately after user types anything

**Phase to address:**
Phase 3 (Phase 4.5 Logic) — add TBD scan step; ralph-tools.cjs should expose a `scan-placeholders <file>` command.

---

### Pitfall 6: Headless Execution Without Exit Codes

**What goes wrong:**
Phase 6 spawns N `claude -p` sessions in a bash loop. When the loop ends, the pipeline reads bead-results files and cats them. But there is no structured pass/fail status per bead — only free-text output. The main agent cannot reliably count successes vs failures or identify which beads need re-running.

**Why it happens:**
Bash loops do not propagate AI session exit codes. The `claude -p` call may return 0 (success) even if the bead executor wrote "BLOCKED" in its result file. The main agent needs to parse free text to infer status.

**How to avoid:**
Require bead-results files to have a mandatory first line: `status: passed|failed|blocked`. ralph-tools.cjs should expose a `summarize-bead-results` command that reads all files, counts by status, and returns structured JSON. The main agent calls this instead of catting raw files.

Headless loop should also use `--max-turns 30` consistently and log exit codes: `claude -p "..." --max-turns 30; echo "exit:$?"`.

**Warning signs:**
- Headless execution summary uses raw `cat` on result files
- No `status:` field convention defined for bead-result files
- User wakes up to 10 result files with no clear way to tell what passed
- No "re-run failed beads" workflow in Phase 6

**Phase to address:**
Phase 4 (Headless Execution) — bead-results format must be defined in ralph-tools.cjs spec before headless execution is implemented.

---

### Pitfall 7: /clear Between Phases Breaks the Persistent-Orchestrator Assumption

**What goes wrong:**
The GSD-inspired design calls for `/clear` between phases to isolate context. But the new ralph-gsd system invokes phases as separate skill invocations, not subagents within a running session. This means the "main agent" from Phase 1 no longer exists when Phase 2 runs — there is no stateful orchestrator. State must live entirely on disk and each phase invocation must reconstruct full context from disk at start.

**Why it happens:**
Designing around a "main agent that persists across phases" when `/clear` is used is a contradiction. Every phase invocation is a brand new Claude Code session with no memory of prior sessions.

**How to avoid:**
Every phase skill must be completely self-contained: read all needed state from disk at invocation start, do work, write results to disk, exit. There must be no assumptions about what the "previous agent" communicated. ralph-tools.cjs `init` command must return all context needed for the current phase in a single call.

The design must explicitly answer: "What does Phase 3 need to know, and where exactly on disk is each piece?" before implementation.

**Warning signs:**
- Phase spec says "the main agent then reads..." when there is no persistent main agent
- State passed via in-memory variables between phases
- Phase 3 assumes Phase 2's research is "still in context"
- No explicit "what does this phase read from disk at start?" section in phase spec

**Phase to address:**
Phase 1 (Core Orchestrator Architecture) — must define the `/clear`-compatible invocation model before any phase work. ralph-tools.cjs `init` contract is foundational.

---

### Pitfall 8: Phase Completion Verified by Flag, Not Content

**What goes wrong:**
Phase N is marked complete (file has `completed: true`) but its actual output is incomplete or corrupt. Phase N+1 reads this incomplete file and proceeds, generating a PRD based on half-baked research or a bead set with wrong dependencies.

**Why it happens:**
Subagents can write `completed: true` after partially completing work — e.g., a research subagent that crashed after two of four agents returned marks itself complete with partial results. Main agent sees `completed: true` and advances.

**How to avoid:**
`completed: true` must be set only after explicit self-verification by the subagent, not at the end of the instruction list. Each subagent prompt must include a "before writing completed: true, verify:" checklist with structural requirements (e.g., "research.md must contain at least one finding per agent that ran", "PRD must have at least 3 user stories with `[PRD]...[/PRD]` markers").

The main agent's spot-check after each phase should also verify structural markers, not just `completed: true`. GSD execute-phase.md encodes exactly this: "Verify first 2 files from `key-files.created` exist on disk" and "Check for `## Self-Check: FAILED` marker."

**Warning signs:**
- Subagent prompt ends with "write completed: true" without a prior self-check step
- Phase output files have `completed: true` but body is empty or a single line
- Main agent only checks `completed: true`, not structural markers in phase file
- No documented "minimum viable content" spec for each phase file

**Phase to address:**
Phase 2 (Phase Execution Pattern) — each phase's subagent prompt template must include a self-check section. ralph-tools.cjs `phase-validate <phase-file>` should encode structural minimums.

---

### Pitfall 9: Tracer Bullet Degrades to Horizontal Layering Under Time Pressure

**What goes wrong:**
The PRD is designed correctly (thin vertical slices), but bead executors under time pressure implement "US-001: create all database tables" as their first story — effectively forcing horizontal layering back into the execution. By the time US-004 runs, all DB is done, US-001 through US-003 "complete" but unverifiable end-to-end.

**Why it happens:**
Bead executors optimize for what they can easily verify locally (schema created, migration runs) over what the tracer bullet principle demands (DB + backend + frontend all working together, however minimal).

**How to avoid:**
US-001's acceptance criteria must include an explicit end-to-end verification step that cannot be satisfied by schema alone: "Verify: call `[endpoint]` and receive a response that reads from `[table]`." The PRD validator in Phase 3 must reject any US-001 that does not include a full-stack verification step.

In bead-results files, require executors to record actual verification output (API response, test run output) — not just "verified the endpoint exists."

**Warning signs:**
- US-001 acceptance criteria only mentions DB schema or migration
- US-002 depends on US-001 "schema only" and adds the first endpoint
- Verification artifacts are absent from bead-results
- Phase 6 gate shows "all beads complete" but no end-to-end working feature

**Phase to address:**
Phase 3 (PRD creation patterns) — US-001 template must mandate full-stack verification. Also Phase 4 (Headless Execution) — bead-results must require actual verification output.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Inline all phase logic in single SKILL.md | Faster initial build | 800-line file unmaintainable; phases cannot be updated independently | Never — extract to phase reference files from the start |
| Use `cat` to read state files in bash | Simple, no deps | Fragile parsing; breaks on YAML quoting | Never — use ralph-tools.cjs for all state reads |
| Mark `completed: true` without self-check | Simpler subagent prompt | Silent failures propagate through pipeline undetected | Never for critical phases |
| Hard-code agent names (security-sentinel, etc.) | Works for current setup | Breaks when compound-engineering updates or user has custom agents | MVP only — add dynamic discovery in Phase 2 |
| Assume `main` branch as review diff base | Simple git command | Breaks on feature-branch-from-develop workflows | Greenfield only — detect base branch in Phase 0 |
| Skip bead-results status convention | Faster to implement | Manual wakeup to unreadable pile of result files | Never — define format before implementing headless |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `/ralph-tui-prd` skill | Call it and assume output is in context | Skill writes output to a file; subagent must read that file location explicitly after invocation |
| `claude -p` in headless loop | Pass full PRD as inline string argument | Write PRD to a temp file; reference via Read tool path in prompt to avoid shell escaping issues |
| `bd`/`br` CLI | Pipe PRD text via stdin | Pass PRD file path as argument; CLI reads from file, not stdin |
| `git diff main...HEAD` | Hardcode `main` | Read base branch from git config or state.md; fallback to `main` only if config absent |
| compound-engineering agents | Assume agents are always available | Check agent files exist before dispatch; fail fast with actionable install instructions |
| SessionStart hook | Inject state as passive text | Parse marker actively in orchestrator entry; treat hook injection as a signal, not source of truth |
| Context7 MCP (research phase) | Call without verifying MCP is active | Pre-flight must check MCP config; gracefully degrade to web search if absent |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Research subagent aggregates full agent outputs | Phase 2 output file >50KB; Phase 3 subagent context overflow | Cap per-agent contribution to 2-3KB summary; use "key findings only" instruction | When any framework-docs agent returns full API docs |
| Orchestrator reads all phase files for verification | Orchestrator context at 40% by Phase 4 | Use ralph-tools.cjs to return only `completed` status | After 3+ phases complete |
| Parallel beads share a git working tree | Race conditions on file writes; commit conflicts | Sequential bead execution OR each bead works on disjoint files | When 2+ beads modify the same source file |
| Phase 3 PRD grows unbounded as reviewers add stories | PRD at 20KB before conversion; bd CLI truncates | Set story count soft limit (15) and hard limit (25) in Phase 3 validator | When feature scope creeps during deepening |
| Headless execution loop without turn limits | Single bead runs indefinitely, blocks all subsequent beads | Always pass `--max-turns 30` to `claude -p` | On ambiguous or blocked beads |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **State resumability:** Pipeline says it is resumable — verify by starting a run, killing it at Phase 2, then re-invoking and confirming it picks up at Phase 2, not Phase 0.
- [ ] **Compaction recovery:** Inject `current_phase: 3` into state.md, start a fresh session without state in context — confirm orchestrator reads from disk and jumps to Phase 3.
- [ ] **Skill invocation validation:** Remove `/ralph-tui-prd` skill, run Phase 3 — confirm pipeline fails with a clear error, not a `completed: true` with empty PRD.
- [ ] **Headless bead status:** Run Phase 6 headless with one intentionally broken bead — confirm the summary clearly identifies the failure, not just a text dump.
- [ ] **Open questions scan:** Put `[TBD: email provider]` in PRD after Phase 3, run Phase 4.5 and mark all questions answered — confirm Phase 5 is blocked by the remaining TBD placeholder.
- [ ] **Tracer bullet enforcement:** Write a PRD where US-001 only creates a DB schema — confirm Phase 3 validator rejects it and asks for a full-stack verification step.
- [ ] **Context budget:** Run through Phases 0-4 and check orchestrator context usage stays under 15% throughout.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| State file inconsistency | LOW | Delete corrupted phase file; re-run that phase; state.md re-advances after `completed: true` |
| Context overflow in research subagent | MEDIUM | Manually summarize phase-2-research.md to <10KB; update `completed: true`; continue pipeline |
| Skill not installed at Phase 3 | LOW | Install missing skill; re-run Phase 3 (phase file has `completed: false`); no other phases affected |
| Multiple beads failed in headless | MEDIUM | Read bead-results for `status: failed`; re-invoke Phase 6 with list of failed bead IDs; successful beads skipped |
| TBD placeholder leaked to execution | HIGH | Return to Phase 4.5; answer the deferred question; update PRD; re-run Phase 5 conversion; re-run affected beads |
| Tracer bullet built horizontally | HIGH | Discard beads from Phase 5 onward; return to Phase 3; rewrite PRD with enforced vertical-slice US-001; re-run all execution phases |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Fat orchestrator (context bloat) | Phase 1: Core Orchestrator | Measure orchestrator context % after Phase 4 completes |
| State file ambiguity | Phase 1: Core Orchestrator | Test forced-incomplete phase recovery |
| Compaction drops thread | Phase 1: Core Orchestrator | Test fresh-session resume with disk state only |
| Skill invocation without output validation | Phase 0: Pre-flight + Phase 2: Skill Layer | Run pipeline with missing skill; confirm blocking error |
| Open questions leaking to execution | Phase 3: Phase 4.5 Logic | TBD-in-PRD test blocks Phase 5 |
| Headless execution without exit codes | Phase 4: Headless Execution | Broken bead test shows clear failure summary |
| /clear breaks persistent-orchestrator assumption | Phase 1: Core Orchestrator | Verify each phase is fully self-contained from disk state |
| Completion verified by flag not content | Phase 2: Phase Execution Pattern | Corrupt phase file with `completed: true`; confirm main agent rejects structurally empty file |
| Tracer bullet degrades to horizontal layering | Phase 3: PRD Creation Patterns | US-001 without full-stack verification is rejected by validator |

---

## Sources

- `/Users/constantin/Code/skills/ralph-pipeline/SKILL.md` — existing system (context-accumulating single-session model, 9-phase design)
- `/Users/constantin/Code/skills/ralph-pipeline/.planning/codebase/CONCERNS.md` — prior concerns audit (state machine fragility, context overflow, compaction hook fragility, headless execution gaps)
- `/Users/constantin/Code/skills/ralph-pipeline/.planning/codebase/ARCHITECTURE.md` — orchestration pattern analysis
- `/Users/constantin/.claude/get-shit-done/workflows/execute-phase.md` — GSD execute-phase patterns (lean orchestrator, spot-checks, classifyHandoffIfNeeded false failure, fresh-agent checkpoint continuations)
- `/Users/constantin/Code/skills/ralph-pipeline/.planning/PROJECT.md` — ralph-gsd design intent and constraints

---
*Pitfalls research for: multi-phase AI coding orchestration with context-isolated CLI pipelines*
*Researched: 2026-02-25*
