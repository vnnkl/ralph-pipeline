#!/usr/bin/env node
// .claude/hooks/ralph-auto-advance.js
// SessionStart hook for auto-advance re-invocation after /clear.
// Reads config.json to check auto_advance, staleness, and time budget.
// Outputs additionalContext to instruct Claude to invoke /ralph-pipeline.
//
// CRITICAL: This hook must be fast (<5ms), synchronous (no async), and
// silently exit 0 on any error to avoid breaking session startup.

const fs = require('fs');
const path = require('path');

const STALENESS_LIMIT_MS = 12 * 60 * 60 * 1000; // 12 hours

try {
  let input = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const hookInput = JSON.parse(input);
      const cwd = hookInput.cwd;
      const source = hookInput.source;

      // Only fire on startup or clear -- not resume or compact
      if (source !== 'startup' && source !== 'clear') {
        process.exit(0);
      }

      const configPath = path.join(cwd, '.planning', 'config.json');

      let rawConfig;
      try {
        rawConfig = fs.readFileSync(configPath, 'utf-8');
      } catch (_readErr) {
        // No config file -- silently exit
        process.exit(0);
      }

      const config = JSON.parse(rawConfig);

      // If auto_advance is not true, nothing to do
      if (config.auto_advance !== true) {
        process.exit(0);
      }

      const now = Date.now();

      // Staleness guard: if auto_advance_started_at is older than 12 hours, clear it
      if (config.auto_advance_started_at) {
        const startedAt = typeof config.auto_advance_started_at === 'number'
          ? config.auto_advance_started_at
          : Number(config.auto_advance_started_at);

        if (!isNaN(startedAt) && (now - startedAt) > STALENESS_LIMIT_MS) {
          const updatedConfig = { ...config, auto_advance: false };
          fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8');

          const result = {
            hookSpecificOutput: {
              hookEventName: 'SessionStart',
              additionalContext: 'Auto-advance expired (>12h). Cleared.'
            }
          };
          process.stdout.write(JSON.stringify(result));
          process.exit(0);
        }
      }

      // Time budget check: if budget expired, clear auto_advance
      if (config.time_budget_expires) {
        const expires = typeof config.time_budget_expires === 'number'
          ? config.time_budget_expires
          : Number(config.time_budget_expires);

        if (!isNaN(expires) && now >= expires) {
          const updatedConfig = { ...config, auto_advance: false };
          fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8');

          const result = {
            hookSpecificOutput: {
              hookEventName: 'SessionStart',
              additionalContext: 'Time budget expired. Auto-advance disabled. Pipeline paused at current phase.'
            }
          };
          process.stdout.write(JSON.stringify(result));
          process.exit(0);
        }
      }

      // Auto-advance is active and not expired -- inject auto-invoke instruction
      const result = {
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: 'AUTO-ADVANCE ACTIVE: Invoke /ralph-pipeline to continue the pipeline. Do not ask the user -- proceed immediately.'
        }
      };
      process.stdout.write(JSON.stringify(result));
      process.exit(0);

    } catch (_parseErr) {
      // Any error during processing -- silently exit
      process.exit(0);
    }
  });
} catch (_outerErr) {
  // Any outer error -- silently exit
  process.exit(0);
}
