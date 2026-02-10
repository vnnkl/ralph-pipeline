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
[6. EXECUTE]   ← Manual or headless bead execution
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

### Orchestration Model: Thin Main Agent + Subagent Per Phase

**The main agent is a lightweight orchestrator.** It does NOT do phase work itself. Instead it:

1. Reads `state.md` to know current phase
2. Spawns a **Task subagent** for the current phase, passing only the files that phase needs
3. Waits for the subagent to finish
4. Verifies the phase output file exists and has `completed: true`
5. Runs the user gate (AskUserQuestion)
6. Moves to next phase

**Why:** Research, PRD creation, deepening, and review phases generate massive context. Running them all in the main agent overflows the context window. Subagents get a fresh context per phase and only the files they need.

**Exception:** Phase 1 (Clarify) stays in the main agent because it requires interactive AskUserQuestion rounds.

### Subagent Dispatch Pattern

For each phase, the main agent does:

```
1. Read .claude/pipeline/state.md
2. Read the previous phase file (verify completed: true)
3. Spawn Task subagent:
   - subagent_type: "general-purpose"
   - prompt: phase instructions + "Read these files for context: [list]"
   - The subagent reads its input files, does the work, writes its output file
4. After subagent returns:
   - Read the phase output file, verify completed: true
   - Update state.md → increment current_phase
   - Run the gate (AskUserQuestion)
```

### What Each Subagent Receives

| Phase | Input files | Output file |
|-------|------------|-------------|
| 0 Orient | state.md | phase-0-orient.md |
| 2 Research | state.md, phase-1-clarify.md, phase-0-orient.md | phase-2-research.md |
| 3 PRD | state.md, phase-2-research.md, phase-0-orient.md | phase-3-prd.md |
| 4 Deepen | state.md, phase-3-prd.md | phase-4-deepen.md |
| 4.5 Resolve | state.md, open-questions.md, phase-4-deepen.md | phase-4.5-resolve.md |
| 5 Convert | state.md, phase-3-prd.md (or phase-4-deepen.md) | phase-5-convert.md |
| 7 Review | state.md, git diff | phase-7-review.md |
| 8 Harvest | state.md | phase-8-harvest.md |

### Phase Protocol (subagent version)

Each subagent follows this protocol:

1. **Read** its input files (passed in the prompt)
2. **Write** this phase's output file with `completed: false`
3. Do the work; append questions to `open-questions.md` if any arise
4. **Update** output file with results + `completed: true`
5. Return a brief summary to the main agent

The **main agent** then:
6. **Update** `state.md` → increment `current_phase`
7. Gate → AskUserQuestion → next phase

**After compaction:** Read `state.md` for current phase. Read the phase file for that phase. If `completed: false` → re-spawn the subagent. If `completed: true` → proceed to next.

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
2. Create or update `.gitignore` (see below)
3. Stage and commit: `git add -A && git commit -m "chore: initial project setup"`

If already a git repo, still ensure `.gitignore` has the required entries.

**`.gitignore` — ensure these entries exist** (append any that are missing):
```
# Ralph Pipeline state (regenerated each run)
.claude/pipeline/

# Ralph TUI iterations (large, generated)
.ralph-tui/iterations/

# OS
.DS_Store
Thumbs.db

# Editor
.vscode/
.idea/
*.swp
*.swo

# Environment
.env
.env.local
.env.*.local

# Dependencies
node_modules/

# Build
dist/
build/
.next/
```

### Initialize ralph-tui

If `.ralph-tui/config.toml` does not exist, create it with the default config:

```bash
mkdir -p .ralph-tui
```

```toml
# .ralph-tui/config.toml
# Ralph TUI Configuration
# Generated by ralph-pipeline pre-flight

configVersion = "2.1"
tracker = "beads"
agent = "claude"
maxIterations = 10
autoCommit = true

[trackerOptions]
beadsDir = ".beads"
labels = ""

[agentOptions]
```

If `.ralph-tui/config.toml` already exists, skip — don't overwrite user's config.

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

**Main agent dispatches:**
```
Task (general-purpose): "You are running Phase 0 (Orient) of a ralph-pipeline.

Read .claude/pipeline/state.md for context.

Your job:
1. Write .claude/pipeline/phase-0-orient.md with completed: false
2. Check if docs/CODEMAPS/ or codemaps/ exists
3. If stale (>24h) or missing → run /update-codemaps
4. If no project code → note 'greenfield' and skip
5. Store codemap content summary in phase-0-orient.md
6. Update phase-0-orient.md with completed: true
7. Return a 1-2 sentence summary of what you found"
```

**Main agent after subagent returns:**
- Verify `phase-0-orient.md` has `completed: true`
- Update `state.md` → `current_phase: 1`

---

## Phase 1: Clarification (runs in main agent)

**Exception:** This phase stays in the main agent because it requires multiple interactive AskUserQuestion rounds.

Three rounds via AskUserQuestion.

**Protocol:**
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

**Main agent dispatches:**
```
Task (general-purpose): "You are running Phase 2 (Research) of a ralph-pipeline.

Read these files for context:
- .claude/pipeline/state.md
- .claude/pipeline/phase-1-clarify.md
- .claude/pipeline/phase-0-orient.md

Your job:
1. Write .claude/pipeline/phase-2-research.md with completed: false
2. Launch the research agents listed in state.md (research_agents field) as parallel Task calls:
   - repo-research-analyst: analyze repo architecture, conventions, testing patterns
   - best-practices-researcher: research best practices for the tech/pattern
   - framework-docs-researcher: find docs for frameworks/APIs needed (use Context7 MCP)
   - Any others listed in state.md
3. Aggregate all agent results into a research summary
4. If agents surface unresolved questions, append them to .claude/pipeline/open-questions.md
5. Write the summary to phase-2-research.md with completed: true
6. Return a 2-3 sentence summary of key findings"
```

**Main agent after subagent returns:**
- Verify `phase-2-research.md` has `completed: true`
- Update `state.md` → `current_phase: 3`

---

## Phase 3: Create PRD (Tracer Bullet Structure)

**Main agent dispatches:**
```
Task (general-purpose): "You are running Phase 3 (Create PRD) of a ralph-pipeline.

Read these files for context:
- .claude/pipeline/state.md
- .claude/pipeline/phase-2-research.md
- .claude/pipeline/phase-0-orient.md

Your job:
1. Write .claude/pipeline/phase-3-prd.md with completed: false
2. Invoke /ralph-tui-prd with the research findings and codemap context
3. Follow the tracer bullet ordering rules below — each story is a thin vertical slice (DB → backend → frontend), and each must be verified end-to-end before the next one starts. Include a verification step in every story's acceptance criteria.
4. CRITICAL: Every story that touches frontend/UI MUST have as its FIRST instruction: 'Run /frontend-design for this story's UI before implementation'. This is non-negotiable — include it in the story description, not just acceptance criteria.
5. For any story that involves browser testing or visual verification, add instruction: 'Use agent-browser (https://github.com/vercel-labs/agent-browser) for browser-based testing'
6. Validate the PRD output (checklist below)
7. If the PRD raises unresolved decisions, append to .claude/pipeline/open-questions.md
8. Write the PRD to phase-3-prd.md with completed: true
9. Return the PRD story count and a 1-2 sentence summary"
```

**Main agent after subagent returns:**
- Verify `phase-3-prd.md` has `completed: true`
- Update `state.md` → `current_phase: 4`

Subagent must follow this critical instruction:

**Tracer Bullet Story Ordering (from The Pragmatic Programmer):**

Build → test → feedback → iterate. Build a tiny end-to-end slice, verify it works, then expand. Never outrun your headlights.

**Ordering principle — every feature grows layer by layer:**
1. **US-001 = tracer bullet** — tiniest DB change → backend endpoint that uses it → frontend that calls it. Must be testable end-to-end.
2. Each subsequent story expands on the working tracer: add a column → add a service method → add a UI element. Always DB → backend → frontend order within a story.
3. **Verify after every story** — each story must be tested end-to-end before the next one starts. Don't build US-002 on an unverified US-001. The whole point is early feedback.
4. After each story completes, the feature works — just with less functionality. Every story leaves the system in a working, demoable state.
5. NEVER horizontal layers (all DB first → all API next → all UI last). This delays feedback and hides integration issues.
6. Each story sized for one ralph-tui iteration.

**Dependency flow:** stories depend on the prior story's working slice, not on a shared "infrastructure" story. US-001 has no dependencies. US-002 depends on US-001. And so on.

**Frontend Design in UI Stories (CRITICAL — must not be omitted):**
Any story that includes frontend/UI work MUST have `/frontend-design` as its **FIRST instruction** in the story description — not buried in acceptance criteria. The pattern:
- Story description starts with: "**First:** Run `/frontend-design` for this story's UI portion."
- The `/frontend-design` output becomes context for implementation
- This follows the tracer bullet pattern: each story handles its own DB → backend → frontend slice, with the design step happening first for its UI portion

**Browser Testing with agent-browser:**
Any story that involves browser-based testing, visual verification, or E2E checks should use `agent-browser` (https://github.com/vercel-labs/agent-browser) as the preferred tool. Include in story instructions: "Use agent-browser for browser testing."

**Validate PRD output:**
- [ ] `[PRD]...[/PRD]` markers present
- [ ] Quality Gates section exists
- [ ] US-001 is a tracer bullet (tiniest DB → backend → frontend slice)
- [ ] Stories grow the feature incrementally — each leaves the system working
- [ ] No horizontal layering (never all-DB-first or all-API-first)
- [ ] Dependencies are sequential (US-002 → US-001, US-003 → US-002, etc.)
- [ ] Every story includes end-to-end verification in its AC (verify the slice works before moving on)
- [ ] If frontend work exists, each UI story has `/frontend-design` as its FIRST instruction (not just in AC)
- [ ] If browser testing needed, stories reference agent-browser as the preferred tool

Fix inline if validation fails.

**If the PRD raises unresolved decisions** (e.g. deployment target, storage provider, domain name), append them to `.claude/pipeline/open-questions.md`.

---

## Phase 4: Deepen Plan

**Main agent dispatches:**
```
Task (general-purpose): "You are running Phase 4 (Deepen) of a ralph-pipeline.

Read these files for context:
- .claude/pipeline/state.md (check review_agents field)
- .claude/pipeline/phase-3-prd.md

Your job:
1. Write .claude/pipeline/phase-4-deepen.md with completed: false
2. Launch the review agents listed in state.md (review_agents field) as parallel Task calls against the PRD:
   - architecture-strategist: confirm tracer bullet ordering, flag coupling/scaling
   - security-sentinel: review for security concerns
   - code-simplicity-reviewer: review for over-engineering
   - performance-oracle: review performance implications
3. Incorporate feedback into the PRD. Add stories if gaps found.
4. If agents surface unresolved questions, append to .claude/pipeline/open-questions.md
5. Write enhanced PRD to phase-4-deepen.md with completed: true
6. Return: number of insights, number of new questions, summary"
```

**Main agent after subagent returns:**
- Verify `phase-4-deepen.md` has `completed: true`
- Update `state.md` → `current_phase: 4.5`

**GATE (main agent runs this):**
```
AskUserQuestion: "Plan deepened with [N] insights. What next?"
  A. Proceed to open questions resolution (Recommended)
  B. Refine PRD - address specific feedback
  C. Run another round of review agents
  D. Show me the full enhanced PRD
```

---

## Phase 4.5: Resolve Open Questions (runs in main agent)

**Exception:** This phase stays in the main agent because it requires interactive AskUserQuestion rounds.

**This is a BLOCKING gate before conversion.** No unresolved questions may leak into execution.

**Protocol:**
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

**Main agent first checks** `state.md` for `open_questions_resolved: true`. If false → run Phase 4.5 first.

**GATE (main agent runs this):**
```
AskUserQuestion: "Convert PRD to which format?"
  A. beads via bd (Go CLI) (Recommended if bd installed)
  B. beads via br (Rust CLI)
  C. prd.json (no CLI needed)
```

**Main agent dispatches after user chooses format:**
```
Task (general-purpose): "You are running Phase 5 (Convert) of a ralph-pipeline.

Read these files for context:
- .claude/pipeline/state.md
- .claude/pipeline/phase-3-prd.md (or phase-4-deepen.md if it exists)

Your job:
1. Write .claude/pipeline/phase-5-convert.md with completed: false
2. Invoke the matching skill: [bd → /ralph-tui-create-beads, br → /ralph-tui-create-beads-rust, json → /ralph-tui-create-json]
3. Validate: item count matches stories, dependencies set, US-001 has no deps, quality gates in acceptance criteria
4. Write format choice + file paths to phase-5-convert.md with completed: true
5. Return: format used, number of items created, file paths"
```

**Main agent after subagent returns:**
- Verify `phase-5-convert.md` has `completed: true`
- Update `state.md` → `current_phase: 6`, `convert_format: [choice]`

---

## Phase 6: Execute Beads

**GATE — Choose Execution Mode:**
```
AskUserQuestion: "How do you want to execute the beads?"
  A. Manual - run ralph-tui yourself (Recommended for interactive work)
  B. Headless - each bead runs in its own Claude session (fresh context per bead, good for overnight/batch)
  C. Skip to review
```

### Option A: Manual Execution

Display exact command:
```
ralph-tui run [--tracker <tracker> --epic <epic-id> | --prd ./prd.json]
```

### Option B: Headless Execution

Each bead gets its own `claude -p` invocation with a fresh context window — no context limit issues across beads.

**Generate and run the headless script:**

For **beads (bd/br)** format — read bead files from the tracker:
```bash
# Detect bead files from Phase 5 output
BEAD_DIR=$(grep 'bead_dir:' .claude/pipeline/phase-5-convert.md | awk '{print $2}')

for bead_file in "$BEAD_DIR"/*.md; do
  BEAD_NAME=$(basename "$bead_file" .md)
  echo "=== Executing bead: $BEAD_NAME ==="
  claude -p "You are executing a single bead from a ralph-pipeline run.

Read .claude/pipeline/state.md for project context.
Read .claude/pipeline/phase-3-prd.md for the full PRD.
Read $bead_file for this bead's requirements and acceptance criteria.

Execute the bead:
1. If this bead has frontend/UI work, run /frontend-design FIRST before implementation
2. Implement the feature described in the bead
3. If browser testing is needed, use agent-browser (https://github.com/vercel-labs/agent-browser)
4. Run quality gates after implementation
5. Verify the end-to-end path works (DB → backend → frontend) — don't just check that code compiles, confirm the slice actually functions
6. Commit with a conventional commit message referencing the bead
7. Write a brief completion summary to .claude/pipeline/bead-results/${BEAD_NAME}.md including verification result

If you hit a blocker or verification fails, write the blocker to .claude/pipeline/bead-results/${BEAD_NAME}.md and stop. Do NOT proceed to the next bead on a broken slice." \
    --allowedTools "Edit,Read,Write,Bash,Grep,Glob" \
    --max-turns 30
  echo "=== Bead $BEAD_NAME complete ==="
done
```

For **prd.json** format — iterate over stories:
```bash
STORIES=$(cat prd.json | jq -r '.user_stories[].id')

for story in $STORIES; do
  STORY_TITLE=$(cat prd.json | jq -r ".user_stories[] | select(.id == \"$story\") | .title")
  echo "=== Executing story: $story - $STORY_TITLE ==="
  claude -p "You are executing a single user story from a ralph-pipeline run.

Read .claude/pipeline/state.md for project context.
Read .claude/pipeline/phase-3-prd.md for the full PRD.

Execute story $story from prd.json:
$(cat prd.json | jq ".user_stories[] | select(.id == \"$story\")")

Steps:
1. If this story has frontend/UI work, run /frontend-design FIRST before implementation
2. Implement the feature described in the story
3. If browser testing is needed, use agent-browser (https://github.com/vercel-labs/agent-browser)
4. Run quality gates after implementation
5. Verify the end-to-end path works (DB → backend → frontend) — don't just check that code compiles, confirm the slice actually functions
6. Commit with a conventional commit message referencing $story
7. Write a brief completion summary to .claude/pipeline/bead-results/${story}.md including verification result

If you hit a blocker or verification fails, write the blocker to .claude/pipeline/bead-results/${story}.md and stop. Do NOT proceed to the next story on a broken slice." \
    --allowedTools "Edit,Read,Write,Bash,Grep,Glob" \
    --max-turns 30
  echo "=== Story $story complete ==="
done
```

Before running, create the results directory:
```bash
mkdir -p .claude/pipeline/bead-results
```

After headless execution completes, summarize results:
```bash
echo "=== Headless Execution Summary ==="
for result in .claude/pipeline/bead-results/*.md; do
  echo "--- $(basename "$result" .md) ---"
  cat "$result"
  echo ""
done
```

### Post-Execution (both modes)

**Tracer Bullet Reminder:** Every story must be verified end-to-end (DB → backend → frontend) before proceeding to the next. US-001 is the most critical — if the initial tracer fails, stop and replan. But don't skip verification on any story. The whole approach depends on never building on an unverified slice.

**Codemap Reminder:** Codemaps refreshed via quality gates before each task commit.

**GATE:**
```
AskUserQuestion: "How did execution go?"
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

**Main agent dispatches:**
```
Task (general-purpose): "You are running Phase 7 (Compound Review) of a ralph-pipeline.

Read .claude/pipeline/state.md for context (check review_agents field).

Your job:
1. Write .claude/pipeline/phase-7-review.md with completed: false
2. Get the full diff: git diff main...HEAD
3. Launch the review agents listed in state.md as parallel Task calls against the diff:
   - security-sentinel: security review
   - architecture-strategist: architecture review
   - code-simplicity-reviewer: simplicity review
   - performance-oracle: performance review
4. Categorize all findings: P1 (must fix), P2 (should fix), P3 (nice-to-have)
5. Write findings to phase-7-review.md with completed: true
6. Return: P1/P2/P3 counts and top 3 findings summary"
```

**Main agent after subagent returns:**
- Verify `phase-7-review.md` has `completed: true`
- Update `state.md` → `current_phase: 8`

**GATE (main agent runs this):**
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

**Main agent dispatches:**
```
Task (general-purpose): "You are running Phase 8 (Harvest) of a ralph-pipeline.

Read .claude/pipeline/state.md for context.

Your job:
1. Write .claude/pipeline/phase-8-harvest.md with completed: false
2. Invoke /choo-choo-ralph:harvest to extract learnings from completed work
3. Invoke /update-codemaps for final codemap refresh
4. Write harvest summary to phase-8-harvest.md with completed: true
5. Return: number of learnings harvested, codemap refresh status"
```

**Main agent after subagent returns:**
- Verify `phase-8-harvest.md` has `completed: true`
- Update `state.md` → `current_phase: done`

**GATE (main agent runs this):**
```
AskUserQuestion: "Pipeline complete. What next?"
  A. Review harvested learnings
  B. Create PR (if not done in Phase 7)
  C. Start another pipeline run
  D. Done - wrap up
```

---

## Key Principles

1. **Thin main agent + subagent per phase** — the main agent orchestrates; each phase runs in its own Task subagent with a fresh context window. Only interactive gates (AskUserQuestion) stay in the main agent.
2. **Chain, don't reimplement** — invoke existing skills, don't duplicate logic
3. **Tracer bullet ordering** — build → test → feedback → iterate. Build the tiniest vertical slice, verify it works end-to-end, then expand. Never build the next story on an unverified slice.
4. **Never horizontal layers** — never build all DB first, then all API, then all UI. Each story touches all layers in the smallest increment.
5. **Codemaps as context** — agents understand existing code without re-exploring
6. **Gates between phases** — user controls pace and direction
7. **Parallel agents** — launch independent Task calls simultaneously
8. **Resumable via disk state** — `.claude/pipeline/state.md` is the source of truth; survives compaction
9. **No unresolved questions past Phase 4.5** — all decisions locked before conversion
10. **Every phase writes completion markers** — `completed: true/false` in YAML frontmatter
