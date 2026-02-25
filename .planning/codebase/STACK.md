# Technology Stack

**Analysis Date:** 2026-02-25

## Languages

**Primary:**
- Markdown - Documentation, YAML frontmatter for state management
- YAML - Configuration in `.ralph-tui/config.toml` and pipeline state files

**Secondary:**
- Bash - Shell scripts for CLI invocation, dependency checking, git operations

## Runtime

**Environment:**
- Claude Code - AI-powered skill execution environment
- Node.js/Bun - Referenced in quality gates and CLI tool installation (`bun install`, `bunx`)

**Package Manager:**
- Bun - Package manager for installing global CLIs and skills
  - Lockfile: Not present in skill (external dependencies managed via `bunx`)

## Frameworks

**Core:**
- Ralph Pipeline - Custom orchestration framework for multi-phase feature development
- Claude Code Skills API - Invokes skill commands like `/ralph-tui-prd`, `/frontend-design`, `/harvest`
- MCP (Model Context Protocol) - Supports MCP servers for extended functionality (n8n-mcp configured)

**Skill Dependencies:**
- ralph-tui (skill suite) - Core PRD and beads conversion tools
  - `/ralph-tui-prd` - Generates PRD with tracer bullet structure
  - `/ralph-tui-create-beads` - Converts PRD to beads format (Go)
  - `/ralph-tui-create-beads-rust` - Converts PRD to beads format (Rust)
  - `/ralph-tui-create-json` - Converts PRD to prd.json format
- everything-claude-code (plugin) - Codemap generation and doc updates
- compound-engineering (plugin) - Review and research agent tasks
- choo-choo-ralph (plugin) - Learning harvest from completed work
- last30days (optional skill) - Community research via Reddit/X/web

**Build/Dev:**
- ralph-tui CLI - Task execution and workflow management
- bd CLI (Go) - Beads tracker for Phase 5 conversion
- br CLI (Rust) - Alternative beads tracker
- agent-browser - Headless browser automation for E2E testing
- Context7 MCP - Framework documentation lookup during research

## Key Dependencies

**Critical:**
- ralph-tui skills (`subsy/ralph-tui`) - PRD generation and task conversion. Without these, no conversion to executable format possible.
- compound-engineering plugin - Provides review agents and research agent infrastructure. Required for Phases 2, 4, 7.
- everything-claude-code plugin - Codemap generation in Phase 0 and final refresh. Required for code understanding.
- choo-choo-ralph plugin - Learning capture in Phase 8. Required for knowledge extraction.

**Infrastructure:**
- Git - Version control, diff generation for review phases, automatic initialization
- Claude Code CLI - Main invocation (`claude -p`), required for headless bead execution in Phase 6
- AskUserQuestion - Interactive gate mechanism between phases (part of Claude Code platform)
- Task subagents - Context isolation for phases 0, 2, 3, 4, 5, 7, 8

## Configuration

**Environment:**
- `.claude/settings.local.json` - Per-project Claude Code settings including MCP server configuration
- `.ralph-tui/config.toml` - Ralph TUI tracker configuration (default created with `configVersion = "2.1"`, `tracker = "beads"`)
- `.claude/pipeline/` - Pipeline state directory (auto-created on first run)
  - `state.md` - Current phase, user decisions, agent selections
  - `open-questions.md` - Unresolved decisions blocking conversion
  - Phase files - Output from each orchestration phase

**Build:**
- `.gitignore` - Pipeline-aware (excludes `.claude/pipeline/`, `.ralph-tui/iterations/`, `.env` files)
- Git initialization - Auto-run on first invocation if not in git repo

## Platform Requirements

**Development:**
- Claude Code runtime environment (Haiku 4.5 or higher for efficiency)
- Git repository or git-init capability
- Bun package manager (for CLI installation)
- Bash shell (for dependency checks and headless execution loops)

**Production:**
- Deployment context: Software projects built through Claude Code
- Supported architectures: Node/TypeScript, Python, Go, Rust, etc. (language-agnostic PRD/bead generation)
- Target environments: Any that can execute `claude -p` sessions for headless phase 6 execution

## Dependencies at a Glance

| Type | Component | Status | Purpose |
|------|-----------|--------|---------|
| Skill | ralph-tui suite | Required | PRD creation, beads/JSON conversion |
| Plugin | everything-claude-code | Required | Codemaps, doc updates |
| Plugin | compound-engineering | Required | Research and review agents |
| Plugin | choo-choo-ralph | Required | Learning harvest |
| Skill | last30days | Optional | Community research |
| CLI | ralph-tui | Optional | Interactive phase 6 execution |
| CLI | bd | Optional | Go beads conversion |
| CLI | br | Optional | Rust beads conversion |
| CLI | agent-browser | Optional | Browser E2E testing |
| MCP | n8n-mcp | Optional | Extended context (enableAllProjectMcpServers: true) |

---

*Stack analysis: 2026-02-25*
