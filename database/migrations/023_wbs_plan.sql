-- Migration 023: WBS codes, lead party and activity dependencies
--
-- Supports importing / exporting an implementation plan (Work Breakdown
-- Structure) as an Excel template:
--   Objective  = WBS section            e.g. "2"      PERMITS AND CLIENT PREREQUISITES
--   Activity   = WBS task               e.g. "2.3"    Road-reserve permits, Dar es Salaam
--   Sub-activity = WBS sub-task         e.g. "2.3.1"  (main_activity_id -> parent activity)
--
-- All new columns are nullable, so existing records are unaffected.

ALTER TABLE `objectives`
  ADD COLUMN `wbs_code` VARCHAR(30) DEFAULT NULL AFTER `project_id`,
  ADD KEY `idx_objectives_wbs` (`project_id`, `wbs_code`);

ALTER TABLE `activities`
  ADD COLUMN `wbs_code`   VARCHAR(30)  DEFAULT NULL AFTER `activity_id`,
  ADD COLUMN `lead_party` VARCHAR(150) DEFAULT NULL COMMENT 'Responsible party text from the plan, e.g. "Client / ROM"' AFTER `supervisor_id`,
  ADD KEY `idx_activities_wbs` (`wbs_code`);

-- Finish-to-start style predecessor links between activities ("AFTER" column).
CREATE TABLE IF NOT EXISTS `activity_dependencies` (
  `dependency_id`  INT(11)   NOT NULL AUTO_INCREMENT,
  `activity_id`    INT(11)   NOT NULL COMMENT 'The successor (the activity that waits)',
  `predecessor_id` INT(11)   NOT NULL COMMENT 'The activity that must happen first',
  `created_at`     TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`dependency_id`),
  UNIQUE KEY `uq_activity_dependency` (`activity_id`, `predecessor_id`),
  KEY `idx_dep_predecessor` (`predecessor_id`),
  CONSTRAINT `dep_activity_fk`    FOREIGN KEY (`activity_id`)    REFERENCES `activities` (`activity_id`) ON DELETE CASCADE,
  CONSTRAINT `dep_predecessor_fk` FOREIGN KEY (`predecessor_id`) REFERENCES `activities` (`activity_id`) ON DELETE CASCADE,
  CONSTRAINT `chk_dep_not_self`   CHECK (`activity_id` <> `predecessor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
