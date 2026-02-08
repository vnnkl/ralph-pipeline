---
name: ralph-pipeline
description: "Orchestrates the full Ralph Loop workflow from idea to shipped code. Chains existing skills through 9 phases: dependency check, codemap orientation, clarification, parallel research, PRD creation with tracer bullet structure, plan deepening, beads/json conversion, manual ralph-tui execution, compound review, and learning harvest. Supports resumability via disk state in .claude/pipeline/, auto-installs missing dependencies, and uses AskUserQuestion gates between phases. Survives context compaction by persisting all phase outputs and decisions to disk. Use when starting a new feature end-to-end, running a full planning-to-review cycle, or resuming an in-progress pipeline. Triggers on: ralph pipeline, full loop, end to end plan, pipeline, run the full loop."
---

# Ralph Pipeline - Full Loop Orchestrator

Chain the complete Ralph workflow from idea to shipped, reviewed, harvested code.

**Note: The current year is 2026.**

## Flow Overview

```
[PRE. DEPS]    ← Check/install missing skills, plugins, CLIs, git init
      ↓
[0. ORIENT]    ← Codemap: generate or refresh docs/CODEMAPS/
      ↓
[1. CLARIFY]   ← Scope, stack, gates, agent selection, /last30days?
      ↓
[2. RESEARCH]  ← Parallel agents + codemaps + optional last30days
      ↓
[3. CREATE PRD] ← /ralph-tui-prd with tracer bullet structure
      ↓
[4. DEEPEN]    ← Selected review agents against PRD
      ↓          ← GATE: refine or proceed?
[4.5 RESOLVE]  ← Resolve all open questions before conversion
      ↓
[5. CONVERT]   ← beads (bd/br) or prd.json
      ↓
[6. PAUSE]     ← Manual ralph-tui execution
      ↓          ← GATE: done running?
[7. REVIEW]    ← Compound review with selected agents
      ↓          ← GATE: fix P1s or proceed?
[8. HARVEST]   ← /harvest + final codemap refresh
```

---

## State Management (Compaction-Resilient)

All pipeline state persists to `.claude/pipeline/` so that context compaction never loses progress.

### State Directory Structure

```
.claude/pipeline/
├── state.md                  ← current phase, user choices, feature name
├── open-questions.md         ← unresolved questions from any phase
├── phase-0-orient.md         ← codemap summaries
├── phase-1-clarify.md        ← user answers, agent selections, quality gates
├── phase-2-research.md       ← aggregated research findings
├── phase-3-prd.md            ← the PRD text
├── phase-4-deepen.md         ← review insights + enhanced PRD
├── phase-4.5-resolve.md      ← question resolution record
├── phase-5-convert.md        ← format choice, file paths, validation
├── phase-7-review.md         ← P1/P2/P3 findings
└── phase-8-harvest.md        ← harvest summary
```

### state.md Format

```yaml
---
feature: "user authentication system"
current_phase: 2
started: 2026-02-08
project_type: existing
tech_stack: "Node/TypeScript"
quality_gates: "bun test && bun run typecheck"
research_agents: [repo-research-analyst, best-practices-researcher, framework-docs-researcher]
review_agents: [security-sentinel, architecture-strategist, code-simplicity-reviewer]
convert_format: null
has_frontend: true
last30days_ran: false
open_questions_resolved: false
---
```

### Phase File Format

Every phase file has YAML frontmatter with a `completed` flag:

```yaml
---
phase: 2
name: research
completed: true
---
## Research Summary
...actual phase output...
```

### Phase Protocol (EVERY phase must follow this)

1. **Read** `state.md` — know current phase + all prior decisions
2. **Read** previous phase file — verify its `completed: true`
3. **Write** this phase's file with `completed: false`
4. Do the work; append questions to `open-questions.md` if any arise
5. **Update** phase file with results + `completed: true`
6. **Update** `state.md` → increment `current_phase`
7. Gate → AskUserQuestion → next phase

**After compaction:** Read `state.md` for current phase. Read the phase file for that phase. If `completed: false` → re-run the phase. If `completed: true` → proceed to next.

### open-questions.md Format

Agents in any phase can append questions here:

```markdown
# Open Questions

- [ ] Which email provider? (SendGrid, Postmark, SES) — from: phase-2-research
- [ ] Deployment target? (Vercel, Fly, Railway) — from: phase-3-prd
- [ ] S3 provider for file storage? — from: phase-3-prd
```

These are resolved as a blocking gate in Phase 4.5 (before conversion).

---

## Resumability

**Primary method: Read `.claude/pipeline/state.md`.**

On invocation:
1. Check if `.claude/pipeline/state.md` exists
2. If yes → read it, read the phase file for `current_phase`, check `completed`
3. If `completed: false` → offer to re-run that phase
4. If `completed: true` → offer to proceed to next phase
5. AskUserQuestion: "Resume at Phase [N], or start from scratch?"

**Fallback (no state.md):** Detect state from filesystem:

| Condition | Resume At |
|-----------|-----------|
| No codemaps, no PRD | Phase 0 |
| Codemaps exist, no PRD | Phase 1 |
| PRD exists, no beads/json | Phase 5 |
| Beads/json exist with open items | Phase 6 |
| All beads closed | Phase 7 |
| Review done | Phase 8 |

**Detection:** Check `docs/CODEMAPS/`, `plans/*.md` for `[PRD]...[/PRD]`, `prd.json` or `tasks/*.json`, beads status, git log for review artifacts.

Announce detected state. AskUserQuestion: "Resume at Phase [N], or start from scratch?"

---

## Pre-flight: Dependency Check + Git Init + Compact Hook

See [references/dependencies.md](references/dependencies.md) for full dependency table.

**Quick check:**
```bash
ls ~/.claude/skills/ralph-tui-prd/SKILL.md 2>/dev/null
ls ~/.claude/skills/compound-agents/ 2>/dev/null
ls ~/.claude/skills/last30days/SKILL.md 2>/dev/null
which ralph-tui 2>/dev/null; which bd 2>/dev/null; which br 2>/dev/null
```

- Missing ralph-tui skills → `bunx add-skill subsy/ralph-tui --all`
- Missing last30days → `git clone https://github.com/mvanhorn/last30days-skill ~/.claude/skills/last30days`
- Missing plugins → warn with install instructions (manual install required)
- Missing CLIs → warn, offer json path as fallback

### Auto Git Init

Check if inside a git repo:
```bash
git rev-parse --is-inside-work-tree 2>/dev/null
```

If not a git repo:
1. Run `git init`
2. Create `.gitignore` if missing — include `.claude/pipeline/` in it
3. If `.gitignore` exists, append `.claude/pipeline/` if not already present
4. Stage and commit: `git add -A && git commit -m "chore: initial project setup"`

### Register Compact Hook

Create `.claude/settings.json` in the project root (or merge into existing) with a hook that re-injects pipeline state after compaction:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "if [ -f .claude/pipeline/state.md ]; then echo '--- RALPH PIPELINE STATE (re-injected after compaction) ---'; cat .claude/pipeline/state.md; PHASE=$(grep 'current_phase:' .claude/pipeline/state.md | awk '{print $2}'); PREV=$((PHASE - 1)); PFILE=$(ls .claude/pipeline/phase-${PREV}-*.md 2>/dev/null | head -1); if [ -n \"$PFILE\" ]; then echo '--- Previous phase output ---'; cat \"$PFILE\"; fi; QFILE=.claude/pipeline/open-questions.md; if [ -f \"$QFILE\" ] && grep -q '\\- \\[ \\]' \"$QFILE\"; then echo '--- OPEN QUESTIONS (must resolve before Phase 5) ---'; cat \"$QFILE\"; fi; fi"
          }
        ]
      }
    ]
  }
}
```

This injects after every compaction: state.md + previous phase output + any unresolved open questions.

### Create State Directory

```bash
mkdir -p .claude/pipeline
```

Initialize `state.md` with feature name (from user prompt or ask), `current_phase: 0`, and `started: [today]`.

---

## Phase 0: Orient (Codemap)

**Goal:** Understand existing codebase. Skip for greenfield.

**State protocol:**
1. Read `.claude/pipeline/state.md`
2. Write `.claude/pipeline/phase-0-orient.md` with `completed: false`
3. Do the work:
   - Check `docs/CODEMAPS/` or `codemaps/` exists
   - If stale (>24h) or missing → invoke `/update-codemaps`
   - If no project code → note "greenfield" and skip
   - Store codemap content summary in phase file
4. Update `phase-0-orient.md` with results + `completed: true`
5. Update `state.md` → `current_phase: 1`

---

## Phase 1: Clarification

Three rounds via AskUserQuestion.

**State protocol:**
1. Read `.claude/pipeline/state.md` + `phase-0-orient.md`
2. Write `.claude/pipeline/phase-1-clarify.md` with `completed: false`
3. Do the work (three rounds below)
4. Update `phase-1-clarify.md` with all answers + `completed: true`
5. Update `state.md` → `current_phase: 2`, plus `project_type`, `tech_stack`, `quality_gates`, `research_agents`, `review_agents`, `has_frontend`, `last30days_ran`

**Round 1 — Scope & Stack:**
- Feature description (free text)
- Greenfield vs existing vs fork/template
- Tech stack (if not obvious from codemaps)
- Quality gates (what commands must pass per story)
- For existing projects, auto-add gate: "refresh codemaps before task commit"

**Round 1b — Optional /last30days:**
```
AskUserQuestion: "Research recent community discussion on [topic] via /last30days?"
  A. Yes - research on Reddit/X/web (Recommended for unfamiliar domains)
  B. No - skip
```
If yes → `/last30days [topic]`, store results for Phase 2.

**Round 2 — Agent Selection (multiSelect: true):**

Discover agents first:
```bash
ls ~/.claude/skills/compound-agents/research/ 2>/dev/null
ls ~/.claude/skills/compound-agents/review/ 2>/dev/null
ls .claude/agents/ 2>/dev/null
```

Present two multi-select questions:
- Research agents for Phase 2: repo-research-analyst, best-practices-researcher, framework-docs-researcher, learnings-researcher
- Review agents for Phases 4 & 7: security-sentinel, architecture-strategist, code-simplicity-reviewer, performance-oracle

Also list any Task subagent_types and project-local agents.

**Round 3 — Scope Boundaries (if needed):**
Only for large/ambiguous features. If >10 stories, suggest splitting.

---

## Phase 2: Research

**State protocol:**
1. Read `.claude/pipeline/state.md` + `phase-1-clarify.md`
2. Write `.claude/pipeline/phase-2-research.md` with `completed: false`
3. Launch agents, aggregate results, append questions to `open-questions.md`
4. Update `phase-2-research.md` with summary + `completed: true`
5. Update `state.md` → `current_phase: 3`

Launch user-selected research agents as **parallel Task calls**:

```
Task repo-research-analyst: "Analyze repository architecture, conventions,
similar implementations, testing patterns.
Codemap context: [from Phase 0]
Focus: [feature from Phase 1]"

Task best-practices-researcher: "Research best practices for [tech/pattern].
[Include /last30days results if gathered]"

Task framework-docs-researcher: "Find docs for [framework/APIs needed].
Use Context7 MCP for official docs."
```

Optional (if selected): learnings-researcher, git-history-analyzer.

Aggregate into research summary. **If agents surface unresolved questions** (e.g. "which email provider?", "what deployment target?"), append them to `.claude/pipeline/open-questions.md`.

---

## Phase 3: Create PRD (Tracer Bullet Structure)

**State protocol:**
1. Read `.claude/pipeline/state.md` + `phase-2-research.md`
2. Write `.claude/pipeline/phase-3-prd.md` with `completed: false`
3. Invoke `/ralph-tui-prd`, validate, append questions to `open-questions.md`
4. Update `phase-3-prd.md` with PRD text + `completed: true`
5. Update `state.md` → `current_phase: 4`

Invoke `/ralph-tui-prd` with research + codemaps + this critical instruction:

**Tracer Bullet Story Ordering (from The Pragmatic Programmer):**

Write code that gets you feedback as quickly as possible. Build a tiny end-to-end slice first, confirm it works, then expand outward from there.

**Ordering principle — every feature grows layer by layer:**
1. **US-001 = tracer bullet** — tiniest DB change → backend endpoint that uses it → frontend that calls it. Must be testable end-to-end.
2. Each subsequent story expands on the working tracer: add a column → add a service method → add a UI element. Always DB → backend → frontend order within a story.
3. After each story completes, the feature works — just with less functionality. Every story leaves the system in a working, demoable state.
4. NEVER horizontal layers (all DB first → all API next → all UI last). This delays feedback and hides integration issues.
5. Each story sized for one ralph-tui iteration.

**Dependency flow:** stories depend on the prior story's working slice, not on a shared "infrastructure" story. US-001 has no dependencies. US-002 depends on US-001. And so on.

**Frontend Design in UI Stories:**
Any story that includes frontend/UI work must invoke `/frontend-design` for its UI portion before implementation. This is not a separate story — it's an instruction embedded in each story that touches UI:
- The story's acceptance criteria should include: "UI designed via /frontend-design before implementation"
- `/frontend-design` output for that story becomes context for its own implementation
- This follows the tracer bullet pattern: each story handles its own DB → backend → frontend slice, including the design step for its UI portion

**Validate PRD output:**
- [ ] `[PRD]...[/PRD]` markers present
- [ ] Quality Gates section exists
- [ ] US-001 is a tracer bullet (tiniest DB → backend → frontend slice)
- [ ] Stories grow the feature incrementally — each leaves the system working
- [ ] No horizontal layering (never all-DB-first or all-API-first)
- [ ] Dependencies are sequential (US-002 → US-001, US-003 → US-002, etc.)
- [ ] If frontend work exists, each UI story includes `/frontend-design` in its acceptance criteria

Fix inline if validation fails.

**If the PRD raises unresolved decisions** (e.g. deployment target, storage provider, domain name), append them to `.claude/pipeline/open-questions.md`.

---

## Phase 4: Deepen Plan

**State protocol:**
1. Read `.claude/pipeline/state.md` + `phase-3-prd.md`
2. Write `.claude/pipeline/phase-4-deepen.md` with `completed: false`
3. Launch review agents, incorporate feedback, append questions to `open-questions.md`
4. Update `phase-4-deepen.md` with enhanced PRD + `completed: true`
5. Update `state.md` → `current_phase: 4.5`

Launch user-selected review agents **in parallel** against PRD text:

```
Task architecture-strategist: "Review PRD architecture.
IMPORTANT: Confirm tracer bullet ordering — each story builds DB → backend → frontend
in the smallest possible increment. No horizontal layering. Each story leaves the
system in a working state. Flag: coupling issues, missing layers, scaling concerns.
[PRD text]"

Task security-sentinel: "Review PRD for security concerns. [PRD text]"
Task code-simplicity-reviewer: "Review for over-engineering. [PRD text]"
Task performance-oracle: "Review performance implications. [PRD text]"
```

Incorporate feedback into PRD stories. Add stories if gaps found.

**GATE:**
```
AskUserQuestion: "Plan deepened with [N] insights. What next?"
  A. Proceed to open questions resolution (Recommended)
  B. Refine PRD - address specific feedback
  C. Run another round of review agents
  D. Show me the full enhanced PRD
```

---

## Phase 4.5: Resolve Open Questions

**This is a BLOCKING gate before conversion.** No unresolved questions may leak into execution.

**State protocol:**
1. Read `.claude/pipeline/state.md` + `.claude/pipeline/open-questions.md`
2. Write `.claude/pipeline/phase-4.5-resolve.md` with `completed: false`
3. Present questions, record answers, update PRD
4. Update `phase-4.5-resolve.md` with resolution record + `completed: true`
5. Update `state.md` → `current_phase: 5`, `open_questions_resolved: true`

**Resolution process:**
1. Read `open-questions.md`
2. If any unchecked `- [ ]` items exist:
   - Present each to user via AskUserQuestion (batch related questions)
   - Record answers in `phase-4.5-resolve.md`
   - Update the PRD (`phase-3-prd.md` or `phase-4-deepen.md`) with answers
   - Mark questions as `- [x]` in `open-questions.md`
3. If no unchecked items → mark resolved and proceed
4. Set `open_questions_resolved: true` in `state.md`
5. Only then proceed to Phase 5

---

## Phase 5: Convert

**State protocol:**
1. Read `.claude/pipeline/state.md` — verify `open_questions_resolved: true`
2. If `open_questions_resolved` is false or missing → run Phase 4.5 first
3. Write `.claude/pipeline/phase-5-convert.md` with `completed: false`
4. Convert, validate
5. Update `phase-5-convert.md` with format + file paths + `completed: true`
6. Update `state.md` → `current_phase: 6`, `convert_format: [choice]`

**GATE — Choose Format:**
```
AskUserQuestion: "Convert PRD to which format?"
  A. beads via bd (Go CLI) (Recommended if bd installed)
  B. beads via br (Rust CLI)
  C. prd.json (no CLI needed)
```

Invoke matching skill:
- **bd** → `/ralph-tui-create-beads`
- **br** → `/ralph-tui-create-beads-rust`
- **json** → `/ralph-tui-create-json`

**Validate:** item count matches stories, dependencies set, US-001 has no dependencies, quality gates in acceptance criteria.

---

## Phase 6: Pause for Manual Execution

Display exact command:
```
ralph-tui run [--tracker <tracker> --epic <epic-id> | --prd ./prd.json]
```

**Tracer Bullet Reminder:** After US-001 completes, verify the end-to-end path works (DB → backend → frontend) before expanding in subsequent stories.

**Codemap Reminder:** Codemaps refreshed via quality gates before each task commit.

**GATE:**
```
AskUserQuestion: "How did ralph-tui execution go?"
  A. All tasks passed - ready for review
  B. Some tasks failed - need fixes
  C. Tracer bullet (US-001) failed - need to replan
  D. Want to add more stories
  E. Skip to harvest
```
- A → Phase 7
- B → discuss failures, re-run specific tasks
- C → return to Phase 3 with lessons learned
- D → Phase 3 to add, Phase 5 to convert
- E → Phase 8

---

## Phase 7: Compound Review

**State protocol:**
1. Read `.claude/pipeline/state.md`
2. Write `.claude/pipeline/phase-7-review.md` with `completed: false`
3. Run review agents, categorize findings
4. Update `phase-7-review.md` with findings + `completed: true`
5. Update `state.md` → `current_phase: 8`

Run review agents from Phase 1 **in parallel** against full diff:

```bash
git diff main...HEAD
```

```
Task security-sentinel: "Security review: [diff]"
Task architecture-strategist: "Architecture review: [diff]"
Task code-simplicity-reviewer: "Simplicity review: [diff]"
Task performance-oracle: "Performance review: [diff]"
```

Categorize findings: **P1** (must fix), **P2** (should fix), **P3** (nice-to-have).

**GATE:**
```
AskUserQuestion: "Review complete. [N] P1, [M] P2, [K] P3. What next?"
  A. Fix P1 critical issues (Recommended if P1 > 0)
  B. Fix P1 + P2 issues
  C. Skip fixes - proceed to harvest
  D. Re-run review after fixes
  E. Create PR now
```

---

## Phase 8: Harvest Learnings

**State protocol:**
1. Read `.claude/pipeline/state.md`
2. Write `.claude/pipeline/phase-8-harvest.md` with `completed: false`
3. Harvest + codemap refresh
4. Update `phase-8-harvest.md` with summary + `completed: true`
5. Update `state.md` → `current_phase: done`

1. Invoke `/choo-choo-ralph:harvest`
2. Invoke `/update-codemaps` for final refresh

**GATE:**
```
AskUserQuestion: "Pipeline complete. What next?"
  A. Review harvested learnings
  B. Create PR (if not done in Phase 7)
  C. Start another pipeline run
  D. Done - wrap up
```

---

## Key Principles

1. **Chain, don't reimplement** — invoke existing skills, don't duplicate logic
2. **Tracer bullet ordering** — build the tiniest DB → backend → frontend slice first, confirm it works, then expand. Every story leaves the system working.
3. **Never horizontal layers** — never build all DB first, then all API, then all UI. Each story touches all layers in the smallest increment.
4. **Codemaps as context** — agents understand existing code without re-exploring
5. **Gates between phases** — user controls pace and direction
6. **Parallel agents** — launch independent Task calls simultaneously
7. **Resumable via disk state** — `.claude/pipeline/state.md` is the source of truth; survives compaction
8. **No unresolved questions past Phase 4.5** — all decisions locked before conversion
9. **Every phase writes completion markers** — `completed: true/false` in YAML frontmatter
