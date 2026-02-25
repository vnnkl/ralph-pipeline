# Coding Conventions

**Analysis Date:** 2026-02-25

## Naming Patterns

**Files:**
- Markdown-based organization: `SKILL.md` (skill definition), `README.md` (user docs), `references/dependencies.md` (reference tables)
- State files: `.claude/pipeline/state.md`, `.claude/pipeline/phase-[N]-[name].md`, `.claude/pipeline/open-questions.md`
- Kebab-case for multi-word filenames: `phase-0-orient.md`, `phase-1-clarify.md`, `phase-4.5-resolve.md`
- Directory structure uses kebab-case: `.claude/pipeline/`, `.ralph-tui/`, `.planning/codebase/`

**Functions/Commands:**
- All user-facing invocations follow kebab-case: `/ralph-pipeline`, `/update-codemaps`, `/ralph-tui-prd`, `/frontend-design`, `/harvest`
- Skill names use kebab-case with descriptive suffixes: `ralph-tui-prd`, `ralph-tui-create-beads`, `compound-agents`, `choo-choo-ralph`
- Phase logic named descriptively: "Phase 0: Orient", "Phase 2: Research", "Phase 4.5: Resolve"

**Variables:**
- YAML frontmatter fields use snake_case: `current_phase`, `completed`, `open_questions_resolved`, `convert_format`, `research_agents`, `review_agents`, `quality_gates`
- State variables are descriptive and context-specific: `feature`, `project_type`, `tech_stack`, `has_frontend`, `last30days_ran`, `started`

**Types/Concepts:**
- Phases identified by number and name: 0 (Orient), 1 (Clarify), 2 (Research), 3 (Create PRD), 4 (Deepen), 4.5 (Resolve), 5 (Convert), 6 (Execute), 7 (Review), 8 (Harvest)
- Gate concepts: AskUserQuestion (interactive user choice), Task subagent (parallel work)
- Story identifiers: US-001, US-002, etc. (user stories)

## Code Style

**Formatting:**
- Markdown-first structure with YAML frontmatter blocks for state/metadata
- 80-character line width target (observed in code examples)
- Consistent indentation: 2 spaces for YAML, 4 spaces for code blocks
- Clear section hierarchy using markdown H2/H3 headings (## Phase, ### Pre-flight)

**Linting:**
- No formal linting configuration detected (pure markdown skill)
- Consistency achieved through explicit documentation of patterns in SKILL.md (lines 96-162 document orchestration pattern)

**Code Blocks:**
- Shell commands wrapped in triple backticks with `bash` language tag
- YAML configuration shown with `toml` tag for TOML files, `yaml` for YAML
- JSON examples use `json` tag
- TypeScript/JavaScript conceptual examples use appropriate language tags but are explanatory, not executable

## Import Organization

**Order:**
- Not applicable — this skill does not import libraries or modules in the traditional sense
- Instead, it **invokes** other skills and plugins in a documented sequence
- Dependency chain documented in `references/dependencies.md` and pre-flight section

**Path Aliases:**
- File paths use absolute references with backticks: `` `~/.claude/skills/ralph-tui-prd/SKILL.md` ``, `` `.claude/pipeline/state.md` ``
- Environment variable paths: `$BEAD_DIR`, `$PFILE`, `$QFILE` in bash examples
- Relative paths within project: `.claude/pipeline/`, `docs/CODEMAPS/`, `.ralph-tui/`

## Error Handling

**Patterns:**
- Graceful degradation: missing dependencies warn but allow fallback execution (see Pre-flight, lines 199-320)
- Conditional checks: `if [ -f .claude/pipeline/state.md ]` before reading state
- Validation blocks: Phase 3 PRD validation checklist (lines 480-491) and Phase 5 conversion validation (lines 583-585)
- Question resolution gates: Phase 4.5 blocks conversion until all open questions answered (lines 539-557)

**Examples from SKILL.md:**
- Missing ralph-tui skills → auto-install or display instructions (lines 211-214)
- Missing plugins → warn with manual install guidance (lines 39-43)
- Missing CLIs → offer JSON fallback for Phase 5 (lines 204-209, 569-571)
- Incomplete phase → detected via `completed: false` in phase file, re-run subagent (lines 153)
- Failed execution → Phase 6 gate allows fixes or re-planning (lines 700-714)

## Logging

**Framework:** Implicit through structured output files and gate summaries

**Patterns:**
- Each phase writes structured output file with YAML frontmatter and completion status
- Phase subagents return 1-3 sentence summaries (Phase 0 line 341, Phase 2 line 419, Phase 3 line 448)
- Review phases report counts: P1/P2/P3 (Phase 7 line 735), insight counts, question counts (Phase 4 line 517)
- Execution summaries: story count, file paths, format chosen (Phase 5 line 586)
- No console.log or debug output — all results persist to disk state files

## Comments

**When to Comment:**
- Every phase has a brief header explaining its goal ("Goal: [purpose]" pattern at Phase 0 line 326)
- Complex protocols (subagent dispatch, resumability) documented inline in SKILL.md
- Decision rationale documented in README.md Design Decisions section (lines 160-176)
- CRITICAL instructions for phases marked with `**CRITICAL:**` (e.g., Phase 3 lines 443, 471)

**Documentation:**
- YAML frontmatter documents state schema (SKILL.md lines 61-78)
- Phase protocol fully specified (lines 139-153)
- Subagent dispatch pattern documented (lines 109-124)

## Function Design

**Size:** Phases are self-contained and documented at 1-3 page length each

**Parameters:**
- Subagent dispatch passes:
  - Prompt with phase instructions
  - List of input files to read (e.g., Phase 2 line 404-407)
  - Expected output file name (e.g., `phase-2-research.md`)
- Gates accept user choice (AskUserQuestion with options A/B/C/D)
- State management via YAML frontmatter fields

**Return Values:**
- Phase subagents return summary text (1-3 sentences)
- Phase output files contain full results + `completed: true`
- Gates return choice identifier (A/B/C) to determine next phase
- File paths returned from Phase 5 (convert) for downstream use

## Module Design

**Exports:** Not applicable — skill is invoked via `/ralph-pipeline` trigger

**Barrel Files:** Not applicable — pure markdown

**Organization:**
- Single entry point: `/ralph-pipeline` (SKILL.md line 3)
- Dependencies exported implicitly: all skills/plugins/CLIs listed in `references/dependencies.md`
- Phase documentation exported as structured sections in SKILL.md
- State schema exported via `.claude/pipeline/` directory pattern

## Special Patterns

**Phase Protocol (Subagent Version):**
```
1. Read input files
2. Write phase output file with completed: false
3. Do the work; append questions to open-questions.md if needed
4. Update output file with results + completed: true
5. Return 1-2 sentence summary
```
Lines 139-153 in SKILL.md

**State File Format:**
```yaml
---
feature: "user authentication system"
current_phase: 2
started: 2026-02-08
project_type: existing
tech_stack: "Node/TypeScript"
quality_gates: "bun test && bun run typecheck"
research_agents: [repo-research-analyst, best-practices-researcher]
review_agents: [security-sentinel, architecture-strategist]
convert_format: null
has_frontend: true
last30days_ran: false
open_questions_resolved: false
---
```
Lines 62-78 in SKILL.md

**Open Questions Pattern:**
```markdown
# Open Questions

- [ ] Which email provider? (SendGrid, Postmark, SES) — from: phase-2-research
- [ ] Deployment target? (Vercel, Fly, Railway) — from: phase-3-prd
- [x] S3 provider for file storage? — from: phase-3-prd (answer: AWS S3)
```
Lines 157-167 in SKILL.md

**Tracer Bullet Ordering Pattern:**
Every story must:
1. Be a vertical slice (DB → backend → frontend) in the smallest increment
2. Leave the system in a working, demoable state
3. Be verified end-to-end before the next story starts
4. Include `/frontend-design` as FIRST instruction if UI involved
5. Include end-to-end verification in acceptance criteria
Lines 457-475 in SKILL.md

**Subagent Dispatch Pattern:**
Main agent does:
1. Read .claude/pipeline/state.md
2. Spawn Task subagent with phase instructions + file list
3. Subagent reads files, does work, writes output with completed: false → true
4. Main agent verifies completed: true
5. Update state.md → increment current_phase
6. Run gate (AskUserQuestion)
Lines 109-151 in SKILL.md

**Frontend Design First Instruction:**
Any story with UI work MUST have this as the FIRST instruction (not buried in AC):
```
**First:** Run `/frontend-design` for this story's UI portion.
```
Lines 471-475 in SKILL.md

**Browser Testing Pattern:**
Stories needing browser testing should reference:
```
Use agent-browser (https://github.com/vercel-labs/agent-browser) for browser-based testing.
```
Line 478 in SKILL.md

---

*Convention analysis: 2026-02-25*
