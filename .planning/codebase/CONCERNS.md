# Codebase Concerns

**Analysis Date:** 2026-02-25

## Critical: State Machine Fragility

**Issue:** Subagent Output Verification Gaps
- **Files:** `SKILL.md` (lines 94-154, 350-418)
- **Problem:** The orchestration model relies on reading `completed: true` from phase files to determine if a phase succeeded. However, the implementation spec doesn't define:
  - What happens if a subagent crashes mid-phase (file exists but `completed: false`)
  - How the main agent distinguishes between "subagent timed out" vs "still writing output"
  - Whether the main agent re-runs incomplete phases automatically or requires user confirmation
  - Recovery behavior when a phase file is corrupted or missing entirely
- **Impact:** Pipeline can enter invalid states (e.g., `state.md` says current_phase=2 but phase-2-research.md is corrupted). Recovery procedure unclear.
- **Scenario:** Context compaction happens mid-subagent work → subagent continues in new session, writes incomplete phase file → main agent reads `completed: false` but can't distinguish this from intentional pause
- **Fix approach:**
  1. Add explicit recovery protocol: subagent detects incomplete phase and re-reads input files to resume
  2. Add timeout handling: if phase file hasn't been updated in N minutes, treat as failed
  3. Add validation step in main agent: verify phase file size > 0 bytes, has valid YAML frontmatter, and contains expected content markers

## High: Missing Dependency Handling

**Issue:** Hard Dependencies Without Fallbacks
- **Files:** `SKILL.md` (lines 199-289), `references/dependencies.md` (entire file)
- **Problem:** Pipeline requires 4 critical plugins (everything-claude-code, choo-choo-ralph, compound-engineering, last30days) but auto-install logic only handles skills, not plugins. Pre-flight "warns" about missing plugins but doesn't define what happens if warning is ignored.
- **Impact:** User starts pipeline with missing compound-engineering plugin → Phase 2 (Research) or Phase 4 (Deepen) dispatches Task subagent expecting review_agents from compound-agents → subagent fails silently or reports "agents not found"
- **Current state:** Pre-flight warns but continues. No check in Phase 2 or 4 that agents actually exist before dispatch
- **Fix approach:**
  1. Add blocking gate after pre-flight: if any critical plugin missing, don't proceed
  2. Phase 2 subagent should validate that research_agents exist (from state.md) before dispatching
  3. Phase 4 subagent should validate that review_agents exist before dispatching
  4. If agents missing, write error to phase file and pause for user intervention

## High: Context Window Overflow Risk

**Issue:** Subagent Context Saturation Unmanaged
- **Files:** `SKILL.md` (lines 409-419, 434-448)
- **Problem:** Phase 2 (Research) and Phase 3 (PRD) can generate massive outputs:
  - Phase 2 aggregates results from 3-4 parallel research agents → could be 5000-10000 lines
  - Phase 3 creates detailed PRD with tracer bullets → could be 3000-5000 lines
  - Phase 4 (Deepen) reads full PRD + review agent outputs → combined could exceed 15KB
  - No guidance on what subagent should do if its own output approaches context limit
- **Impact:** If a research agent returns unusually large findings (e.g., 50KB framework documentation), the Phase 2 subagent tries to aggregate it → hits context limit → incomplete research.md written → pipeline proceeds with incomplete research
- **Current state:** Protocol says subagent "aggregates all agent results" but doesn't mention summarization, truncation, or overflow handling
- **Fix approach:**
  1. Document max output size expectations for each phase (e.g., phase-2-research.md target <10KB, phase-3-prd.md target <15KB)
  2. Add guidance to subagent prompts: if aggregated output approaches limit, summarize/excerpt instead of copying full agent outputs
  3. Add validation in main agent: if phase output file > 20KB, warn user and ask if truncation happened
  4. Consider splitting Phase 2 into Phase 2a (per-agent research) + Phase 2b (aggregation) if context overflow persists

## High: Tracer Bullet Verification Gap

**Issue:** No Built-in Verification That Stories Actually Work End-to-End
- **Files:** `SKILL.md` (lines 456-491, 696-699), `README.md` (lines 58-64)
- **Problem:** The skill emphasizes tracer bullet ordering and "verify after every story" but:
  - Phase 3 (PRD creation) validates that stories EXIST but not that they're truly minimal vertical slices
  - Phase 6 (Execute) includes a reminder to verify US-001 end-to-end but no automated check
  - If a story's acceptance criteria are vague (e.g., "verify the feature works"), the executor might mark it complete without actually testing the full DB → backend → frontend slice
  - No requirement for a verification artifact (test run log, screenshot, API response) to be stored
- **Impact:** US-001 marked "complete" but missing integration step (e.g., frontend calls backend but backend doesn't update DB) → US-002 built on faulty foundation → entire pipeline builds on broken base
- **Fix approach:**
  1. Require Phase 3 PRD stories to include explicit "VERIFY:" section with concrete testable steps (e.g., "curl endpoint and check response contains X field")
  2. Add Phase 6 sub-gate: after each story, executor commits with a "VERIFY:" log showing actual test results
  3. Phase 7 review should check that verification artifacts exist for each story

## Medium: Open Questions Resolution Enforcement

**Issue:** Phase 4.5 (Resolve) Assumes User Will Answer Every Question
- **Files:** `SKILL.md` (lines 535-558)
- **Problem:** Phase 4.5 protocol says "present each to user via AskUserQuestion" but doesn't specify:
  - If user skips a question (closes prompt without answering), does the pipeline stop or assume "no preference"?
  - If a question is unanswerable at planning time (e.g., "exact customer names for test data"), how should it be marked?
  - If user answers vaguely (e.g., "maybe AWS S3" instead of committing), does that count as resolved?
- **Impact:** Phase 4.5 completes with `open_questions_resolved: true` but some questions were skipped → Phase 5 PRD has placeholders like "[TBD: email provider]" → execution fails when it hits the placeholder
- **Current state:** Phase 4.5 marks questions as `[x]` but doesn't validate the answer is substantive
- **Fix approach:**
  1. Add validation: AskUserQuestion for each open question must have answer text (not just "yes/no")
  2. If answer is "TBD" or "unknown", offer option to defer to execution phase (Phase 6) with explicit "DECISION_PENDING" marker in PRD
  3. Add Phase 5 validation: scan PRD for "[TBD]" markers before conversion — if found, stop and ask user to either answer or defer
  4. If deferred to Phase 6, require executor to confirm decision before proceeding with story

## Medium: Git State Assumptions

**Issue:** Pre-flight Git Initialization and Subsequent State Tracking
- **Files:** `SKILL.md` (lines 199-260, 727)
- **Problem:**
  - Pre-flight assumes `main` branch exists (line 727: `git diff main...HEAD`) but doesn't verify main actually exists after init
  - Auto-generated `.gitignore` is appended to existing entries but doesn't check for conflicts (e.g., if `.gitignore` already ignores a critical directory like `src/`)
  - Phase 7 review runs `git diff main...HEAD` but doesn't handle if user branches from non-main (e.g., working on feature branch off `develop`)
- **Impact:** Pipeline expects feature branch to be based on `main`, but user branches from `develop` → `git diff main...HEAD` includes all develop-specific changes → review agents review unrelated code
- **Current state:** No explicit branching strategy documented. Assumes main branch is always the base.
- **Fix approach:**
  1. Pre-flight: detect current git config `branch.autosetuprebase` and ask user what the base branch is (offer `main` or `develop`)
  2. Phase 7: use the configured base branch instead of hardcoding `main`
  3. Add check before Phase 7: verify branch is a fast-forward merge candidate from base branch, or warn about merge conflicts

## Medium: Headless Execution Complexity

**Issue:** Phase 6 Headless Mode Has Unclear Error Recovery
- **Files:** `SKILL.md` (lines 614-677)
- **Problem:**
  - Headless mode spawns separate `claude -p` sessions per bead/story
  - If a story fails mid-execution (e.g., compilation error), the session writes to `.claude/pipeline/bead-results/${BEAD_NAME}.md` and stops
  - Main agent isn't monitoring these sessions — after all sessions complete, main agent has no easy way to aggregate failures vs successes
  - If 5 of 10 beads fail, how does main agent know? It just reads the directory and displays what it finds
- **Impact:** User launches headless mode, goes to sleep, wakes up to incomplete results without clear summary of what failed and why
- **Current state:** Headless section has summary code (lines 684-691) but it's just `cat` — no parsing of failed vs passed
- **Fix approach:**
  1. Require headless executor to write standard format to bead-results files: `status: passed|failed|blocked` at top
  2. Add main agent post-execution logic: read all bead-results files, count passed/failed/blocked, highlight failures
  3. Add automatic re-run proposal: if any beads failed, offer to re-run just those beads (provide command)

## Medium: Compaction Hook Fragility

**Issue:** SessionStart Hook May Not Inject State Properly After Compaction
- **Files:** `SKILL.md` (lines 290-312)
- **Problem:**
  - Compaction hook is registered as a SessionStart hook with a command that cats state files
  - But SessionStart runs before the main agent reads any input — so the injected state appears in the prompt but isn't parsed by the agent's logic
  - If main agent's entry point logic doesn't explicitly look for the re-injected state marker (`--- RALPH PIPELINE STATE (re-injected after compaction) ---`), it will miss it and start from Phase 0
- **Impact:** Context compacts at Phase 3 → hook injects state → agent starts new session → agent doesn't see the marker → agent re-initializes pipeline instead of resuming at Phase 3
- **Current state:** Hook assumes agent will recognize and parse the injected state, but doesn't verify this
- **Fix approach:**
  1. Add explicit parsing in main agent entry: check for `--- RALPH PIPELINE STATE` marker in context, extract phase number
  2. If marker found, read state.md directly and jump to that phase
  3. Add debug output: "Resuming from compaction, Phase X"
  4. Consider adding a hook validation step: after compaction, verify state.md still exists and is readable

## Medium: Large SKILL.md File Complexity

**Issue:** Main Skill Documentation Exceeds Comfortable Read Size
- **Files:** `SKILL.md` (796 lines)
- **Problem:**
  - SKILL.md is 796 lines covering 9 phases + pre-flight + state management
  - No table of contents or navigation — finding Phase 4 description requires scrolling
  - Phase descriptions repeat patterns (e.g., "Write phase file with completed: false...") without consolidation
  - If a future maintainer needs to add Phase 9.5 or modify Phase 4 retry logic, they must understand the entire file first
- **Impact:** Onboarding new contributors requires reading 800 lines. Bug fixes in orchestration logic require full re-read.
- **Current state:** Monolithic structure. Repeated boilerplate across phase descriptions.
- **Fix approach:**
  1. Extract a `ARCHITECTURE.md` documenting the subagent dispatch pattern once (instead of explaining in Phase 2, 3, 4, etc.)
  2. Create `PHASE_PROTOCOL.md` documenting the standard phase file format (frontmatter, completed flag, etc.) once
  3. Reduce individual phase sections to 50-60 lines each (title, goal, input, output, key points)
  4. Add table of contents at top of SKILL.md

## Low: Documentation of Failure Modes

**Issue:** No Documented Error Recovery for Common Failures
- **Files:** All .md files
- **Problem:**
  - What if a research agent times out? Does the Phase 2 aggregation wait forever or timeout?
  - What if a review agent encounters code it doesn't understand (e.g., Fortran)? Does Phase 4 stop or skip it?
  - What if the PRD file created in Phase 3 has syntax errors (malformed YAML)? Does Phase 4 catch it?
  - What if a user runs `/ralph-pipeline` twice concurrently? Do they share `.claude/pipeline/` state?
- **Impact:** Rare failures leave users stranded with no documented recovery procedure
- **Fix approach:**
  1. Create `TROUBLESHOOTING.md` documenting common failures and recovery steps
  2. For each phase, add "if subagent fails" section to main agent dispatch logic
  3. Add safety: check if .claude/pipeline/state.md is locked (concurrent run protection)

## Low: Agent Selection Scalability

**Issue:** Phase 1 Agent Selection Hard-Codes Specific Agents
- **Files:** `SKILL.md` (lines 383-389)
- **Problem:**
  - Phase 1 lists specific agents: repo-research-analyst, best-practices-researcher, framework-docs-researcher, learnings-researcher
  - If a user has custom agents in `.claude/agents/`, Phase 1 doesn't discover or offer them
  - If a compound-agents update adds new agents, Phase 1 doesn't know about them
- **Impact:** Users with specialized agents can't use them without manually editing phase-1-clarify.md
- **Current state:** Hard-coded list. No dynamic discovery.
- **Fix approach:**
  1. Add dynamic agent discovery: glob `.claude/agents/` and `~/.claude/skills/compound-agents/` directories
  2. Present discovered agents to user in Phase 1 round 2 with brief descriptions (from SKILL.md if available)
  3. Allow custom agent selection instead of just pre-defined ones

## Low: .gitignore Completeness

**Issue:** Generated Files Not All Covered by .gitignore Template
- **Files:** `SKILL.md` (lines 231-260)
- **Problem:**
  - Template ignores `.beads/` but not `.ralph-tui/iterations/` explicitly (though mentioned in comment)
  - Doesn't ignore `prd.json` or `tasks/*.json` (generated by Phase 5)
  - Doesn't ignore `.claude/pipeline/bead-results/` (generated by Phase 6 headless)
  - Doesn't ignore `.claude/pipeline/state.md` (though marked as regenerated)
- **Impact:** After a full pipeline run, user's git status is cluttered with generated files that should be ignored
- **Current state:** Template comment says "Ralph TUI iterations (large, generated)" but rule is `.ralph-tui/iterations/` which may be too specific
- **Fix approach:**
  1. Expand .gitignore template to include all generated directories from all phases:
     ```
     .ralph-tui/
     prd.json
     tasks/
     .claude/pipeline/bead-results/
     ```
  2. Add note in SKILL.md: "User may want to commit state.md and phase files for team collaboration"

---

## Summary by Severity

**Critical (blocks adoption):**
- State machine fragility and recovery gaps
- Missing dependency validation gates

**High (causes failures):**
- Context window overflow unmanaged
- Tracer bullet verification gap
- Open questions enforcement

**Medium (causes confusion/rework):**
- Git state assumptions
- Headless execution error recovery
- Compaction hook fragility
- SKILL.md documentation size

**Low (nice-to-have):**
- Common failure documentation
- Agent selection scalability
- .gitignore completeness

*Concerns audit: 2026-02-25*
