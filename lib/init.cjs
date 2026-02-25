/**
 * Init -- Compound init commands for ralph-pipeline workflow bootstrapping
 *
 * Provides: cmdInitPipeline(), cmdInitPhase()
 *
 * Each init command loads ALL context needed by a specific workflow entry
 * point in one call, eliminating multi-command sequences at session start.
 *
 * Modeled on GSD's ~/.claude/get-shit-done/bin/lib/init.cjs but adapted
 * for ralph-pipeline's simpler phase structure and config schema.
 *
 * Zero npm dependencies -- Node.js builtins only.
 */

const fs = require('fs');
const path = require('path');
const { output, error, safeReadFile, pathExistsInternal, loadConfig } = require('./core.cjs');
const { stateExtractField } = require('./state.cjs');
const { findPhaseInternal } = require('./phase.cjs');

// -- Helpers ------------------------------------------------------------------

/**
 * Count phase directories in .planning/phases/.
 * Returns the number of phase directories found.
 */
function countPhaseDirs(cwd) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).length;
  } catch {
    return 0;
  }
}

/**
 * Check if preflight cache exists and is less than 1 hour old.
 * Returns the cached `passed` value if valid, or null if stale/missing.
 */
function checkPreflightCache(cwd) {
  const cachePath = path.join(cwd, '.planning', '.preflight-cache.json');
  try {
    const content = fs.readFileSync(cachePath, 'utf-8');
    const cache = JSON.parse(content);
    if (typeof cache.timestamp !== 'number' || typeof cache.passed !== 'boolean') {
      return null;
    }
    const oneHourMs = 60 * 60 * 1000;
    const age = Date.now() - cache.timestamp;
    if (age < oneHourMs) {
      return cache.passed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Capitalize a phase name string (e.g., "foundation" -> "Foundation").
 * Accepts either raw name ("foundation") or full dir name ("01-foundation").
 */
function formatPhaseName(name) {
  if (!name) return null;
  // If it starts with digits (full dir name), strip the prefix
  const match = name.match(/^\d+-?(.*)/);
  const raw = (match && match[1]) ? match[1] : name;
  const spaced = raw.replace(/-/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// -- cmdInitPipeline ----------------------------------------------------------

/**
 * Main init for when the skill is first invoked.
 * Returns everything the orchestrator needs to decide what to do next:
 * config, state, phase info, file existence checks, preflight cache.
 */
function cmdInitPipeline(cwd, raw) {
  const config = loadConfig(cwd);

  // Read STATE.md
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const stateContent = safeReadFile(statePath);

  // Extract state fields
  const currentPhaseRaw = stateContent ? stateExtractField(stateContent, 'Phase') : null;
  const status = stateContent ? stateExtractField(stateContent, 'Status') : null;

  // Parse phase number from "N of M (Name)" pattern
  let currentPhase = null;
  if (currentPhaseRaw) {
    const phaseMatch = currentPhaseRaw.match(/^(\d+)/);
    if (phaseMatch) {
      currentPhase = parseInt(phaseMatch[1], 10);
    }
  }

  // Look up phase directory and name
  let phaseDir = null;
  let phaseName = null;
  if (currentPhase !== null) {
    const phaseInfo = findPhaseInternal(cwd, currentPhase);
    if (phaseInfo) {
      phaseDir = phaseInfo.directory;
      phaseName = phaseInfo.name ? formatPhaseName(phaseInfo.name) : null;
    }
  }

  const result = {
    // Config
    mode: config.mode,
    depth: config.depth,
    commit_docs: config.commit_docs,
    auto_advance: config.auto_advance,
    time_budget: config.time_budget,
    ide: config.ide,

    // State
    current_phase: currentPhase,
    phase_name: phaseName,
    status,

    // Phase info
    phase_dir: phaseDir,
    phase_count: countPhaseDirs(cwd),

    // File existence checks
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    config_exists: pathExistsInternal(cwd, '.planning/config.json'),
    reference_exists: pathExistsInternal(cwd, '.reference/get-shit-done'),

    // Preflight cache (avoid re-running if recent)
    preflight_passed: checkPreflightCache(cwd),
  };

  output(result, raw);
}

// -- cmdInitPhase -------------------------------------------------------------

/**
 * Init for a specific phase context (used by phase subagents).
 * Returns pipeline init + phase-specific context including file existence.
 */
function cmdInitPhase(cwd, phaseIdentifier, raw) {
  if (!phaseIdentifier) {
    error('Phase identifier required for init phase', 'MISSING_PHASE');
  }

  const config = loadConfig(cwd);

  // Read STATE.md
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const stateContent = safeReadFile(statePath);

  // Extract state fields
  const currentPhaseRaw = stateContent ? stateExtractField(stateContent, 'Phase') : null;
  const status = stateContent ? stateExtractField(stateContent, 'Status') : null;

  let currentPhase = null;
  if (currentPhaseRaw) {
    const phaseMatch = currentPhaseRaw.match(/^(\d+)/);
    if (phaseMatch) {
      currentPhase = parseInt(phaseMatch[1], 10);
    }
  }

  // Look up requested phase
  const phaseInfo = findPhaseInternal(cwd, phaseIdentifier);
  const phaseNumber = phaseInfo ? parseInt(phaseInfo.number, 10) : parseInt(phaseIdentifier, 10);

  // Pipeline-level fields
  let pipelinePhaseName = null;
  if (currentPhase !== null) {
    const pipelinePhaseInfo = findPhaseInternal(cwd, currentPhase);
    if (pipelinePhaseInfo) {
      pipelinePhaseName = pipelinePhaseInfo.name ? formatPhaseName(pipelinePhaseInfo.name) : null;
    }
  }

  // Phase-specific file counts
  let hasContext = false;
  let hasResearch = false;
  let planCount = 0;
  let summaryCount = 0;
  let planFiles = [];
  let summaryFiles = [];

  if (phaseInfo && phaseInfo.path) {
    try {
      const files = fs.readdirSync(phaseInfo.path);
      const padded = String(phaseIdentifier).padStart(2, '0');

      hasContext = files.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
      hasResearch = files.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');

      planFiles = files
        .filter(f => f.endsWith('-PLAN.md'))
        .sort();
      summaryFiles = files
        .filter(f => f.endsWith('-SUMMARY.md'))
        .sort();

      planCount = planFiles.length;
      summaryCount = summaryFiles.length;
    } catch {
      // Phase directory read failed
    }
  }

  const result = {
    // Config (pipeline-level)
    mode: config.mode,
    depth: config.depth,
    commit_docs: config.commit_docs,
    auto_advance: config.auto_advance,
    time_budget: config.time_budget,
    ide: config.ide,

    // State (pipeline-level)
    current_phase: currentPhase,
    phase_name: pipelinePhaseName,
    status,

    // Pipeline-level info
    phase_count: countPhaseDirs(cwd),

    // File existence checks (pipeline-level)
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    config_exists: pathExistsInternal(cwd, '.planning/config.json'),
    reference_exists: pathExistsInternal(cwd, '.reference/get-shit-done'),

    // Preflight cache
    preflight_passed: checkPreflightCache(cwd),

    // Phase-specific
    phase_number: phaseNumber,
    phase_dir: phaseInfo ? phaseInfo.directory : null,
    has_context: hasContext,
    has_research: hasResearch,
    has_plans: planCount,
    has_summaries: summaryCount,
    plan_files: planFiles,
    summary_files: summaryFiles,
  };

  output(result, raw);
}

module.exports = {
  cmdInitPipeline,
  cmdInitPhase,
};
