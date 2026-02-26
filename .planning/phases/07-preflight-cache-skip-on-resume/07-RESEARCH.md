# Phase 7: Preflight Cache + Skip-on-Resume - Research

**Researched:** 2026-02-26
**Domain:** File-based caching for CLI state (Node.js CJS, zero dependencies)
**Confidence:** HIGH

## Summary

This phase closes two v1.0 audit gaps: INT-02 (preflight cache never written) and FLOW-02 (preflight skip-on-resume never activates). The existing codebase already has the reader side implemented (`checkPreflightCache` in `lib/init.cjs`, line 41) but never writes the cache file. The writer side must be added to `cmdPreflight` in `lib/preflight.cjs`. Additionally, the existing reader has a 1-hour TTL check that the user has explicitly decided to remove -- cache validity should be based solely on `passed: true` and version match, with no time-based expiry.

The scope is narrow: modify `cmdPreflight` to write `.planning/.preflight-cache.json` on success, update `checkPreflightCache` to remove TTL and add version checking, add `--force` flag to the CLI, and ensure the cache file is gitignored. No new libraries needed -- this is pure Node.js `fs` operations on a single JSON file.

**Primary recommendation:** Modify three files (`lib/preflight.cjs`, `lib/init.cjs`, `ralph-tools.cjs`) with minimal, focused changes. Write cache after constructing the result object but before the `output()` call since `output()` calls `process.exit(0)`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- No TTL -- cache is valid as long as the file exists and `passed: true`
- No automatic expiration; cache persists until `--force` or manual deletion
- Remove the existing 1-hour TTL check from `checkPreflightCache` in `lib/init.cjs`
- Store full preflight results (passed, missing, setup_actions, reference info) -- not just pass/fail
- Include `version: 1` field for future format changes (version mismatch = treat as stale)
- Include timestamp for informational purposes (not used for expiry)
- File location: `.planning/.preflight-cache.json`
- File is gitignored (machine-local state, not committed)
- `cmdPreflight` writes cache automatically on success -- no explicit flag needed
- Failed preflight does NOT write a cache (only success is cached)
- `cmdInitPipeline` returns `preflight_passed: true` when valid cache exists -- silent skip, no mention to user
- Missing or invalid cache returns `preflight_passed: null` -- orchestrator decides whether to run preflight
- `passed: false` in cache also returns `null` (treat as "needs re-run")
- Add `--force` flag to `cmdPreflight` (exposed through `ralph-tools.cjs` CLI)
- `--force` deletes old cache, runs preflight fresh, writes new cache on success
- No automatic invalidation -- no TTL, no config fingerprinting, no file watching
- Cache version field handles format evolution: if version doesn't match expected, treat as stale

### Claude's Discretion
- Exact JSON structure of the cache file (as long as it includes version, timestamp, passed, and full results)
- Error handling for corrupt/unreadable cache files
- Whether to log cache write to stderr for debugging

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ORCH-02 | Pre-flight detects user's IDE environment (or asks) and checks only relevant dependencies -- no bloat installs | Cache write in `cmdPreflight` stores the full preflight result so it can be read back by `cmdInitPipeline`. The `--force` flag allows re-running when environment changes. The skip-on-resume behavior means preflight only runs once per environment setup, not on every pipeline invocation. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs` | builtin | Read/write cache JSON file | Zero-dep constraint (STATE-01); project uses `fs.readFileSync`/`fs.writeFileSync` everywhere |
| Node.js `path` | builtin | Construct `.planning/.preflight-cache.json` path | Already used in all lib/ modules |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `JSON.parse`/`JSON.stringify` | builtin | Serialize/deserialize cache | Standard project pattern for all JSON I/O |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON file | SQLite / LevelDB | Overkill for single-file cache; violates zero-dep constraint |
| Manual JSON | `conf` / `configstore` npm | Violates zero-dep constraint (STATE-01) |

**Installation:**
```bash
# No installation needed -- Node.js builtins only
```

## Architecture Patterns

### Recommended Changes Map
```
lib/preflight.cjs     # Add: writePreflightCache(), modify cmdPreflight()
lib/init.cjs          # Modify: checkPreflightCache() -- remove TTL, add version check
ralph-tools.cjs       # Modify: preflight case -- parse --force flag, pass to cmdPreflight()
.gitignore            # Add: .planning/.preflight-cache.json
tests/preflight.test.cjs  # New: test cache write/read cycle
```

### Pattern 1: Cache Write on Success (in cmdPreflight)
**What:** Write the cache file BEFORE calling `output()` because `output()` calls `process.exit(0)`.
**When to use:** Every successful preflight run.
**Example:**
```javascript
// In cmdPreflight, after determining passed === true but BEFORE output():
const CACHE_VERSION = 1;
const cachePath = path.join(cwd, '.planning', '.preflight-cache.json');

if (passed) {
  const cache = {
    version: CACHE_VERSION,
    timestamp: Date.now(),
    passed: true,
    missing,
    setup_actions: actions,
    reference: referenceInfo,
    config: { ide: config.ide },
  };
  try {
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // Cache write failure is non-fatal -- preflight still passes
  }
}

output(result, raw);
```

### Pattern 2: Cache Read with Version Check (in checkPreflightCache)
**What:** Remove TTL check, add version field validation, return `true` only when `passed === true` AND `version === CACHE_VERSION`.
**When to use:** Every `init pipeline` and `init phase` call.
**Example:**
```javascript
const EXPECTED_CACHE_VERSION = 1;

function checkPreflightCache(cwd) {
  const cachePath = path.join(cwd, '.planning', '.preflight-cache.json');
  try {
    const content = fs.readFileSync(cachePath, 'utf-8');
    const cache = JSON.parse(content);
    if (cache.version !== EXPECTED_CACHE_VERSION) {
      return null;
    }
    if (cache.passed === true) {
      return true;
    }
    return null;
  } catch {
    return null;
  }
}
```

### Pattern 3: --force Flag via CLI
**What:** Parse `--force` in `ralph-tools.cjs` preflight case, delete existing cache, pass force flag to `cmdPreflight`.
**When to use:** User wants to re-run preflight despite existing cache.
**Example:**
```javascript
// In ralph-tools.cjs, preflight case:
case 'preflight': {
  const forceIdx = args.indexOf('--force');
  const force = forceIdx !== -1;
  if (forceIdx !== -1) args.splice(forceIdx, 1);
  preflight.cmdPreflight(cwd, raw, force);
  break;
}

// In cmdPreflight, accept force parameter:
function cmdPreflight(cwd, raw, force) {
  if (force) {
    const cachePath = path.join(cwd, '.planning', '.preflight-cache.json');
    try { fs.unlinkSync(cachePath); } catch { /* no-op */ }
  }
  // ... rest of preflight logic unchanged ...
}
```

### Anti-Patterns to Avoid
- **Writing cache after `output()`:** `output()` calls `process.exit(0)` -- any code after it never executes.
- **Caching failed results:** User decided only success is cached. Failed preflight should NOT write cache.
- **Using `process.exit(0)` bypass for cache write:** Don't restructure `output()`. Write cache before calling `output()`.
- **Adding TTL back:** User explicitly removed TTL. Cache is valid until `--force` or version mismatch.
- **Mutating the result object to add cache metadata:** Keep cache content and `output()` result separate. The cache stores the full result, but the result object sent to stdout should not change.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON file I/O | Custom serializer | `JSON.stringify`/`JSON.parse` | Standard, handles edge cases |
| File deletion (--force) | Complex cleanup | `fs.unlinkSync` with try/catch | Simple, idempotent |
| Path construction | String concatenation | `path.join()` | Cross-platform safety |

**Key insight:** This phase is intentionally simple. The entire implementation is ~30 lines of new code across 3 files. The complexity is in getting the integration points right (write before `output()`, version field, gitignore), not in the caching logic itself.

## Common Pitfalls

### Pitfall 1: Writing Cache After output()
**What goes wrong:** Cache write code placed after `output(result, raw)` never executes because `output()` calls `process.exit(0)`.
**Why it happens:** Easy to forget that `output()` terminates the process.
**How to avoid:** Write cache file BEFORE the `output()` call. The cache write is the last thing before `output()`.
**Warning signs:** Cache file never appears on disk despite successful preflight runs.

### Pitfall 2: Breaking cmdPreflight Signature
**What goes wrong:** Adding the `force` parameter changes `cmdPreflight(cwd, raw)` to `cmdPreflight(cwd, raw, force)`. If any other caller still uses the old signature, it silently gets `force === undefined` which is falsy -- safe but worth noting.
**Why it happens:** JavaScript doesn't enforce function signatures.
**How to avoid:** Check all callers of `cmdPreflight`. Currently only `ralph-tools.cjs` calls it. The `module.exports` already exports it.
**Warning signs:** `--force` flag has no effect.

### Pitfall 3: Forgetting to Gitignore the Cache File
**What goes wrong:** `.planning/.preflight-cache.json` gets committed to git. It contains machine-local paths and state.
**Why it happens:** `.planning/` is not gitignored (it contains committed files like STATE.md).
**How to avoid:** Add `.planning/.preflight-cache.json` to `.gitignore` explicitly.
**Warning signs:** `git status` shows the cache file as untracked.

### Pitfall 4: Cache File in Non-existent Directory
**What goes wrong:** `fs.writeFileSync` throws if `.planning/` directory doesn't exist.
**Why it happens:** Could happen in edge case where preflight passes but `.planning/` hasn't been created yet.
**How to avoid:** The preflight check itself includes `checkPlanningDir()` which verifies `.planning/` exists. If it doesn't exist, that's a setup_action, and preflight still passes (it's not a required dependency). However, the cache write should wrap in try/catch regardless (already recommended).
**Warning signs:** Error in stderr about ENOENT during cache write.

### Pitfall 5: Failed Preflight Exit Path
**What goes wrong:** The failed preflight path calls `process.exit(1)` directly after writing to stdout/stderr (lines 332-338). Cache should NOT be written on this path.
**Why it happens:** `cmdPreflight` has two exit paths: success via `output()` and failure via manual `process.exit(1)`.
**How to avoid:** Only write cache when `passed === true`, and place the write before the `output()` call (not before the failure exit).
**Warning signs:** Cache file written with `passed: false` content.

## Code Examples

### Complete Cache Write Logic
```javascript
// lib/preflight.cjs -- additions

const CACHE_VERSION = 1;

function writePreflightCache(cwd, result) {
  const cachePath = path.join(cwd, '.planning', '.preflight-cache.json');
  const cache = {
    version: CACHE_VERSION,
    timestamp: Date.now(),
    passed: result.passed,
    missing: result.missing,
    setup_actions: result.setup_actions,
    reference: result.reference,
    config: result.config,
  };
  try {
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // Non-fatal: cache write failure doesn't block preflight
  }
}
```

### Complete Updated checkPreflightCache
```javascript
// lib/init.cjs -- replacement for existing checkPreflightCache

const EXPECTED_CACHE_VERSION = 1;

function checkPreflightCache(cwd) {
  const cachePath = path.join(cwd, '.planning', '.preflight-cache.json');
  try {
    const content = fs.readFileSync(cachePath, 'utf-8');
    const cache = JSON.parse(content);
    if (cache.version !== EXPECTED_CACHE_VERSION) {
      return null;
    }
    if (cache.passed === true) {
      return true;
    }
    return null;
  } catch {
    return null;
  }
}
```

### CLI --force Flag Parsing
```javascript
// ralph-tools.cjs -- updated preflight case

case 'preflight': {
  const forceIdx = args.indexOf('--force');
  const force = forceIdx !== -1;
  if (forceIdx !== -1) args.splice(forceIdx, 1);
  preflight.cmdPreflight(cwd, raw, force);
  break;
}
```

### Force Delete in cmdPreflight
```javascript
// lib/preflight.cjs -- at top of cmdPreflight

function cmdPreflight(cwd, raw, force) {
  if (force) {
    const cachePath = path.join(cwd, '.planning', '.preflight-cache.json');
    try { fs.unlinkSync(cachePath); } catch { /* no-op */ }
  }
  // ... existing preflight logic ...
}
```

### Test Pattern (subprocess execution)
```javascript
// tests/preflight.test.cjs -- follows init.test.cjs pattern

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function createTempProjectForPreflight() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-preflight-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  // ... setup minimal required files ...
  return tmpDir;
}

// Test: preflight writes cache on success
// Test: cache file contains version, timestamp, passed, results
// Test: init pipeline returns preflight_passed: true when valid cache exists
// Test: init pipeline returns preflight_passed: null when cache missing
// Test: init pipeline returns preflight_passed: null when version mismatch
// Test: --force deletes old cache and re-runs
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 1-hour TTL on cache | No TTL (user decision) | Phase 7 CONTEXT.md | Cache persists until --force or version mismatch |
| Cache read only (init.cjs) | Cache read + write (init.cjs + preflight.cjs) | Phase 7 | Closes INT-02 gap |
| `checkPreflightCache` checks timestamp age | `checkPreflightCache` checks version field | Phase 7 | Simpler, more predictable invalidation |

**Deprecated/outdated:**
- 1-hour TTL in `checkPreflightCache`: Explicitly removed per user decision. Cache validity is based on existence + `passed: true` + version match only.

## Open Questions

1. **CACHE_VERSION constant location**
   - What we know: Both `lib/preflight.cjs` (writer) and `lib/init.cjs` (reader) need access to the same version constant.
   - What's unclear: Should the constant live in one file and be imported, or duplicated in both?
   - Recommendation: Export `CACHE_VERSION` from `lib/preflight.cjs` and import in `lib/init.cjs`. Single source of truth. Alternatively, define it in `lib/core.cjs` if preferred. Either works -- the value is `1` and unlikely to diverge.

2. **Cache write stderr logging**
   - What we know: User marked this as Claude's discretion.
   - What's unclear: Whether stderr logging aids debugging or creates noise.
   - Recommendation: Skip stderr logging for now. The cache write is wrapped in try/catch with silent failure. If debugging is needed later, a `--verbose` flag would be more appropriate than always-on logging.

## Sources

### Primary (HIGH confidence)
- Project source code: `lib/preflight.cjs`, `lib/init.cjs`, `ralph-tools.cjs`, `lib/core.cjs` -- direct inspection of current implementation
- Project source code: `tests/init.test.cjs` -- subprocess testing pattern used by the project
- `.planning/v1.0-MILESTONE-AUDIT.md` -- INT-02 and FLOW-02 gap definitions
- `.planning/phases/07-preflight-cache-skip-on-resume/07-CONTEXT.md` -- all locked decisions

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` accumulated decisions -- prior cache design from Phase 01-04

### Tertiary (LOW confidence)
- None -- this phase is entirely internal to the project with no external dependencies

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Node.js builtins only, zero external dependencies, established project pattern
- Architecture: HIGH -- Three existing files to modify, clear insertion points identified at specific line numbers
- Pitfalls: HIGH -- All pitfalls derived from direct code inspection (e.g., `output()` calling `process.exit(0)`)

**Research date:** 2026-02-26
**Valid until:** Indefinite (no external dependencies to version-drift)
