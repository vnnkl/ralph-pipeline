/**
 * Time Budget -- CLI commands for time budget management
 *
 * Provides: cmdTimeBudgetStart(), cmdTimeBudgetCheck(),
 *           cmdTimeBudgetRecordBead(), cmdTimeBudgetEstimate()
 *
 * All functions use immutable patterns -- new config objects via spread,
 * never mutating the loaded config.
 *
 * Zero npm dependencies -- Node.js builtins only.
 */

const { output, error, loadConfig, saveConfig } = require('./core.cjs');

// -- Time Budget Commands -----------------------------------------------------

/**
 * Start a time budget. Sets time_budget_expires as absolute timestamp.
 * @param {string} cwd - Working directory
 * @param {string|number} hours - Budget in hours
 */
function cmdTimeBudgetStart(cwd, hours) {
  if (!hours || isNaN(hours) || parseFloat(hours) <= 0) {
    error('Hours must be a positive number', 'INVALID_HOURS');
  }

  const config = loadConfig(cwd);
  const parsedHours = parseFloat(hours);
  const expiresAt = Date.now() + (parsedHours * 3600000);

  const updatedConfig = {
    ...config,
    time_budget_hours: parsedHours,
    time_budget_expires: expiresAt,
  };
  saveConfig(cwd, updatedConfig);

  output({
    started: true,
    hours: parsedHours,
    expires_at: new Date(expiresAt).toISOString(),
  });
}

/**
 * Check if time budget has expired. Returns remaining time info.
 * @param {string} cwd - Working directory
 */
function cmdTimeBudgetCheck(cwd) {
  const config = loadConfig(cwd);

  if (!config.time_budget_expires) {
    output({ has_budget: false, expired: false });
    return;
  }

  const now = Date.now();
  const remaining = config.time_budget_expires - now;
  const expired = remaining <= 0;

  const hours = Math.max(0, Math.floor(remaining / 3600000));
  const minutes = Math.max(0, Math.floor((remaining % 3600000) / 60000));

  output({
    has_budget: true,
    expired,
    remaining_ms: Math.max(0, remaining),
    remaining_display: expired
      ? 'Budget expired'
      : hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`,
    budget_hours: config.time_budget_hours,
    expires_at: new Date(config.time_budget_expires).toISOString(),
  });
}

/**
 * Record a bead execution duration. Updates running average in config.
 * @param {string} cwd - Working directory
 * @param {string|number} durationMs - Bead duration in milliseconds
 */
function cmdTimeBudgetRecordBead(cwd, durationMs) {
  if (!durationMs || isNaN(durationMs)) {
    error('Duration in ms required', 'INVALID_DURATION');
  }

  const config = loadConfig(cwd);
  const duration = parseInt(durationMs, 10);
  const prevAvg = config.avg_bead_duration_ms || 0;
  const prevCount = config.total_beads_executed || 0;
  const newCount = prevCount + 1;

  // Weighted running average
  const newAvg = prevCount === 0
    ? duration
    : Math.round((prevAvg * prevCount + duration) / newCount);

  const updatedConfig = {
    ...config,
    avg_bead_duration_ms: newAvg,
    total_beads_executed: newCount,
  };
  saveConfig(cwd, updatedConfig);

  output({
    recorded: true,
    duration_ms: duration,
    avg_bead_duration_ms: newAvg,
    total_beads_executed: newCount,
  });
}

/**
 * Estimate how many beads can fit in remaining budget.
 * Uses historical average or 20-minute default for first run.
 * @param {string} cwd - Working directory
 */
function cmdTimeBudgetEstimate(cwd) {
  const config = loadConfig(cwd);
  const defaultBeadDuration = 20 * 60 * 1000; // 20 minutes
  const avgBead = config.avg_bead_duration_ms || defaultBeadDuration;
  const remaining = config.time_budget_expires
    ? Math.max(0, config.time_budget_expires - Date.now())
    : null;

  const estimatedBeads = remaining !== null
    ? Math.floor(remaining / avgBead)
    : null;

  output({
    avg_bead_duration_ms: avgBead,
    avg_bead_duration_display: Math.round(avgBead / 60000) + 'min',
    total_beads_executed: config.total_beads_executed || 0,
    remaining_ms: remaining,
    estimated_beads_remaining: estimatedBeads,
    is_first_run: (config.total_beads_executed || 0) === 0,
  });
}

module.exports = {
  cmdTimeBudgetStart,
  cmdTimeBudgetCheck,
  cmdTimeBudgetRecordBead,
  cmdTimeBudgetEstimate,
};
