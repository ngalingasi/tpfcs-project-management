-- Migration 011: Inspection Management Module

-- ── Inspection Checklists ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inspection_checklists` (
  `checklist_id`   INT(11)      NOT NULL AUTO_INCREMENT,
  `checklist_name` VARCHAR(255) NOT NULL,
  `inspection_type`ENUM('FA','GRI') NOT NULL COMMENT 'FA=Factory Assessment, GRI=Goods Receiving',
  `description`    TEXT         DEFAULT NULL,
  `status`         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_by`     INT(11)      NOT NULL,
  `updated_by`     INT(11)      DEFAULT NULL,
  `deleted_by`     INT(11)      DEFAULT NULL,
  `created_at`     TIMESTAMP    NOT NULL DEFAULT current_timestamp(),
  `updated_at`     TIMESTAMP    NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at`     TIMESTAMP    NULL DEFAULT NULL,
  PRIMARY KEY (`checklist_id`),
  KEY `idx_cl_type`    (`inspection_type`),
  KEY `idx_cl_status`  (`status`),
  KEY `idx_cl_deleted` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── Checklist Items ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `checklist_items` (
  `checklist_item_id` INT(11)      NOT NULL AUTO_INCREMENT,
  `checklist_id`      INT(11)      NOT NULL,
  `item_title`        VARCHAR(255) NOT NULL,
  `item_description`  TEXT         DEFAULT NULL,
  `item_order`        INT(11)      NOT NULL DEFAULT 0,
  `response_type`     ENUM('pass_fail','yes_no','text','number','photo','file')
                      NOT NULL DEFAULT 'pass_fail',
  `is_required`       TINYINT(1)   NOT NULL DEFAULT 1,
  `requires_comment`  TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`        TIMESTAMP    NOT NULL DEFAULT current_timestamp(),
  `updated_at`        TIMESTAMP    NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`checklist_item_id`),
  KEY `idx_ci_checklist` (`checklist_id`),
  CONSTRAINT `ci_checklist_fk`
    FOREIGN KEY (`checklist_id`) REFERENCES `inspection_checklists` (`checklist_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── Inspection Request Number Sequence ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inspection_number_sequences` (
  `year`     YEAR(4) NOT NULL,
  `last_seq` INT(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── Inspection Requests ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inspection_requests` (
  `inspection_request_id` INT(11)      NOT NULL AUTO_INCREMENT,
  `request_number`        VARCHAR(30)  NOT NULL COMMENT 'Auto: INS-YYYY-NNNNN',
  `inspection_type`       ENUM('FA','GRI') NOT NULL,
  `project_id`            INT(11)      DEFAULT NULL,
  `purchase_order_id`     INT(11)      NOT NULL,
  `checklist_id`          INT(11)      NOT NULL,
  -- Location
  `location_name`         VARCHAR(255) NOT NULL,
  `location_address`      TEXT         DEFAULT NULL,
  `location_country`      VARCHAR(100) DEFAULT NULL,
  `location_region`       VARCHAR(100) DEFAULT NULL,
  `latitude`              DECIMAL(10,6) DEFAULT NULL,
  `longitude`             DECIMAL(10,6) DEFAULT NULL,
  -- Schedule
  `inspection_date`       DATE         NOT NULL,
  `inspection_time`       TIME         DEFAULT NULL,
  -- Config
  `requires_evidence_upload` TINYINT(1) NOT NULL DEFAULT 0,
  `request_notes`         TEXT         DEFAULT NULL,
  `status`                ENUM('draft','pending_acceptance','scheduled','active','completed','cancelled')
                          NOT NULL DEFAULT 'draft',
  `created_by`            INT(11)      NOT NULL,
  `updated_by`            INT(11)      DEFAULT NULL,
  `deleted_by`            INT(11)      DEFAULT NULL,
  `created_at`            TIMESTAMP    NOT NULL DEFAULT current_timestamp(),
  `updated_at`            TIMESTAMP    NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at`            TIMESTAMP    NULL DEFAULT NULL,
  PRIMARY KEY (`inspection_request_id`),
  UNIQUE KEY `uq_request_number` (`request_number`),
  KEY `idx_ir_type`    (`inspection_type`),
  KEY `idx_ir_po`      (`purchase_order_id`),
  KEY `idx_ir_project` (`project_id`),
  KEY `idx_ir_status`  (`status`),
  KEY `idx_ir_date`    (`inspection_date`),
  KEY `idx_ir_deleted` (`deleted_at`),
  CONSTRAINT `ir_po_fk`      FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`        (`purchase_order_id`),
  CONSTRAINT `ir_project_fk` FOREIGN KEY (`project_id`)        REFERENCES `projects`               (`project_id`) ON DELETE SET NULL,
  CONSTRAINT `ir_cl_fk`      FOREIGN KEY (`checklist_id`)      REFERENCES `inspection_checklists`  (`checklist_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── Inspection Request → Order Items (which items are being inspected) ────────
CREATE TABLE IF NOT EXISTS `inspection_request_items` (
  `id`                    INT(11) NOT NULL AUTO_INCREMENT,
  `inspection_request_id` INT(11) NOT NULL,
  `purchase_order_item_id`INT(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ir_poi` (`inspection_request_id`, `purchase_order_item_id`),
  CONSTRAINT `iri_request_fk` FOREIGN KEY (`inspection_request_id`) REFERENCES `inspection_requests`  (`inspection_request_id`) ON DELETE CASCADE,
  CONSTRAINT `iri_item_fk`    FOREIGN KEY (`purchase_order_item_id`) REFERENCES `purchase_order_items` (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── Inspection Assignments ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inspection_assignments` (
  `inspection_assignment_id` INT(11)     NOT NULL AUTO_INCREMENT,
  `inspection_request_id`    INT(11)     NOT NULL,
  `user_id`                  INT(11)     NOT NULL,
  `assignment_status`        ENUM('pending','accepted','rejected','cancelled')
                             NOT NULL DEFAULT 'pending',
  `accepted_at`              TIMESTAMP   NULL DEFAULT NULL,
  `rejected_at`              TIMESTAMP   NULL DEFAULT NULL,
  `remarks`                  TEXT        DEFAULT NULL,
  `created_at`               TIMESTAMP   NOT NULL DEFAULT current_timestamp(),
  `updated_at`               TIMESTAMP   NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`inspection_assignment_id`),
  UNIQUE KEY `uq_ia_request_user` (`inspection_request_id`, `user_id`),
  KEY `idx_ia_user`   (`user_id`),
  KEY `idx_ia_status` (`assignment_status`),
  CONSTRAINT `ia_request_fk` FOREIGN KEY (`inspection_request_id`) REFERENCES `inspection_requests` (`inspection_request_id`) ON DELETE CASCADE,
  CONSTRAINT `ia_user_fk`    FOREIGN KEY (`user_id`)               REFERENCES `users`               (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
