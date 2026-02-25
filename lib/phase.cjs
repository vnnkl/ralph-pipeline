/**
 * Phase -- Phase lifecycle: find phase, complete phase, advance state
 *
 * Provides: findPhaseInternal(), cmdPhaseComplete()
 *
 * Modeled on GSD's phase.cjs but adapted for ralph-pipeline's simpler phase structure.
 */

const fs = require('fs');
const path = require('path');
const { output, error, safeReadFile } = require('./core.cjs');
const { stateReplaceField, writeStateMd } = require('./state.cjs');

// -- Phase lookup -----------------------------------------------------------

/**
 * Find a phase directory by phase number.
 * Phase directories are named `NN-name` (e.g., `01-foundation`).
 * Pads phaseNumber to 2 digits for matching.
 * Returns { number, name, directory, path } or null.
 */
function findPhaseInternal(cwd, phaseNumber) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const padded = String(phaseNumber).padStart(2, '0');

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();

    const match = dirs.find(d => d.startsWith(padded + '-') || d === padded);
    if (!match) {
      return null;
    }

    const dirMatch = match.match(/^(\d+)-?(.*)/);
    const number = dirMatch ? dirMatch[1] : padded;
    const name = dirMatch && dirMatch[2] ? dirMatch[2] : null;

    return {
      number,
      name,
      directory: path.join('.planning', 'phases', match),
      path: path.join(phasesDir, match),
    };
  } catch {
    return null;
  }
}

// -- Phase complete ---------------------------------------------------------

/**
 * Mark a phase as complete: update ROADMAP.md checkbox and progress,
 * advance STATE.md to the next phase.
 */
function cmdPhaseComplete(cwd, phaseNumber, raw) {
  if (!phaseNumber) {
    error('Phase number required', 'MISSING_PHASE');
  }

  const phaseInfo = findPhaseInternal(cwd, phaseNumber);
  if (!phaseInfo) {
    error('Phase not found', 'PHASE_NOT_FOUND');
  }

  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const today = new Date().toISOString().split('T')[0];
  const padded = phaseInfo.number;

  // -- Update ROADMAP.md --

  const roadmapContent = safeReadFile(roadmapPath);
  if (roadmapContent) {
    let updated = roadmapContent;

    // Mark phase checkbox: - [ ] **Phase N:...** -> - [x] **Phase N:...**
    const checkboxPattern = new RegExp(
      `(-\\s*\\[)[ ](\\]\\s*\\*\\*Phase\\s+${phaseNumber}[:\\s][^\\n]*)`,
      'i'
    );
    updated = updated.replace(checkboxPattern, `$1x$2 (completed ${today})`);

    // Update progress table status
    const tablePattern = new RegExp(
      `(\\|\\s*${phaseNumber}\\.\\s[^|]*\\|)\\s*[^|]*(\\|)\\s*[^|]*(\\|)`,
      'i'
    );
    updated = updated.replace(tablePattern, `$1 Complete $2 ${today} $3`);

    fs.writeFileSync(roadmapPath, updated, 'utf-8');
  }

  // -- Find next phase --

  let nextPhaseNum = null;
  let nextPhaseName = null;
  let isLastPhase = true;

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();

    // Find directories with a higher phase number
    const currentNum = parseInt(padded, 10);
    for (const dir of dirs) {
      const dirMatch = dir.match(/^(\d+)-?(.*)/);
      if (dirMatch) {
        const dirNum = parseInt(dirMatch[1], 10);
        if (dirNum > currentNum) {
          nextPhaseNum = dirNum;
          nextPhaseName = dirMatch[2] || null;
          isLastPhase = false;
          break;
        }
      }
    }
  } catch {
    // Ignore filesystem errors
  }

  // -- Update STATE.md --

  const stateContent = safeReadFile(statePath);
  if (stateContent) {
    let updated = stateContent;

    if (isLastPhase) {
      // Last phase -- mark pipeline complete
      updated = stateReplaceField(updated, 'Status', 'Pipeline complete') || updated;
      updated = stateReplaceField(updated, 'Last activity', `${today} -- Pipeline complete`) || updated;
    } else {
      // Advance to next phase
      const totalPhases = (() => {
        const phaseRaw = updated.match(/Phase:\s*\d+\s*of\s*(\d+)/);
        return phaseRaw ? phaseRaw[1] : '5';
      })();
      const phaseName = nextPhaseName ? nextPhaseName.replace(/-/g, ' ') : '';
      const phaseLabel = phaseName ? ` (${phaseName.charAt(0).toUpperCase() + phaseName.slice(1)})` : '';

      updated = stateReplaceField(updated, 'Phase', `${nextPhaseNum} of ${totalPhases}${phaseLabel}`) || updated;
      updated = stateReplaceField(updated, 'Status', 'Ready to plan') || updated;
      updated = stateReplaceField(updated, 'Last activity', `${today} -- Phase ${phaseNumber} complete`) || updated;
    }

    writeStateMd(statePath, updated, cwd);
  }

  // -- Output result --

  if (isLastPhase) {
    output(
      { completed: parseInt(phaseNumber, 10), next_phase: null, pipeline_complete: true, date: today },
      raw
    );
  } else {
    output(
      { completed: parseInt(phaseNumber, 10), next_phase: nextPhaseNum, date: today },
      raw
    );
  }
}

module.exports = {
  findPhaseInternal,
  cmdPhaseComplete,
};
