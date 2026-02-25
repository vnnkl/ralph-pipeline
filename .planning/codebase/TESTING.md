# Testing Patterns

**Analysis Date:** 2026-02-25

## Test Framework

**Runner:**
- Not a traditional testing framework — this is a markdown-based orchestration skill
- Instead uses **structured validation and gates** between phases
- Each phase writes an output file with `completed: true/false` marker for verification

**Configuration:**
- No `.test.ts`, `.spec.ts`, or test runner config files (vitest, jest, etc.)
- Validation logic embedded in phase definitions in `SKILL.md`
- State validation through `.claude/pipeline/state.md` YAML schema

**Run Commands:**
- Single invocation point: `/ralph-pipeline` skill trigger
- No separate test suite — validation happens during phase execution
- Gate validation: each phase must produce `completed: true` before proceeding

## Test File Organization

**Location:**
- Not applicable — code is 100% markdown definition in `SKILL.md`
- State files created/validated during execution: `.claude/pipeline/phase-*.md`
- Validation logic embedded inline in phase documentation

**Naming:**
- Phase output files follow pattern: `phase-[N]-[name].md`
- State file: `state.md`
- Questions file: `open-questions.md`
- Results directory: `.claude/pipeline/bead-results/`

**Structure:**
```
.claude/pipeline/
├── state.md                    # Current phase, user choices
├── open-questions.md           # Unresolved decisions
├── phase-0-orient.md           # Codemap results
├── phase-1-clarify.md          # User answers + agent selections
├── phase-2-research.md         # Aggregated research findings
├── phase-3-prd.md              # PRD with [PRD]...[/PRD] markers
├── phase-4-deepen.md           # Review insights + enhanced PRD
├── phase-4.5-resolve.md        # Question resolution record
├── phase-5-convert.md          # Format choice, file paths
├── phase-7-review.md           # P1/P2/P3 categorized findings
├── phase-8-harvest.md          # Harvest summary
└── bead-results/               # Individual bead/story execution results
    ├── US-001.md
    ├── US-002.md
    └── bead-name.md
```

## Test Structure

**Suite Organization:**
Each phase acts as a "test suite" with validation steps:

**Phase 0 Orient (Codemap Verification):**
- Input: `state.md`
- Validation: Check if codemaps exist and age (<24h)
- Output: `phase-0-orient.md` with `completed: true/false`
- Marks completion before Phase 1 proceeds

**Phase 1 Clarify (User Input Validation):**
- Input: Direct AskUserQuestion prompts
- Validation: Three rounds of user choices (scope/stack, agent selection, scope boundaries)
- Output: `phase-1-clarify.md` with all answers + `completed: true/false`
- Marks completion and updates `state.md` with selections

**Phase 2 Research (Parallel Agent Testing):**
- Input: `state.md`, `phase-1-clarify.md`, `phase-0-orient.md`
- Validation: Launch research agents in parallel, aggregate results
- Output: `phase-2-research.md` with findings + `completed: true/false`
- Fails if agents return incomplete findings

**Phase 3 PRD Creation (Validation Checklist):**
- Input: Research findings, codemap context
- Validation: PRD validation checklist (lines 480-491 in SKILL.md):
  - [ ] `[PRD]...[/PRD]` markers present
  - [ ] Quality Gates section exists
  - [ ] US-001 is a tracer bullet (tiniest DB → backend → frontend slice)
  - [ ] Stories grow the feature incrementally
  - [ ] No horizontal layering
  - [ ] Dependencies are sequential (US-002 → US-001, etc.)
  - [ ] Every story includes end-to-end verification in AC
  - [ ] If frontend work exists, UI stories have `/frontend-design` as FIRST instruction
  - [ ] If browser testing needed, stories reference agent-browser
- Output: `phase-3-prd.md` with `completed: true/false`
- Fails validation if checklist items not met — inline fixes required

**Phase 4 Deepen (Parallel Review Testing):**
- Input: `phase-3-prd.md`
- Validation: Launch 4 parallel review agents (security-sentinel, architecture-strategist, code-simplicity-reviewer, performance-oracle)
- Output: `phase-4-deepen.md` with feedback incorporated + `completed: true/false`
- Reports: insight count, question count, summary

**Phase 4.5 Resolve (Questions Blocking Gate):**
- Input: `open-questions.md` with unchecked items
- Validation: BLOCKING gate — no unchecked `- [ ]` items allowed
- Process: AskUserQuestion rounds to resolve each unchecked question
- Output: `phase-4.5-resolve.md` with resolution record + `completed: true/false`
- Marks questions as `- [x]` in `open-questions.md`
- Only proceeds if `open_questions_resolved: true`

**Phase 5 Convert (Format Validation):**
- Input: PRD file
- Validation: item count matches story count, dependencies set correctly, US-001 has no deps, quality gates in AC
- Output: `phase-5-convert.md` with format choice + file paths + `completed: true/false`
- Returns: format used, number of items, file paths

**Phase 6 Execute (Tracer Bullet & End-to-End Verification):**
- Input: Beads or prd.json
- Validation: **CRITICAL** — each story must be verified end-to-end before next story starts
- Patterns:
  - Manual mode: User runs `ralph-tui` themselves; pipeline waits at gate
  - Headless mode: Each bead spawned in individual `claude -p` session with fresh context, max 30 turns
- Each bead/story must:
  - Run `/frontend-design` FIRST if UI work involved
  - Implement feature
  - Run quality gates after implementation
  - Verify end-to-end path works (DB → backend → frontend)
  - Commit with conventional message
  - Write completion summary to `.claude/pipeline/bead-results/[name].md`
- Output: `bead-results/` directory with individual results
- Gate allows: proceed to review (A), fix failures (B), replan (C), add stories (D), skip to harvest (E)

**Phase 7 Review (Code Diff Testing):**
- Input: Full diff via `git diff main...HEAD`
- Validation: Launch 4 parallel review agents against actual code
- Categorization: P1 (must fix), P2 (should fix), P3 (nice-to-have)
- Output: `phase-7-review.md` with categorized findings + `completed: true/false`
- Returns: P1/P2/P3 counts and top 3 findings
- Gate allows: fix P1 (A), fix P1+P2 (B), skip fixes (C), re-run after fixes (D), create PR (E)

**Phase 8 Harvest (Final Verification):**
- Input: `state.md`
- Validation: Invoke `/harvest` for learnings, `/update-codemaps` for refresh
- Output: `phase-8-harvest.md` with summary + `completed: true/false`
- Returns: learnings count, codemap refresh status

## Mocking

**Framework:** Not applicable — no unit testing framework

**Patterns:**
- State is mocked via YAML files in `.claude/pipeline/`
- Subagents receive pre-filled state files as input
- Disk-based "mocking" of prior phase outputs for resumability testing
- No function-level mocking

**What to Mock:**
- Subagent dependencies: pass only necessary phase input files
- External skills: assume they exist (verified in pre-flight)
- Plugin availability: fallback gracefully (missing plugin → warning, continue)

**What NOT to Mock:**
- `state.md` state — always read from disk
- User gate responses — always use AskUserQuestion (never hardcode)
- Phase output files — wait for subagent completion

## Fixtures and Factories

**Test Data:**
State file example (SKILL.md lines 62-78):
```yaml
---
feature: "user authentication system"
current_phase: 2
started: 2026-02-08
project_type: existing
tech_stack: "Node/TypeScript"
quality_gates: "bun test && bun run typecheck"
research_agents: [repo-research-analyst, best-practices-researcher]
review_agents: [security-sentinel, architecture-strategist]
convert_format: null
has_frontend: true
last30days_ran: false
open_questions_resolved: false
---
```

Open questions example (SKILL.md lines 158-167):
```markdown
# Open Questions

- [ ] Which email provider? (SendGrid, Postmark, SES) — from: phase-2-research
- [ ] Deployment target? (Vercel, Fly, Railway) — from: phase-3-prd
- [x] S3 provider for file storage? — from: phase-3-prd
```

Phase output template (SKILL.md lines 80-92):
```yaml
---
phase: 2
name: research
completed: true
---
## Research Summary
...actual phase output...
```

Bead execution result template (SKILL.md lines 639, 670):
```markdown
.claude/pipeline/bead-results/${BEAD_NAME}.md
or
.claude/pipeline/bead-results/${story}.md
```

**Location:**
- Fixtures exist in `.claude/pipeline/` directory, created during execution
- Templates documented in SKILL.md
- Test data embedded in phase documentation (examples at lines 62-78, 158-167, 80-92)

## Coverage

**Requirements:** 
- Not a traditional coverage metric — this is an orchestration skill
- Instead, **coverage** means every phase must complete with `completed: true`
- All phase files must exist and validate before pipeline finishes

**Validation Requirements:**
- PRD validation: 9-point checklist (lines 480-491)
- Conversion validation: item count, dependencies, US-001 check (lines 583-585)
- Execution validation: tracer bullet verification (end-to-end per story)
- Review categorization: P1/P2/P3 findings

**View Coverage:**
No test command — coverage verified by:
```bash
# Check phase completion
grep "completed: true" .claude/pipeline/phase-*.md

# Check state progression
cat .claude/pipeline/state.md | grep "current_phase"

# Check question resolution
grep "\\- \\[x\\]" .claude/pipeline/open-questions.md

# Check bead results
ls .claude/pipeline/bead-results/
```

## Test Types

**Validation Tests (Phase 3 PRD Validation):**
- Scope: Tracer bullet story structure, `/frontend-design` instruction presence, agent-browser references
- Approach: Checklist verification against PRD output
- Example: "Every story includes end-to-end verification in AC" check (line 487)

**Integration Tests (Phase 6 Execution):**
- Scope: Each story/bead executed end-to-end (DB → backend → frontend)
- Approach: Headless execution with fresh context per bead, quality gates run after implementation
- Example: "Verify the end-to-end path works (DB → backend → frontend) — don't just check that code compiles" (line 637)

**Code Review Tests (Phase 7 Review):**
- Scope: Actual code diff against 4 review dimensions (security, architecture, simplicity, performance)
- Approach: Parallel agents categorize findings as P1/P2/P3
- Example: "security-sentinel: security review" (line 729)

**E2E Tests (Phase 6 Headless Execution):**
- Framework: Individual `claude -p` sessions per bead with allowedTools (Edit, Read, Write, Bash, Grep, Glob)
- Approach: Each bead can run custom commands, browser tests with agent-browser
- Example: headless script (lines 616-645)

## Common Patterns

**Async Testing (Phase 2 Research, Phase 4 Deepen, Phase 7 Review):**
Parallel Task dispatch pattern:
```
Launch the research agents listed in state.md as parallel Task calls:
  - repo-research-analyst
  - best-practices-researcher
  - framework-docs-researcher
```
Lines 411-415 in SKILL.md

Agents run independently; results aggregated by subagent.

**Error Testing (Phase 6 Execution Failures):**
Gate allows recovery:
```
AskUserQuestion: "How did execution go?"
  A. All tasks passed - ready for review
  B. Some tasks failed - need fixes
  C. Tracer bullet (US-001) failed - need to replan
```
Lines 700-714 in SKILL.md

Failed bead result written to `.claude/pipeline/bead-results/${BEAD_NAME}.md` without proceeding to next bead.

**Tracer Bullet Verification (Phase 6):**
Every story must include:
1. `/frontend-design` FIRST if UI involved (line 633)
2. Implementation of feature (line 634)
3. `agent-browser` for browser testing if needed (line 635)
4. Quality gates execution (line 636)
5. **End-to-end verification** — "verify the slice actually functions" (line 637)
6. Commit with conventional message (line 638)
7. Completion summary write (line 639)

No story proceeds to next until prior story verified.

**Resumability Testing (Post-Compaction):**
After compaction, pipeline recovers by:
1. Reading `state.md`
2. Reading the phase file for `current_phase`
3. Checking `completed` flag
4. If `completed: false` → re-run subagent
5. If `completed: true` → proceed to next phase
Lines 173-195 in SKILL.md

SessionStart hook re-injects state files automatically.

**Gate Pattern (Interactive Testing):**
Every phase ends with AskUserQuestion gate:
- Phase 1 → Phase 2
- Phase 4 → Phase 4.5 (with options to refine, re-run agents, show full PRD)
- Phase 6 → Phase 7 (with options to fix, replan, add stories, skip to harvest)
- Phase 7 → Phase 8 (with options to fix P1, fix P1+P2, skip, re-run, create PR)

Gates allow iterative refinement without losing progress.

---

*Testing analysis: 2026-02-25*
