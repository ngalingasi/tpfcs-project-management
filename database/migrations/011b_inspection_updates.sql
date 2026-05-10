-- Migration 011b: Inspection Module Adjustments

-- 1. Add require_evidence_on_acceptance to inspection_requests
ALTER TABLE `inspection_requests`
  ADD COLUMN `require_evidence_on_acceptance` TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'If true, assigned staff must upload evidence before accepting'
    AFTER `requires_evidence_upload`;

ALTER TABLE `inspection_requests`
  ADD COLUMN `location_region_id` INT(11) DEFAULT NULL
    COMMENT 'FK to regions table — used when inspection is inside Tanzania'
    AFTER `location_region`;

ALTER TABLE `inspection_requests`
  ADD COLUMN `location_city` VARCHAR(100) DEFAULT NULL
    COMMENT 'City name for international locations'
    AFTER `location_region_id`;

ALTER TABLE `inspection_requests`
  ADD INDEX `idx_ir_region_id` (`location_region_id`);
-- 2. Add assignment evidence table
CREATE TABLE IF NOT EXISTS `assignment_evidence` (
  `assignment_evidence_id` INT(11)      NOT NULL AUTO_INCREMENT,
  `inspection_assignment_id` INT(11)    NOT NULL,
  `file_name`              VARCHAR(255) NOT NULL,
  `file_path`              VARCHAR(500) NOT NULL,
  `file_type`              VARCHAR(100) DEFAULT NULL COMMENT 'MIME type',
  `uploaded_by`            INT(11)      NOT NULL,
  `uploaded_at`            TIMESTAMP    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`assignment_evidence_id`),
  KEY `idx_ae_assignment` (`inspection_assignment_id`),
  KEY `idx_ae_uploaded_by`(`uploaded_by`),
  CONSTRAINT `ae_assignment_fk` FOREIGN KEY (`inspection_assignment_id`)
    REFERENCES `inspection_assignments` (`inspection_assignment_id`) ON DELETE CASCADE,
  CONSTRAINT `ae_user_fk` FOREIGN KEY (`uploaded_by`)
    REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
