-- Migration: Change activities.status from varchar(50) to ENUM
-- Also updates activity_status_history old_status and new_status columns

ALTER TABLE `activities`
  MODIFY COLUMN `status`
    ENUM('pending','in_progress','on_hold','completed','cancelled','overdue')
    NOT NULL DEFAULT 'pending';

ALTER TABLE `activity_status_history`
  MODIFY COLUMN `old_status`
    ENUM('pending','in_progress','on_hold','completed','cancelled','overdue')
    DEFAULT NULL,
  MODIFY COLUMN `new_status`
    ENUM('pending','in_progress','on_hold','completed','cancelled','overdue')
    DEFAULT NULL;

-- Also enforce enum on objectives.status
ALTER TABLE `objectives`
  MODIFY COLUMN `status`
    ENUM('pending','in_progress','completed','cancelled')
    NOT NULL DEFAULT 'pending';

-- Also enforce enum on targets.status
ALTER TABLE `targets`
  MODIFY COLUMN `status`
    ENUM('on_track','at_risk','off_track','achieved','missed')
    NOT NULL DEFAULT 'on_track';
