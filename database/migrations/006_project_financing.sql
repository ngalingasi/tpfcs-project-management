-- Migration 006: Project Financing as multiple sources (like implementers)

CREATE TABLE IF NOT EXISTS `project_financing` (
  `financing_id`      INT(11)       NOT NULL AUTO_INCREMENT,
  `project_id`        INT(11)       NOT NULL,
  `fund_source`       VARCHAR(255)  DEFAULT NULL COMMENT 'e.g. Foreign, Domestic',
  `financial_modality`VARCHAR(255)  DEFAULT NULL COMMENT 'e.g. Concession Loan, Grant',
  `financial_category`VARCHAR(255)  DEFAULT NULL COMMENT 'e.g. Development Projects Fund',
  `financier`         VARCHAR(255)  DEFAULT NULL COMMENT 'e.g. IFD, World Bank',
  `committed_amount`  DECIMAL(18,2) DEFAULT NULL,
  `exchange_rate`     DECIMAL(18,4) DEFAULT NULL,
  `currency`          VARCHAR(10)   DEFAULT 'TZS',
  `amount_tzs`        DECIMAL(18,2) DEFAULT NULL COMMENT 'Calculated: committed_amount * exchange_rate',
  `created_at`        TIMESTAMP     NOT NULL DEFAULT current_timestamp(),
  `created_by`        INT(11)       DEFAULT NULL,
  PRIMARY KEY (`financing_id`),
  KEY `idx_project_financing_project` (`project_id`),
  CONSTRAINT `project_financing_project_fk`
    FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Remove single-source financing columns from projects table (replaced by table above)
-- Only run if columns exist:
ALTER TABLE `projects`
  DROP COLUMN IF EXISTS `financial_modality`,
  DROP COLUMN IF EXISTS `financial_category`,
  DROP COLUMN IF EXISTS `financier`,
  DROP COLUMN IF EXISTS `committed_amount`,
  DROP COLUMN IF EXISTS `exchange_rate`,
  DROP COLUMN IF EXISTS `currency`;
