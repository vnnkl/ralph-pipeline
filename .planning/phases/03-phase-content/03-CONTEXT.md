# Phase 3: Phase Content - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the subagent prompts and validation logic for four pipeline phases: Research, PRD, Deepen, and Resolution. Each phase template must invoke chained skills correctly and produce validated output. The orchestrator shell (Phase 2) dispatches these templates — this phase fills in their content.

</domain>

<decisions>
## Implementation Decisions

### Research Agent Design
- 4 parallel agents write individual files to .planning/research/, then gsd-research-synthesizer merges into SUMMARY.md
- Use GSD's existing compound-engineering subagent types directly: repo-research-analyst, best-practices-researcher, framework-docs-researcher, learnings-researcher
- Skip learnings-researcher if docs/solutions/ directory doesn't exist in the user's project (note "no learnings found" in SUMMARY.md)
- Synthesis step dispatches as Task(subagent_type='gsd-research-synthesizer')

### PRD Context Input
- Research context passed to /ralph-tui-prd is configurable: SUMMARY.md only (default) or all individual research files (for comprehensive/6hr runs)
- Configuration controlled by existing depth setting in config.json

### PRD Validation
- Hard gate: if [PRD]...[/PRD] markers missing or fewer than 3 user stories, phase fails visibly — no soft warnings
- Tracer bullet: US-001 must be a vertical slice through the layers the PRD declares as in-scope (not hardcoded to DB+backend+frontend)
- Parse PRD structure to detect layer coverage; verify against PRD-declared scope, not against the entire codebase

### Deepen Gate Behavior
- Use GSD's compound-engineering review agents: security-sentinel, architecture-strategist, code-simplicity-reviewer, performance-oracle
- Present findings as per-agent sections with attribution headers (Security, Architecture, Simplicity, Performance)
- "Refine" auto-revises: spawn an agent that reads findings + PRD, produces revised PRD for user review
- "Re-run" re-runs all 4 review agents (not just affected ones) — PRD changed so all perspectives need fresh review
- "Proceed" advances to next phase

### Resolution Flow
- Present open items one-by-one via AskUserQuestion, not batched
- Generate 2-3 concrete answer options per item based on surrounding PRD context
- Write answers back inline to PRD immediately (replacing [TBD]) — partial progress survives interruption
- Scan both the PRD body for [TBD]/[TODO]/[PLACEHOLDER] patterns AND the open-questions file
- Final validation pass: re-scan PRD after all items resolved to confirm zero markers remain; loop back if any found

### Claude's Discretion
- Exact prompt wording for each subagent
- How research synthesis weighs conflicting agent findings
- Error recovery when a subagent fails or returns empty
- Formatting of deepen review findings within per-agent sections

</decisions>

<specifics>
## Specific Ideas

- Research agent prompt structure should follow GSD agent definitions in .reference/get-shit-done/
- The pipeline's hands-free philosophy means auto-revise should be the default at deepen gate (not manual editing)
- Tracer bullet validation needs to be smart about projects that only work on a subset of existing layers

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-phase-content*
*Context gathered: 2026-02-25*
