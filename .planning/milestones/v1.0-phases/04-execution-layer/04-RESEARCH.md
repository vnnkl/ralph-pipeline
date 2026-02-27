# Phase 4: Execution Layer - Research

**Researched:** 2026-02-25
**Domain:** Claude Code headless execution, bead conversion pipelines, parallel agent review, result aggregation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Always present bead format choice via AskUserQuestion (bd Go / br Rust / prd.json) -- no config default
- If conversion produces zero beads: block with error, offer retry / edit PRD / abort -- never proceed with empty .beads/
- Validate bead structure beyond existence: each .beads/*.md must have valid frontmatter and acceptance criteria -- reject malformed beads
- Frontend stories auto-inject /frontend-design skill instruction -- detect by tag/content, no user confirmation needed
- Execution gate always asks: headless (claude -p) or manual (ralph-tui) -- manual is the default option
- Stop batch immediately on bead failure -- surface error clearly, do not continue with remaining beads
- Show bead-level progress: which bead is running (e.g., "Executing bead 3/8: US-002-backend"), update on completion with pass/fail
- No per-bead timeout -- trust claude -p to complete or fail on its own
- Pipeline trusts the bead agent's self-reported result -- beads have their own internal quality gates enforced by the executing agent
- No external quality check by the pipeline after each bead -- the bead's exit determines pass/fail/blocked
- Result files are status-only: `status: passed|failed|blocked` written to `.claude/pipeline/bead-results/${BEAD_NAME}.md` -- no summary or details
- Post-execution review spawns four parallel agents (security, architecture, performance, simplicity) categorizing findings as P1/P2/P3
- "Fix P1s" / "Fix P1+P2" presents findings as a checklist for the user to apply manually -- no auto-fix agent
- After user signals fixes done, ask whether to re-run review or proceed as-is
- "Create PR" creates a draft PR -- user promotes to ready after final check
- Add "re-run bead X" option for targeted re-execution of a specific problematic bead

### Claude's Discretion
- P1/P2/P3 threshold definitions for review categorization
- Result file directory structure within .claude/pipeline/
- How bead-level progress is displayed (format of status updates)
- Error message formatting when a bead fails

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONV-01 | Conversion gate: user chooses bead format (bd Go beads / br Rust beads / prd.json) | Three skills exist: /ralph-tui-create-beads, /ralph-tui-create-beads-rust, /ralph-tui-create-json. AskUserQuestion pattern from resolve/deepen templates. |
| CONV-02 | Bead conversion by invoking /ralph-tui-create-beads or /ralph-tui-create-beads-rust skill (chain, don't reimplement) | Skills confirmed at ~/.claude/skills/ralph-tui-create-beads/ and ~/.claude/skills/ralph-tui-create-beads-rust/. Use Skill tool to invoke. |
| CONV-03 | Frontend stories inject /frontend-design skill as first instruction in bead acceptance criteria | design-taste-frontend skill confirmed at ~/.claude/skills/design-taste-frontend/. Detection logic: scan PRD user stories for "frontend", "UI", "interface", "component", "page", "view" tags/content. |
| CONV-04 | Configurable depth affects bead granularity (quick: fewer larger beads, comprehensive: more granular beads) | Depth read from config.json via `node ralph-tools.cjs config-get depth`. Pass as instruction to bead creation skill. |
| EXEC-01 | Execution gate per phase: user chooses headless (claude -p per bead) or manual (launch ralph-tui) | AskUserQuestion with manual as default. Manual = show ralph-tui launch command. Headless = iterate beads sequentially via claude -p. |
| EXEC-02 | Headless mode: pipeline orchestrates claude -p per bead with structured exit codes | `claude -p` confirmed: exit 0 = success, non-zero = failure. Use `--allowedTools`, `--output-format json`, `--permission-mode` flags. Sequential execution with stop-on-failure. |
| EXEC-03 | Bead results written to structured results directory with pass/fail per bead | Write to `.claude/pipeline/bead-results/${BEAD_NAME}.md` with YAML frontmatter `status: passed|failed|blocked`. |
| EXEC-04 | Quality gates from PRD enforced per bead (tests pass, type checks pass) | Pipeline trusts bead agent's self-reported result (locked decision). No external quality check by pipeline. Bead's own acceptance criteria include quality gates. |
| REVW-01 | Parallel review agents run post-execution (security, architecture, performance, simplicity) | Compound review agents confirmed at ~/.claude/skills/compound-agents/review/. Same 4 agents used in deepen template. Review against git diff, not PRD. |
| REVW-02 | Findings categorized P1/P2/P3 with actionable fix suggestions | Same severity scheme as deepen phase. P1 = blocks merge, P2 = should fix, P3 = nice-to-have. Deduplication across agents. |
| REVW-03 | Review gate: fix P1s, fix P1+P2, skip, re-run, or create PR | Five options. Fix options present checklist (manual fix). Re-run dispatches fresh agents. Create PR uses `gh pr create --draft`. |
</phase_requirements>

## Summary

Phase 4 covers three distinct subphases: conversion (PRD to beads), execution (headless claude -p or manual ralph-tui), and post-execution review (parallel agent compound review). The conversion gate chains existing skills (/ralph-tui-create-beads, /ralph-tui-create-beads-rust, /ralph-tui-create-json) without reimplementing them. The execution gate offers headless or manual mode. Headless mode runs `claude -p` per bead sequentially, writing minimal status-only result files. The review gate spawns four parallel review agents and presents a multi-option gate with fix/re-run/PR actions.

The architecture follows the same pattern established in Phase 3 templates: the pipeline template is a detailed prompt dispatched as a Task subagent by the orchestrator (SKILL.md). Each template reads state/config, executes its logic, writes output files, and returns a completion signal. This phase will produce three templates (convert.md, execute.md, review.md) replacing the current stubs plus any necessary PHASE_FILES mapping updates in the orchestrator.

**Primary recommendation:** Build three production templates following the Phase 3 template patterns (research.md, deepen.md, resolve.md as exemplars), with convert.md using Skill tool for chaining, execute.md using Bash for claude -p orchestration, and review.md using Task for parallel agents.

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `claude -p` | Current (CLI) | Headless bead execution | Official Claude Code headless mode; exit codes, --allowedTools, --output-format json |
| `gh pr create` | Current | Draft PR creation | GitHub CLI, already used in project for git operations |
| Skill tool | Built-in | Chain /ralph-tui-create-beads, /ralph-tui-create-beads-rust, /ralph-tui-create-json | Claude Code skill invocation; skills confirmed installed |
| Task tool | Built-in | Parallel review agents | Same pattern as deepen phase parallel agent dispatch |
| AskUserQuestion | Built-in | Gates and choices | Same pattern as resolve/deepen phases |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `node ralph-tools.cjs config-get depth` | Read depth setting | Before conversion to determine bead granularity |
| `node ralph-tools.cjs scan-phases` | Check completion | Orchestrator verification after template returns |
| Grep tool | Bead validation, frontend detection | Validate .beads/*.md structure, detect frontend stories |
| Glob tool | Bead discovery | List .beads/*.md files after conversion |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sequential claude -p | Parallel claude -p | User decided stop-on-failure, so sequential is required |
| Pipeline quality gates | Bead self-reported status | User decided to trust bead agent's gates, simpler pipeline |
| Auto-fix agent | Manual checklist | User decided manual fixes with checklist presentation |

## Architecture Patterns

### Recommended Template Structure

Each of the three templates follows this skeleton:

```
templates/
├── convert.md    # Phase 7 (pipeline phase 7): PRD -> beads
├── execute.md    # Phase 8 (pipeline phase 8): headless or manual execution
└── review.md     # Phase 9 (pipeline phase 9): compound review + PR
```

### Pattern 1: Skill Chaining (convert.md)

**What:** Invoke an existing Claude Code skill from within a Task subagent template using the Skill tool.
**When to use:** When the pipeline delegates work to an external skill that handles its own prompting and output.
**Example:**

```
# In convert.md template body:
Use the Skill tool to invoke /ralph-tui-create-beads with the PRD content as input.
Wait for skill completion. Then validate output.
```

**Key considerations:**
- The Skill tool IS available inside Task subagents (unlike what some patterns suggest)
- The PRD content from `.planning/pipeline/prd.md` must be passed as context to the skill
- Depth setting from config.json should be communicated as an instruction: "quick = fewer beads, comprehensive = more granular beads"
- After skill completes, validate `.beads/*.md` existence and frontmatter structure

### Pattern 2: Sequential Headless Execution (execute.md)

**What:** Run `claude -p` per bead file, capture exit code, write result file, stop on first failure.
**When to use:** Headless execution mode selected by user.
**Example:**

```bash
# Per-bead execution pattern
for bead in .beads/*.md; do
  BEAD_NAME=$(basename "$bead" .md)

  # Read bead content and execute
  claude -p "$(cat "$bead")" \
    --allowedTools "Read,Edit,Bash,Grep,Glob,Write" \
    --output-format json \
    --permission-mode bypassPermissions \
    2>&1

  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    STATUS="passed"
  else
    STATUS="failed"
  fi

  # Write result file
  mkdir -p .claude/pipeline/bead-results
  cat > ".claude/pipeline/bead-results/${BEAD_NAME}.md" << EOF
---
status: ${STATUS}
bead: ${BEAD_NAME}
executed: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
---
EOF

  if [ "$STATUS" = "failed" ]; then
    break  # Stop batch on failure
  fi
done
```

**Key considerations:**
- `--permission-mode bypassPermissions` or `--dangerously-skip-permissions` needed for unattended execution
- `--allowedTools` should be scoped to tools the bead needs (Read, Edit, Bash, Grep, Glob, Write)
- Exit code 0 = success, non-zero = failure
- `--output-format json` captures structured output with session_id for potential resume
- The template subagent runs this bash loop, NOT the orchestrator
- `--model` flag can specify the model if model_profile config requires it

### Pattern 3: Parallel Agent Dispatch (review.md)

**What:** Spawn four Task agents in parallel with `run_in_background=true`, collect findings, present gate.
**When to use:** Post-execution compound review.
**Example:** Same pattern as deepen.md template (already implemented in Phase 3). Key difference: review agents analyze `git diff` of actual code changes, not the PRD document.

```
# Review agent prompt pattern (review.md):
Task with run_in_background=true:
"First, read ~/.claude/skills/compound-agents/review/security-sentinel.md for your role.

DIFF TO REVIEW:
{git diff main...HEAD or git diff of committed bead work}

Write findings to: {CWD}/.planning/pipeline/review-security.md"
```

### Pattern 4: Bead Progress Reporting

**What:** Show progress during sequential bead execution.
**When to use:** Headless mode, between each bead.
**Example:**

```
Executing bead 1/8: US-001-database-schema ... PASSED
Executing bead 2/8: US-001-backend-api ... PASSED
Executing bead 3/8: US-001-frontend-view ... FAILED

Batch stopped. 2/8 beads passed, 1 failed.
Failed bead: US-001-frontend-view
```

### Pattern 5: Result Aggregation

**What:** After all beads execute (or batch stops), read all result files and compute totals.
**When to use:** After headless execution completes or stops.
**Example:**

```bash
# Count results
PASSED=$(grep -l "status: passed" .claude/pipeline/bead-results/*.md 2>/dev/null | wc -l)
FAILED=$(grep -l "status: failed" .claude/pipeline/bead-results/*.md 2>/dev/null | wc -l)
BLOCKED=$(grep -l "status: blocked" .claude/pipeline/bead-results/*.md 2>/dev/null | wc -l)
TOTAL=$((PASSED + FAILED + BLOCKED))
```

This addresses the aggregation problem identified in CONCERNS.md.

### Anti-Patterns to Avoid

- **Parallel bead execution:** User decided sequential with stop-on-failure. Do not parallelize.
- **External quality gates:** User decided to trust bead self-reporting. Do not add pipeline-level test/typecheck verification.
- **Auto-fix agent for review findings:** User decided manual checklist. Do not spawn fix agents.
- **Resuming from failed bead:** Instead, offer "re-run bead X" as a targeted option. Fresh session, not resume.
- **Reading bead output into orchestrator:** Pass file paths only. Templates are Task subagents with fresh context.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bead creation from PRD | Custom PRD-to-bead converter | /ralph-tui-create-beads skill (bd), /ralph-tui-create-beads-rust skill (br), /ralph-tui-create-json skill (json) | Skills handle PRD parsing, epic creation, bead splitting; maintained separately |
| Compound code review | Custom multi-agent review | Compound review pattern from deepen.md + ~/.claude/skills/compound-agents/review/ agents | Four reviewed agent definitions already exist with calibrated severity thresholds |
| Headless CLI execution | Custom process spawner | `claude -p` with --allowedTools, --output-format json | Official Claude Code headless mode with structured exit codes |
| PR creation | Custom git+GitHub integration | `gh pr create --draft` | GitHub CLI handles auth, remote, template |
| Frontend skill detection | Hardcoded keyword list | Grep for tags/content in PRD user stories | PRD structure varies; pattern matching is more robust than a fixed list |

**Key insight:** Every major capability in this phase delegates to an existing tool or skill. The templates are orchestration glue, not reimplementations.

## Common Pitfalls

### Pitfall 1: Skill Tool Not Available in Task Subagents

**What goes wrong:** Assuming Task subagents cannot use the Skill tool and trying to work around it with Bash.
**Why it happens:** Some Claude Code documentation is ambiguous about tool availability in subagents.
**How to avoid:** The deepen template's Step 5 explicitly warns "Do NOT use the Skill tool inside Task subagents." However, the PRD template (prd.md) DOES use "Use the Skill tool to invoke /ralph-tui-prd" directly in the template. The convert template IS the Task subagent itself, and the Skill tool IS available to it. Verify by checking: the PRD template successfully invokes /ralph-tui-prd via Skill tool.
**Warning signs:** If Skill tool invocation fails inside convert template, fall back to describing the skill invocation as a natural language instruction.

### Pitfall 2: claude -p Permission Handling

**What goes wrong:** Headless `claude -p` hangs waiting for permission approval that never comes.
**Why it happens:** Default permission mode requires interactive approval for tool use.
**How to avoid:** Use `--allowedTools "Read,Edit,Bash,Grep,Glob,Write"` to pre-approve all needed tools. Alternatively, `--dangerously-skip-permissions` bypasses all checks (only safe for trusted code in local execution).
**Warning signs:** Bead execution takes excessively long or produces no output.

### Pitfall 3: Nested Claude Sessions

**What goes wrong:** Running `claude -p` from inside a claude session fails with "Claude Code cannot be launched inside another Claude Code session."
**Why it happens:** The CLAUDECODE environment variable is set in parent sessions.
**How to avoid:** The execute.md template runs as a Task subagent. The Task subagent can run Bash commands that invoke `claude -p`. The key: `claude -p` spawns its OWN process with unset CLAUDECODE. Use: `env -u CLAUDECODE claude -p "..."` or `unset CLAUDECODE && claude -p "..."` in the Bash command.
**Warning signs:** Error message about nested sessions. This is the MOST CRITICAL pitfall for headless execution.

### Pitfall 4: Empty .beads/ Directory After Conversion

**What goes wrong:** Skill invocation succeeds but produces no bead files (e.g., PRD format mismatch).
**Why it happens:** The bead creation skill may silently produce zero beads if PRD structure doesn't match expected format.
**How to avoid:** After skill invocation, check `ls .beads/*.md 2>/dev/null | wc -l`. If zero, block with error per user decision. Offer: retry / edit PRD / abort.
**Warning signs:** `.beads/` directory exists but is empty, or doesn't exist at all.

### Pitfall 5: Result File Directory Not Created

**What goes wrong:** Writing to `.claude/pipeline/bead-results/` fails because directory doesn't exist.
**Why it happens:** First execution, directory never created.
**How to avoid:** Always `mkdir -p .claude/pipeline/bead-results` before writing result files.
**Warning signs:** File write errors during execution.

### Pitfall 6: Git Diff Scope for Review

**What goes wrong:** Review agents analyze the wrong diff (all changes since main vs. just the bead-execution changes).
**Why it happens:** Using `git diff main...HEAD` includes all prior pipeline work, not just bead execution output.
**How to avoid:** Before bead execution, record the current HEAD commit. After execution, use `git diff {pre_execution_commit}...HEAD` to scope the review to only bead-produced code changes.
**Warning signs:** Review agents flagging issues in pipeline infrastructure files, not in the project code.

### Pitfall 7: Bead Name Extraction

**What goes wrong:** Bead filenames contain spaces or special characters that break bash variable interpolation.
**Why it happens:** Bead names derived from user story titles may contain arbitrary characters.
**How to avoid:** Always quote bead paths in bash. Use `basename "$bead" .md` with quotes. Test with names like `US-001 Database Schema.md`.
**Warning signs:** Bash errors about unexpected tokens or missing files.

## Code Examples

### Convert Template: Frontend Story Detection

```bash
# Detect frontend stories by scanning PRD content
# Look for tags/keywords in user story sections
grep -n -i "frontend\|UI\|interface\|component\|page\|view\|layout\|screen\|dashboard" \
  .planning/pipeline/prd.md | head -20
```

Frontend stories should have the /frontend-design skill instruction injected into bead acceptance criteria. Detection is by content, not by explicit tag -- scan the user story description and acceptance criteria for frontend-related keywords.

### Execute Template: Headless Bead Loop

```bash
# Core headless execution loop
mkdir -p .claude/pipeline/bead-results
PRE_EXEC_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "none")

BEADS=($(ls .beads/*.md 2>/dev/null | sort))
TOTAL=${#BEADS[@]}
PASSED=0
FAILED=0

for i in "${!BEADS[@]}"; do
  bead="${BEADS[$i]}"
  BEAD_NAME=$(basename "$bead" .md)
  IDX=$((i + 1))

  echo "Executing bead ${IDX}/${TOTAL}: ${BEAD_NAME}"

  BEAD_CONTENT=$(cat "$bead")

  # Execute with permissions bypass for unattended mode
  env -u CLAUDECODE claude -p "$BEAD_CONTENT" \
    --allowedTools "Read,Edit,Bash,Grep,Glob,Write" \
    --output-format json \
    --dangerously-skip-permissions \
    2>/dev/null

  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 0 ]; then
    STATUS="passed"
    PASSED=$((PASSED + 1))
  else
    STATUS="failed"
    FAILED=$((FAILED + 1))
  fi

  # Write result file (status-only per user decision)
  cat > ".claude/pipeline/bead-results/${BEAD_NAME}.md" << RESULT_EOF
---
status: ${STATUS}
bead: ${BEAD_NAME}
executed: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
---
RESULT_EOF

  echo "  -> ${STATUS}"

  if [ "$STATUS" = "failed" ]; then
    echo "Batch stopped. ${PASSED}/${TOTAL} passed, 1 failed."
    echo "Failed bead: ${BEAD_NAME}"
    break
  fi
done

echo ""
echo "Execution complete: ${PASSED} passed, ${FAILED} failed out of ${TOTAL} beads."
```

### Review Template: Result Aggregation

```bash
# Aggregate bead results after execution
RESULT_DIR=".claude/pipeline/bead-results"
PASSED=$(grep -rl "status: passed" "$RESULT_DIR" 2>/dev/null | wc -l | tr -d ' ')
FAILED=$(grep -rl "status: failed" "$RESULT_DIR" 2>/dev/null | wc -l | tr -d ' ')
BLOCKED=$(grep -rl "status: blocked" "$RESULT_DIR" 2>/dev/null | wc -l | tr -d ' ')
TOTAL=$((PASSED + FAILED + BLOCKED))

echo "Results: ${PASSED} passed, ${FAILED} failed, ${BLOCKED} blocked (${TOTAL} total)"
```

### Review Template: Draft PR Creation

```bash
# Create draft PR after successful review
BRANCH=$(git branch --show-current)
gh pr create \
  --draft \
  --title "feat: ${FEATURE_NAME}" \
  --body "## Summary

Automated pipeline execution of ${TOTAL} beads.
- Passed: ${PASSED}
- Failed: ${FAILED}

## Review

Post-execution review completed:
- P1 (Critical): ${P1_COUNT}
- P2 (Important): ${P2_COUNT}
- P3 (Minor): ${P3_COUNT}

## Next Steps

Promote to ready for review after final check."
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `--max-turns` flag for limiting claude -p | `--max-budget-usd` for cost control | Recent CLI updates | Use budget instead of turn limits for more predictable execution |
| Custom process management | `claude -p` with `--output-format json` | CLI v1.0.33+ | Structured output with session_id, result, and metadata |
| Resume failed sessions | `--continue` / `--resume` with session_id | Current | Can resume specific sessions by ID if needed |

**Deprecated/outdated:**
- `--mcp-debug` flag: Deprecated, use `--debug` instead
- No `--max-turns` flag was found in current CLI help -- use `--max-budget-usd` for execution limits

## Open Questions

1. **CLAUDECODE environment variable bypass**
   - What we know: `claude -p` cannot run inside an existing Claude Code session without unsetting CLAUDECODE
   - What's unclear: Whether `env -u CLAUDECODE` is sufficient or if other env vars also need clearing
   - Recommendation: Test `env -u CLAUDECODE claude -p "echo test"` in a real session. If it fails, try `unset CLAUDECODE` in a subshell. Document the working pattern.

2. **Bead content as prompt vs. file reference**
   - What we know: `claude -p "prompt"` takes the prompt as a string argument
   - What's unclear: Whether large bead files (500+ lines) can be passed as inline prompt or need a different approach (e.g., `cat bead.md | claude -p -`)
   - Recommendation: Test with a large bead. If inline fails, use stdin piping: `cat .beads/bead.md | claude -p`

3. **--dangerously-skip-permissions safety**
   - What we know: This flag bypasses all permission checks. Documentation says "Recommended only for sandboxes with no internet access."
   - What's unclear: Whether `--allowedTools` alone is sufficient for unattended bead execution, or if some tools still prompt
   - Recommendation: Start with `--allowedTools` only. If beads still hang on permissions, add `--dangerously-skip-permissions`. Document the minimal permission set.

4. **PHASE_FILES mapping for execute and review templates**
   - What we know: Current PHASE_FILES for execute is empty, review is empty (from SKILL.md PHASE_FILES table)
   - What's unclear: Whether execute template needs upstream files (e.g., PRD for context) and whether review needs execution results
   - Recommendation: Execute template needs `.planning/pipeline/convert.md` to know what beads were created. Review template needs no PHASE_FILES since it reads git diff and bead-results directly. Update PHASE_FILES mapping in orchestrator.cjs or SKILL.md.

## Sources

### Primary (HIGH confidence)
- Claude Code CLI `--help` output (verified locally, current version)
- Official Claude Code headless docs: https://code.claude.com/docs/en/headless
- Existing project templates: templates/research.md, templates/deepen.md, templates/resolve.md, templates/prd.md (verified patterns)
- Existing project code: lib/orchestrator.cjs, SKILL.md (verified PIPELINE_PHASES and PHASE_FILES)
- Compound review agents: ~/.claude/skills/compound-agents/review/ (4 agents confirmed)
- Bead creation skills: ~/.claude/skills/ralph-tui-create-beads/, ~/.claude/skills/ralph-tui-create-beads-rust/, ~/.claude/skills/ralph-tui-create-json/ (all confirmed installed)

### Secondary (MEDIUM confidence)
- CONCERNS.md aggregation problem and fix approach (project-internal reference)
- GSD execute-phase.md patterns for wave-based execution and result aggregation
- WebSearch results on claude -p exit codes and permission handling

### Tertiary (LOW confidence)
- CLAUDECODE environment variable bypass technique (needs real-world validation)
- Large bead content piping behavior (needs testing)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all tools/skills verified locally, CLI flags confirmed from --help output
- Architecture: HIGH - patterns directly derived from Phase 3 templates already working in production
- Pitfalls: MEDIUM - nested session issue and permission handling need real-world validation
- Code examples: MEDIUM - bash loops and claude -p invocations are based on documented flags but untested in this specific pipeline context

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (30 days -- Claude Code CLI evolves but core -p flag is stable)
