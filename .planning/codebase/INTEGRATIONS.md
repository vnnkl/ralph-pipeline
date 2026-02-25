# External Integrations

**Analysis Date:** 2026-02-25

## APIs & External Services

**Claude Code Platform:**
- Claude Code Skills - Dynamically invoked during pipeline execution
- Claude Code CLI (`claude -p`) - Used for headless bead execution in Phase 6 with fresh context windows
- MCP Servers - Extended functionality via Model Context Protocol
  - n8n-mcp: Configured in `.claude/settings.local.json` (optional, `enableAllProjectMcpServers: true`)

**Community Research:**
- last30days API - Optional skill at Phase 1b for Reddit/X/web research
  - Skill: `github.com/mvanhorn/last30days-skill`
  - Invocation: `/last30days [topic]`
  - Data: Community discussions on unfamiliar topics before research phase

**Browser Testing:**
- agent-browser - Headless browser automation for E2E and visual verification
  - Repository: `github.com/vercel-labs/agent-browser`
  - Purpose: Browser-based testing, visual verification, E2E checks
  - Integration: Referenced as preferred tool in Phase 3 PRD stories and Phase 6 execution

## External Skills & Plugins

**Ralph TUI Skill Suite** (`github.com/subsy/ralph-tui`):
- Installation: `bunx add-skill subsy/ralph-tui --all`
- Functions:
  - `/ralph-tui-prd` - PRD generation with tracer bullet structure (Phase 3)
  - `/ralph-tui-create-beads` - Go beads CLI conversion (Phase 5)
  - `/ralph-tui-create-beads-rust` - Rust beads CLI conversion (Phase 5)
  - `/ralph-tui-create-json` - JSON format conversion (Phase 5)

**Everything Claude Code Plugin** (`github.com/affaan-m/everything-claude-code`):
- Provides: `/update-codemaps` command, doc-updater agent
- Used in: Phase 0 (Orient) for codemap generation, Phase 8 (Harvest) for final refresh
- Purpose: Codebase documentation generation for agent context

**Compound Engineering Plugin** (`github.com/EveryInc/compound-engineering-plugin`):
- Provides: Research agent tasks, review agent tasks, Task subagent_types
- Agents supplied:
  - Research: repo-research-analyst, best-practices-researcher, framework-docs-researcher, learnings-researcher
  - Review: security-sentinel, architecture-strategist, code-simplicity-reviewer, performance-oracle
- Used in: Phase 2 (Research), Phase 4 (Deepen), Phase 7 (Review)

**Choo-Choo-Ralph Plugin** (`github.com/subsy/choo-choo-ralph`):
- Provides: `/choo-choo-ralph:harvest` command
- Used in: Phase 8 (Harvest) to extract learnings from completed work

## Data Storage

**Local Filesystem:**
- Pipeline state: `.claude/pipeline/` directory
  - `state.md` - Current phase, feature name, user decisions
  - `open-questions.md` - Unresolved questions from research/planning
  - `phase-0-orient.md` through `phase-8-harvest.md` - Phase outputs with completion markers
  - `bead-results/` - Results from headless bead execution
- Project configuration: `.ralph-tui/config.toml` - Default config on first run
- Task tracking: Beads format (`.beads/` directory) or `prd.json` from Phase 5

**No external databases:** All state persists to disk for compaction resilience. No cloud storage or remote state backends configured.

## Authentication & Identity

**Auth Provider:**
- Claude Code platform authentication - Required to run skill commands
- Git authentication - Required for `git init`, version control operations
- GitHub authentication - Required only when cloning skill dependencies (last30days)

Implementation: Environment-based (Claude Code credentials, git config, GitHub SSH/token).

## Monitoring & Observability

**Error Tracking:**
- None configured - Errors logged to console during execution

**Logs:**
- Phase output files in `.claude/pipeline/` serve as execution logs
- YAML frontmatter `completed: true/false` flags indicate phase success/failure
- Bead result summaries written to `.claude/pipeline/bead-results/` in Phase 6

## CI/CD & Deployment

**Hosting:**
- No persistent hosting - Skill runs locally in Claude Code environment
- Supports deployment context: Projects built through Ralph Pipeline can target any environment (Vercel, Fly, Railway, custom, etc.)

**CI Pipeline:**
- Quality gates defined by user in Phase 1 (e.g., `bun test && bun run typecheck`)
- Gates run before each bead/story commit
- Beads/JSON format ensures compatibility with ralph-tui and external CI systems

## Environment Configuration

**Required env vars:**
- None specified in skill itself
- Quality gates may require environment variables (project-specific)
- No API keys, tokens, or secrets hardcoded in skill

**Secrets location:**
- Excluded from tracking: `.env`, `.env.local`, `.env.*.local` (in `.gitignore`)
- Skill does not handle secret management — projects using Ralph Pipeline handle secrets independently

## Webhooks & Callbacks

**Incoming:**
- None - Skill operates synchronously during execution

**Outgoing:**
- Git commits - Phase 6 execution creates conventional commits with bead/story references
- Optional GitHub actions - if project has CI configured, commits trigger builds

## Context7 MCP

**Framework Docs Lookup:**
- Referenced in Phase 2 (Research) for framework documentation discovery
- Used by framework-docs-researcher agent during parallel research
- Provides documentation context for API/framework research

## Git Integration

**Version Control:**
- `git init` - Auto-initialized if project not in repo (pre-flight)
- `git diff main...HEAD` - Retrieved in Phase 7 for code review against full changeset
- Conventional commits - Phase 6 generates commits with format `[type]: [description]` referencing bead/story IDs
- `.gitignore` - Auto-created with pipeline-aware exclusions

## No Direct External Service Dependencies

**Notably absent:**
- No cloud APIs for deployment (handled by executing projects)
- No analytics or telemetry
- No artifact storage (AWS S3, GCS, etc.)
- No email services
- No payment processing
- No third-party authentication (OAuth, SAML)
- No external task management (Jira, Linear, etc.)

Ralph Pipeline is a standalone orchestration skill that chains existing Claude Code infrastructure and optional plugins.

---

*Integration audit: 2026-02-25*
