<objective>
Execute {{PHASE_NAME}} phase ({{PHASE_ID}} of 9) for the current pipeline project.
</objective>

<files_to_read>
- {{STATE_PATH}}
- {{CONFIG_PATH}}
{{PHASE_FILES}}
</files_to_read>

<instructions>
<!-- TODO: Phase-specific instructions added in build phase 5 -->
Invoke /ralph-tui-create-beads or /ralph-tui-create-beads-rust.

This is a stub template. When dispatched, immediately write a completion output file.

1. Read the files listed above
2. Write output to .planning/pipeline/{{PHASE_SLUG}}.md with frontmatter: completed: true
3. Return: ## PHASE COMPLETE
</instructions>

<success_criteria>
- Output file exists at .planning/pipeline/{{PHASE_SLUG}}.md
- Output file has `completed: true` in frontmatter
</success_criteria>
