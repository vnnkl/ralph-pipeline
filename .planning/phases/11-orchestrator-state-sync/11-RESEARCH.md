# Phase 11: Orchestrator State Sync - Research

**Researched:** 2026-02-27
**Domain:** SKILL.md orchestrator wiring + STATE.md/ROADMAP.md state sync
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Keep existing `ralph-tools.cjs state set Status` calls in SKILL.md for sub-phase tracking (e.g., "research complete, running prd")
- Add one `ralph-tools.cjs phase-complete` call after the review phase (last pipeline phase) to mark the dev-phase done
- Phase field in STATE.md stays at dev-phase level (e.g., "Phase 11 of 13") throughout the pipeline run -- no sub-phase detail in Phase field
- Status field continues to be updated per sub-phase (existing behavior)
- After review phase completes (the last pipeline sub-phase) -- the full pipeline must finish before the dev-phase gets its ROADMAP checkbox
- Single `ralph-tools.cjs phase-complete <dev-phase-number>` call at the end of Step 7 (the /clear boundary step) or equivalent completion path
- Matches GSD's transition.md pattern: checkbox = dev-phase is truly done
- **Primary (prevent):** By calling phase-complete at pipeline end, STATE.md should never go stale
- **Fallback (auto-correct on resume):** On resume, if STATE.md Phase field doesn't match file scan position, auto-correct both STATE.md and ROADMAP.md to match file scan truth
- Auto-correct logs a brief info line: "STATE.md synced to phase N (pipeline-sub-phase)" -- informational, not a warning
- Replace existing mismatch warning with this auto-correct behavior
- Auto-correct scope includes ROADMAP: if all 9 pipeline phases are complete on disk but ROADMAP checkbox is unchecked, call phase-complete to fix it
- ROADMAP stays binary: In Progress or Complete -- no pipeline sub-phase granularity
- Partial pipeline runs (abort, replan, time budget expired) leave ROADMAP unchanged -- checkbox only gets marked when full pipeline completes

### Claude's Discretion
- Exact placement of phase-complete call in SKILL.md (likely after Step 6 gate but before Step 7 /clear, or within Step 7 before the /clear suggestion)
- How to detect "all pipeline phases complete on disk" for the auto-correct fallback (likely reuse existing scanPipelinePhases)
- Whether auto-correct should be in SKILL.md orchestrator logic or in a new ralph-tools.cjs subcommand

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STATE-03 | ralph-tools.cjs handles git commits with conditional logic (commit_docs flag, .gitignore check) | cmdPhaseComplete already exists and works correctly. Phase 11 wires it into the orchestrator completion path (SKILL.md Step 6/7) so it actually gets called. Auto-correct fallback reuses scanPipelinePhases + cmdPhaseComplete for ROADMAP sync on resume. |
</phase_requirements>

## Summary

This phase is pure orchestrator wiring -- no new CLI commands, no new lib modules, no schema changes. The `cmdPhaseComplete` command in `lib/phase.cjs` already does everything needed (updates ROADMAP.md checkbox, advances STATE.md Phase field, writes frontmatter). It has never been called by the SKILL.md orchestrator during pipeline runs, causing STATE.md to go stale and the mismatch warning to fire on every resume.

The fix has two parts: (1) add a `ralph-tools.cjs phase-complete` call in SKILL.md after the final pipeline phase (review) completes, and (2) replace the existing mismatch warning in Step 2 with auto-correct logic that silently fixes STATE.md and ROADMAP.md to match disk truth on resume.

**Primary recommendation:** Add phase-complete call in SKILL.md Step 6 (after YOLO approve or manual approve gate) when the completing phase is phase 9 (review). Replace the Step 2 mismatch path with auto-correct that calls `state set Status` + conditionally `phase-complete` to sync both STATE.md and ROADMAP.md.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ralph-tools.cjs | existing | CLI entry point, phase-complete command | Already built, tested, handles ROADMAP + STATE.md updates |
| lib/phase.cjs | existing | `cmdPhaseComplete()` -- marks ROADMAP checkbox, advances STATE.md | Already built in Phase 1, tested in state.test.cjs |
| lib/orchestrator.cjs | existing | `scanPipelinePhases()`, `detectPosition()` | Already built in Phase 2, 23+ tests |
| lib/state.cjs | existing | `stateReplaceField()`, `writeStateMd()` | Already built in Phase 1, frontmatter sync |
| SKILL.md | existing | Orchestrator logic, Steps 2, 6, 7 | The file being modified |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lib/core.cjs | existing | `output()`, `error()` | Only if adding new CLI subcommands (unlikely) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline SKILL.md auto-correct logic | New `ralph-tools.cjs sync-state` subcommand | Subcommand is cleaner but adds code; SKILL.md inline is simpler for 3-5 lines of logic |

**Installation:** No new dependencies.

## Architecture Patterns

### Current Orchestrator Flow (relevant steps)

```
SKILL.md orchestrator:
  Step 1: init pipeline -> {current_phase, status, mode, ...}
  Step 2: scan-phases -> detect position -> [MISMATCH WARNING if stale]
  Step 3: Status banner
  Step 4: Dispatch phase template as Task
  Step 5: Completion verification (dual check)
  Step 6: User gate (YOLO bypass or manual approve/redirect/skip)
  Step 7: /clear boundary (time budget check, auto-advance)
```

### Pattern 1: phase-complete Placement
**What:** Call `ralph-tools.cjs phase-complete <dev-phase>` after the pipeline's final phase (review, id=9) is approved in the gate
**When to use:** Only when all 9 pipeline phases are complete (i.e., the current phase being approved is phase 9)
**Why not after every pipeline phase:** CONTEXT.md locks this -- ROADMAP checkbox is binary (complete/not), and phase-complete advances STATE.md Phase field. Calling it mid-pipeline would advance the dev-phase prematurely.

The call belongs in Step 6 or the transition between Step 6 and Step 7. After the gate approves phase 9 (review), before the /clear suggestion:

```
# In SKILL.md, after Step 6 gate resolves for phase 9:
node ralph-tools.cjs phase-complete <DEV_PHASE_NUMBER>
```

Where `<DEV_PHASE_NUMBER>` is the current dev-phase from STATE.md (e.g., 11 for Phase 11). The SKILL.md orchestrator already has `current_phase` from init pipeline output -- but this is the STATE.md phase, not the pipeline phase. The dev-phase number is what gets passed to phase-complete.

**Key distinction:**
- Pipeline phases: 1-9 (preflight through review) -- internal to the skill
- Dev phases: 1-13 (Foundation through Quality Gate) -- the project's actual phases in ROADMAP.md
- `cmdPhaseComplete` operates on dev phases, not pipeline phases
- The orchestrator knows the dev-phase from `init pipeline` output's `current_phase` field

### Pattern 2: Auto-Correct on Resume (replacing mismatch warning)
**What:** When Step 2 detects a mismatch between STATE.md and file scan, auto-correct STATE.md to match file scan truth instead of just warning
**When to use:** Every resume after /clear where STATE.md is stale

Current SKILL.md Step 2 mismatch path:
```
Position mismatch: STATE.md says phase {X}, file scan says phase {Y}. Using file scan.
```

New auto-correct behavior:
1. `node ralph-tools.cjs state set Status "Pipeline phase {file_scan_phase}/9 ({pipeline_display_name})"`
2. If all 9 pipeline phases complete on disk but pipeline hasn't been marked done: `node ralph-tools.cjs phase-complete <dev_phase>`
3. Log info: "STATE.md synced to pipeline phase {N} ({pipeline_display_name})"

The auto-correct for ROADMAP is the important addition. Current behavior: if a pipeline completes all 9 phases but crashes before phase-complete runs, ROADMAP stays unchecked. The fallback detects this via `scanPipelinePhases()` returning all phases complete, then calls `phase-complete` to fix ROADMAP.

### Pattern 3: Pipeline-Complete Detection for Auto-Correct
**What:** Use `scanPipelinePhases` to detect if all 9 phases are complete on disk
**When to use:** During Step 2 position detection, to decide if auto-correct should also fix ROADMAP

`detectPosition()` already returns `{ pipeline_complete: true }` when all phases are complete. The orchestrator already handles this case (shows completion banner). The auto-correct just needs to insert a `phase-complete` call before the completion banner when ROADMAP is stale.

### Anti-Patterns to Avoid
- **Calling phase-complete after every pipeline phase:** Would advance STATE.md dev-phase field and mark ROADMAP checkbox mid-pipeline. User locked this to only fire after review (phase 9).
- **Auto-correcting ROADMAP for partial pipelines:** A partial pipeline (3/9 phases done) should NOT mark the ROADMAP checkbox. Only a fully completed pipeline (9/9) gets the checkbox.
- **Storing pipeline position in STATE.md Phase field:** The Phase field tracks dev-phases (1-13), not pipeline sub-phases (1-9). Pipeline position comes from file scan only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ROADMAP checkbox update | Custom regex replacement | `cmdPhaseComplete` in `lib/phase.cjs` | Already handles regex, date stamping, progress table, STATE.md advance |
| Pipeline position detection | Manual file scanning | `scanPipelinePhases()` + `detectPosition()` in `lib/orchestrator.cjs` | 23+ tests, handles all edge cases |
| STATE.md field replacement | Direct fs.writeFileSync | `stateReplaceField()` + `writeStateMd()` | Handles frontmatter sync, immutable patterns |

**Key insight:** Every component needed already exists and is tested. This phase is wiring, not building.

## Common Pitfalls

### Pitfall 1: Confusing Pipeline Phases vs Dev Phases
**What goes wrong:** Passing pipeline phase number (1-9) to `phase-complete` instead of dev-phase number
**Why it happens:** SKILL.md tracks pipeline phase position (1-9) internally, but `cmdPhaseComplete` expects dev-phase number (1-13 from ROADMAP.md)
**How to avoid:** Use `current_phase` from `init pipeline` output (which reads STATE.md) as the dev-phase number for `phase-complete`. Never pass the pipeline `id` (1-9) to phase-complete.
**Warning signs:** ROADMAP.md shows wrong phase checked off; STATE.md advances to wrong phase number

### Pitfall 2: output() Calls process.exit(0)
**What goes wrong:** Attempting to call `cmdPhaseComplete` as a JS function from within the orchestrator would exit the process
**Why it happens:** `output()` in `lib/core.cjs` calls `process.exit(0)` after writing JSON
**How to avoid:** Always call `phase-complete` via CLI: `node ralph-tools.cjs phase-complete <N>`. SKILL.md already follows this pattern for all ralph-tools calls.
**Warning signs:** N/A -- SKILL.md is a markdown orchestrator, not a JS module. This is a reminder for the planner.

### Pitfall 3: Auto-Correct Running phase-complete on Partial Pipeline
**What goes wrong:** A pipeline that completed 6/9 phases triggers phase-complete, marking the dev-phase as done in ROADMAP
**Why it happens:** Auto-correct logic doesn't check that ALL 9 pipeline phases are complete before calling phase-complete
**How to avoid:** Only call `phase-complete` in auto-correct when `detectPosition()` returns `{ pipeline_complete: true }`. For partial pipelines, only fix STATE.md's Status field, not ROADMAP.
**Warning signs:** ROADMAP checkbox marked for a dev-phase whose pipeline is still in progress

### Pitfall 4: Double phase-complete on Resume After Successful Pipeline
**What goes wrong:** Pipeline completes, phase-complete runs in Step 6. On next resume, auto-correct detects all-complete and runs phase-complete again.
**Why it happens:** phase-complete is idempotent for ROADMAP (checkbox already checked), but it advances STATE.md to the next dev-phase again -- potentially double-advancing.
**How to avoid:** The "all phases complete" path in Step 2 already shows the Pipeline Complete banner and stops. The auto-correct for ROADMAP should be placed in this path: before showing the banner, check if ROADMAP checkbox is already marked. If `cmdPhaseComplete` regex doesn't match `- [ ]` (because it's already `- [x]`), the ROADMAP stays unchanged. But STATE.md Phase WILL be advanced again via `stateReplaceField`. So the guard must be: only call `phase-complete` if the current dev-phase ROADMAP checkbox is unchecked. Alternatively, check if `current_phase` from init pipeline has already been advanced past the dev-phase.
**Warning signs:** STATE.md Phase jumps two dev-phases forward after a resume.

### Pitfall 5: Step 2 Auto-Correct Modifying Phase Field
**What goes wrong:** Auto-correct writes pipeline sub-phase info into STATE.md Phase field
**Why it happens:** Confusion between what Status field vs Phase field should contain
**How to avoid:** Per CONTEXT.md: Phase field stays at dev-phase level. Auto-correct only updates the Status field with pipeline sub-phase position. The Phase field is only modified by `cmdPhaseComplete` at pipeline end.
**Warning signs:** STATE.md Phase field shows pipeline phase names instead of dev-phase names.

## Code Examples

### Example 1: phase-complete Call in SKILL.md Step 6 (after phase 9 approved)

```markdown
### Step 6b: Dev-Phase Completion (pipeline phase 9 only)

If the just-completed pipeline phase is phase 9 (review) -- the full pipeline is done:

1. Get dev-phase number from init pipeline output (`current_phase`)
2. Run: `node ralph-tools.cjs phase-complete {current_phase}`
3. Parse output: { completed, next_phase, date, pipeline_complete? }
4. Log: "Dev-phase {current_phase} marked complete. ROADMAP updated."
```

### Example 2: Auto-Correct Replacing Mismatch Warning in Step 2

```markdown
- **If mismatch:** Auto-correct STATE.md to match file scan:
  1. Run: `node ralph-tools.cjs state set Status "Pipeline phase {file_scan_phase}/9 ({pipeline_display_name})"`
  2. Log: "STATE.md synced to pipeline phase {file_scan_phase} ({pipeline_display_name})"
  3. Use the file scan position for dispatch.
```

### Example 3: Auto-Correct for Complete Pipeline with Stale ROADMAP

```markdown
- **If all phases complete AND ROADMAP checkbox unchecked:**
  1. Get dev-phase from init pipeline output
  2. Run: `node ralph-tools.cjs phase-complete {current_phase}`
  3. Log: "ROADMAP synced: dev-phase {current_phase} marked complete."
  4. Show pipeline completion banner.
```

### Example 4: cmdPhaseComplete CLI Output (existing, from lib/phase.cjs)

```javascript
// Called via: node ralph-tools.cjs phase-complete 11
// Returns JSON:
{
  "completed": 11,
  "next_phase": 12,
  "date": "2026-02-27"
}
// For last phase:
{
  "completed": 13,
  "next_phase": null,
  "pipeline_complete": true,
  "date": "2026-02-27"
}
```

### Example 5: scanPipelinePhases Output (existing, from lib/orchestrator.cjs)

```javascript
// Called via: node ralph-tools.cjs scan-phases
// Returns array of 9 phase objects:
[
  { "id": 1, "slug": "preflight", "displayName": "Pre-flight", "completed": true },
  { "id": 2, "slug": "clarify", "displayName": "Clarify", "completed": true },
  // ...
  { "id": 9, "slug": "review", "displayName": "Review", "completed": false }
]
```

### Example 6: detectPosition Output (existing, from lib/orchestrator.cjs)

```javascript
// All complete:
{ "phase": null, "pipeline_complete": true }

// Match:
{ "phase": 3, "mismatch": false }

// Mismatch (stale STATE.md):
{ "phase": 3, "mismatch": true, "corrected_from": 5 }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mismatch warning (log + ignore) | Auto-correct (fix STATE.md + ROADMAP) | Phase 11 | Eliminates warning noise; STATE.md always accurate on resume |
| STATE.md manually stale | phase-complete called at pipeline end | Phase 11 | ROADMAP checkboxes auto-update; STATE.md Phase field accurate |
| cmdPhaseComplete orphaned | Wired into SKILL.md Step 6 | Phase 11 | Closes Phase 2 tech debt |

## Open Questions

1. **How to guard against double phase-complete on resume?**
   - What we know: `cmdPhaseComplete` regex for ROADMAP only matches `- [ ]` (unchecked). If already `- [x]`, the ROADMAP is unchanged. But STATE.md Phase field gets advanced regardless via `stateReplaceField`. Running phase-complete twice would advance the dev-phase twice.
   - What's unclear: Best guard mechanism for the "all pipeline complete" auto-correct path.
   - Recommendation: In the "all phases complete" path (Step 2), read `current_phase` from init pipeline. If `current_phase` has already been advanced past the expected dev-phase (meaning phase-complete already ran), skip the phase-complete call and just show the banner. Concretely: the orchestrator should check if the ROADMAP checkbox for `current_phase` is already `[x]` before calling phase-complete. Since `cmdPhaseComplete` reads ROADMAP and writes it, the simplest guard is: if the ROADMAP regex doesn't match `- [ ]` for the phase, the write is a no-op for ROADMAP, but the STATE.md advance still happens. So a dedicated guard is needed. Option: add `--if-unchecked` flag to phase-complete, or check ROADMAP in SKILL.md before calling. Planner should decide.

2. **Should auto-correct be inline in SKILL.md or a new CLI subcommand?**
   - What we know: CONTEXT.md gives this as Claude's discretion. Auto-correct is 3-5 CLI calls inline in SKILL.md.
   - What's unclear: Whether inlining makes SKILL.md too complex vs a subcommand.
   - Recommendation: Inline in SKILL.md. The logic is: (a) `state set Status "..."` and (b) conditionally `phase-complete`. This is 2-3 lines of orchestrator instructions, well within SKILL.md's complexity budget. A subcommand would need to duplicate position detection logic already done in Step 2.

## Sources

### Primary (HIGH confidence)
- `lib/phase.cjs` -- `cmdPhaseComplete()` implementation: lines 59-169
- `lib/orchestrator.cjs` -- `scanPipelinePhases()`, `detectPosition()`: lines 40-81
- `lib/state.cjs` -- `stateReplaceField()`, `writeStateMd()`: lines 67-203
- `SKILL.md` -- Steps 2, 6, 7 (orchestrator logic)
- `.planning/phases/11-orchestrator-state-sync/11-CONTEXT.md` -- locked decisions

### Secondary (MEDIUM confidence)
- `.reference/get-shit-done/workflows/transition.md` -- GSD's phase-complete pattern (confirms "checkbox = dev-phase truly done")
- `.planning/v1.0-MILESTONE-AUDIT.md` -- STATE-03 gap description, Phase 2 tech debt

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components exist, tested, verified in prior phases
- Architecture: HIGH -- wiring existing code into existing orchestration, no new modules
- Pitfalls: HIGH -- all pitfalls derived from direct code reading, not speculation

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable -- no external dependencies, internal wiring only)
