<objective>
Execute {{PIPELINE_DISPLAY_NAME}} phase ({{PHASE_ID}} of 9) for the current pipeline project.

Run parallel review agents against actual bead-produced code changes (git diff), categorize findings as P1/P2/P3, and present a multi-option review gate including PR creation.
</objective>

<files_to_read>
- {{STATE_PATH}}
- {{CONFIG_PATH}}
{{PHASE_FILES}}
</files_to_read>

<instructions>
## Review Phase

You are a post-execution code review orchestrator. Your job is to scope the review diff to bead-produced changes, spawn parallel review agents, collect findings with P1/P2/P3 severity, deduplicate across agents, and present a gate with fix/re-run/PR options.

**Key difference from deepen phase:** Deepen reviews the PRD document (design-time). Review reviews the git diff of actual code changes (post-execution).

### Step 1: Read Context

Read the files listed in files_to_read above.

Read the execution output to get the pre-execution commit hash:

```
.planning/pipeline/execute.md
```

From the execute.md frontmatter, extract `pre_exec_commit`. If not found or empty, try the fallback:

```bash
cat .claude/pipeline/pre-exec-commit.txt 2>/dev/null || echo "none"
```

Store as `PRE_EXEC_COMMIT`.

Aggregate bead results from the results directory:

```bash
ls .claude/pipeline/bead-results/*.md 2>/dev/null
```

For each result file, read its frontmatter to extract `status` and `bead` fields. Count: `PASSED`, `FAILED`, `BLOCKED`.

Also read the total bead count from execute.md frontmatter field `total_beads`, or count the result files.

### Step 2: Compute Review Diff

Get the diff scoped to bead-produced changes:

```bash
PRE_EXEC_COMMIT=$(cat .claude/pipeline/pre-exec-commit.txt 2>/dev/null || echo "none")
```

If `PRE_EXEC_COMMIT` is "none" or empty, fall back to a best-effort diff using the bead count:

```bash
BEAD_COUNT=$(ls .claude/pipeline/bead-results/*.md 2>/dev/null | wc -l | tr -d ' ')
git diff HEAD~${BEAD_COUNT}...HEAD
```

Otherwise, use the scoped diff:

```bash
git diff ${PRE_EXEC_COMMIT}...HEAD
```

Store the full diff output as `REVIEW_DIFF`.

Also capture diff stats for the summary:

```bash
git diff ${PRE_EXEC_COMMIT}...HEAD --stat
```

If the diff is empty, log a warning: "Review diff is empty. Beads may not have committed changes. Proceeding with empty diff -- review agents will have limited findings." Continue anyway.

### Step 3: Show Execution Summary

Before launching review agents, present the execution context:

```
## Execution Summary

**Bead Results:** {PASSED} passed, {FAILED} failed, {BLOCKED} blocked out of {total} beads
**Diff Scope:** {PRE_EXEC_COMMIT}...HEAD
**Diff Stats:** {N} files changed, {M} insertions(+), {K} deletions(-)

Starting compound code review...
```

### Step 4: Spawn Parallel Review Agents

Spawn 4 Task subagents in parallel using `run_in_background=true`. Each agent reads its definition from `~/.claude/skills/compound-agents/review/`, receives the REVIEW_DIFF, and writes findings to a distinct output file.

**IMPORTANT:** Each Task prompt must start with reading the agent definition file. Include the full REVIEW_DIFF in each prompt so agents have complete context.

**IMPORTANT:** Do NOT use the Skill tool inside Task subagents. Use only Read, Write, Bash, Grep, and Glob tools.

---

**Agent 1 -- Security Sentinel**

Spawn a Task with `run_in_background=true`:

```
First, read ~/.claude/skills/compound-agents/review/security-sentinel.md for your role and instructions.

You are reviewing actual CODE CHANGES (git diff) for security issues in bead-produced code. This is post-execution review of real implementation, not design review.

CODE CHANGES (git diff):
{paste the full REVIEW_DIFF}

YOUR TASK:
Review these code changes for security vulnerabilities:
- Hardcoded secrets, API keys, or credentials in committed code
- SQL injection, XSS, or command injection vectors
- Missing input validation or sanitization
- Authentication/authorization bypasses
- Insecure data handling (plaintext passwords, unencrypted PII)
- Unsafe deserialization or eval usage
- Missing CSRF/CORS protections where applicable
- Dependency vulnerabilities (known CVEs if identifiable)

For each finding, assign severity:
- P1 (Critical): Blocks merge -- exploitable security vulnerability, credential exposure, data loss risk
- P2 (Important): Should fix before merge -- significant security weakness, missing validation
- P3 (Minor): Nice-to-have -- defense in depth, security best practice suggestion

Write your complete findings to: {{CWD}}/.planning/pipeline/review-security.md

Use this format:
---
agent: security-sentinel
completed: true
finding_count: {total findings}
p1_count: {P1 count}
p2_count: {P2 count}
p3_count: {P3 count}
---
# Security Review

## P1 -- Critical
{findings with file:line references and fix suggestion, or "None"}

## P2 -- Important
{findings with file:line references and fix suggestion, or "None"}

## P3 -- Minor
{findings with file:line references and fix suggestion, or "None"}
```

---

**Agent 2 -- Architecture Strategist**

Spawn a Task with `run_in_background=true`:

```
First, read ~/.claude/skills/compound-agents/review/architecture-strategist.md for your role and instructions.

You are reviewing actual CODE CHANGES (git diff) for architectural concerns in bead-produced code. This is post-execution review of real implementation.

CODE CHANGES (git diff):
{paste the full REVIEW_DIFF}

YOUR TASK:
Review these code changes for architectural quality:
- Component boundaries and separation of concerns in the actual code
- Coupling between modules (tight coupling, circular dependencies)
- Consistent patterns across files (naming, structure, error handling)
- Proper abstraction levels (over-abstraction or under-abstraction)
- Missing interfaces or contracts between components
- Code organization and file structure clarity
- Breaking changes to existing APIs or contracts

For each finding, assign severity:
- P1 (Critical): Blocks merge -- architectural flaw requiring major refactoring to fix later
- P2 (Important): Should fix before merge -- significantly improves maintainability
- P3 (Minor): Suggestion -- alternative approach worth considering

Write your complete findings to: {{CWD}}/.planning/pipeline/review-architecture.md

Use this format:
---
agent: architecture-strategist
completed: true
finding_count: {total findings}
p1_count: {P1 count}
p2_count: {P2 count}
p3_count: {P3 count}
---
# Architecture Review

## P1 -- Critical
{findings with file:line references and fix suggestion, or "None"}

## P2 -- Important
{findings with file:line references and fix suggestion, or "None"}

## P3 -- Minor
{findings with file:line references and fix suggestion, or "None"}
```

---

**Agent 3 -- Code Simplicity Reviewer**

Spawn a Task with `run_in_background=true`:

```
First, read ~/.claude/skills/compound-agents/review/code-simplicity-reviewer.md for your role and instructions.

You are reviewing actual CODE CHANGES (git diff) for unnecessary complexity in bead-produced code. This is post-execution review of real implementation.

CODE CHANGES (git diff):
{paste the full REVIEW_DIFF}

YOUR TASK:
Review these code changes for simplicity and over-engineering:
- Unnecessary abstractions or indirection layers
- Over-engineered patterns (factory of factories, unnecessary generics)
- Dead code or unused imports
- Functions that are too long or do too many things
- Deeply nested conditionals or callback pyramids
- Duplicated code that should be extracted
- Premature optimization without evidence of need
- Configuration or options that will never be used

For each finding, assign severity:
- P1 (Critical): Blocks merge -- significant over-engineering that harms readability and maintenance
- P2 (Important): Should simplify -- reduces complexity meaningfully
- P3 (Minor): Consider -- marginal simplification opportunity

Write your complete findings to: {{CWD}}/.planning/pipeline/review-simplicity.md

Use this format:
---
agent: code-simplicity-reviewer
completed: true
finding_count: {total findings}
p1_count: {P1 count}
p2_count: {P2 count}
p3_count: {P3 count}
---
# Simplicity Review

## P1 -- Critical
{findings with file:line references and fix suggestion, or "None"}

## P2 -- Important
{findings with file:line references and fix suggestion, or "None"}

## P3 -- Minor
{findings with file:line references and fix suggestion, or "None"}
```

---

**Agent 4 -- Performance Oracle**

Spawn a Task with `run_in_background=true`:

```
First, read ~/.claude/skills/compound-agents/review/performance-oracle.md for your role and instructions.

You are reviewing actual CODE CHANGES (git diff) for performance concerns in bead-produced code. This is post-execution review of real implementation.

CODE CHANGES (git diff):
{paste the full REVIEW_DIFF}

YOUR TASK:
Review these code changes for performance issues:
- N+1 query patterns or excessive database calls
- Missing caching for frequently accessed data
- Synchronous I/O in hot paths
- Unbounded data fetching (missing pagination or limits)
- Memory leaks (unclosed connections, event listener accumulation)
- Inefficient algorithms (O(n^2) where O(n) is possible)
- Large bundle size contributions (unnecessary dependencies)
- Missing async/await or blocking operations

For each finding, assign severity:
- P1 (Critical): Blocks merge -- performance issue causing visible degradation or resource exhaustion
- P2 (Important): Should fix before merge -- significant performance improvement opportunity
- P3 (Minor): Consider -- optimization that can be deferred

Write your complete findings to: {{CWD}}/.planning/pipeline/review-performance.md

Use this format:
---
agent: performance-oracle
completed: true
finding_count: {total findings}
p1_count: {P1 count}
p2_count: {P2 count}
p3_count: {P3 count}
---
# Performance Review

## P1 -- Critical
{findings with file:line references and fix suggestion, or "None"}

## P2 -- Important
{findings with file:line references and fix suggestion, or "None"}

## P3 -- Minor
{findings with file:line references and fix suggestion, or "None"}
```

### Step 5: Collect and Present Findings

After all 4 agents complete, read their output files:

```
.planning/pipeline/review-security.md
.planning/pipeline/review-architecture.md
.planning/pipeline/review-simplicity.md
.planning/pipeline/review-performance.md
```

If any agent file is missing, log a warning: "Agent {name} produced no output -- skipping." Continue with available findings.

Parse the frontmatter from each file to extract finding counts. Then read the body content of each file.

**Deduplicate findings across agents:** If the same issue is flagged by multiple agents (same file, same line range, same concern), keep the highest-severity instance and note which agents flagged it. Present deduplicated findings only.

Format the combined findings report:

```
## Code Review Findings

### Security (security-sentinel)
{body content from review-security.md, or "Agent produced no output"}

### Architecture (architecture-strategist)
{body content from review-architecture.md, or "Agent produced no output"}

### Simplicity (code-simplicity-reviewer)
{body content from review-simplicity.md, or "Agent produced no output"}

### Performance (performance-oracle)
{body content from review-performance.md, or "Agent produced no output"}

---

**Deduplicated totals:**
**Total findings:** {sum of all finding_count values, minus duplicates}
**Critical (P1):** {count} -- blocks merge
**Important (P2):** {count}
**Minor (P3):** {count}

{if duplicates found: "Note: {N} duplicate findings removed (same issue found by multiple agents)."}
```

Present this report to the user.

### Step 6: Present Review Gate

Read the pipeline mode:
```bash
node ralph-tools.cjs config-get mode --raw
```

If mode is "yolo":
- Log: "YOLO mode: auto-selecting skip for review gate (accepting all findings)"
- Skip AskUserQuestion, go directly to Step 7 (Write Completion File)

If mode is NOT "yolo":

After presenting findings, present the review gate. Six options (locked decision from CONTEXT.md):

```
## Review Gate

Choose one:

1. **Fix P1s** -- Present P1 findings as a checklist for manual fixing. No auto-fix agent.
2. **Fix P1+P2** -- Present P1 and P2 findings as a checklist for manual fixing.
3. **Skip** -- Accept all findings as-is, proceed without fixes.
4. **Re-run** -- Delete old review files, re-run all 4 review agents fresh.
5. **Create PR** -- Create a draft PR with review findings summary.
6. **Re-run bead X** -- Re-execute a specific bead, then optionally re-review.
```

Wait for the user's response.

**If user selects "Fix P1s" (or "1" or "fix p1s"):**

Present the P1 findings as a numbered checklist:

```
## P1 Findings -- Manual Fix Checklist

- [ ] 1. {P1 finding description} ({file}:{line}) -- {fix suggestion}
- [ ] 2. {P1 finding description} ({file}:{line}) -- {fix suggestion}
...

Apply these fixes manually, then respond with "done" when ready.
```

Wait for the user to signal "done". Then ask:

```
Fixes applied. Choose one:
1. **Re-run review** -- Re-run all 4 agents to verify fixes
2. **Proceed** -- Continue as-is
```

If "Re-run review": delete old review-*.md files and go back to Step 4.
If "Proceed": go to Step 7.

**If user selects "Fix P1+P2" (or "2" or "fix p1+p2"):**

Present the P1 and P2 findings as a numbered checklist:

```
## P1+P2 Findings -- Manual Fix Checklist

### P1 -- Critical (must fix)
- [ ] 1. {finding} ({file}:{line}) -- {fix suggestion}

### P2 -- Important (should fix)
- [ ] 1. {finding} ({file}:{line}) -- {fix suggestion}
...

Apply these fixes manually, then respond with "done" when ready.
```

Wait for "done". Then ask re-run review or proceed (same as Fix P1s above).

**If user selects "Skip" (or "3" or "skip"):**

Go directly to Step 7 (Write Completion File).

**If user selects "Re-run" (or "4" or "re-run"):**

Delete old review output files:

```bash
rm -f .planning/pipeline/review-security.md .planning/pipeline/review-architecture.md .planning/pipeline/review-simplicity.md .planning/pipeline/review-performance.md
```

Go back to Step 4 (spawn all 4 agents fresh).

**If user selects "Create PR" (or "5" or "create pr"):**

Compute the branch name and create a draft PR:

```bash
BRANCH=$(git branch --show-current)
```

Build the PR body from the review findings and bead results:

```bash
gh pr create --draft \
  --title "feat: {{PIPELINE_PHASE}} pipeline output" \
  --body "## Pipeline Review Summary

### Bead Execution
- **Passed:** {PASSED}/{total}
- **Failed:** {FAILED}/{total}
- **Blocked:** {BLOCKED}/{total}

### Code Review Findings
- **P1 (Critical):** {p1_count}
- **P2 (Important):** {p2_count}
- **P3 (Minor):** {p3_count}

### Review Agents
- Security Sentinel: {finding_count} findings
- Architecture Strategist: {finding_count} findings
- Code Simplicity Reviewer: {finding_count} findings
- Performance Oracle: {finding_count} findings

---
*Generated by ralph-pipeline review phase*"
```

Report the PR URL to the user. Then go to Step 7.

**If user selects "Re-run bead X" (or "6" or "re-run bead"):**

Present the list of beads with their execution status:

```
## Re-run Bead

Which bead do you want to re-execute?

| # | Bead | Status |
|---|------|--------|
| 1 | {bead_name} | {passed/failed/blocked} |
| 2 | {bead_name} | {passed/failed/blocked} |
...

Enter the bead number or name.
```

Wait for the user's response.

Before executing the bead, construct an augmented quality gate suffix:

1. Read the bead file (`{{CWD}}/.beads/{BEAD_NAME}.md`) to identify which files it modifies (from its description, acceptance criteria, or file path references).

2. Filter the P1 and P2 findings from the review output files (`review-security.md`, `review-architecture.md`, `review-simplicity.md`, `review-performance.md`) to only those whose file references overlap with files the bead works on. If no findings match, include ALL P1 and P2 findings as a fallback with the note: "Could not determine bead-specific findings. Showing all P1/P2 items."

3. Write the combined suffix to a temp file using a heredoc with single-quoted delimiter to prevent variable expansion issues from special characters in findings:

```bash
cat > /tmp/bead-quality-suffix.txt << 'SUFFIX_EOF'

---
QUALITY GATES (mandatory before reporting success):
1. If the project has a test suite, run the relevant tests. Your work is not complete until tests pass.
2. If the project uses a typed language (TypeScript, Go, Rust, etc.), run the type checker. Your work is not complete until type checks pass.
3. If both tests and type checks fail, fix the issues before reporting success.
Your exit code MUST reflect the actual state: exit 0 only if your implementation is correct AND quality gates pass.

---
REVIEW FINDINGS (fix these issues from the previous review):
{filtered P1/P2 findings with file references and fix suggestions}
SUFFIX_EOF
```

4. Execute the bead with the augmented suffix piped in:

```bash
(cat "{{CWD}}/.beads/{BEAD_NAME}.md"; cat /tmp/bead-quality-suffix.txt) | env -u CLAUDECODE claude -p \
  --allowedTools "Read,Edit,Bash,Grep,Glob,Write" \
  --output-format json \
  --dangerously-skip-permissions
```

IMPORTANT: The `{filtered P1/P2 findings...}` placeholder is instructions for the review orchestrator agent to fill in at runtime -- it is NOT a bash variable. The heredoc uses single-quoted `'SUFFIX_EOF'` to prevent bash expansion.

Capture the exit code. Update the result file in `.claude/pipeline/bead-results/{BEAD_NAME}.md` with the new status and timestamp.

Report the re-execution result:

```
Bead {BEAD_NAME} re-executed: {PASSED/FAILED}
```

Then ask:

```
Choose one:
1. **Re-run review** -- Re-run all 4 review agents against the updated diff
2. **Proceed** -- Continue as-is
```

If "Re-run review": delete old review-*.md files, recompute REVIEW_DIFF, and go back to Step 4.
If "Proceed": go to Step 7.

### Step 7: Write Completion File

Write `.planning/pipeline/review.md` with this structure:

```yaml
---
completed: true
findings_p1: {final P1 count}
findings_p2: {final P2 count}
findings_p3: {final P3 count}
pr_created: {true|false}
pr_url: {url or null}
---
```

Body: Include the final review findings summary (the report from Step 5).

### Step 8: Return Completion

Return:

## PHASE COMPLETE

</instructions>

<success_criteria>
- Output file exists at .planning/pipeline/{{PIPELINE_PHASE}}.md with `completed: true` in frontmatter
- Review diff scoped to bead-produced changes via pre_exec_commit...HEAD
- All 4 review agents spawned in parallel (security, architecture, simplicity, performance)
- Each agent reviews actual code diff, not the PRD
- Findings categorized as P1/P2/P3 with file:line references and fix suggestions
- Findings deduplicated across agents
- Review gate presented with all 6 options (fix P1s / fix P1+P2 / skip / re-run / create PR / re-run bead X)
- Fix options present manual checklist -- no auto-fix agent
- Create PR uses gh pr create --draft
- Re-run bead X re-executes a single bead via env -u CLAUDECODE claude -p
- PHASE COMPLETE returned on completion
</success_criteria>
