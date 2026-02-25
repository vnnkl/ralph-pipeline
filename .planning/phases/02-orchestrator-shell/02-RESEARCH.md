# Phase 2: Orchestrator Shell - Research

**Researched:** 2026-02-25
**Domain:** Claude Code skill orchestration, phase sequencing, Task subagent dispatch, /clear boundary patterns, user gate UX
**Confidence:** HIGH

## Summary

Phase 2 transforms the lean 72-line SKILL.md entry point (built in Phase 1) into a working orchestrator that sequences 9 pipeline phases, dispatches Task subagents per phase, verifies completion via `completed: true` frontmatter flags, and presents context-dependent user gates between phases. The /clear boundary pattern is the core thesis: each pipeline phase runs in a fresh Claude session, state lives entirely on disk in `.planning/`, and the orchestrator reads STATE.md on invocation to resume at the correct position.

The GSD reference at `.reference/get-shit-done/workflows/` provides the authoritative implementation patterns. Three GSD workflows map directly to Phase 2's needs: `execute-phase.md` (subagent dispatch via Task tool, wave-based execution, completion verification via spot-checks), `resume-project.md` (STATE.md-driven position detection, status banner, contextual next actions), and `transition.md` (phase completion, state advancement, next-phase routing). The key architectural insight from GSD is "orchestrator coordinates, not executes" -- SKILL.md stays lean by passing file paths via `<files_to_read>` blocks rather than loading phase content into its own context.

The implementation requires three major components: (1) sequencing logic in SKILL.md that reads `init pipeline` output to determine position and dispatches the correct phase template, (2) prompt template files in `templates/` that the orchestrator fills with variables before dispatching as Task subagents, and (3) CLI additions to ralph-tools.cjs for phase output scanning (`completed: true` flag checking) and STATE.md advancement after phase completion.

**Primary recommendation:** Model SKILL.md orchestration directly on GSD's execute-phase.md + resume-project.md patterns. Keep orchestrator context at ~10-15% by passing paths only. Use Task tool for subagent dispatch. Template files in `templates/` mirror GSD's workflow file separation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Linear phase order by default, with `--skip-to <phase>` flag for jumping ahead
- Completed phases auto-skipped silently (one-line log: "Phase X already complete, skipping")
- Phase position determined by STATE.md as primary + output file scan for validation (belt-and-suspenders, matching GSD pattern)
- On mismatch between STATE.md and file scan, trust the file scan (more recent truth)
- Each pipeline phase has a prompt template file in `templates/` directory -- orchestrator fills variables and dispatches
- SKILL.md stays lean (template separation mirrors GSD's workflow file separation)
- Dual completion verification: agent return message for immediate routing + `completed: true` in file frontmatter for /clear recovery
- On subagent failure: auto-retry once, then present user gate (Retry / Skip / Abort)
- Gates are context-dependent (not a fixed template) -- options vary based on what just happened (matching GSD pattern)
- After successful phase: approve / redirect / skip / replan (contextual subset shown)
- After failure: retry / skip / abort
- Redirect mechanic: spawn fresh subagent with original prompt + existing output + user feedback (not resume -- matches GSD's "fresh agent with explicit state" pattern)
- Gate display: summary + 2-3 key excerpts from output (not full content, not just file path)
- On re-invoke: show status banner (pipeline progress, current position) then auto-dispatch next incomplete phase
- Orchestrator passes file paths only to subagents via `<files_to_read>` blocks -- never loads content into its own context (stays lean)
- Manual mode: suggest `/clear first -> fresh context window` before next phase
- Auto mode: dispatch next phase as Task subagent (inherently context-isolated, no /clear needed)

### Claude's Discretion
- Exact status banner format and content density
- Template file naming convention
- How much of the phase output to excerpt in gates
- Internal error classification logic for retry decisions

### Deferred Ideas (OUT OF SCOPE)
- YOLO mode (ORCH-06) auto-approving all gates -- Phase 5
- Auto-advance chain with --auto flag (ORCH-07) -- Phase 5
- Time budget integration (TIME-01 through TIME-04) -- Phase 5
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ORCH-03 | Pipeline executes phases sequentially: pre-flight -> clarify -> research -> PRD -> deepen -> resolve -> convert -> execute -> review | GSD's execute-phase.md provides wave-based sequential execution; ralph adapts to linear 9-phase sequence. init pipeline already returns current_phase for position detection. |
| ORCH-04 | Each phase transition triggers /clear for true context isolation (fresh session per phase) | GSD's transition.md shows the /clear boundary pattern: complete current phase, advance STATE.md, present next-up with `/clear first` suggestion. Manual mode uses /clear; auto mode uses Task subagent (inherent isolation). |
| ORCH-05 | User gates between phases via AskUserQuestion (approve/redirect/replan) | GSD's checkpoint handling in execute-phase.md provides the pattern: context-dependent options, structured presentation, fresh agent for redirect. CONTEXT.md locks context-dependent gates with approve/redirect/skip/replan options. |
| STATE-07 | GSD-style resumability: on invocation, read STATE.md to determine current phase and resume from last incomplete phase | GSD's resume-project.md provides the exact pattern: read STATE.md, detect position, check incomplete work, present status, auto-dispatch. init pipeline already extracts current_phase and status. File scan validates position. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js builtins only | v18+ (fs, path) | ralph-tools.cjs CLI extensions | Maintains zero-dep constraint from Phase 1 |
| Claude Code Task tool | Current | Subagent dispatch with fresh 200k context | GSD's proven subagent pattern; inherent context isolation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ralph-tools.cjs (existing) | Phase 1 | State reads, phase lookups, config, commits | Every orchestrator operation |
| frontmatter.cjs (existing) | Phase 1 | Extract `completed: true` from phase output files | Completion verification scan |
| AskUserQuestion (Claude Code) | Built-in | Present user gates with structured options | Between-phase gates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Task tool for subagent dispatch | Direct inline execution | Task gives fresh 200k context per phase; inline execution would overflow |
| Template files in templates/ | Inline prompt strings in SKILL.md | Templates are maintainable, testable, and match GSD's workflow file separation |
| STATE.md + file scan for position | STATE.md only | File scan provides belt-and-suspenders recovery if STATE.md is stale (locked decision) |

**Installation:**
```bash
# No installation needed -- zero npm dependencies
# Templates are .md files read by the orchestrator at runtime
```

## Architecture Patterns

### Recommended Project Structure
```
ralph-pipeline/
├── SKILL.md                    # Orchestrator entry point (expanded from Phase 1)
├── ralph-tools.cjs             # CLI router (add scan-phases, advance-phase commands)
├── lib/
│   ├── core.cjs                # Existing: output(), error(), safeReadFile()
│   ├── state.cjs               # Existing: stateExtractField/stateReplaceField
│   ├── phase.cjs               # Existing: findPhaseInternal, cmdPhaseComplete
│   ├── init.cjs                # Existing: cmdInitPipeline (extend with pipeline phase info)
│   ├── config.cjs              # Existing: loadConfig/saveConfig
│   ├── frontmatter.cjs         # Existing: extractFrontmatter
│   ├── commands.cjs            # Existing: cmdCommit
│   ├── preflight.cjs           # Existing: cmdPreflight
│   └── orchestrator.cjs        # NEW: pipeline phase scanning, completion checks, advancement
├── templates/                  # NEW: prompt template files per pipeline phase
│   ├── preflight.md            # Phase 1: pre-flight check template
│   ├── clarify.md              # Phase 2: clarification template
│   ├── research.md             # Phase 3: research dispatch template
│   ├── prd.md                  # Phase 4: PRD creation template
│   ├── deepen.md               # Phase 5: deepen review template
│   ├── resolve.md              # Phase 6: resolution template
│   ├── convert.md              # Phase 7: conversion template
│   ├── execute.md              # Phase 8: execution template
│   └── review.md               # Phase 9: compound review template
└── tests/
    ├── state.test.cjs          # Existing: state field tests
    └── orchestrator.test.cjs   # NEW: orchestrator logic tests
```

### Pattern 1: Lean Orchestrator (from GSD execute-phase.md)
**What:** Orchestrator stays at ~10-15% context by passing file paths, never content.
**When to use:** Always -- the orchestrator never reads phase output content.
**Example:**
```
Orchestrator calls: ralph-tools.cjs init pipeline
Reads: { current_phase: 3, status: "Executing", phase_dir: ".planning/phases/..." }
Dispatches: Task(prompt=template.replace("{{PHASE_DIR}}", phaseDir))
Verifies: ralph-tools.cjs scan-phases --check completed
Advances: ralph-tools.cjs phase-advance (if completed: true found)
```

### Pattern 2: Template-Based Dispatch (from GSD workflow separation)
**What:** Each pipeline phase has a prompt template in `templates/`. Orchestrator reads template, fills variables (`{{PHASE_DIR}}`, `{{CONFIG_MODE}}`, etc.), dispatches as Task.
**When to use:** Every phase dispatch.
**Example:**
```markdown
<!-- templates/research.md -->
<objective>
Execute research phase for the current pipeline project.
</objective>

<files_to_read>
- {{PHASE_DIR}}/context.md (if exists)
- .planning/STATE.md
- .planning/config.json
</files_to_read>

<success_criteria>
- Research outputs written to .planning/research/
- Output file has completed: true in frontmatter
</success_criteria>
```

### Pattern 3: Dual Completion Verification (locked decision)
**What:** Two-layer verification: (1) Task return message for immediate routing, (2) `completed: true` in output file frontmatter for /clear recovery.
**When to use:** After every subagent phase completes.
**Logic:**
```
1. Task returns -> check return message for success/failure signal
2. If success signal: scan output file frontmatter for completed: true
3. If completed: true: advance STATE.md, present success gate
4. If completed: false or missing: present failure gate (retry/skip/abort)
5. On /clear recovery: skip Task return (doesn't exist), use file scan only
```

### Pattern 4: Context-Dependent User Gates (locked decision + GSD checkpoint pattern)
**What:** Gate options vary based on what just happened. Not a fixed template.
**When to use:** Between every phase transition.
**Gate types:**
```
Success gate:
  - approve: advance to next phase
  - redirect: spawn fresh subagent with original prompt + output + feedback
  - skip: mark phase skipped, advance
  - replan: return to planning mode

Failure gate (after auto-retry):
  - retry: dispatch same phase again
  - skip: mark phase skipped, advance
  - abort: stop pipeline, preserve state
```

### Pattern 5: Position Detection with Belt-and-Suspenders (locked decision)
**What:** STATE.md is primary position source; output file scan validates.
**When to use:** On every skill invocation.
**Logic:**
```
1. Read STATE.md current_phase (via init pipeline)
2. Scan .planning/ for phase output files with completed: true
3. Compute "file-scan position" = first phase without completed output
4. If STATE.md position == file-scan position: proceed
5. If mismatch: trust file scan (more recent truth), log warning, correct STATE.md
```

### Anti-Patterns to Avoid
- **Orchestrator reading phase content:** SKILL.md should never `cat` or Read phase output files for their content. Pass paths only. Subagents read.
- **Fixed gate templates:** Gates must be context-dependent. Don't present "redirect" when there's nothing to redirect (e.g., pre-flight check).
- **Resuming subagents:** Never "resume" a subagent. Always spawn fresh with explicit state (GSD's proven pattern -- resume breaks with parallel tool calls).
- **In-memory state:** Never store pipeline position in variables that don't survive /clear. All state on disk.
- **Monolithic SKILL.md:** Keep SKILL.md as routing logic only. Phase-specific instructions live in templates/.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase output frontmatter parsing | Custom YAML parser | lib/frontmatter.cjs extractFrontmatter() | Already built and tested in Phase 1; handles the `completed: true` boolean |
| STATE.md field updates | Manual regex/string replacement | lib/state.cjs stateReplaceField() + writeStateMd() | Already built with frontmatter sync; handles both bold and plain formats |
| Phase directory lookup | Manual fs.readdirSync with pattern matching | lib/phase.cjs findPhaseInternal() | Already handles NN-name pattern, padded numbers |
| Config loading | Manual JSON.parse with defaults | lib/core.cjs loadConfig() | Already handles missing file, merges defaults |
| Git commits with conditional logic | Manual execSync chains | lib/commands.cjs cmdCommit() | Already checks commit_docs flag, .gitignore, handles edge cases |

**Key insight:** Phase 1 built all the infrastructure this phase needs. The orchestrator should compose existing lib/ functions, not duplicate them. New lib/orchestrator.cjs should import and combine existing modules.

## Common Pitfalls

### Pitfall 1: Orchestrator Context Bloat
**What goes wrong:** SKILL.md reads phase output content (research summaries, PRD text) into its own context, consuming the context window before later phases.
**Why it happens:** Natural instinct to "see what the subagent produced" before presenting the user gate.
**How to avoid:** Pass file paths only. For gate excerpts, use a dedicated "excerpt" CLI command that returns 2-3 key lines, not the full content.
**Warning signs:** SKILL.md contains `Read` calls for anything in `.planning/` beyond STATE.md and config.json.

### Pitfall 2: Position Detection Race Condition
**What goes wrong:** STATE.md says phase 4 but file scan says phase 3 is incomplete, causing confusion about which to run.
**Why it happens:** /clear happened after STATE.md was advanced but before the subagent wrote `completed: true` to the output file.
**How to avoid:** CONTEXT.md decision: trust file scan on mismatch (it reflects actual disk state). Correct STATE.md before dispatching.
**Warning signs:** User sees "Resuming Phase 4" but Phase 3 output doesn't exist.

### Pitfall 3: Gate Option Mismatch
**What goes wrong:** "Redirect" option shown for pre-flight phase (which has nothing to redirect to) or "Replan" shown when no plan exists.
**Why it happens:** Using a fixed gate template instead of context-dependent options.
**How to avoid:** Each pipeline phase defines which gate options make sense. Pre-flight: approve/retry/abort. Research: approve/redirect/replan. PRD: approve/redirect/skip.
**Warning signs:** User clicks "redirect" and the orchestrator has no redirect logic for that phase.

### Pitfall 4: Template Variable Injection Failures
**What goes wrong:** Template dispatched with `{{PHASE_DIR}}` literal string instead of actual path.
**Why it happens:** Missing variable in the substitution map, or template variable syntax mismatch.
**How to avoid:** Define a strict template variable contract. Validate all `{{VAR}}` patterns are resolved before dispatch. Fail loudly if any remain.
**Warning signs:** Subagent errors with "file not found: {{PHASE_DIR}}/output.md".

### Pitfall 5: Subagent Failure Detection
**What goes wrong:** Subagent Task returns but the orchestrator can't distinguish success from failure in the return message.
**Why it happens:** No structured return format; relying on free-text parsing.
**How to avoid:** Define a clear return format in each template: `## PHASE COMPLETE` or `## PHASE FAILED` as the first heading. Parse the heading. Fall back to file scan if ambiguous.
**Warning signs:** Orchestrator always treats returns as success, missing actual failures.

### Pitfall 6: Redirect Spawns Stale Context
**What goes wrong:** User selects "redirect" with feedback, but the fresh subagent doesn't receive the existing output file path.
**Why it happens:** Redirect prompt template missing the `<existing_output>` block.
**How to avoid:** Redirect always includes: original template + existing output path + user feedback. The fresh subagent reads the existing output and revises.
**Warning signs:** Redirect produces output that ignores previous work.

## Code Examples

### Pipeline Phase Map (orchestrator.cjs)
```javascript
// Source: SKILL.md phase list + CONTEXT.md decisions
const PIPELINE_PHASES = [
  { id: 1, name: 'preflight',  template: 'preflight.md',  gateOptions: ['approve', 'retry', 'abort'] },
  { id: 2, name: 'clarify',    template: 'clarify.md',    gateOptions: ['approve', 'redirect', 'skip'] },
  { id: 3, name: 'research',   template: 'research.md',   gateOptions: ['approve', 'redirect', 'replan'] },
  { id: 4, name: 'prd',        template: 'prd.md',        gateOptions: ['approve', 'redirect', 'replan'] },
  { id: 5, name: 'deepen',     template: 'deepen.md',     gateOptions: ['approve', 'redirect', 'skip'] },
  { id: 6, name: 'resolve',    template: 'resolve.md',    gateOptions: ['approve', 'redirect'] },
  { id: 7, name: 'convert',    template: 'convert.md',    gateOptions: ['approve', 'skip'] },
  { id: 8, name: 'execute',    template: 'execute.md',    gateOptions: ['approve', 'retry', 'abort'] },
  { id: 9, name: 'review',     template: 'review.md',     gateOptions: ['approve', 'skip'] },
];
```

### Phase Output File Scanning (orchestrator.cjs)
```javascript
// Source: Phase 1 frontmatter.cjs + CONTEXT.md belt-and-suspenders decision
function scanPipelinePhases(cwd) {
  const pipelineDir = path.join(cwd, '.planning', 'pipeline');
  const results = [];
  for (const phase of PIPELINE_PHASES) {
    const outputPath = path.join(pipelineDir, `${phase.name}.md`);
    const content = safeReadFile(outputPath);
    if (content) {
      const { frontmatter } = extractFrontmatter(content);
      results.push({
        ...phase,
        outputExists: true,
        completed: frontmatter.completed === true,
      });
    } else {
      results.push({ ...phase, outputExists: false, completed: false });
    }
  }
  return results;
}
```

### Template Variable Substitution
```javascript
// Source: GSD execute-phase.md Task dispatch pattern
function fillTemplate(templateContent, variables) {
  let filled = templateContent;
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    filled = filled.replace(pattern, String(value));
  }
  // Validate no unresolved variables remain
  const unresolved = filled.match(/\{\{[A-Z_]+\}\}/g);
  if (unresolved) {
    throw new Error('Unresolved template variables: ' + unresolved.join(', '));
  }
  return filled;
}
```

### Status Banner (SKILL.md, from GSD resume-project.md)
```markdown
## Pipeline Status

**Phase:** 3 of 9 (Research)
**Status:** Ready to dispatch
**Progress:** [##--------] 22%

Phase 1: Pre-flight -- complete
Phase 2: Clarify -- complete
Phase 3: Research -- next
```

### User Gate Presentation (SKILL.md)
```markdown
## Phase 3: Research Complete

Research outputs written to .planning/research/:
- repo-analysis.md: 4 key patterns identified
- best-practices.md: 3 library recommendations
- framework-docs.md: API surface mapped

**Choose:**
1. **Approve** -- proceed to PRD creation
2. **Redirect** -- revise research with feedback
3. **Replan** -- revisit research scope
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Resume subagents (Task resume) | Fresh agent with explicit state | GSD v2+ | More reliable; resume breaks with parallel tool calls |
| Monolithic orchestrator file | Template-separated dispatch | GSD v2+ | Orchestrator stays lean; templates are independently maintainable |
| In-memory pipeline position | Disk-only state (STATE.md + file scan) | GSD v2+ | Survives /clear, crashes, session boundaries |
| Fixed gate options | Context-dependent gates | GSD v2+ | Better UX; no confusing options for inapplicable actions |

**Deprecated/outdated:**
- Task tool `resume` parameter: Works for simple cases but breaks with parallel tool calls. GSD abandoned it for fresh agents.
- Single-source position tracking: GSD moved to belt-and-suspenders (state file + disk scan) for crash recovery.

## Open Questions

1. **Pipeline phase output file naming convention**
   - What we know: CONTEXT.md says each phase has an output file with `completed: true` frontmatter. Phase 1 used `NN-NN-SUMMARY.md` for build plans.
   - What's unclear: What do pipeline phase outputs look like? Are they `preflight-output.md`, `research-output.md`, etc.? Or do they use Phase 1's `NN-SUMMARY.md` pattern? Pipeline phases (pre-flight through review) are different from build phases (Foundation through Advanced Features).
   - Recommendation: Use `{phase-name}.md` in `.planning/pipeline/` directory (e.g., `.planning/pipeline/preflight.md`, `.planning/pipeline/research.md`). Keeps pipeline outputs separate from build phase outputs in `.planning/phases/`. Claude's discretion area per CONTEXT.md.

2. **Template variable contract**
   - What we know: Templates need `{{PHASE_DIR}}`, `{{CONFIG_MODE}}`, and other variables filled. GSD uses `{phase_number}`, `{phase_dir}` style.
   - What's unclear: Exact set of variables each template needs. This depends on the phase content (Phase 3), which hasn't been built yet.
   - Recommendation: Define a minimal core set (`{{CWD}}`, `{{PHASE_NAME}}`, `{{STATE_PATH}}`, `{{CONFIG_PATH}}`). Phase 3 adds phase-specific variables. Templates for phases 3-9 will be stubs/skeletons in Phase 2 and fleshed out in later build phases.

3. **Excerpt strategy for gate display**
   - What we know: CONTEXT.md says gates show "summary + 2-3 key excerpts from output." Claude's discretion on how much to excerpt.
   - What's unclear: How to extract excerpts without reading the full output into orchestrator context.
   - Recommendation: Add a `ralph-tools.cjs excerpt <file> [--lines N]` command that returns the first N non-frontmatter lines (default 10). Orchestrator calls this CLI command, gets a small string back, includes it in the gate display. This keeps orchestrator context lean.

4. **Stub templates for unbuilt phases**
   - What we know: Phase 2 creates `templates/` directory with 9 template files. But phases 3-9 content is built in build phases 3-5.
   - What's unclear: What should stub templates contain?
   - Recommendation: Each stub template should have the structural skeleton (objective, files_to_read, success_criteria) with TODO markers for phase-specific instructions. This lets Phase 2 test the full sequencing flow end-to-end with stub phases that immediately return `completed: true`.

## Sources

### Primary (HIGH confidence)
- `.reference/get-shit-done/workflows/execute-phase.md` -- Subagent dispatch via Task, wave-based execution, completion spot-checks, checkpoint handling, context efficiency principles
- `.reference/get-shit-done/workflows/resume-project.md` -- STATE.md-driven position detection, status banner format, contextual next-action routing, incomplete work detection
- `.reference/get-shit-done/workflows/transition.md` -- Phase completion flow, ROADMAP.md + STATE.md updates, next-phase offering, auto-advance detection
- `.reference/get-shit-done/workflows/execute-plan.md` -- Plan execution within a phase, Task subagent prompt structure, SUMMARY.md creation, deviation rules

### Secondary (MEDIUM confidence)
- `.reference/get-shit-done/workflows/discuss-phase.md` -- Context-dependent discussion patterns, CONTEXT.md structure (used for understanding gate design)
- Phase 1 SUMMARY.md files -- Established `completed: true` boolean frontmatter pattern, ralph-tools.cjs API surface, lib/ module architecture

### Tertiary (LOW confidence)
- None -- all findings verified against GSD reference source code on disk

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Using existing Phase 1 infrastructure + GSD patterns verified on disk
- Architecture: HIGH -- GSD reference provides battle-tested orchestrator patterns; CONTEXT.md locks all major decisions
- Pitfalls: HIGH -- Derived from GSD's explicit failure handling patterns and known Claude Code limitations (classifyHandoffIfNeeded bug, Task resume limitations)

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable domain; GSD patterns unlikely to change in 30 days)
