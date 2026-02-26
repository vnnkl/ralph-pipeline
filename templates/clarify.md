<objective>
Execute {{PHASE_NAME}} phase ({{PHASE_ID}} of 9) for the current pipeline project.
</objective>

<files_to_read>
- {{STATE_PATH}}
- {{CONFIG_PATH}}
{{PHASE_FILES}}
</files_to_read>

<instructions>
<!-- YOLO mode: gate bypass handled by orchestrator (SKILL.md Step 6) -->
<!-- TODO: Phase-specific instructions added in build phase 3 -->
Gather project scope, stack choices, quality gates.

This is a stub template. When dispatched, immediately write a completion output file.

1. Read the files listed above
2. Write output to .planning/pipeline/{{PHASE_SLUG}}.md with frontmatter: completed: true
3. Return: ## PHASE COMPLETE
</instructions>

<success_criteria>
- Output file exists at .planning/pipeline/{{PHASE_SLUG}}.md
- Output file has `completed: true` in frontmatter
</success_criteria>
