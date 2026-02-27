# Phase 3: Phase Content - Research

**Researched:** 2026-02-25
**Domain:** Subagent prompt engineering for multi-phase AI pipeline (research, PRD, deepen, resolution)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 4 parallel agents write individual files to .planning/research/, then gsd-research-synthesizer merges into SUMMARY.md
- Use GSD's existing compound-engineering subagent types directly: repo-research-analyst, best-practices-researcher, framework-docs-researcher, learnings-researcher
- Skip learnings-researcher if docs/solutions/ directory doesn't exist in the user's project (note "no learnings found" in SUMMARY.md)
- Synthesis step dispatches as Task(subagent_type='gsd-research-synthesizer')
- Research context passed to /ralph-tui-prd is configurable: SUMMARY.md only (default) or all individual research files (for comprehensive/6hr runs)
- Configuration controlled by existing depth setting in config.json
- Hard gate: if [PRD]...[/PRD] markers missing or fewer than 3 user stories, phase fails visibly -- no soft warnings
- Tracer bullet: US-001 must be a vertical slice through the layers the PRD declares as in-scope (not hardcoded to DB+backend+frontend)
- Parse PRD structure to detect layer coverage; verify against PRD-declared scope, not against the entire codebase
- Use GSD's compound-engineering review agents: security-sentinel, architecture-strategist, code-simplicity-reviewer, performance-oracle
- Present findings as per-agent sections with attribution headers (Security, Architecture, Simplicity, Performance)
- "Refine" auto-revises: spawn an agent that reads findings + PRD, produces revised PRD for user review
- "Re-run" re-runs all 4 review agents (not just affected ones) -- PRD changed so all perspectives need fresh review
- "Proceed" advances to next phase
- Present open items one-by-one via AskUserQuestion, not batched
- Generate 2-3 concrete answer options per item based on surrounding PRD context
- Write answers back inline to PRD immediately (replacing [TBD]) -- partial progress survives interruption
- Scan both the PRD body for [TBD]/[TODO]/[PLACEHOLDER] patterns AND the open-questions file
- Final validation pass: re-scan PRD after all items resolved to confirm zero markers remain; loop back if any found

### Claude's Discretion
- Exact prompt wording for each subagent
- How research synthesis weighs conflicting agent findings
- Error recovery when a subagent fails or returns empty
- Formatting of deepen review findings within per-agent sections

### Deferred Ideas (OUT OF SCOPE)
- None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RSRCH-01 | Parallel research agents spawn before PRD (repo-research-analyst, best-practices-researcher, framework-docs-researcher, learnings-researcher) | GSD new-project and new-milestone workflows provide exact Task dispatch pattern with 4 parallel agents; compound-agents/research/ has all 3 core agent definitions; learnings-researcher has no existing definition -- must be created |
| RSRCH-02 | Research outputs written to .planning/research/ as structured markdown | GSD research-project templates (STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, SUMMARY.md) define the output format; ralph-pipeline adapts file names for phase-research context |
| RSRCH-03 | Research summary synthesized from individual outputs before PRD creation | GSD gsd-research-synthesizer agent definition provides synthesis pattern; model-profiles.md maps synthesizer to sonnet/sonnet/haiku by profile |
| PRD-01 | PRD created by invoking /ralph-tui-prd skill with research context | /ralph-tui-prd SKILL.md documents the full flow: clarifying questions, [PRD]...[/PRD] markers, US-NNN format, Quality Gates section; skill is invoked via Skill tool from within the template subagent |
| PRD-02 | PRD enforces tracer bullet ordering (vertical slices: DB -> backend -> frontend per story) | CONTEXT.md decision: validate against PRD-declared scope not entire codebase; parse user stories for layer references; US-001 must touch all declared layers |
| PRD-03 | Open questions collected during PRD creation appended to open-questions file | /ralph-tui-prd outputs Open Questions section (section 9); template must extract these and write to .planning/pipeline/open-questions.md |
| DEEP-01 | Parallel review agents run against PRD (security-sentinel, architecture-strategist, code-simplicity-reviewer, performance-oracle) | compound-review SKILL.md and compound-agents/review/ have all 4 agent definitions; GSD compound review pattern provides parallel dispatch model |
| DEEP-02 | Review findings incorporated into PRD with gate: refine, re-run, or proceed | CONTEXT.md decision: refine auto-revises via spawned agent; re-run re-runs all 4 agents fresh; proceed advances |
| RSLV-01 | Blocking gate: all open questions must be resolved before conversion proceeds | CONTEXT.md decision: scan PRD body + open-questions file for [TBD]/[TODO]/[PLACEHOLDER]; final re-scan after all items resolved |
| RSLV-02 | Each open question presented via AskUserQuestion with concrete options | CONTEXT.md decision: one-by-one presentation, 2-3 concrete options per item based on PRD context; GSD questioning.md reference for AskUserQuestion patterns |
| RSLV-03 | PRD updated with answers; open-questions file marked resolved | CONTEXT.md decision: write answers inline immediately (partial progress survives interruption); mark items [x] in open-questions file |
</phase_requirements>

## Summary

Phase 3 fills the stub templates for four pipeline phases (Research, PRD, Deepen, Resolution) with working subagent prompts. Each template is dispatched by the orchestrator shell (Phase 2) as a Task subagent with `{{VAR}}` placeholders filled at dispatch time. The templates currently exist at `templates/research.md`, `templates/prd.md`, `templates/deepen.md`, and `templates/resolve.md` as stub skeletons with TODO markers.

The core challenge is **prompt engineering at scale**: each template must precisely instruct a fresh-context subagent to read specific files, invoke chained skills or spawn nested subagents, validate structural output, and write completion files. The GSD reference repository (`.reference/get-shit-done/`) provides authoritative patterns for all four phases -- the research phase mirrors the `new-project.md` / `new-milestone.md` 4-agent parallel dispatch, the PRD phase chains to `/ralph-tui-prd`, the deepen phase mirrors `compound-review`, and the resolution phase is a novel gate with no direct GSD equivalent (closest analog is the questioning pattern in `references/questioning.md`).

**Primary recommendation:** Build each template as a self-contained subagent prompt that follows the existing skeleton pattern (`<objective>`, `<files_to_read>`, `<instructions>`, `<success_criteria>`) and uses Task tool for nested subagent dispatch. Never invoke the Skill tool from within a Task subagent (Skills don't resolve inside Task). Instead, the PRD template should invoke `/ralph-tui-prd` via the Skill tool directly since it runs as the dispatched subagent (not a nested Task).

## Standard Stack

### Core

| Component | Source | Purpose | Why Standard |
|-----------|--------|---------|--------------|
| Task tool (parallel dispatch) | Claude Code built-in | Spawn parallel research/review agents | GSD's established pattern; `run_in_background=true` for parallelism |
| Skill tool | Claude Code built-in | Invoke /ralph-tui-prd from PRD template | Official skill invocation; works in dispatched subagents (not nested Tasks) |
| AskUserQuestion | Claude Code built-in | Resolution gate user interaction | GSD questioning pattern; one-by-one with concrete options |
| compound-agents/research/* | `~/.claude/skills/compound-agents/research/` | 3 research agent prompts (repo-research-analyst, best-practices-researcher, framework-docs-researcher) | Existing tested definitions; `model: inherit` |
| compound-agents/review/* | `~/.claude/skills/compound-agents/review/` | 4 review agent prompts (security-sentinel, architecture-strategist, code-simplicity-reviewer, performance-oracle) | Existing tested definitions; `model: inherit` |
| gsd-research-synthesizer | `~/.claude/agents/gsd-research-synthesizer.md` | Synthesis of parallel research outputs | GSD agent with defined downstream consumer contract |
| ralph-tools.cjs | Project CLI | State mutations, scan-phases, config reads | Zero-dep CJS; all state goes through this |

### Supporting

| Component | Source | Purpose | When to Use |
|-----------|--------|---------|-------------|
| fillTemplate() | `lib/orchestrator.cjs` | Template variable substitution | Orchestrator fills `{{VAR}}` before Task dispatch |
| excerptFile() | `lib/orchestrator.cjs` | Extract phase output for gate display | Orchestrator shows excerpt at user gate |
| Grep tool | Claude Code built-in | TBD/TODO/PLACEHOLDER scanning in PRD | Resolution phase validation pass |
| Read/Write tools | Claude Code built-in | File I/O within subagents | All template subagents read context and write output |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Skill tool for /ralph-tui-prd | Inline PRD generation prompt | Breaks "chain, don't reimplement" principle; duplicates 300+ line skill |
| Task for nested agents | Sequential inline execution | Loses parallelism; bloats template subagent context |
| AskUserQuestion one-by-one | Batch all questions | User decisions are higher quality one-at-a-time; partial progress survives interruption |

## Architecture Patterns

### Template Skeleton (Established in Phase 2)

Every template follows the same structure. Phase 3 replaces stub `<instructions>` with real content:

```
<objective>
Execute {{PHASE_NAME}} phase ({{PHASE_ID}} of 9) for the current pipeline project.
</objective>

<files_to_read>
- {{STATE_PATH}}
- {{CONFIG_PATH}}
{{PHASE_FILES}}
</files_to_read>

<instructions>
[Phase-specific content -- THIS IS WHAT PHASE 3 BUILDS]
</instructions>

<success_criteria>
- Output file exists at .planning/pipeline/{{PHASE_SLUG}}.md
- Output file has `completed: true` in frontmatter
</success_criteria>
```

Template variables filled by orchestrator at dispatch time:
- `{{CWD}}` -- working directory
- `{{PHASE_NAME}}` -- e.g. "Research"
- `{{PHASE_SLUG}}` -- e.g. "research"
- `{{PHASE_ID}}` -- e.g. "3"
- `{{STATE_PATH}}` -- `.planning/STATE.md`
- `{{CONFIG_PATH}}` -- `.planning/config.json`
- `{{PHASE_FILES}}` -- phase-specific file references

### Pattern 1: Parallel Agent Dispatch (Research + Deepen)

**What:** Spawn N agents in parallel via Task with `run_in_background=true`, wait for all to complete, then process results.

**When to use:** Research phase (4 agents) and Deepen phase (4 agents).

**Structure from GSD new-project.md:**
```
# Step 1: Spawn parallel agents
Task(prompt="[agent-specific prompt]", subagent_type="general-purpose",
     model="sonnet", description="[dimension] research", run_in_background=true)
Task(prompt="[agent-specific prompt]", subagent_type="general-purpose",
     model="sonnet", description="[dimension] research", run_in_background=true)
...

# Step 2: Wait for all to complete (implicit -- Task results come back)

# Step 3: Spawn synthesizer
Task(prompt="Synthesize outputs...", subagent_type="gsd-research-synthesizer",
     model="sonnet", description="Synthesize research")
```

**Key detail:** GSD uses `subagent_type="general-purpose"` for researchers (not a specific type), and `subagent_type="gsd-research-synthesizer"` for synthesizer. The agent prompt is embedded directly in the Task prompt with a `"First, read [agent-definition].md for your role and instructions."` prefix.

### Pattern 2: Skill Chaining (PRD Phase)

**What:** Template subagent invokes an external skill via the Skill tool, then validates and post-processes the output.

**When to use:** PRD phase (invokes /ralph-tui-prd).

**Critical constraint from GSD plan-phase.md line 460:** "Do NOT use the Skill tool or /gsd: commands" applies to nested Task subagents. But the PRD template IS the dispatched subagent (not nested), so Skill tool IS available.

**Flow:**
```
1. Read research context (SUMMARY.md or all research files based on depth config)
2. Invoke Skill tool: /ralph-tui-prd with research context as input
3. Validate output: [PRD]...[/PRD] markers present, >= 3 user stories
4. Validate tracer bullet: US-001 covers all PRD-declared layers
5. Extract open questions to .planning/pipeline/open-questions.md
6. Write PRD to .planning/pipeline/prd.md with completed: true
```

### Pattern 3: Gate with Loop (Deepen + Resolution)

**What:** Present findings/questions to user, branch on response, potentially loop.

**When to use:** Deepen gate (refine/re-run/proceed) and Resolution gate (resolve each item, re-scan).

**Deepen gate flow:**
```
1. Spawn 4 review agents in parallel
2. Collect findings, format per-agent sections
3. Present gate: refine / re-run / proceed
4. If refine: spawn revision agent with findings + PRD
   -> produce revised PRD -> present to user -> loop to step 1 or proceed
5. If re-run: loop to step 1 with updated PRD
6. If proceed: advance to next phase
```

**Resolution gate flow:**
```
1. Scan PRD for [TBD]/[TODO]/[PLACEHOLDER] patterns
2. Scan .planning/pipeline/open-questions.md for unchecked items
3. For each unresolved item:
   a. Generate 2-3 concrete options from PRD context
   b. Present via AskUserQuestion
   c. Write answer inline to PRD immediately
   d. Mark item [x] in open-questions file
4. Final re-scan: if any markers remain, loop to step 1
5. Write completion file
```

### Anti-Patterns to Avoid

- **Fat template:** Template instructions should NOT contain the full agent prompt for each of the 4 research/review agents. Instead, reference agent definition files via paths and let Task subagents read them. This keeps the template under 50% context budget.
- **Skill tool in nested Task:** Skills don't resolve inside Task subagents. The PRD template subagent CAN use Skill tool (it's the direct dispatch). But if it needs to spawn a Task that then uses Skill, that will fail.
- **Sequential where parallel works:** Research agents and review agents must run in parallel (Task with `run_in_background=true`). Sequential dispatch wastes 4x time.
- **Hardcoded layer validation:** Tracer bullet must validate against PRD-declared scope, not a hardcoded list of layers. A CLI-only project declaring only "backend" and "tests" should pass if US-001 covers both.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Research agent prompts | Custom prompts from scratch | compound-agents/research/*.md agent definitions | Battle-tested, consistent output format, maintained externally |
| Review agent prompts | Custom security/arch/perf prompts | compound-agents/review/*.md agent definitions | Same agents used by compound-review skill; consistent finding format |
| Research synthesis | Custom merge logic in template | gsd-research-synthesizer agent via Task | Has defined downstream consumer contract; produces SUMMARY.md with roadmap implications |
| PRD generation | Inline PRD prompting | /ralph-tui-prd via Skill tool | 300+ line skill with clarifying questions, quality gates, [PRD] markers; chain, don't reimplement |
| TBD/placeholder scanning | Custom regex in template | Grep tool with pattern `\[TBD\]\|\[TODO\]\|\[PLACEHOLDER\]\|TBD:` | Built-in tool, reliable, no custom code needed |
| AskUserQuestion formatting | Custom question presentation | GSD questioning.md patterns | Established UX patterns, 2-4 options ideal, headers under 12 chars |

**Key insight:** Phase 3 is primarily integration work, not greenfield implementation. Every major component (research agents, review agents, PRD skill, synthesizer) already exists. The templates wire these components together with correct file paths, validation gates, and error handling.

## Common Pitfalls

### Pitfall 1: Skill Tool Not Available in Nested Tasks
**What goes wrong:** Template dispatches a Task that tries to invoke /ralph-tui-prd via Skill tool. The skill doesn't resolve.
**Why it happens:** Claude Code Skill tool only resolves in the main session and direct Task subagents, not in Tasks spawned by Tasks.
**How to avoid:** The PRD template IS the direct dispatch (not nested). Use Skill tool directly in the template instructions. For research/review agents spawned as nested Tasks, use only Read/Write/Bash/Grep/Glob tools.
**Warning signs:** "Skill not found" errors from within Task subagents.

### Pitfall 2: Template Variable Explosion
**What goes wrong:** Adding too many `{{VAR}}` placeholders to templates, causing `fillTemplate()` to throw "Unresolved template variables" errors.
**Why it happens:** fillTemplate() throws if ANY `{{UPPERCASE}}` pattern remains unresolved. Adding a new variable to a template without updating the orchestrator dispatch logic causes all 9 templates to fail.
**How to avoid:** Keep template variables minimal. Use the existing 6 variables (`CWD`, `PHASE_NAME`, `PHASE_SLUG`, `PHASE_ID`, `STATE_PATH`, `CONFIG_PATH`, `PHASE_FILES`). For phase-specific file paths, compute them inside the template instructions using the known `{{CWD}}` and `{{PHASE_SLUG}}` values, or embed them directly.
**Warning signs:** Template dispatch failures after adding new templates.

### Pitfall 3: PRD Validation False Positives
**What goes wrong:** PRD validation passes but the PRD is actually malformed. Downstream conversion produces broken beads.
**Why it happens:** Validation only checks for `[PRD]...[/PRD]` markers and story count >= 3, missing structural issues like empty acceptance criteria, duplicate story IDs, or stories without descriptions.
**How to avoid:** Beyond marker and count checks, validate: (1) each US-NNN has both Description and Acceptance Criteria sections, (2) US-001 references layers declared in the PRD's Technical Considerations or Overview, (3) no duplicate US-NNN IDs. Keep validation surgical -- don't over-engineer, but catch the failures that corrupt downstream.
**Warning signs:** Conversion phase produces beads with empty acceptance criteria.

### Pitfall 4: Resolution Gate Accepts Vague Answers
**What goes wrong:** User answers "TBD" or "not sure" to a resolution question. The answer is written inline but it's still effectively unresolved. Execution beads hit the vague placeholder.
**Why it happens:** The gate checks for checkbox completion, not answer quality. Any response satisfies the gate.
**How to avoid:** After writing the answer inline, the final re-scan catches patterns like `[TBD]`, `TBD:`, `[TODO]`. Additionally, if the user's answer contains "TBD", "not sure", "maybe", or "decide later", flag it: "This answer still contains a placeholder pattern. Resolve it now or explicitly mark as DECISION_PENDING: with a fallback strategy."
**Warning signs:** `open_questions_resolved: true` but PRD still contains `[TBD]` patterns.

### Pitfall 5: Parallel Agent Output Conflicts
**What goes wrong:** Two parallel research agents write to the same file, or one overwrites the other's output.
**Why it happens:** File path collision when agents aren't given distinct output paths.
**How to avoid:** Each research agent writes to a distinct file: `repo-research.md`, `best-practices.md`, `framework-docs.md`, `learnings.md`. Each review agent writes to a distinct file or section. The synthesizer reads all files and writes SUMMARY.md. No shared write targets.
**Warning signs:** Missing agent output after parallel execution.

### Pitfall 6: Deepen Auto-Revise Infinite Loop
**What goes wrong:** Refine produces revised PRD, re-run finds new issues, refine again, re-run again, indefinitely.
**Why it happens:** No iteration cap on the refine/re-run cycle.
**How to avoid:** Cap at 2-3 refine iterations. After max iterations, present remaining findings and force proceed/abort decision.
**Warning signs:** Deepen phase runs for 30+ minutes without completing.

## Code Examples

### Research Template Instructions (Core Structure)

```markdown
<instructions>
## Research Phase

### Step 1: Read Context
Read STATE.md and config.json from files_to_read above.
Read .planning/pipeline/clarify.md for project scope and stack decisions.

### Step 2: Check for Learnings
Check if docs/solutions/ directory exists in the project:
ls docs/solutions/ 2>/dev/null
If it exists, include learnings-researcher agent.
If not, note "no learnings found" and skip that agent.

### Step 3: Spawn Parallel Research Agents
Spawn 3-4 agents in parallel using Task with run_in_background=true.

Each agent reads the compound-agents definition file for its role,
plus project context:

Task 1 - Repo Research:
Read ~/.claude/skills/compound-agents/research/repo-research-analyst.md
Analyze the project repository structure, conventions, and patterns.
Write output to: .planning/research/repo-research.md

Task 2 - Best Practices:
Read ~/.claude/skills/compound-agents/research/best-practices-researcher.md
Research best practices for the project's domain and stack.
Write output to: .planning/research/best-practices.md

Task 3 - Framework Docs:
Read ~/.claude/skills/compound-agents/research/framework-docs-researcher.md
Gather documentation for the project's frameworks and libraries.
Write output to: .planning/research/framework-docs.md

Task 4 - Learnings (conditional):
If docs/solutions/ exists, read project learnings and patterns.
Write output to: .planning/research/learnings.md
If skipped, note in SUMMARY.md.

### Step 4: Synthesize
After all agents complete, spawn synthesizer:
Read ~/.claude/agents/gsd-research-synthesizer.md for instructions.
Read all research output files.
Write .planning/research/SUMMARY.md.

### Step 5: Write Completion
Write .planning/pipeline/research.md with frontmatter: completed: true
Include a brief excerpt of SUMMARY.md key findings.

Return: ## PHASE COMPLETE
</instructions>
```

### PRD Validation Logic (Post-Skill Invocation)

```markdown
After /ralph-tui-prd completes, validate the output:

1. Check [PRD]...[/PRD] markers:
   - Search output for [PRD] and [/PRD] markers
   - If missing: FAIL with "PRD markers not found. Skill may have failed."

2. Count user stories:
   - Search for ### US-NNN pattern within [PRD] block
   - If fewer than 3: FAIL with "Only {N} user stories found. Minimum is 3."

3. Validate tracer bullet US-001:
   - Extract layers declared in PRD (from Technical Considerations or Overview)
   - Parse US-001 acceptance criteria for layer references
   - If US-001 doesn't reference all declared layers: FAIL with
     "US-001 must be a vertical slice covering: {layers}. Found: {covered}."

4. Extract open questions:
   - Find "## Open Questions" section in PRD
   - Write each question to .planning/pipeline/open-questions.md as unchecked
   - Format: "- [ ] {question text} (source: PRD)"
```

### Resolution Gate Scan Pattern

```markdown
## Scan for Unresolved Items

### PRD Body Scan
Use Grep tool to find patterns in .planning/pipeline/prd.md:
- Pattern: \[TBD\]|\[TODO\]|\[PLACEHOLDER\]|TBD:|TODO:

### Open Questions Scan
Read .planning/pipeline/open-questions.md
Find all lines matching: - [ ] (unchecked items)

### Combined Unresolved List
Merge both sources into ordered list.
For each item:
1. Read surrounding PRD context (5 lines before/after the marker)
2. Generate 2-3 concrete answer options based on context
3. Present via AskUserQuestion:
   - header: short label (max 12 chars)
   - question: the unresolved item with context
   - options: generated answers + "Let me explain" option
4. Write answer inline to PRD (replace [TBD] with answer text)
5. Mark corresponding open-questions item as [x]

### Final Validation
After all items resolved, re-scan PRD for remaining markers.
If any found: loop back to scan step.
If clean: write completion file.
```

### Deepen Gate Presentation Format

```markdown
## Review Findings

### Security (security-sentinel)
{findings from security agent, or "No issues found"}

### Architecture (architecture-strategist)
{findings from architecture agent, or "No issues found"}

### Simplicity (code-simplicity-reviewer)
{findings from simplicity agent, or "No issues found"}

### Performance (performance-oracle)
{findings from performance agent, or "No issues found"}

---

**Total findings:** {count}
**Critical (P1):** {count} -- blocks proceed
**Important (P2):** {count}
**Minor (P3):** {count}

Choose:
1. Refine -- auto-revise PRD based on findings (recommended if P1 > 0)
2. Re-run -- re-run all reviewers against current PRD
3. Proceed -- accept findings and advance to resolution
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-session pipeline | /clear between phases with disk state | 2025-2026 (GSD + ralph-pipeline) | Prevents context rot; enables overnight runs |
| Inline PRD generation | Chain to /ralph-tui-prd skill | Project inception | 300+ lines of PRD logic maintained separately |
| Manual question resolution | Automated AskUserQuestion gate | Phase 3 design | Ensures no TBD leaks to execution |
| Horizontal PRD layers | Tracer bullet vertical slices | Project requirement | US-001 proves integration across all layers early |

**Deprecated/outdated:**
- Inlining /ralph-tui-prd logic into the template -- out of scope per REQUIREMENTS.md
- Batching resolution questions -- user decisions are better one-at-a-time per CONTEXT.md

## Open Questions

1. **Learnings-researcher agent definition**
   - What we know: CONTEXT.md says "use GSD's existing compound-engineering subagent types" including learnings-researcher, but no `learnings-researcher.md` exists in `compound-agents/research/`
   - What's unclear: Whether to create a new agent definition or use a lightweight inline prompt
   - Recommendation: Create a minimal inline prompt within the research template that reads `docs/solutions/` files and summarizes learnings. No need for a full agent definition file since it's conditional and project-specific.

2. **PHASE_FILES variable content for each template**
   - What we know: `{{PHASE_FILES}}` is filled by the orchestrator and appears in files_to_read. Currently empty for stubs.
   - What's unclear: What phase-specific files each template needs in files_to_read
   - Recommendation: Research needs clarify output (`- .planning/pipeline/clarify.md`). PRD needs research SUMMARY (`- .planning/research/SUMMARY.md`). Deepen needs PRD (`- .planning/pipeline/prd.md`). Resolve needs PRD + open-questions (`- .planning/pipeline/prd.md\n- .planning/pipeline/open-questions.md`). These should be set in the orchestrator dispatch logic when PHASE_FILES is computed, or hardcoded in the template body since the paths are known.

3. **Depth config affecting research context passed to PRD**
   - What we know: CONTEXT.md says "SUMMARY.md only (default) or all individual research files (for comprehensive/6hr runs)"
   - What's unclear: The exact depth values and how to read them in template context
   - Recommendation: Read `config.json` depth field. If "comprehensive", include all `.planning/research/*.md` files in PRD skill context. If "standard" or "quick", include only SUMMARY.md. The template can read config via `node ralph-tools.cjs config-get depth`.

4. **Refine agent identity in Deepen phase**
   - What we know: CONTEXT.md says "spawn an agent that reads findings + PRD, produces revised PRD"
   - What's unclear: Whether this revision agent needs a specific definition or can be a general-purpose Task
   - Recommendation: Use a general-purpose Task with an inline prompt: "Read the review findings and the current PRD. Produce a revised PRD that addresses all P1 and P2 findings while preserving the PRD structure and [PRD]...[/PRD] markers. Write the revised PRD to the same path." No dedicated agent definition needed.

## Sources

### Primary (HIGH confidence)
- `.reference/get-shit-done/workflows/new-project.md` -- 4-agent parallel research dispatch pattern (lines 540-728)
- `.reference/get-shit-done/workflows/new-milestone.md` -- Subsequent milestone research with synthesizer (lines 110-185)
- `.reference/get-shit-done/workflows/plan-phase.md` -- Task dispatch with subagent_type, Skill tool constraints (line 460)
- `~/.claude/skills/compound-agents/research/` -- 3 research agent definitions (repo-research-analyst, best-practices-researcher, framework-docs-researcher)
- `~/.claude/skills/compound-agents/review/` -- 4 review agent definitions (security-sentinel, architecture-strategist, code-simplicity-reviewer, performance-oracle)
- `~/.claude/agents/gsd-research-synthesizer.md` -- Synthesizer agent with downstream consumer contract
- `~/.claude/skills/ralph-tui-prd/SKILL.md` -- PRD skill: [PRD] markers, US-NNN format, Open Questions section, Quality Gates
- `~/.claude/skills/compound-review/SKILL.md` -- Compound review: parallel agents, P1/P2/P3 categorization, findings format
- `.reference/get-shit-done/references/questioning.md` -- AskUserQuestion patterns: 2-4 options, headers under 12 chars
- `.reference/get-shit-done/references/model-profiles.md` -- Agent model mapping: synthesizer=sonnet, researcher=sonnet (balanced)
- `lib/orchestrator.cjs` -- fillTemplate(), PIPELINE_PHASES, scanPipelinePhases()
- `templates/*.md` -- Existing stub templates with {{VAR}} skeleton pattern

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` -- Prior project research; confirms pitfall patterns and architecture approach
- `.planning/research/PITFALLS.md` -- TBD leak pitfall documentation (lines 114-126)
- `.planning/phases/02-orchestrator-shell/02-02-SUMMARY.md` -- Phase 2 output: confirms template skeleton and dispatch pattern

### Tertiary (LOW confidence)
- Learnings-researcher behavior -- No existing agent definition found. Inline prompt recommended based on GSD pattern extrapolation. Needs validation during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All components exist and are verified against source files
- Architecture: HIGH -- Patterns directly from GSD reference with established usage
- Pitfalls: HIGH -- Derived from prior project research, CONTEXT.md decisions, and GSD anti-pattern documentation

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable -- all referenced components are version-pinned or locally controlled)
