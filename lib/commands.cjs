/**
 * Commands -- Git commit with conditional logic and utility commands
 *
 * Provides: cmdCommit()
 *
 * Modeled on GSD's commands.cjs but adapted for ralph-pipeline.
 * Checks commit_docs flag and .gitignore before staging.
 */

const path = require('path');
const { output, error, execGit, loadConfig } = require('./core.cjs');

// -- Git commit with conditional logic --------------------------------------

/**
 * Commit .planning/ files with conditional checks.
 *
 * 1. If commit_docs is false in config, skip with reason.
 * 2. If .planning is gitignored, skip with reason.
 * 3. Stage specified files (or .planning/ by default).
 * 4. Commit with message. Handle nothing-to-commit gracefully.
 * 5. On success, return short hash.
 */
function cmdCommit(cwd, message, files, raw) {
  if (!message) {
    error('Commit message required', 'MISSING_MESSAGE');
  }

  const config = loadConfig(cwd);

  // Check commit_docs config
  if (!config.commit_docs) {
    output(
      { committed: false, reason: 'skipped_commit_docs_false' },
      raw,
      'skipped'
    );
    return;
  }

  // Check if .planning is gitignored
  const ignoreResult = execGit(cwd, ['check-ignore', '-q', '.planning']);
  if (ignoreResult.exitCode === 0) {
    output(
      { committed: false, reason: 'skipped_gitignored' },
      raw,
      'skipped'
    );
    return;
  }

  // Stage files
  const filesToStage = files && files.length > 0 ? files : ['.planning/'];
  for (const file of filesToStage) {
    execGit(cwd, ['add', file]);
  }

  // Commit
  const commitResult = execGit(cwd, ['commit', '-m', message]);
  if (commitResult.exitCode !== 0) {
    const combined = commitResult.stdout + commitResult.stderr;
    if (combined.includes('nothing to commit')) {
      output(
        { committed: false, reason: 'nothing_to_commit' },
        raw,
        'nothing'
      );
      return;
    }
    output(
      { committed: false, reason: 'commit_failed', error: commitResult.stderr },
      raw,
      'failed'
    );
    return;
  }

  // Get short hash
  const hashResult = execGit(cwd, ['rev-parse', '--short', 'HEAD']);
  const hash = hashResult.exitCode === 0 ? hashResult.stdout : null;

  output(
    { committed: true, hash },
    raw,
    hash || 'committed'
  );
}

module.exports = {
  cmdCommit,
};
