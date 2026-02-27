# Phase 5: Advanced Features - Research

**Researched:** 2026-02-26
**Domain:** Pipeline automation (YOLO mode, auto-advance chaining, time budgets)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **YOLO mode** activated via --yolo flag; persists to config.json; auto-approves ALL user gates; conversion gate uses `bead_format` from config.json; execution gate defaults to manual ralph-tui; resolution gate: Claude auto-answers [TBD]/[TODO]/[PLACEHOLDER] items tagged [YOLO-RESOLVED]
- **Auto-advance failure handling:** phase failure auto-retries once then stops; bead execution failure skips failed bead and continues; blocking gates in YOLO mode answered autonomously
- **Time budget:** prompted via AskUserQuestion at pipeline start (not a flag); stored as `time_budget_expires` (absolute timestamp) and `time_budget_hours`; bead execution times recorded as `avg_bead_duration_ms` and `total_beads_executed` running average; show estimate at start; log remaining at each phase boundary; hard stop at phase boundary when expired; persists across /clear
- **Auto-advance chaining:** --auto flag works from any phase; uses actual /clear + re-invoke; SessionStart hook checks config.json for `auto_advance: true` and auto-invokes /ralph-pipeline; orchestrator sets auto_advance before triggering /clear; clears auto_advance on completion/failure; hook only fires when auto_advance is true

### Claude's Discretion
- SessionStart hook implementation details (registration, removal, guard logic)
- First-run default estimate for bead duration when no historical data exists
- Exact format of time remaining display at phase boundaries
- How to handle edge case where /clear happens mid-phase (crash recovery)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ORCH-06 | YOLO mode auto-approves all gates without user interaction | Gate bypass patterns in SKILL.md Step 6, template-level gate modifications in resolve.md/convert.md/execute.md/review.md; config.json `mode: "yolo"` flag |
| ORCH-07 | Auto-advance chain (--auto flag): phases advance hands-free from research through review | SessionStart hook pattern (verified in Claude Code docs), /clear + re-invoke architecture in SKILL.md Step 7, config.json `auto_advance` field |
| TIME-01 | User can specify time budget in hours at pipeline start | AskUserQuestion integration in SKILL.md Step 1, config.json fields `time_budget_expires` and `time_budget_hours` |
| TIME-02 | Pipeline auto-advances through phases until budget expires | Phase boundary check in SKILL.md Step 7, `Date.now()` vs `time_budget_expires` comparison |
| TIME-03 | Current phase always finishes before stopping (clean phase boundaries) | Budget check occurs BETWEEN phases (Step 7), not during phase execution |
| TIME-04 | Time remaining persisted to config.json (survives /clear between phases) | config.json already persists across /clear (verified in loadConfig/saveConfig in core.cjs) |
</phase_requirements>

## Summary

Phase 5 layers three automation capabilities onto the existing 9-phase pipeline: YOLO mode (gate bypass), auto-advance chaining (/clear + re-invoke), and time budgets. The existing codebase is well-prepared for these additions. The orchestrator in SKILL.md already has Step 6 (User Gate) and Step 7 (/clear Boundary) with explicit hooks for "auto mode" behavior. Config.json already includes `auto_advance` and `time_budget` fields in the loadConfig defaults. The primary implementation work is: (1) conditional gate bypass logic in the orchestrator and templates, (2) a SessionStart hook for auto-advance re-invocation after /clear, and (3) time tracking math in ralph-tools.cjs.

The architecture is mostly orchestrator-level changes (SKILL.md instructions) plus small additions to ralph-tools.cjs for time budget commands. No new npm dependencies. No new pipeline phases. The primary risk is the SessionStart hook reliability for auto-advance chaining -- Claude Code's hook system is well-documented and the project already uses SessionStart hooks in ~/.claude/settings.json.

**Primary recommendation:** Implement in three waves -- (1) YOLO mode gate bypass in orchestrator + templates, (2) time budget tracking in ralph-tools.cjs + orchestrator, (3) auto-advance SessionStart hook + /clear chain.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js builtins (fs, path, os) | 16.7+ | File I/O, config persistence, time math | Zero-dep constraint (STATE-01); already used throughout |
| ralph-tools.cjs | existing | CLI for config-get/set, state management | All state mutations go through ralph-tools.cjs (STATE-02) |
| Claude Code hooks | current | SessionStart hook for auto-advance | Official Claude Code feature; user already has hooks in settings.json |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jq | system | JSON parsing in hook scripts | SessionStart hook reads config.json to check auto_advance flag |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SessionStart hook + /clear | Task subagent chaining (no /clear) | True context isolation requires /clear; Task subagents share parent context window |
| Absolute timestamp for budget | Remaining-hours countdown | Absolute timestamp survives /clear without needing to recalculate; simpler comparison |
| AskUserQuestion for time budget | --time-budget CLI flag | User chose prompted approach -- more discoverable for first-time users |

**Installation:**
```bash
# No new dependencies needed
# All implementation uses existing Node.js builtins and ralph-tools.cjs
```

## Architecture Patterns

### Recommended Changes Structure
```
ralph-pipeline/
├── SKILL.md                    # Orchestrator: add YOLO gate bypass, time budget prompt, auto-advance /clear logic
├── ralph-tools.cjs             # CLI router: add time-budget-* commands
├── lib/
│   ├── core.cjs                # loadConfig defaults: add time_budget_expires, time_budget_hours, avg_bead_duration_ms, total_beads_executed, bead_format
│   ├── config.cjs              # No changes (dot-notation get/set already works for nested fields)
│   └── time-budget.cjs         # NEW: time budget logic (start, check, record-bead, estimate)
├── templates/
│   ├── resolve.md              # Add YOLO-mode auto-resolution path
│   ├── convert.md              # Add YOLO-mode bead_format from config (skip gate)
│   ├── execute.md              # Add YOLO-mode default to manual (locked decision)
│   └── review.md               # Add YOLO-mode auto-skip review gate
└── .claude/
    └── hooks/
        └── ralph-auto-advance.js  # SessionStart hook: check config.json, auto-invoke /ralph-pipeline
```

### Pattern 1: Conditional Gate Bypass (YOLO Mode)
**What:** Each template that presents an AskUserQuestion gate checks `mode` from config. If `mode === "yolo"`, skip the gate and use a predetermined answer.
**When to use:** Every phase template with a user gate (resolve, convert, execute, review)

**Example:**
```
### Step 2: Present Gate (or YOLO bypass)

Read config mode:
node ralph-tools.cjs config-get mode --raw

If mode is "yolo":
- Skip AskUserQuestion
- Log: "YOLO mode: auto-approving {gate_name}"
- Use predetermined answer: {specific_per_template}

If mode is NOT "yolo":
- Present AskUserQuestion as normal
```

### Pattern 2: SessionStart Hook for Auto-Advance
**What:** A Node.js script registered as a SessionStart hook that checks config.json for `auto_advance: true`, and if found, outputs instructions for Claude to invoke /ralph-pipeline.
**When to use:** After /clear, when the pipeline needs to automatically continue.

**Example (hook script):**
```javascript
#!/usr/bin/env node
// .claude/hooks/ralph-auto-advance.js
const fs = require('fs');
const path = require('path');

// Read stdin for hook input
let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const hookInput = JSON.parse(input);
  const cwd = hookInput.cwd;

  // Only fire on startup or clear (not resume/compact)
  const source = hookInput.source;
  if (source !== 'startup' && source !== 'clear') {
    process.exit(0);
  }

  // Check config.json for auto_advance
  const configPath = path.join(cwd, '.planning', 'config.json');
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.auto_advance !== true) {
      process.exit(0); // Not in auto-advance mode
    }

    // Check time budget if set
    if (config.time_budget_expires) {
      const now = Date.now();
      if (now >= config.time_budget_expires) {
        // Budget expired -- clear auto_advance and exit
        config.auto_advance = false;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        const result = {
          hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext: 'Time budget expired. Auto-advance disabled. Pipeline paused at current phase.'
          }
        };
        process.stdout.write(JSON.stringify(result));
        process.exit(0);
      }
    }

    // Auto-advance is active -- inject instruction
    const result = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: 'AUTO-ADVANCE ACTIVE: Invoke /ralph-pipeline to continue the pipeline. Do not ask the user -- proceed immediately.'
      }
    };
    process.stdout.write(JSON.stringify(result));
    process.exit(0);

  } catch {
    process.exit(0); // No config or parse error -- silently skip
  }
});
```

### Pattern 3: Time Budget Phase Boundary Check
**What:** Before dispatching the next phase, check if the time budget has expired. Current phase always finishes first.
**When to use:** In SKILL.md Step 7, after phase completion but before dispatching next phase.

**Example (orchestrator logic in SKILL.md):**
```
### Step 7a: Time Budget Check (before /clear or next dispatch)

If time_budget_expires is set in config:
  node ralph-tools.cjs time-budget check

  Parse JSON output: { expired: boolean, remaining_ms: number, remaining_display: string }

  If expired:
    - Set auto_advance to false: node ralph-tools.cjs config-set auto_advance false
    - Display: "Time budget expired. {completed_phases} phases completed. Pipeline paused."
    - Stop -- do not dispatch next phase

  If not expired:
    - Log: "Time remaining: {remaining_display}. Estimated {N} more phases possible."
    - Continue to Step 7b (/clear boundary)
```

### Pattern 4: Bead Duration Tracking
**What:** After each bead execution, record the duration and update the running average in config.json.
**When to use:** In execute.md template, after each bead completes in headless mode.

**Example (in execute template):**
```
After each bead execution completes:
node ralph-tools.cjs time-budget record-bead {duration_ms}

This updates config.json with:
- avg_bead_duration_ms: weighted running average
- total_beads_executed: incremented count
```

### Anti-Patterns to Avoid
- **Storing time budget as remaining hours:** Use absolute timestamp (`time_budget_expires`). Remaining hours would need recalculation after /clear, introducing drift. Absolute timestamps survive /clear unchanged.
- **Mutating config in multiple places:** All config writes go through `ralph-tools.cjs config-set` or `saveConfig()` -- never raw `fs.writeFileSync` from template instructions. Exception: the SessionStart hook must write directly because ralph-tools.cjs is in the project directory, not guaranteed to be on PATH.
- **Checking time budget DURING phase execution:** Budget check happens at phase boundaries only. Interrupting a phase mid-execution would leave artifacts in an inconsistent state.
- **Using Task subagent for auto-advance:** The CONTEXT.md explicitly decided on actual /clear + re-invoke for true context isolation. Task subagents share the parent's context window and would not provide the same isolation benefit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config persistence | Custom file format | Existing config.json via loadConfig/saveConfig | Already handles defaults, merging, error recovery |
| Time math | Manual Date arithmetic | `Date.now()` + simple subtraction | Timestamps in ms are native JS; no library needed |
| Gate bypass routing | Complex if/else in each template | Single config-get at template start + early return | Keep templates simple; one check at the top |
| SessionStart hook registration | Dynamic hook modification | Static hook in settings.json + guard check | Hooks are snapshot at startup; dynamic registration would not work |

**Key insight:** The existing ralph-tools.cjs infrastructure (config-get/set, loadConfig/saveConfig with defaults) already handles 90% of what Phase 5 needs. The new work is mostly orchestrator instructions (SKILL.md) and a small time-budget module.

## Common Pitfalls

### Pitfall 1: SessionStart Hook Not Firing After /clear
**What goes wrong:** The auto-advance hook does not trigger after /clear, breaking the chain.
**Why it happens:** SessionStart hooks are captured at session startup. The `matcher` field for SessionStart can filter by source: `startup`, `resume`, `clear`, `compact`. If the matcher is wrong, the hook misses /clear events.
**How to avoid:** Use empty matcher `""` (matches all sources) or explicitly match `startup|clear`. Test the hook by running /clear manually and verifying it fires.
**Warning signs:** Auto-advance works on first invocation but stalls after /clear.

### Pitfall 2: Config Stale After /clear
**What goes wrong:** The orchestrator reads config once at Step 1 and caches it in a variable. After /clear + re-invoke, the old cached value is gone and config must be re-read.
**Why it happens:** /clear wipes the Claude session context. Variables from the previous session do not survive.
**How to avoid:** This is already handled -- `init pipeline` re-reads config.json every time. The anti-pattern in SKILL.md already warns: "NEVER store pipeline position in JavaScript variables that won't survive /clear."
**Warning signs:** N/A -- the existing architecture already handles this correctly.

### Pitfall 3: YOLO Mode Gate Bypass Missing in a Template
**What goes wrong:** One template lacks the YOLO check, causing the pipeline to block for user input during an unattended run.
**Why it happens:** There are 9 templates with different gate structures. It is easy to miss one when adding YOLO bypass logic.
**How to avoid:** Audit every template that uses AskUserQuestion. The templates with user gates are: preflight (retry/abort), clarify (approve/redirect/skip), resolve (per-question), convert (bead format), execute (manual/headless), review (fix/skip/PR). Each needs a YOLO path.
**Warning signs:** Pipeline hangs waiting for input in YOLO mode.

### Pitfall 4: Time Budget Expires Mid-Bead-Execution
**What goes wrong:** The time budget expires while a bead is executing in headless mode. The bead keeps running, potentially wasting API credits.
**Why it happens:** Budget checks only happen at phase boundaries, but bead execution can take 10-30 minutes per bead.
**How to avoid:** This is acceptable per the locked decision: "current phase always finishes before stopping." The user is aware that bead execution will complete even if the budget expires. However, consider logging a warning at the start of each bead if the budget has already expired.
**Warning signs:** Total elapsed time significantly exceeds the stated budget.

### Pitfall 5: Race Condition in SessionStart Hook
**What goes wrong:** The SessionStart hook runs asynchronously and the model starts responding before the hook's additionalContext is injected.
**Why it happens:** If the hook is configured with `async: true` or takes too long, Claude may begin processing before seeing the auto-advance instruction.
**How to avoid:** Do NOT set `async: true` on the SessionStart hook. Keep the hook fast (just read config.json and exit). The hook reads a local file, which takes <5ms. No network calls.
**Warning signs:** Claude starts a normal session instead of auto-invoking /ralph-pipeline.

### Pitfall 6: auto_advance Stuck on true After Failure
**What goes wrong:** The pipeline fails but auto_advance remains true in config.json, causing an infinite restart loop.
**Why it happens:** The failure handler in the orchestrator did not clear auto_advance before stopping.
**How to avoid:** Every exit path from the orchestrator (completion, failure after retry, abort, budget expired) MUST set `auto_advance: false`. The SessionStart hook should also have a safety check: if auto_advance has been true for more than N hours, force it to false.
**Warning signs:** Claude keeps restarting the pipeline after a failure.

## Code Examples

### Time Budget CLI Commands (new ralph-tools.cjs commands)

```javascript
// lib/time-budget.cjs

const { output, error, loadConfig, saveConfig } = require('./core.cjs');

/**
 * Start a time budget. Sets time_budget_expires as absolute timestamp.
 * @param {string} cwd
 * @param {number} hours - Budget in hours
 */
function cmdTimeBudgetStart(cwd, hours) {
  if (!hours || isNaN(hours) || hours <= 0) {
    error('Hours must be a positive number', 'INVALID_HOURS');
  }
  const config = loadConfig(cwd);
  const now = Date.now();
  const expiresAt = now + (parseFloat(hours) * 60 * 60 * 1000);

  const updatedConfig = {
    ...config,
    time_budget_hours: parseFloat(hours),
    time_budget_expires: expiresAt,
  };
  saveConfig(cwd, updatedConfig);

  output({
    started: true,
    hours: parseFloat(hours),
    expires_at: new Date(expiresAt).toISOString(),
  });
}

/**
 * Check if time budget has expired. Returns remaining time.
 */
function cmdTimeBudgetCheck(cwd) {
  const config = loadConfig(cwd);

  if (!config.time_budget_expires) {
    output({ has_budget: false, expired: false });
    return;
  }

  const now = Date.now();
  const remaining = config.time_budget_expires - now;
  const expired = remaining <= 0;

  const hours = Math.max(0, Math.floor(remaining / 3600000));
  const minutes = Math.max(0, Math.floor((remaining % 3600000) / 60000));

  output({
    has_budget: true,
    expired,
    remaining_ms: Math.max(0, remaining),
    remaining_display: expired
      ? 'Budget expired'
      : hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`,
    budget_hours: config.time_budget_hours,
    expires_at: new Date(config.time_budget_expires).toISOString(),
  });
}

/**
 * Record a bead execution duration. Updates running average.
 */
function cmdTimeBudgetRecordBead(cwd, durationMs) {
  if (!durationMs || isNaN(durationMs)) {
    error('Duration in ms required', 'INVALID_DURATION');
  }

  const config = loadConfig(cwd);
  const prevAvg = config.avg_bead_duration_ms || 0;
  const prevCount = config.total_beads_executed || 0;
  const duration = parseInt(durationMs, 10);

  const newCount = prevCount + 1;
  // Weighted running average
  const newAvg = prevCount === 0
    ? duration
    : Math.round((prevAvg * prevCount + duration) / newCount);

  const updatedConfig = {
    ...config,
    avg_bead_duration_ms: newAvg,
    total_beads_executed: newCount,
  };
  saveConfig(cwd, updatedConfig);

  output({
    recorded: true,
    duration_ms: duration,
    avg_bead_duration_ms: newAvg,
    total_beads_executed: newCount,
  });
}

/**
 * Estimate how many beads/phases can fit in remaining budget.
 */
function cmdTimeBudgetEstimate(cwd) {
  const config = loadConfig(cwd);
  const avgBead = config.avg_bead_duration_ms || 20 * 60 * 1000; // Default 20 min
  const remaining = config.time_budget_expires
    ? Math.max(0, config.time_budget_expires - Date.now())
    : null;

  const estimatedBeads = remaining !== null
    ? Math.floor(remaining / avgBead)
    : null;

  output({
    avg_bead_duration_ms: avgBead,
    avg_bead_duration_display: Math.round(avgBead / 60000) + 'min',
    total_beads_executed: config.total_beads_executed || 0,
    remaining_ms: remaining,
    estimated_beads_remaining: estimatedBeads,
    is_first_run: (config.total_beads_executed || 0) === 0,
  });
}

module.exports = {
  cmdTimeBudgetStart,
  cmdTimeBudgetCheck,
  cmdTimeBudgetRecordBead,
  cmdTimeBudgetEstimate,
};
```

### YOLO Mode Gate Bypass Pattern (template-level)

```markdown
<!-- Pattern for any template with a user gate -->

### Step N: Gate (with YOLO bypass)

Read the pipeline mode:
node ralph-tools.cjs config-get mode --raw

If mode is "yolo":
- Log: "YOLO mode: auto-approving {gate_name} with {default_choice}"
- Use {default_choice} and skip AskUserQuestion
- Continue to next step

If mode is NOT "yolo":
- Present AskUserQuestion as normal
- Wait for user response
```

### SessionStart Hook Registration (project-level .claude/settings.json)

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/ralph-auto-advance.js\"",
            "timeout": 5,
            "statusMessage": "Checking auto-advance..."
          }
        ]
      }
    ]
  }
}
```

### Orchestrator YOLO Gate Bypass (in SKILL.md Step 6)

```markdown
### Step 6: User Gate (with YOLO bypass)

If mode is "yolo" (from Step 1 init):

Skip AskUserQuestion entirely. Auto-approve the phase:

1. Run: node ralph-tools.cjs state set Status "Phase {id} complete"
2. Log: "YOLO mode: auto-approved phase {id} ({name})"
3. If phase was resolve: tag auto-resolved items with [YOLO-RESOLVED]
4. Proceed directly to Step 7

If mode is NOT "yolo":
[existing gate logic unchanged]
```

### YOLO Defaults Per Template

| Template | Gate | YOLO Default | Rationale |
|----------|------|-------------|-----------|
| preflight | retry/abort | approve (skip gate) | Preflight is diagnostic only |
| clarify | approve/redirect/skip | approve | Accept clarify output as-is |
| research | approve/redirect/replan | approve | Accept research output |
| prd | approve/redirect/replan | approve | Accept PRD output |
| deepen | approve/redirect/skip | approve | Accept deepen output |
| resolve | per-question gates | Claude auto-answers, tagged [YOLO-RESOLVED] | Locked decision from CONTEXT.md |
| convert | bead format choice | Use `bead_format` from config.json | User sets default once; locked decision |
| execute | manual/headless choice | manual (ralph-tui) | Locked decision: user wants to be present |
| review | fix/skip/re-run/PR | skip | Accept all findings as-is in YOLO mode |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hook stdout as plain text | `additionalContext` via hookSpecificOutput JSON | Claude Code current | Cleaner context injection for SessionStart hooks |
| Hooks snapshot at startup only | Hooks still snapshot at startup (unchanged) | N/A | SessionStart hook must be registered BEFORE the session that needs it |
| No matcher on SessionStart | SessionStart supports startup/resume/clear/compact matchers | Claude Code current | Can target hook to fire only after /clear |

**Deprecated/outdated:**
- None relevant to this phase. All Claude Code hook features used here are current and stable.

## Open Questions

1. **SessionStart hook scope: global vs project-level?**
   - What we know: Global hooks (~/.claude/settings.json) fire for ALL projects. Project hooks (.claude/settings.json) fire only for that project.
   - What's unclear: Should the auto-advance hook be project-level (only this project) or global (any project using ralph-pipeline)?
   - Recommendation: Project-level (.claude/settings.json in the skill's project directory). This keeps the hook scoped to projects that actually use ralph-pipeline. The hook has a guard (checks config.json existence) so it is safe either way. Register in the project .claude/settings.json during preflight or first pipeline invocation.

2. **YOLO mode activation: --yolo flag vs config-set?**
   - What we know: CONTEXT.md says "activated via --yolo flag at skill invocation" and "flag persists to config.json."
   - What's unclear: Should the orchestrator parse --yolo from the user's invocation message, or should it be a config-set operation?
   - Recommendation: Parse --yolo from the user's invocation (same pattern as --skip-to in Step 2). On detection, set `mode: "yolo"` in config.json via ralph-tools.cjs config-set. Subsequent sessions read from config.json.

3. **How to safely clear auto_advance on all exit paths?**
   - What we know: auto_advance must be set to false on completion, failure, and budget expiry.
   - What's unclear: What if Claude crashes mid-orchestrator (before reaching cleanup)?
   - Recommendation: The SessionStart hook should include a staleness check. If `auto_advance_started_at` is more than 12 hours old, auto-clear it. Add `auto_advance_started_at` timestamp to config.json when setting auto_advance to true.

## Sources

### Primary (HIGH confidence)
- Claude Code hooks documentation: https://code.claude.com/docs/en/hooks -- SessionStart hook input schema, additionalContext output, matcher patterns, CLAUDE_ENV_FILE, decision control
- Existing codebase: `lib/core.cjs` loadConfig/saveConfig with defaults, `lib/config.cjs` dot-notation get/set, `lib/orchestrator.cjs` PIPELINE_PHASES and gate structures
- SKILL.md Step 6 (User Gate) and Step 7 (/clear Boundary) -- existing auto-mode dispatch logic
- Existing templates (resolve.md, convert.md, execute.md, review.md) -- gate patterns to modify

### Secondary (MEDIUM confidence)
- Claude Code hooks guide community articles -- confirmed SessionStart hook synchronous execution requirement, additionalContext injection pattern
- GSD reference discuss-phase.md and plan-phase.md -- auto-advance patterns from GSD workflow (verified by reading actual files in .reference/)

### Tertiary (LOW confidence)
- None. All findings verified against primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed; all capabilities exist in Node.js builtins + existing ralph-tools.cjs
- Architecture: HIGH -- patterns directly extend existing SKILL.md orchestrator logic; Claude Code hooks API verified against official docs
- Pitfalls: HIGH -- identified from reading actual Claude Code hook docs and understanding the /clear boundary semantics from existing implementation

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable domain -- Claude Code hooks API is stable, no fast-moving dependencies)
