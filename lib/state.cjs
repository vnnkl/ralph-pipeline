/**
 * State -- STATE.md CRUD operations and frontmatter sync
 *
 * Provides: stateExtractField(), stateReplaceField(), buildStateFrontmatter(),
 *           syncStateFrontmatter(), writeStateMd(), cmdState()
 *
 * Modeled on GSD's state.cjs but adapted for ralph-pipeline's STATE.md format.
 * Handles both bold (`**Field:**`) and plain (`Field:`) field patterns.
 */

const fs = require('fs');
const path = require('path');
const { output, error, safeReadFile } = require('./core.cjs');
const { extractFrontmatter, reconstructFrontmatter } = require('./frontmatter.cjs');

// -- Field regex helpers ----------------------------------------------------

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a regex fragment matching a field name in bold or plain format.
 * Matches both `**FieldName:**` and `FieldName:`.
 */
function fieldFragment(fieldName) {
  return `(?:\\*\\*)?${escapeRegex(fieldName)}:(?:\\*\\*)?`;
}

/**
 * Regex to extract the value after a field name.
 */
function fieldPattern(fieldName) {
  return new RegExp(`${fieldFragment(fieldName)}\\s*(.+)`, 'i');
}

/**
 * Regex to capture the prefix (field + colon + space) for replacement.
 */
function fieldReplacePattern(fieldName) {
  return new RegExp(`(${fieldFragment(fieldName)}\\s*)(.*)`, 'i');
}

// -- Core field operations --------------------------------------------------

/**
 * Extract a field value from STATE.md content.
 * Supports both bold and plain field formats.
 * Strips YAML frontmatter before matching to avoid hitting frontmatter keys.
 * Returns the trimmed value or null if field not found.
 */
function stateExtractField(content, fieldName) {
  // Strip YAML frontmatter to avoid matching frontmatter keys
  const fmMatch = content.match(/^---\n[\s\S]*?\n---\n/);
  const body = fmMatch ? content.slice(fmMatch[0].length) : content;
  const pattern = fieldPattern(fieldName);
  const match = body.match(pattern);
  if (match) return match[1].trim();
  // Fallback: field may be in frontmatter only (e.g. minimal STATE.md)
  if (fmMatch) {
    const fmMatchResult = fmMatch[0].match(pattern);
    if (fmMatchResult) return fmMatchResult[1].trim();
  }
  return null;
}

/**
 * Replace a field value in STATE.md content immutably.
 * Strips YAML frontmatter before matching to avoid replacing frontmatter keys.
 * Returns new content string with the field replaced, or null if field not found.
 * IMMUTABLE -- does not mutate the input string.
 */
function stateReplaceField(content, fieldName, newValue) {
  // Strip YAML frontmatter to avoid replacing frontmatter keys
  const fmMatch = content.match(/^---\n[\s\S]*?\n---\n/);
  const fmPrefix = fmMatch ? fmMatch[0] : '';
  const body = fmMatch ? content.slice(fmMatch[0].length) : content;
  const pattern = fieldReplacePattern(fieldName);
  if (!pattern.test(body)) {
    // Fallback: field may be in frontmatter only (e.g. minimal STATE.md)
    if (fmPrefix && pattern.test(fmPrefix)) {
      const updatedFm = fmPrefix.replace(pattern, (_match, prefix) => `${prefix}${newValue}`);
      return updatedFm + body;
    }
    return null;
  }
  const updatedBody = body.replace(pattern, (_match, prefix) => `${prefix}${newValue}`);
  return fmPrefix + updatedBody;
}

// -- Frontmatter sync -------------------------------------------------------

/**
 * Extract machine-readable fields from STATE.md body and build
 * a frontmatter object for YAML serialization.
 */
function buildStateFrontmatter(bodyContent, cwd) {
  const extract = (name) => stateExtractField(bodyContent, name);

  const phaseRaw = extract('Phase');
  const status = extract('Status');
  const lastActivity = extract('Last activity');
  const planRaw = extract('Plan');
  const progressRaw = extract('Progress');

  // Parse phase number from "N of M (Name)" pattern
  let currentPhase = null;
  let totalPhases = null;
  if (phaseRaw) {
    const phaseMatch = phaseRaw.match(/^(\d+)\s*of\s*(\d+)/);
    if (phaseMatch) {
      currentPhase = parseInt(phaseMatch[1], 10);
      totalPhases = parseInt(phaseMatch[2], 10);
    }
  }

  // Parse plan number from "N of M in current phase" pattern
  let currentPlan = null;
  if (planRaw) {
    const planMatch = planRaw.match(/^(\d+)/);
    if (planMatch) {
      currentPlan = parseInt(planMatch[1], 10);
    }
  }

  // Parse progress percentage
  let progressPercent = null;
  if (progressRaw) {
    const pctMatch = progressRaw.match(/(\d+)%/);
    if (pctMatch) {
      progressPercent = parseInt(pctMatch[1], 10);
    }
  }

  // Normalize status
  let normalizedStatus = status || 'unknown';
  const statusLower = (status || '').toLowerCase();
  if (statusLower.includes('executing') || statusLower.includes('in progress')) {
    normalizedStatus = 'executing';
  } else if (statusLower.includes('planning') || statusLower.includes('ready to plan')) {
    normalizedStatus = 'planning';
  } else if (statusLower.includes('complete') || statusLower.includes('done')) {
    normalizedStatus = 'completed';
  } else if (statusLower.includes('ready to execute')) {
    normalizedStatus = 'executing';
  } else if (statusLower.includes('verif')) {
    normalizedStatus = 'verifying';
  } else if (statusLower.includes('paused') || statusLower.includes('stopped')) {
    normalizedStatus = 'paused';
  }

  // Count disk state if cwd available
  let completedPlans = null;
  let totalPlansOnDisk = null;
  if (cwd) {
    try {
      const phasesDir = path.join(cwd, '.planning', 'phases');
      if (fs.existsSync(phasesDir)) {
        const phaseDirs = fs.readdirSync(phasesDir, { withFileTypes: true })
          .filter(e => e.isDirectory()).map(e => e.name);
        let diskPlans = 0;
        let diskSummaries = 0;
        for (const dir of phaseDirs) {
          const files = fs.readdirSync(path.join(phasesDir, dir));
          diskPlans += files.filter(f => f.match(/-PLAN\.md$/i)).length;
          diskSummaries += files.filter(f => f.match(/-SUMMARY\.md$/i)).length;
        }
        totalPlansOnDisk = diskPlans;
        completedPlans = diskSummaries;
      }
    } catch {
      // Ignore filesystem errors
    }
  }

  const fm = { ralph_state_version: '1.0' };
  if (currentPhase !== null) fm.current_phase = currentPhase;
  if (totalPhases !== null) fm.total_phases = totalPhases;
  if (currentPlan !== null) fm.current_plan = currentPlan;
  fm.status = normalizedStatus;
  fm.last_updated = new Date().toISOString();
  if (lastActivity) fm.last_activity = lastActivity;
  if (progressPercent !== null) fm.progress_percent = progressPercent;
  if (totalPlansOnDisk !== null) fm.total_plans = totalPlansOnDisk;
  if (completedPlans !== null) fm.completed_plans = completedPlans;

  return fm;
}

/**
 * Strip existing YAML frontmatter from content, returning only the body.
 */
function stripFrontmatter(content) {
  return content.replace(/^---\n[\s\S]*?\n---\n*/, '');
}

/**
 * Sync STATE.md content by building YAML frontmatter from the markdown body.
 * Returns full content string with frontmatter + body.
 */
function syncStateFrontmatter(content, cwd) {
  const body = stripFrontmatter(content);
  const fm = buildStateFrontmatter(body, cwd);
  return reconstructFrontmatter(fm, '\n' + body);
}

/**
 * Write STATE.md with synchronized YAML frontmatter.
 * All STATE.md writes should use this instead of raw fs.writeFileSync.
 */
function writeStateMd(statePath, content, cwd) {
  const synced = syncStateFrontmatter(content, cwd);
  fs.writeFileSync(statePath, synced, 'utf-8');
}

// -- CLI command handler ----------------------------------------------------

/**
 * CLI handler for `state` command.
 * Subcommands:
 *   get <field>    Extract a field value and output it
 *   set <field> <value>  Replace a field value and write STATE.md
 *   json           Output frontmatter as JSON
 */
function cmdState(cwd, subcommand, args, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const content = safeReadFile(statePath);

  if (!content) {
    error('STATE.md not found', 'STATE_NOT_FOUND');
  }

  switch (subcommand) {
    case 'get': {
      const fieldName = args[0];
      if (!fieldName) {
        error('Field name required for state get', 'MISSING_FIELD');
      }
      const value = stateExtractField(content, fieldName);
      if (value === null) {
        output({ field: fieldName, value: null, found: false }, raw, '');
      } else {
        output({ field: fieldName, value, found: true }, raw, value);
      }
      break;
    }

    case 'set': {
      const fieldName = args[0];
      const newValue = args.slice(1).join(' ');
      if (!fieldName || !newValue) {
        error('Field name and value required for state set', 'MISSING_ARGS');
      }
      const updated = stateReplaceField(content, fieldName, newValue);
      if (updated === null) {
        error(`Field "${fieldName}" not found in STATE.md`, 'FIELD_NOT_FOUND');
      }
      writeStateMd(statePath, updated, cwd);
      output({ field: fieldName, value: newValue, updated: true }, raw, 'true');
      break;
    }

    case 'json': {
      const { frontmatter, hasFrontmatter } = extractFrontmatter(content);
      if (hasFrontmatter && Object.keys(frontmatter).length > 0) {
        output(frontmatter, raw, JSON.stringify(frontmatter, null, 2));
      } else {
        const body = stripFrontmatter(content);
        const built = buildStateFrontmatter(body, cwd);
        output(built, raw, JSON.stringify(built, null, 2));
      }
      break;
    }

    default: {
      error(
        'Unknown state subcommand: ' + subcommand + '. Available: get, set, json',
        'UNKNOWN_SUBCOMMAND'
      );
    }
  }
}

module.exports = {
  stateExtractField,
  stateReplaceField,
  buildStateFrontmatter,
  syncStateFrontmatter,
  writeStateMd,
  cmdState,
};
