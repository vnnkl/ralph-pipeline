# Phase 10: Cosmetic Cleanup - Research

**Researched:** 2026-02-26
**Domain:** Documentation alignment, config defaults, dead code removal
**Confidence:** HIGH

## Summary

Phase 10 is a purely cosmetic/housekeeping phase with four discrete tasks. No new libraries, no architectural changes, no runtime behavior modifications. Every change is a one-line or few-line edit to existing files. The scope is fully enumerated by the success criteria and the v1.0 audit report (INT-05, INT-06, tech debt items).

The risk is low. The only code change with any behavioral effect is adding `auto_advance_started_at: null` to `loadConfig` defaults in `lib/core.cjs`. This ensures `config-get auto_advance_started_at` returns `null` instead of `CONFIG_KEY_NOT_FOUND` when never set. The SessionStart hook already reads config.json directly and guards with an if-check, so this is belt-and-suspenders.

**Primary recommendation:** Execute as a single plan with four tasks (one per success criterion). No dependencies between tasks.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ORCH-07 | Auto-advance chain (--auto flag): phases advance hands-free from research through review | Adding `auto_advance_started_at` to loadConfig defaults ensures `config-get` never errors on this key. Cosmetic fix -- hook already works via direct config.json read. |
</phase_requirements>

## Standard Stack

No new libraries or tools needed. All changes are edits to existing files using existing patterns.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js fs | builtin | Read/write config.json, lib files | Already used everywhere |
| Text editor | N/A | Markdown file edits | ROADMAP.md, REQUIREMENTS.md |

### Supporting
None needed.

### Alternatives Considered
None -- scope is too narrow for alternatives.

## Architecture Patterns

### Pattern 1: loadConfig Defaults Extension
**What:** Add a new key to the `defaults` object in `loadConfig()` at `lib/core.cjs:111-125`
**When to use:** When a config key is read via `config-get` but has no default
**Example:**
```javascript
// lib/core.cjs lines 111-125
function loadConfig(cwd) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  const defaults = {
    mode: 'normal',
    depth: 'standard',
    // ... existing defaults ...
    phase_retry_count: 0,
    auto_advance_started_at: null,  // <-- ADD THIS
  };
  // ... rest unchanged ...
}
```

### Pattern 2: ROADMAP Checkbox Sync
**What:** Update `- [ ]` to `- [x]` for completed phases; update progress table rows
**When to use:** After phases complete but ROADMAP was not updated (stale data)
**Scope of staleness (verified against VERIFICATION.md files on disk):**

Top-level phase checkboxes -- current vs correct:
| Phase | Current | Should Be | Reason |
|-------|---------|-----------|--------|
| Phase 1 | `[ ]` | `[x]` | 5/5 plans complete, 01-VERIFICATION.md exists |
| Phase 5 | `[ ]` | `[x]` | 3/3 plans complete, 05-VERIFICATION.md exists |
| Phase 6 | `[ ]` | `[x]` | 1/1 plan complete, 06-VERIFICATION.md exists |
| Phase 7 | `[ ]` | `[x]` | 1/1 plan complete, 07-VERIFICATION.md exists |
| Phase 8 | `[ ]` | `[x]` | 2/2 plans complete, 08-VERIFICATION.md exists |

Plan-level checkboxes -- stale items:
| Phase | Plans | Current Checkboxes | Should Be |
|-------|-------|--------------------|-----------|
| Phase 5 | 05-01, 05-02, 05-03 | All `[ ]` | All `[x]` |
| Phase 6 | 06-01 | `[ ]` | `[x]` |
| Phase 7 | 07-01 | `[ ]` | `[x]` |
| Phase 8 | Shows "0 plans" | No plan list | "2 plans" with `[x]` plan list |
| Phase 9 | 09-01, 09-02 | Both `[ ]` | Both `[x]` |

Progress table rows -- current vs correct (from STATE.md):
| Phase | Current Row | Should Be |
|-------|-------------|-----------|
| 4. Execution Layer | 3/3 | 4/4 (4 plans actually exist) |
| 5. Advanced Features | 0/3 Not started | 3/3 Complete 2026-02-25 |
| 6. Time Budget Init | 0/1 Not started | 1/1 Complete 2026-02-26 |
| 7. Preflight Cache | 0/0 Not started | 1/1 Complete 2026-02-26 |
| 8. Tech Debt Cleanup | 0/0 Not started | 2/2 Complete 2026-02-26 |

Phase 8 details section also needs "Plans" line updated from "0 plans (to be planned)" to actual plan info.
Phase 9 detail section plan count is correct (2 plans) but plan checkboxes are unchecked.

### Pattern 3: Traceability Table Update
**What:** Add phase numbers to the "Phase" column of existing rows in REQUIREMENTS.md
**Exact changes needed:**

Current traceability rows:
```
| TIME-01 | Phase 5, 6 | Complete |
| TIME-04 | Phase 5, 6 | Complete |
| ORCH-02 | Phase 1, 7 | Complete |
```

**IMPORTANT FINDING:** The CURRENT REQUIREMENTS.md file ALREADY shows TIME-01/TIME-04 mapped to "Phase 5, 6" and ORCH-02 mapped to "Phase 1, 7". This matches the desired state from the audit. The traceability table may have been fixed in a prior phase. The planner should verify current state and skip if already correct.

### Pattern 4: Dead Code Removal
**What:** Remove the `spliceFrontmatter` function body from `lib/frontmatter.cjs`
**Current state (lines 233-243):**
```javascript
// -- Splice -------------------------------------------------------------------

/**
 * Extract frontmatter, merge updates immutably, reconstruct.
 * Returns full file content string.
 */
function spliceFrontmatter(content, updates) {
  const { frontmatter, body } = extractFrontmatter(content);
  const merged = { ...frontmatter, ...updates };
  return reconstructFrontmatter(merged, body);
}
```
- Function is defined but NOT exported (export was removed in Phase 8)
- No callers in any `.cjs` file (verified via grep)
- Decision from Phase 8: "Kept spliceFrontmatter function body but removed export (small, may be useful later)"
- Phase 10 success criteria explicitly says: "Dead spliceFrontmatter function body removed from lib/frontmatter.cjs"

Remove the entire block: comment separator, JSDoc, and function body (lines 233-243). Keep `module.exports` intact.

### Anti-Patterns to Avoid
- **Partial ROADMAP updates:** Update ALL stale data in one pass, not just checkboxes. The progress table must also be corrected.
- **Editing REQUIREMENTS.md unnecessarily:** Verify the traceability table is actually wrong before changing it. It may have been fixed in a prior phase.

## Don't Hand-Roll

Not applicable -- no libraries or custom solutions needed for this phase.

## Common Pitfalls

### Pitfall 1: Missing Stale ROADMAP Entries
**What goes wrong:** Updating only the top-level phase checkboxes but forgetting plan-level checkboxes, progress table, or "Plans: 0 plans" text
**Why it happens:** Multiple locations in ROADMAP.md reference the same completion state
**How to avoid:** Enumerate all locations upfront (checkboxes, plan lists, plan counts, progress table) and check each
**Warning signs:** Progress table still shows "Not started" after checkbox fix

### Pitfall 2: Traceability Table Already Fixed
**What goes wrong:** Making a change that's already been applied, potentially introducing a duplicate
**Why it happens:** The audit report was written before subsequent phases may have fixed the issue
**How to avoid:** Read the CURRENT file content and compare against desired state before editing
**Warning signs:** The REQUIREMENTS.md already shows the correct phase mappings

### Pitfall 3: Breaking spliceFrontmatter Removal
**What goes wrong:** Removing more or less than intended (e.g., accidentally removing the module.exports or the comment separator)
**Why it happens:** Imprecise line targeting
**How to avoid:** Remove exactly: the comment separator line `// -- Splice ---...`, the JSDoc comment, and the function body. Leave `module.exports` intact.
**Warning signs:** Module exports break, or leftover orphan comments

## Code Examples

### Adding auto_advance_started_at to loadConfig defaults
```javascript
// In lib/core.cjs, inside loadConfig() defaults object
const defaults = {
  mode: 'normal',
  depth: 'standard',
  model_profile: 'balanced',
  commit_docs: true,
  auto_advance: false,
  time_budget: null,
  ide: null,
  time_budget_expires: null,
  time_budget_hours: null,
  avg_bead_duration_ms: null,
  total_beads_executed: 0,
  bead_format: null,
  phase_retry_count: 0,
  auto_advance_started_at: null,  // NEW: prevents CONFIG_KEY_NOT_FOUND
};
```

### Removing spliceFrontmatter from lib/frontmatter.cjs
```javascript
// REMOVE these lines (233-243):
// -- Splice -------------------------------------------------------------------

/**
 * Extract frontmatter, merge updates immutably, reconstruct.
 * Returns full file content string.
 */
function spliceFrontmatter(content, updates) {
  const { frontmatter, body } = extractFrontmatter(content);
  const merged = { ...frontmatter, ...updates };
  return reconstructFrontmatter(merged, body);
}

// KEEP module.exports unchanged (already excludes spliceFrontmatter)
```

## State of the Art

Not applicable -- this phase involves no libraries or evolving APIs.

## Open Questions

1. **Is REQUIREMENTS.md traceability table already correct?**
   - What we know: Current file shows `TIME-01 | Phase 5, 6`, `TIME-04 | Phase 5, 6`, `ORCH-02 | Phase 1, 7` which matches the desired state from the audit
   - What's unclear: Whether this was fixed post-audit or the audit was wrong
   - Recommendation: Planner should verify current state and skip this task if already correct. Success criterion 3 may already be satisfied.

## Sources

### Primary (HIGH confidence)
- `lib/core.cjs` - loadConfig defaults (lines 109-134)
- `lib/frontmatter.cjs` - spliceFrontmatter dead code (lines 233-248)
- `.planning/ROADMAP.md` - stale checkboxes and progress table
- `.planning/REQUIREMENTS.md` - traceability table (lines 114-155)
- `.planning/v1.0-MILESTONE-AUDIT.md` - INT-05, INT-06, tech debt items
- `.planning/STATE.md` - actual plan counts and completion dates

### Secondary (MEDIUM confidence)
- Phase VERIFICATION.md files (all 9 exist) - confirm which phases are truly complete

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no libraries needed, verified existing code
- Architecture: HIGH - all changes are simple edits to known files with known patterns
- Pitfalls: HIGH - main risk is staleness verification, fully enumerated above

**Research date:** 2026-02-26
**Valid until:** indefinite (no external dependencies that could change)
