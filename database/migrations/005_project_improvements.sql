-- ============================================================
-- Migration 005: Project Improvements (inspired by NPMIS PDF)
-- Pages 1-2 only
-- ============================================================

-- 1. New fields on projects table
ALTER TABLE `projects`
  -- Comma-separated text fields (displayed as bullet points in UI)
  ADD COLUMN `project_objectives`        TEXT         DEFAULT NULL
    COMMENT 'Comma-separated project objectives (bulleted in UI)'
    AFTER `project_background`,
  ADD COLUMN `project_main_activities`   TEXT         DEFAULT NULL
    COMMENT 'Comma-separated main activities (bulleted in UI)'
    AFTER `project_objectives`,
  ADD COLUMN `project_beneficiaries`     TEXT         DEFAULT NULL
    COMMENT 'Comma-separated beneficiaries e.g. Public, Women, Youth'
    AFTER `project_main_activities`,
  -- Sub-sector (seen in PDF create form)
  ADD COLUMN `sub_sector`                VARCHAR(255) DEFAULT NULL
    AFTER `sector_id`,
  -- Financing fields (from Financing Modality table in PDF)
  ADD COLUMN `financial_modality`        VARCHAR(255) DEFAULT NULL
    COMMENT 'e.g. Concession Loan, Grant, Own Funds'
    AFTER `fund_structure`,
  ADD COLUMN `financial_category`        VARCHAR(255) DEFAULT NULL
    COMMENT 'e.g. Development Projects Fund'
    AFTER `financial_modality`,
  ADD COLUMN `financier`                 VARCHAR(255) DEFAULT NULL
    COMMENT 'e.g. IFD, World Bank, Government'
    AFTER `financial_category`,
  ADD COLUMN `committed_amount`          DECIMAL(18,2) DEFAULT NULL
    COMMENT 'Committed financing amount'
    AFTER `financier`,
  ADD COLUMN `exchange_rate`             DECIMAL(18,4) DEFAULT NULL
    COMMENT 'Exchange rate to TZS'
    AFTER `committed_amount`,
  ADD COLUMN `currency`                  VARCHAR(10)  DEFAULT 'TZS'
    COMMENT 'Currency of financing e.g. USD, EUR, TZS'
    AFTER `exchange_rate`,
  -- Project use capacity (seen in PDF finish concept form)
  ADD COLUMN `project_use_capacity`      TEXT         DEFAULT NULL
    AFTER `project_beneficiaries`,
  -- Project scope/coverage (seen in PDF)
  ADD COLUMN `project_scope`             TEXT         DEFAULT NULL
    AFTER `project_use_capacity`,
  -- Has land (PDF shows "Has Lot" field)
  ADD COLUMN `has_land`                  TINYINT(1)   DEFAULT 0
    COMMENT '1 = project has land/lot allocated'
    AFTER `compensation`;

-- 2. Project coordinators table (seen in PDF page 1 bottom section)
CREATE TABLE IF NOT EXISTS `project_coordinators` (
  `coordinator_id`  INT(11)       NOT NULL AUTO_INCREMENT,
  `project_id`      INT(11)       NOT NULL,
  `full_name`        VARCHAR(255)  NOT NULL,
  `email`           VARCHAR(255)  DEFAULT NULL,
  `phone_number`    VARCHAR(50)   DEFAULT NULL,
  `address`         VARCHAR(255)  DEFAULT NULL,
  `created_at`      TIMESTAMP     NOT NULL DEFAULT current_timestamp(),
  `created_by`      INT(11)       DEFAULT NULL,
  PRIMARY KEY (`coordinator_id`),
  KEY `idx_project_coordinators_project` (`project_id`),
  CONSTRAINT `project_coordinators_project_fk`
    FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. Add missing columns to project_implementers
--    (PDF shows: Vote Name, Vote Code, Sub Vote Code, Sub Vote Name, Implementer, Cost Center, Involvement)
--    All already exist ✓ — just add consultant field
ALTER TABLE `project_implementers`
  ADD COLUMN `role_type`  ENUM('implementer','consultant','contractor') NOT NULL DEFAULT 'implementer'
    COMMENT 'Type of implementing party'
    AFTER `involvement`;

-- 4. Employment/beneficiaries structured table (PDF shows Employment Category table)
CREATE TABLE IF NOT EXISTS `project_employment` (
  `employment_id`   INT(11)       NOT NULL AUTO_INCREMENT,
  `project_id`      INT(11)       NOT NULL,
  `category`        VARCHAR(255)  NOT NULL  COMMENT 'e.g. Direct Employment',
  `type`            VARCHAR(255)  NOT NULL  COMMENT 'e.g. Temporary Employment, Permanent',
  `foreign_count`   INT(11)       DEFAULT 0,
  `domestic_count`  INT(11)       DEFAULT 0,
  `created_at`      TIMESTAMP     NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`employment_id`),
  KEY `idx_project_employment_project` (`project_id`),
  CONSTRAINT `project_employment_project_fk`
    FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- project_regions table kept as-is (region_id reference only)
