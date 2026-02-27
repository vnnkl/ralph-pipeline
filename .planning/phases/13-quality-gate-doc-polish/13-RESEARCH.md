# Phase 13: Quality Gate + Doc Polish - Research

**Researched:** 2026-02-27
**Domain:** Template prompt engineering, orchestrator constants, CLI documentation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Re-running a bead from review gate appends QUALITY_GATE_SUFFIX **plus** bead-specific review findings
- Standard quality gates (run tests, run type checker) always included -- same as execute.md
- Review findings filtered to only P1/P2 items relevant to the specific bead being re-run (match by files modified)
- Findings appended inline in the suffix text so the bead agent sees exact issues to fix
- Fix the specific audit flag -- add clarify.md to PHASE_FILES for all templates that read it inline
- Add to deepen (phase 5) and resolve (phase 6) in addition to wherever else the audit flagged
- Update both orchestrator code (lib/orchestrator.cjs) AND SKILL.md PHASE_FILES table to stay in sync
- No full audit of all 9 phases -- just fix what's flagged
- Full flag/argument reference for each time-budget subcommand (not one-liners)
- Each entry includes signature + usage example (e.g., `node ralph-tools.cjs time-budget start 4`)
- Include YOLO mode documentation alongside standard subcommands (start, check, estimate)
- All time-budget functionality documented in one place in SKILL.md

### Claude's Discretion
None -- all decisions locked.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXEC-03 | Bead results written to structured results directory with pass/fail per bead | The review re-run path at review.md line 507 currently executes beads without QUALITY_GATE_SUFFIX, meaning re-run beads may not enforce tests/type checks, producing unreliable pass/fail results. Fix: append the same suffix used in execute.md plus filtered review findings. |
| REVW-03 | Review gate: fix P1s, fix P1+P2, skip, re-run, or create PR | The "Re-run bead X" option (option 6) at review.md line 484 currently re-executes without quality gates, creating a gap where re-run beads bypass enforcement. Fix: define QUALITY_GATE_SUFFIX + REVIEW_FINDINGS_SUFFIX and pipe both to the bead agent. |
</phase_requirements>

## Summary

This phase closes three distinct but small tech debt items identified in the v1.0 milestone audit. All changes are surgical edits to existing files -- no new files, no new libraries, no architectural changes. The domain is template prompt engineering (appending suffix text to bead invocations), orchestrator constant alignment (PHASE_FILES), and CLI documentation (SKILL.md table).

The highest-risk change is the QUALITY_GATE_SUFFIX addition to review.md's re-run path, because it requires filtering P1/P2 findings by files modified in the specific bead. This filtering must happen in the template instructions (the review orchestrator agent parses findings and constructs the suffix), not in code. The other two changes (PHASE_FILES and CLI table) are pure documentation/constant alignment with zero behavioral risk.

**Primary recommendation:** Make all three changes in a single plan with three tasks. Each task touches different files with no overlap, so they could theoretically be parallel, but sequential is fine given the small scope.

## Standard Stack

Not applicable -- this phase modifies existing markdown templates and one documentation file. No new libraries or tools are introduced.

## Architecture Patterns

### Pattern 1: Quality Gate Suffix Piping (existing)

**What:** The execute.md template defines a bash variable QUALITY_GATE_SUFFIX before the bead loop and appends it to each bead's stdin via `(cat bead.md; echo "$QUALITY_GATE_SUFFIX")`.
**When to use:** Any bead execution path (execute.md headless mode, execute.md re-run, review.md re-run bead X).
**Current code (execute.md lines 156-163):**

```bash
QUALITY_GATE_SUFFIX="

---
QUALITY GATES (mandatory before reporting success):
1. If the project has a test suite, run the relevant tests. Your work is not complete until tests pass.
2. If the project uses a typed language (TypeScript, Go, Rust, etc.), run the type checker. Your work is not complete until type checks pass.
3. If both tests and type checks fail, fix the issues before reporting success.
Your exit code MUST reflect the actual state: exit 0 only if your implementation is correct AND quality gates pass."
```

**Piping pattern (execute.md line 187):**

```bash
(cat "{{CWD}}/.beads/{BEAD_NAME}.md"; echo "$QUALITY_GATE_SUFFIX") | env -u CLAUDECODE claude -p \
  --allowedTools "Read,Edit,Bash,Grep,Glob,Write" \
  --output-format json \
  --dangerously-skip-permissions
```

**Confidence:** HIGH -- verified from actual template source.

### Pattern 2: Augmented Suffix with Review Findings (new)

**What:** For the review re-run path, the suffix must include the standard QUALITY_GATE_SUFFIX as a base, then append a REVIEW FINDINGS section with P1/P2 items filtered to the specific bead being re-run.
**How filtering works:** The review orchestrator agent already has all review findings loaded from `review-security.md`, `review-architecture.md`, `review-simplicity.md`, `review-performance.md`. The agent filters findings by matching `file:line` references against the files modified by the bead. To determine which files a bead modifies, the agent reads the bead file and extracts mentioned file paths, or reads the result file for the bead.

**Augmented suffix structure (per CONTEXT.md decision):**

```
---
QUALITY GATES (mandatory before reporting success):
1. If the project has a test suite, run the relevant tests. Your work is not complete until tests pass.
2. If the project uses a typed language (TypeScript, Go, Rust, etc.), run the type checker. Your work is not complete until type checks pass.
3. If both tests and type checks fail, fix the issues before reporting success.
Your exit code MUST reflect the actual state: exit 0 only if your implementation is correct AND quality gates pass.

---
REVIEW FINDINGS (fix these issues from the previous review):
{filtered P1/P2 findings with file:line references and fix suggestions}
```

**Confidence:** HIGH -- directly implements CONTEXT.md locked decisions.

### Pattern 3: PHASE_FILES Declaration (existing)

**What:** The PHASE_FILES table in SKILL.md Step 4 defines which upstream files are injected into each template's `<files_to_read>` block via the `{{PHASE_FILES}}` variable.
**Current gap:** Deepen (phase 5) and resolve (phase 6) read `clarify.md` inline via hardcoded path in their template instructions, but `clarify.md` is not declared in PHASE_FILES. This is a documentation/consistency issue -- the templates work correctly today because the agent reads the file in Step 1 instructions. Adding it to PHASE_FILES makes the dependency explicit in `<files_to_read>`.

**Where to change:**
1. SKILL.md PHASE_FILES table (lines 182-192): Add `- .planning/pipeline/clarify.md` to phases 5 and 6

**Important note:** There is no PHASE_FILES constant in `lib/orchestrator.cjs`. The PIPELINE_PHASES array in orchestrator.cjs defines `id`, `slug`, `displayName`, `template`, `gateOptions` -- it does NOT have a `phaseFiles` field. The PHASE_FILES computation is documented only in SKILL.md's Step 4 table, and the orchestrator agent follows those instructions when dispatching. So the "orchestrator code" change mentioned in CONTEXT.md means updating the SKILL.md table (which IS the orchestrator's dispatch instructions), not editing orchestrator.cjs.

**Confidence:** HIGH -- verified by reading orchestrator.cjs (no PHASE_FILES constant exists) and SKILL.md (table at line 182).

### Anti-Patterns to Avoid

- **Duplicating QUALITY_GATE_SUFFIX text:** The review template should contain the exact same quality gate text as execute.md. Since templates are independent prompt files (not code modules), duplication is acceptable and preferred for clarity -- each template is self-contained.
- **Over-filtering findings:** When filtering P1/P2 findings for a specific bead, don't try to parse file paths from the bead content with regex. Read the bead file, identify what it works on from its description/acceptance criteria, and match against finding file references. If uncertain, include the finding.
- **Editing orchestrator.cjs for PHASE_FILES:** The PHASE_FILES constant does NOT exist in orchestrator.cjs code. The PIPELINE_PHASES array has no `phaseFiles` property. The SKILL.md table is the single source of truth. Do not add a phaseFiles field to the PIPELINE_PHASES array.

## Don't Hand-Roll

Not applicable -- this phase makes surgical edits to existing files only.

## Common Pitfalls

### Pitfall 1: Misunderstanding Where PHASE_FILES Lives

**What goes wrong:** Attempting to edit `lib/orchestrator.cjs` to add PHASE_FILES values, or adding a `phaseFiles` field to the PIPELINE_PHASES array.
**Why it happens:** CONTEXT.md says "Update both orchestrator code (lib/orchestrator.cjs) AND SKILL.md PHASE_FILES table to stay in sync." This is misleading because PHASE_FILES is not a code constant -- it's a dispatch instruction table in SKILL.md that the orchestrator agent reads and follows at runtime.
**How to avoid:** Only edit the SKILL.md PHASE_FILES table (lines 182-192). Do NOT modify `lib/orchestrator.cjs` for this change. The PIPELINE_PHASES array has no phaseFiles property and should not be given one.
**Warning signs:** Any diff to `lib/orchestrator.cjs` in this phase is a red flag.

### Pitfall 2: Missing the Bash Variable Quoting in Suffix

**What goes wrong:** The augmented suffix contains review findings with special characters (quotes, backticks, dollar signs) that break bash variable assignment.
**Why it happens:** Review findings contain code references and fix suggestions with arbitrary text.
**How to avoid:** The template instructions should tell the agent to construct the suffix using a heredoc with single-quoted delimiter to prevent variable expansion:

```bash
cat > /tmp/bead-quality-suffix.txt << 'SUFFIX_EOF'
{quality gates + review findings}
SUFFIX_EOF
(cat "{{CWD}}/.beads/{BEAD_NAME}.md"; cat /tmp/bead-quality-suffix.txt) | env -u CLAUDECODE claude -p ...
```

**Warning signs:** Bash errors during bead re-execution about unexpected tokens or unterminated strings.

### Pitfall 3: Filtering Findings Too Aggressively

**What goes wrong:** No findings match the specific bead, so the bead agent gets an empty REVIEW FINDINGS section and misses issues.
**Why it happens:** File path matching is imprecise -- bead descriptions may not list exact file paths, or findings may reference files the bead didn't explicitly mention but still affects.
**How to avoid:** Per CONTEXT.md: "Review findings filtered to only P1/P2 items relevant to the specific bead being re-run (match by files modified)." If no findings match, include ALL P1/P2 findings as a fallback with a note: "Could not determine bead-specific findings. Showing all P1/P2 items."
**Warning signs:** Empty REVIEW FINDINGS section in the augmented suffix.

## Code Examples

### Example 1: Review Re-run with Augmented Suffix (review.md change)

The re-run bead path (currently at review.md line 504-511) should be updated to:

```markdown
Before executing the bead, construct the augmented quality gate suffix:

1. Start with the standard quality gate text (same as execute.md).

2. Read the bead file to identify which files it modifies (from its description,
   acceptance criteria, or file references).

3. Filter the P1/P2 findings from the review output files to only those whose
   file:line references match files the bead works on. If no findings match,
   include ALL P1/P2 findings.

4. Append the filtered findings as a REVIEW FINDINGS section.

5. Write the combined suffix to a temp file and pipe it with the bead:
   cat > /tmp/bead-quality-suffix.txt << 'SUFFIX_EOF'
   {constructed suffix}
   SUFFIX_EOF
   (cat bead.md; cat /tmp/bead-quality-suffix.txt) | env -u CLAUDECODE claude -p ...
```

**Confidence:** HIGH -- follows execute.md pattern with CONTEXT.md-specified augmentation.

### Example 2: Updated PHASE_FILES Table (SKILL.md change)

Current:
```
| 5 - deepen | `- .planning/pipeline/prd.md` |
| 6 - resolve | `- .planning/pipeline/prd.md\n- .planning/pipeline/open-questions.md` |
```

Updated:
```
| 5 - deepen | `- .planning/pipeline/prd.md\n- .planning/pipeline/clarify.md` |
| 6 - resolve | `- .planning/pipeline/prd.md\n- .planning/pipeline/open-questions.md\n- .planning/pipeline/clarify.md` |
```

**Confidence:** HIGH -- verified both templates read clarify.md inline (deepen.md line 24, resolve.md line 23).

### Example 3: Time Budget CLI Reference Entries (SKILL.md change)

The current CLI Reference table has a single row for time-budget. Replace with expanded entries:

```
| `time-budget start <hours>` | Start a time budget. Sets absolute expiry timestamp. Example: `node ralph-tools.cjs time-budget start 4` |
| `time-budget check` | Check budget status. Returns: has_budget, expired, remaining_ms, remaining_display |
| `time-budget record-bead <ms>` | Record bead duration (ms). Updates weighted running average. Example: `node ralph-tools.cjs time-budget record-bead 120000` |
| `time-budget estimate` | Estimate remaining beads in budget. Uses historical avg or 20min default on first run |
```

Note: YOLO mode uses the same subcommands. In YOLO mode, `start` is called if time_budget_hours was pre-configured; `check` runs at phase boundaries (Step 7a); `record-bead` runs after each headless bead execution; `estimate` runs after budget check. No YOLO-specific subcommands exist.

**Confidence:** HIGH -- verified from ralph-tools.cjs (lines 280-298) and lib/time-budget.cjs function signatures.

## State of the Art

Not applicable -- this phase fixes existing tech debt, no ecosystem changes involved.

## Open Questions

1. **Should PHASE_FILES for deepen/resolve list clarify.md before or after existing entries?**
   - What we know: PHASE_FILES values are newline-separated in the `<files_to_read>` block. Order may affect which file the agent reads first.
   - What's unclear: Whether the agent reads files in the order listed or all at once.
   - Recommendation: Append clarify.md after existing entries (prd.md is the primary input for both deepen and resolve; clarify.md is supplementary context). This matches existing patterns -- prd (phase 4) lists SUMMARY.md before clarify.md. LOW risk either way.

## Sources

### Primary (HIGH confidence)
- `lib/orchestrator.cjs` -- PIPELINE_PHASES array structure verified (no phaseFiles field)
- `templates/execute.md` -- QUALITY_GATE_SUFFIX definition and piping pattern (lines 156-187)
- `templates/review.md` -- Re-run bead X path (lines 484-530)
- `templates/deepen.md` -- Inline clarify.md read (line 24)
- `templates/resolve.md` -- Inline clarify.md read (line 23)
- `SKILL.md` -- PHASE_FILES table (lines 182-192), CLI Reference table (lines 369-389)
- `ralph-tools.cjs` -- time-budget command routing (lines 280-298)
- `lib/time-budget.cjs` -- Subcommand signatures and behavior
- `.planning/v1.0-MILESTONE-AUDIT.md` -- Gap identification and tech debt items

## Metadata

**Confidence breakdown:**
- Architecture: HIGH -- all changes are well-scoped edits to existing files with clear patterns to follow
- Pitfalls: HIGH -- identified from actual code inspection, not hypothetical
- Implementation: HIGH -- three independent surgical edits with no cross-dependencies

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable -- internal project templates, no external dependencies)
