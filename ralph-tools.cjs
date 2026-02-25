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
 *   help                          List available commands
 *
 * Planned (not yet implemented):
 *   state                         State management operations
 *   init                          Compound init commands
 *   commit                        Git commit with conditional logic
 *   phase-complete                Mark phase as complete
 *   preflight                     Pre-flight dependency checks
 */

const fs = require('fs');
const path = require('path');
const { output, error } = require('./lib/core.cjs');
const config = require('./lib/config.cjs');

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
    'state': '(planned) State management operations',
    'init': '(planned) Compound init commands',
    'commit': '(planned) Git commit with conditional logic',
    'phase-complete': '(planned) Mark phase as complete',
    'preflight': '(planned) Pre-flight dependency checks',
    'help': 'Show this help message',
  };
  output({ commands }, raw);
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

    // -- Planned commands (not yet implemented) --------------------------------

    case 'state': {
      error('Command "state" not yet implemented', 'NOT_IMPLEMENTED');
      break;
    }

    case 'init': {
      error('Command "init" not yet implemented', 'NOT_IMPLEMENTED');
      break;
    }

    case 'commit': {
      error('Command "commit" not yet implemented', 'NOT_IMPLEMENTED');
      break;
    }

    case 'phase-complete': {
      error('Command "phase-complete" not yet implemented', 'NOT_IMPLEMENTED');
      break;
    }

    case 'preflight': {
      error('Command "preflight" not yet implemented', 'NOT_IMPLEMENTED');
      break;
    }

    default: {
      error('Unknown command: ' + command, 'UNKNOWN_COMMAND');
    }
  }
}

main();
