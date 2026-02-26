# Phase 7: Preflight Cache + Skip-on-Resume - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Preflight writes a cache file on success so init-pipeline can report `preflight_passed` and skip re-running preflight on resume. Closes INT-02 and FLOW-02 from v1.0 audit.

</domain>

<decisions>
## Implementation Decisions

### Cache freshness
- No TTL — cache is valid as long as the file exists and `passed: true`
- No automatic expiration; cache persists until `--force` or manual deletion
- Remove the existing 1-hour TTL check from `checkPreflightCache` in `lib/init.cjs`

### Cache content
- Store full preflight results (passed, missing, setup_actions, reference info) — not just pass/fail
- Include `version: 1` field for future format changes (version mismatch = treat as stale)
- Include timestamp for informational purposes (not used for expiry)
- File location: `.planning/.preflight-cache.json`
- File is gitignored (machine-local state, not committed)

### Cache write behavior
- `cmdPreflight` writes cache automatically on success — no explicit flag needed
- Failed preflight does NOT write a cache (only success is cached)

### Stale cache / resume behavior
- `cmdInitPipeline` returns `preflight_passed: true` when valid cache exists — silent skip, no mention to user
- Missing or invalid cache returns `preflight_passed: null` — orchestrator decides whether to run preflight
- `passed: false` in cache also returns `null` (treat as "needs re-run")

### Force re-run
- Add `--force` flag to `cmdPreflight` (exposed through `ralph-tools.cjs` CLI)
- `--force` deletes old cache, runs preflight fresh, writes new cache on success

### Invalidation
- No automatic invalidation — no TTL, no config fingerprinting, no file watching
- Cache version field handles format evolution: if version doesn't match expected, treat as stale

### Claude's Discretion
- Exact JSON structure of the cache file (as long as it includes version, timestamp, passed, and full results)
- Error handling for corrupt/unreadable cache files
- Whether to log cache write to stderr for debugging

</decisions>

<specifics>
## Specific Ideas

- Existing `checkPreflightCache` in `lib/init.cjs` (line 41) already reads the cache — update it to remove TTL, add version check
- Existing `cmdPreflight` in `lib/preflight.cjs` (line 259) needs cache write added after successful output
- `ralph-tools.cjs` needs `--force` flag parsing for the preflight command

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-preflight-cache-skip-on-resume*
*Context gathered: 2026-02-26*
