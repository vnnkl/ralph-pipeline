#!/usr/bin/env node

/**
 * Ralph Tools -- CLI utility for ralph-pipeline workflow operations
 *
 * Zero npm dependencies. Routes commands to lib/ modules via switch/case.
 * Modeled on gsd-tools.cjs architecture.
 *
 * Usage: node ralph-tools.cjs <command> [args] [--raw] [--cwd <path>]
 *
 * Commands:
 *   config-get [key]              Get config value (dot-notation) or full dump
 *   config-set <key> <value>      Set config value with type coercion
 *   state <sub> [args]            State management: get, set, json
 *   init [pipeline|phase <N>]     Compound init commands (all context in one call)
 *   commit <message> [files...]   Git commit with conditional logic
 *   phase-complete <phase>        Mark phase as complete (advances state)
 *   preflight                     Pre-flight dependency checks
 *   setup-reference               Copy GSD reference to .reference/ with version pinning
 *   setup-gitignore <pattern>     Add pattern to .gitignore
 *   help                          List available commands
 */

const fs = require('fs');
const path = require('path');
const { output, error, safeReadFile } = require('./lib/core.cjs');
const config = require('./lib/config.cjs');
const state = require('./lib/state.cjs');
const phase = require('./lib/phase.cjs');
const commands = require('./lib/commands.cjs');
const preflight = require('./lib/preflight.cjs');
const init = require('./lib/init.cjs');
const orchestrator = require('./lib/orchestrator.cjs');
const timeBudget = require('./lib/time-budget.cjs');

// -- CLI Argument Parsing -----------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2);

  // Extract --cwd flag
  let cwd = process.cwd();
  const cwdEqArg = args.find(arg => arg.startsWith('--cwd='));
  const cwdIdx = args.indexOf('--cwd');

  if (cwdEqArg) {
    const value = cwdEqArg.slice('--cwd='.length).trim();
    if (!value) error('Missing value for --cwd', 'INVALID_ARGS');
    args.splice(args.indexOf(cwdEqArg), 1);
    cwd = path.resolve(value);
  } else if (cwdIdx !== -1) {
    const value = args[cwdIdx + 1];
    if (!value || value.startsWith('--')) error('Missing value for --cwd', 'INVALID_ARGS');
    args.splice(cwdIdx, 2);
    cwd = path.resolve(value);
  }

  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
    error('Invalid --cwd: ' + cwd, 'INVALID_CWD');
  }

  // Extract --raw flag
  const rawIndex = args.indexOf('--raw');
  const raw = rawIndex !== -1;
  if (rawIndex !== -1) args.splice(rawIndex, 1);

  return { args, cwd, raw };
}

// -- Help output --------------------------------------------------------------

function showHelp(raw) {
  const commands = {
    'config-get': 'Get config value by dot-notation key, or dump full config',
    'config-set': 'Set config value with type coercion (bool, number, null)',
    'state': 'State management: get <field>, set <field> <value>, json',
    'commit': 'Git commit with conditional logic (respects commit_docs, gitignore)',
    'phase-complete': 'Mark phase as complete (updates ROADMAP.md + STATE.md)',
    'preflight': 'Pre-flight dependency checks (skills, MCP, CLIs, GSD reference)',
    'setup-reference': 'Copy GSD reference to .reference/ with version pinning',
    'setup-gitignore': 'Add pattern to .gitignore (e.g., .reference/)',
    'init': 'Compound init commands: init pipeline, init phase <N>',
    'scan-phases': 'Scan pipeline phases: completion status of all 9 phases',
    'excerpt': 'Extract first N non-frontmatter lines from a file',
    'time-budget': 'Time budget management: start <hours>, check, record-bead <ms>, estimate',
    'help': 'Show this help message',
  };
  output({ commands }, raw);
}

// -- Setup Reference ----------------------------------------------------------

const EXPECTED_GSD_VERSION = 'v2.1.0';

function setupReference(cwd, raw) {
  const os = require('os');
  const homeGsdPath = path.join(os.homedir(), '.claude', 'get-shit-done');
  const targetDir = path.join(cwd, '.reference');
  const targetPath = path.join(targetDir, 'get-shit-done');

  // Check source exists
  try {
    fs.statSync(homeGsdPath);
  } catch {
    error('GSD not found at ' + homeGsdPath + '. Install GSD plugin first.', 'GSD_NOT_FOUND');
  }

  // Create .reference/ directory
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
  } catch (err) {
    error('Failed to create .reference/ directory: ' + err.message, 'MKDIR_FAILED');
  }

  // Copy GSD reference (use fs.cpSync on Node 16.7+, fallback to cp -r)
  try {
    if (typeof fs.cpSync === 'function') {
      // Remove existing target first for clean copy
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      }
      fs.cpSync(homeGsdPath, targetPath, { recursive: true });
    } else {
      const { execSync } = require('child_process');
      if (fs.existsSync(targetPath)) {
        execSync(`rm -rf "${targetPath}"`);
      }
      execSync(`cp -r "${homeGsdPath}" "${targetPath}"`);
    }
  } catch (err) {
    error('Failed to copy GSD reference: ' + err.message, 'COPY_FAILED');
  }

  // Read actual version from copied reference
  let actualVersion = null;
  const versionContent = safeReadFile(path.join(targetPath, 'VERSION'));
  if (versionContent) {
    actualVersion = versionContent.trim();
  } else {
    const pkgContent = safeReadFile(path.join(targetPath, 'package.json'));
    if (pkgContent) {
      try {
        actualVersion = JSON.parse(pkgContent).version || null;
      } catch {
        // ignore
      }
    }
  }

  // Add .reference/ to .gitignore
  setupGitignoreInternal(cwd, '.reference/');

  output({
    setup: true,
    reference_path: '.reference/get-shit-done/',
    version: actualVersion,
    expected_version: EXPECTED_GSD_VERSION,
    version_matched: actualVersion === EXPECTED_GSD_VERSION,
  }, raw);
}

// -- Setup Gitignore ----------------------------------------------------------

function setupGitignoreInternal(cwd, pattern) {
  const gitignorePath = path.join(cwd, '.gitignore');
  const content = safeReadFile(gitignorePath) || '';
  const lines = content.split('\n').map(l => l.trim());
  const patternTrimmed = pattern.trim();

  if (lines.some(l => l === patternTrimmed || l === patternTrimmed.replace(/\/$/, ''))) {
    return false;
  }

  const newContent = content.endsWith('\n') || content === ''
    ? content + patternTrimmed + '\n'
    : content + '\n' + patternTrimmed + '\n';

  try {
    fs.writeFileSync(gitignorePath, newContent, 'utf-8');
    return true;
  } catch (err) {
    error('Failed to update .gitignore: ' + err.message, 'GITIGNORE_WRITE_FAILED');
  }
}

function setupGitignore(cwd, pattern, raw) {
  const added = setupGitignoreInternal(cwd, pattern);
  output({ added: added !== false, pattern }, raw);
}

// -- Main Router --------------------------------------------------------------

function main() {
  const { args, cwd, raw } = parseArgs(process.argv);
  const command = args[0];

  if (!command) {
    error(
      'Usage: ralph-tools <command> [args] [--raw] [--cwd <path>]\n' +
      'Commands: config-get, config-set, state, init, commit, phase-complete, preflight, help',
      'NO_COMMAND'
    );
  }

  switch (command) {
    case 'config-get': {
      config.cmdConfigGet(cwd, args[1], raw);
      break;
    }

    case 'config-set': {
      config.cmdConfigSet(cwd, args[1], args[2]);
      break;
    }

    case 'help': {
      showHelp(raw);
      break;
    }

    case 'state': {
      state.cmdState(cwd, args[1], args.slice(2), raw);
      break;
    }

    case 'commit': {
      commands.cmdCommit(cwd, args[1], args.slice(2), raw);
      break;
    }

    case 'phase-complete': {
      phase.cmdPhaseComplete(cwd, args[1], raw);
      break;
    }

    case 'init': {
      const subCmd = args[1];
      if (!subCmd || subCmd === 'pipeline') {
        init.cmdInitPipeline(cwd, raw);
      } else if (subCmd === 'phase') {
        init.cmdInitPhase(cwd, args[2], raw);
      } else {
        error('Unknown init subcommand: ' + subCmd + '. Available: pipeline, phase <N>', 'UNKNOWN_SUBCOMMAND');
      }
      break;
    }

    case 'preflight': {
      preflight.cmdPreflight(cwd, raw);
      break;
    }

    case 'scan-phases': {
      orchestrator.cmdScanPhases(cwd, raw);
      break;
    }

    case 'excerpt': {
      orchestrator.cmdExcerpt(cwd, args[1], args[2] ? parseInt(args[2], 10) : undefined, raw);
      break;
    }

    case 'setup-reference': {
      setupReference(cwd, raw);
      break;
    }

    case 'setup-gitignore': {
      const pattern = args[1];
      if (!pattern) error('Usage: setup-gitignore <pattern>', 'INVALID_ARGS');
      setupGitignore(cwd, pattern, raw);
      break;
    }

    case 'time-budget': {
      const sub = args[1];
      if (!sub) error('Usage: time-budget <start|check|record-bead|estimate> [args]', 'INVALID_ARGS');
      switch (sub) {
        case 'start':
          timeBudget.cmdTimeBudgetStart(cwd, args[2]);
          break;
        case 'check':
          timeBudget.cmdTimeBudgetCheck(cwd);
          break;
        case 'record-bead':
          timeBudget.cmdTimeBudgetRecordBead(cwd, args[2]);
          break;
        case 'estimate':
          timeBudget.cmdTimeBudgetEstimate(cwd);
          break;
        default:
          error('Unknown time-budget subcommand: ' + sub, 'UNKNOWN_SUBCOMMAND');
      }
      break;
    }

    default: {
      error('Unknown command: ' + command, 'UNKNOWN_COMMAND');
    }
  }
}

main();
