/**
 * Preflight -- Pre-flight dependency checker for ralph-pipeline
 *
 * Validates the entire environment before the pipeline starts:
 * skills, MCP servers, CLIs, GSD reference repo, .gitignore,
 * .planning/ directory, and IDE preference.
 *
 * Returns structured JSON with all missing items and actionable
 * install hints so the orchestrator can offer interactive installation.
 *
 * Diagnostic only -- does NOT perform installations or copies.
 *
 * Zero npm dependencies -- Node.js builtins only.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { output, error, safeReadFile, loadConfig } = require('./core.cjs');

// -- Constants ----------------------------------------------------------------

const REQUIRED_SKILLS = [
  { name: 'ralph-tui-prd', purpose: 'PRD creation' },
  { name: 'ralph-tui-create-beads', purpose: 'Bead conversion (Go)' },
];

const REQUIRED_MCP_SERVERS = [
  { name: 'context7', purpose: 'Documentation lookups', config_key: 'context7' },
];

const OPTIONAL_CLIS = [
  { name: 'bd', purpose: 'Go bead CLI', required: false },
  { name: 'br', purpose: 'Rust bead CLI', required: false },
];

const REQUIRED_PLANNING_FILES = ['STATE.md', 'ROADMAP.md', 'PROJECT.md'];

const IDE_OPTIONS = ['vscode', 'cursor', 'zed', 'neovim', 'other'];

const CACHE_VERSION = 1;

// -- Skill check --------------------------------------------------------------

function checkSkills(cwd) {
  const missing = [];
  const homeDir = os.homedir();

  for (const skill of REQUIRED_SKILLS) {
    const homePath = path.join(homeDir, '.claude', 'skills', skill.name, 'SKILL.md');
    const cwdPath = path.join(cwd, '.claude', 'skills', skill.name, 'SKILL.md');

    const foundHome = fileExists(homePath);
    const foundCwd = fileExists(cwdPath);

    if (!foundHome && !foundCwd) {
      missing.push({
        type: 'skill',
        name: skill.name,
        purpose: skill.purpose,
        required: true,
        install_hint: `Install via: claude install-skill ${skill.name}`,
      });
    }
  }

  return missing;
}

// -- MCP server check ---------------------------------------------------------

function checkMcpServers() {
  const missing = [];
  const homeDir = os.homedir();

  // Check both possible MCP config locations
  const configPaths = [
    path.join(homeDir, '.claude.json'),
    path.join(homeDir, '.claude', 'settings.json'),
  ];

  let mcpServers = {};

  for (const configPath of configPaths) {
    const content = safeReadFile(configPath);
    if (content) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
          mcpServers = { ...mcpServers, ...parsed.mcpServers };
        }
      } catch {
        // Invalid JSON, skip
      }
    }
  }

  for (const server of REQUIRED_MCP_SERVERS) {
    if (!mcpServers[server.config_key]) {
      missing.push({
        type: 'mcp_server',
        name: server.name,
        purpose: server.purpose,
        required: true,
        install_hint: `Add to ~/.claude.json mcpServers config or run: claude mcp add ${server.name}`,
      });
    }
  }

  return missing;
}

// -- CLI check ----------------------------------------------------------------

function checkCLIs() {
  const missing = [];
  const whichCmd = process.platform === 'win32' ? 'where' : 'which';

  for (const cli of OPTIONAL_CLIS) {
    try {
      execSync(`${whichCmd} ${cli.name}`, { stdio: 'pipe', encoding: 'utf-8' });
    } catch {
      const installHints = {
        bd: 'Install bd via: go install github.com/anthropics/claude-code/bd@latest',
        br: 'Install br via: cargo install br-bead',
      };
      missing.push({
        type: 'cli',
        name: cli.name,
        purpose: cli.purpose,
        required: false,
        install_hint: installHints[cli.name] || `Install ${cli.name} from its official source`,
      });
    }
  }

  return missing;
}

// -- GSD reference check ------------------------------------------------------

function checkGsdReference(cwd) {
  const homeDir = os.homedir();
  const referencePath = path.join(cwd, '.reference', 'get-shit-done');
  const homeGsdPath = path.join(homeDir, '.claude', 'get-shit-done');

  if (fileExists(referencePath)) {
    const version = readVersion(referencePath);
    return {
      available: true,
      source: 'project',
      path: '.reference/get-shit-done/',
      version,
    };
  }

  // Reference not in project -- check if local copy exists for setup
  if (fileExists(homeGsdPath)) {
    const version = readVersion(homeGsdPath);
    return {
      available: false,
      source: 'local',
      local_path: homeGsdPath,
      version,
      setup_needed: true,
    };
  }

  return {
    available: false,
    source: 'none',
    install_hint: 'Install GSD plugin: claude install get-shit-done',
    setup_needed: true,
  };
}

// -- .gitignore check ---------------------------------------------------------

function checkGitignore(cwd) {
  const gitignorePath = path.join(cwd, '.gitignore');
  const content = safeReadFile(gitignorePath);

  if (!content) {
    return { action: 'add_gitignore', pattern: '.reference/' };
  }

  const lines = content.split('\n').map(l => l.trim());
  const hasPattern = lines.some(l => l === '.reference/' || l === '.reference');

  if (!hasPattern) {
    return { action: 'add_gitignore', pattern: '.reference/' };
  }

  return null;
}

// -- .planning/ directory check -----------------------------------------------

function checkPlanningDir(cwd) {
  const planningDir = path.join(cwd, '.planning');

  if (!fileExists(planningDir)) {
    return { action: 'init_planning', missing_files: REQUIRED_PLANNING_FILES };
  }

  const missingFiles = REQUIRED_PLANNING_FILES.filter(
    f => !fileExists(path.join(planningDir, f))
  );

  if (missingFiles.length > 0) {
    return { action: 'init_planning', missing_files: missingFiles };
  }

  return null;
}

// -- IDE preference check -----------------------------------------------------

function checkIdePreference(config) {
  if (!config.ide) {
    return { action: 'ask_ide', options: IDE_OPTIONS };
  }
  return null;
}

// -- Utilities ----------------------------------------------------------------

function fileExists(filePath) {
  try {
    fs.statSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function readVersion(dirPath) {
  // Try VERSION file first
  const versionFile = safeReadFile(path.join(dirPath, 'VERSION'));
  if (versionFile) {
    return versionFile.trim();
  }

  // Try package.json
  const pkgContent = safeReadFile(path.join(dirPath, 'package.json'));
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent);
      return pkg.version || null;
    } catch {
      return null;
    }
  }

  return null;
}

// -- Cache write --------------------------------------------------------------

function writePreflightCache(cwd, result) {
  const cachePath = path.join(cwd, '.planning', '.preflight-cache.json');
  const cache = {
    version: CACHE_VERSION,
    timestamp: Date.now(),
    passed: result.passed,
    missing: result.missing,
    setup_actions: result.setup_actions,
    reference: result.reference,
    config: result.config,
  };
  try {
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // Non-fatal: cache write failure doesn't block preflight
  }
}

// -- Main command -------------------------------------------------------------

function cmdPreflight(cwd, raw, force) {
  if (force) {
    const cachePath = path.join(cwd, '.planning', '.preflight-cache.json');
    try { fs.unlinkSync(cachePath); } catch { /* no-op */ }
  }
  const missing = [];
  const actions = [];

  // 1. Required skills
  const missingSkills = checkSkills(cwd);
  missing.push(...missingSkills);

  // 2. Required MCP servers
  const missingMcp = checkMcpServers();
  missing.push(...missingMcp);

  // 3. Optional CLIs
  const missingClis = checkCLIs();
  missing.push(...missingClis);

  // 4. GSD reference
  const referenceInfo = checkGsdReference(cwd);
  if (referenceInfo.source === 'none') {
    missing.push({
      type: 'reference',
      name: 'get-shit-done',
      purpose: 'GSD workflow reference',
      required: true,
      install_hint: referenceInfo.install_hint,
    });
  }

  // 5. .gitignore check
  const gitignoreAction = checkGitignore(cwd);
  if (gitignoreAction) {
    actions.push(gitignoreAction);
  }

  // 6. .planning/ directory
  const planningAction = checkPlanningDir(cwd);
  if (planningAction) {
    actions.push(planningAction);
  }

  // 7. IDE preference
  const config = loadConfig(cwd);
  const ideAction = checkIdePreference(config);
  if (ideAction) {
    actions.push(ideAction);
  }

  // Determine if passed: all required items present and reference available
  const requiredMissing = missing.filter(m => m.required !== false);
  const referenceOk = referenceInfo.available || referenceInfo.source === 'local';
  const passed = requiredMissing.length === 0 && referenceOk;

  const result = {
    passed,
    missing,
    setup_actions: actions,
    reference: referenceInfo,
    config: { ide: config.ide },
  };

  if (!passed && requiredMissing.length > 0) {
    // Write summary to stderr for non-zero exit
    const summary = requiredMissing
      .map(m => `  - [${m.type}] ${m.name}: ${m.install_hint}`)
      .join('\n');
    process.stderr.write(
      JSON.stringify({
        error: true,
        message: `Pre-flight failed: ${requiredMissing.length} required dependency(s) missing:\n${summary}`,
        code: 'PREFLIGHT_FAILED',
      }) + '\n'
    );
    // Still output the full result to stdout before exiting
    if (raw) {
      process.stdout.write(JSON.stringify(result));
    } else {
      process.stdout.write(JSON.stringify(result, null, 2));
    }
    process.exit(1);
  }

  if (passed) {
    writePreflightCache(cwd, result);
  }

  output(result, raw);
}

module.exports = {
  cmdPreflight,
  CACHE_VERSION,
};
