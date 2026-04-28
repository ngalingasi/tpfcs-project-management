/**
 * Activity statuses — single source of truth used by:
 *   - DB migration (enum column)
 *   - Joi validation in routes
 *   - Model default values
 *   - Status transition rules
 */
const ACTIVITY_STATUSES = {
  PENDING:     'pending',      // Created, not yet started
  IN_PROGRESS: 'in_progress',  // Work actively ongoing
  ON_HOLD:     'on_hold',      // Temporarily paused (waiting resources, approvals, etc.)
  COMPLETED:   'completed',    // All work done, 100% progress
  CANCELLED:   'cancelled',    // Abandoned, will not be done
  OVERDUE:     'overdue',      // Past end_date and still not completed
};

const ACTIVITY_STATUS_LIST = Object.values(ACTIVITY_STATUSES);

/**
 * Valid status transitions — prevents illegal jumps e.g. cancelled → in_progress
 * Key = current status, Value = allowed next statuses
 */
const ACTIVITY_STATUS_TRANSITIONS = {
  pending:     ['in_progress', 'on_hold', 'cancelled'],
  in_progress: ['on_hold', 'completed', 'cancelled', 'overdue'],
  on_hold:     ['in_progress', 'cancelled'],
  overdue:     ['in_progress', 'on_hold', 'cancelled', 'completed'],
  completed:   [], // terminal — cannot move out
  cancelled:   [], // terminal — cannot move out
};

/**
 * Objective / Target statuses
 */
const OBJECTIVE_STATUSES = {
  PENDING:     'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED:   'completed',
  CANCELLED:   'cancelled',
};
const OBJECTIVE_STATUS_LIST = Object.values(OBJECTIVE_STATUSES);

const TARGET_STATUSES = {
  ON_TRACK:  'on_track',   // Progress is on schedule
  AT_RISK:   'at_risk',    // Progress is behind but recoverable
  OFF_TRACK: 'off_track',  // Significantly behind schedule
  ACHIEVED:  'achieved',   // Target value reached
  MISSED:    'missed',     // Deadline passed without achieving target
};
const TARGET_STATUS_LIST = Object.values(TARGET_STATUSES);

module.exports = {
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LIST,
  ACTIVITY_STATUS_TRANSITIONS,
  OBJECTIVE_STATUSES,
  OBJECTIVE_STATUS_LIST,
  TARGET_STATUSES,
  TARGET_STATUS_LIST,
};
