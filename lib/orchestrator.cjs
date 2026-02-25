/**
 * Orchestrator -- Pipeline phase management logic
 *
 * Provides: PIPELINE_PHASES, scanPipelinePhases(), detectPosition(),
 *           fillTemplate(), excerptFile(), cmdScanPhases(), cmdExcerpt()
 *
 * Pure functions for pipeline scanning, position detection with
 * belt-and-suspenders validation, template variable substitution,
 * and excerpt extraction.
 *
 * Zero npm dependencies -- Node.js builtins only.
 */

const path = require('path');
const { safeReadFile, output, error } = require('./core.cjs');
const { extractFrontmatter } = require('./frontmatter.cjs');

// -- Pipeline Phase Map -------------------------------------------------------

const PIPELINE_PHASES = [
  { id: 1, name: 'preflight',  template: 'preflight.md',  gateOptions: ['approve', 'retry', 'abort'] },
  { id: 2, name: 'clarify',    template: 'clarify.md',    gateOptions: ['approve', 'redirect', 'skip'] },
  { id: 3, name: 'research',   template: 'research.md',   gateOptions: ['approve', 'redirect', 'replan'] },
  { id: 4, name: 'prd',        template: 'prd.md',        gateOptions: ['approve', 'redirect', 'replan'] },
  { id: 5, name: 'deepen',     template: 'deepen.md',     gateOptions: ['approve', 'redirect', 'skip'] },
  { id: 6, name: 'resolve',    template: 'resolve.md',    gateOptions: ['approve', 'redirect'] },
  { id: 7, name: 'convert',    template: 'convert.md',    gateOptions: ['approve', 'skip'] },
  { id: 8, name: 'execute',    template: 'execute.md',    gateOptions: ['approve', 'retry', 'abort'] },
  { id: 9, name: 'review',     template: 'review.md',     gateOptions: ['approve', 'skip'] },
];

// -- scanPipelinePhases -------------------------------------------------------

/**
 * Scan .planning/pipeline/ directory for output files and their completion status.
 * Returns new array of phase objects (never mutates PIPELINE_PHASES).
 *
 * Each returned entry: { ...phase, outputExists: boolean, completed: boolean }
 */
function scanPipelinePhases(cwd) {
  return PIPELINE_PHASES.map(phase => {
    const outputPath = path.join(cwd, '.planning', 'pipeline', `${phase.name}.md`);
    const content = safeReadFile(outputPath);

    if (content === null) {
      return { ...phase, outputExists: false, completed: false };
    }

    const { frontmatter } = extractFrontmatter(content);
    const completed = frontmatter.completed === true;

    return { ...phase, outputExists: true, completed };
  });
}

// -- detectPosition -----------------------------------------------------------

/**
 * Detect current pipeline position from file scan, validate against STATE.md phase.
 * Trusts file scan on mismatch (more recent truth).
 *
 * @param {string} cwd - Working directory
 * @param {number} statePhase - Phase number from STATE.md / init pipeline
 * @returns {{ phase: number|null, mismatch: boolean, corrected_from?: number, pipeline_complete?: boolean }}
 */
function detectPosition(cwd, statePhase) {
  const phases = scanPipelinePhases(cwd);
  const firstIncomplete = phases.find(p => !p.completed);

  if (!firstIncomplete) {
    return { phase: null, pipeline_complete: true };
  }

  const fileScanPhase = firstIncomplete.id;

  if (fileScanPhase === statePhase) {
    return { phase: fileScanPhase, mismatch: false };
  }

  return { phase: fileScanPhase, mismatch: true, corrected_from: statePhase };
}

// -- fillTemplate -------------------------------------------------------------

/**
 * Substitute {{VAR}} patterns in template content with variable values.
 * Throws Error if any unresolved {{VAR}} patterns remain after substitution.
 *
 * @param {string} templateContent - Template string with {{VAR}} placeholders
 * @param {Object} variables - Key-value map of substitutions
 * @returns {string} Filled template
 */
function fillTemplate(templateContent, variables) {
  let result = templateContent;

  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(pattern, String(value));
  }

  const remaining = result.match(/\{\{[A-Z_]+\}\}/g);
  if (remaining && remaining.length > 0) {
    throw new Error('Unresolved template variables: ' + remaining.join(', '));
  }

  return result;
}

// -- excerptFile --------------------------------------------------------------

/**
 * Return first N non-frontmatter lines from a file.
 * Strips YAML frontmatter before excerpting.
 *
 * @param {string} filePath - Absolute path to file
 * @param {number} [maxLines=10] - Maximum lines to return
 * @returns {string|null} Excerpt string, or null if file doesn't exist
 */
function excerptFile(filePath, maxLines) {
  const lineCount = maxLines !== undefined ? maxLines : 10;
  const content = safeReadFile(filePath);

  if (content === null) {
    return null;
  }

  // Strip YAML frontmatter if present
  const stripped = content.replace(/^---\n[\s\S]*?\n---\n*/, '');

  if (stripped.trim() === '') {
    return '';
  }

  const lines = stripped.split('\n');
  const excerpt = lines.slice(0, lineCount);

  return excerpt.join('\n');
}

// -- CLI Commands -------------------------------------------------------------

/**
 * CLI handler for scan-phases command.
 * Outputs JSON array of 9 phase objects with completion status.
 */
function cmdScanPhases(cwd, raw) {
  const phases = scanPipelinePhases(cwd);
  output(phases, raw);
}

/**
 * CLI handler for excerpt command.
 * Outputs { file, lines, excerpt } for a given file path.
 */
function cmdExcerpt(cwd, filePath, maxLines, raw) {
  if (!filePath) {
    error('Usage: excerpt <file-path> [max-lines]', 'INVALID_ARGS');
  }

  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const excerpt = excerptFile(resolvedPath, maxLines);

  if (excerpt === null) {
    error('File not found: ' + filePath, 'FILE_NOT_FOUND');
  }

  output({ file: filePath, lines: maxLines || 10, excerpt }, raw);
}

module.exports = {
  PIPELINE_PHASES,
  scanPipelinePhases,
  detectPosition,
  fillTemplate,
  excerptFile,
  cmdScanPhases,
  cmdExcerpt,
};
