# Ralph Pipeline Dependencies

Full dependency table for the pre-flight check phase.

## Required Skills

| Skill | Check Path | Install Command |
|-------|-----------|-----------------|
| ralph-tui-prd | `~/.claude/skills/ralph-tui-prd/SKILL.md` | `bunx add-skill subsy/ralph-tui --all` |
| ralph-tui-create-beads | `~/.claude/skills/ralph-tui-create-beads/SKILL.md` | (installed with above) |
| ralph-tui-create-beads-rust | `~/.claude/skills/ralph-tui-create-beads-rust/SKILL.md` | (installed with above) |
| ralph-tui-create-json | `~/.claude/skills/ralph-tui-create-json/SKILL.md` | (installed with above) |
| compound-agents | `~/.claude/skills/compound-agents/` | (from compound-engineering plugin) |
| last30days | `~/.claude/skills/last30days/SKILL.md` | `git clone https://github.com/mvanhorn/last30days-skill ~/.claude/skills/last30days` |

**Batch check:**
```bash
ls ~/.claude/skills/ralph-tui-prd/SKILL.md 2>/dev/null
ls ~/.claude/skills/ralph-tui-create-beads/SKILL.md 2>/dev/null
ls ~/.claude/skills/ralph-tui-create-beads-rust/SKILL.md 2>/dev/null
ls ~/.claude/skills/ralph-tui-create-json/SKILL.md 2>/dev/null
ls ~/.claude/skills/compound-agents/ 2>/dev/null
ls ~/.claude/skills/last30days/SKILL.md 2>/dev/null
```

**Auto-install logic:**
- If any `ralph-tui-*` skill missing → `bunx add-skill subsy/ralph-tui --all`
- If `last30days` missing → `git clone https://github.com/mvanhorn/last30days-skill ~/.claude/skills/last30days`
- If `compound-agents` missing → warn: requires compound-engineering plugin

## Required Plugins

| Plugin | What It Provides | Check Path |
|--------|-----------------|-----------|
| everything-claude-code | `/update-codemaps`, doc-updater agent | `~/.claude/plugins/marketplaces/everything-claude-code/` |
| choo-choo-ralph | `/harvest` command | check skill list for `choo-choo-ralph:harvest` |
| compound-engineering | review/research Task subagent_types | check skill list for `compound-engineering:*` |

Plugins require manual install. If missing, display:
```
Missing plugin: [name]
Install via Claude Code plugin marketplace or manually.
```

## Required CLIs (Optional)

| CLI | Check | Install | Required For |
|-----|-------|---------|-------------|
| ralph-tui | `which ralph-tui` | `bun install -g ralph-tui` | Phase 6 execution |
| bd (beads Go) | `which bd` | See github.com/subsy/beads | Phase 5 beads conversion |
| br (beads Rust) | `which br` | `cargo install beads-rust` | Phase 5 beads conversion |

CLIs are optional. Without bd/br, use prd.json path in Phase 5.
Without ralph-tui, user runs execution manually.

If both bd and br missing:
```
AskUserQuestion: "No beads CLI found. Install one, or use prd.json?"
  A. Install bd (Go) - `bun install -g beads`
  B. Install br (Rust) - `cargo install beads-rust`
  C. Use prd.json instead (no CLI needed) (Recommended)
```

## Upstream Sources (NOT modified)

| Source | What We Use |
|--------|-------------|
| `subsy/ralph-tui` (npm + skills) | `/ralph-tui-prd`, `/ralph-tui-create-beads`, `/ralph-tui-create-beads-rust`, `/ralph-tui-create-json` |
| `EveryInc/compound-engineering-plugin` | compound-agents, Task subagent_types, deepen-plan pattern |
| `affaan-m/everything-claude-code` | `/update-codemaps`, doc-updater agent |
| `choo-choo-ralph` plugin | `/harvest` command |
| `mvanhorn/last30days-skill` | `/last30days` for community research |
