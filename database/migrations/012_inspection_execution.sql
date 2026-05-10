-- Migration 012: Inspection Execution, Approval & Stock Management

-- ── 1. Update inspection_requests status ENUM ─────────────────────────────────
ALTER TABLE `inspection_requests`
  MODIFY COLUMN `status`
    ENUM(
      'draft',
      'pending_acceptance',
      'scheduled',
      'active',
      'inspected',
      'pending_approval',
      'approved',
      'rejected',
      'cancelled'
    )
    NOT NULL DEFAULT 'draft';

-- ── 2. Inspection Responses (checklist answers) ───────────────────────────────
CREATE TABLE IF NOT EXISTS `inspection_responses` (
  `inspection_response_id` INT(11)      NOT NULL AUTO_INCREMENT,
  `inspection_request_id`  INT(11)      NOT NULL,
  `checklist_item_id`      INT(11)      NOT NULL,
  `order_item_id`          INT(11)      DEFAULT NULL COMMENT 'Optional link to specific order item',
  `response_value`         TEXT         DEFAULT NULL COMMENT 'pass/fail/yes/no/text/number value',
  `response_comment`       TEXT         DEFAULT NULL,
  `evidence_path`          VARCHAR(500) DEFAULT NULL,
  `evidence_name`          VARCHAR(255) DEFAULT NULL,
  `created_by`             INT(11)      NOT NULL,
  `created_at`             TIMESTAMP    NOT NULL DEFAULT current_timestamp(),
  `updated_at`             TIMESTAMP    NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`inspection_response_id`),
  UNIQUE KEY `uq_response_item` (`inspection_request_id`, `checklist_item_id`),
  KEY `idx_ir_responses`     (`inspection_request_id`),
  KEY `idx_ir_checklist_item`(`checklist_item_id`),
  CONSTRAINT `resp_request_fk` FOREIGN KEY (`inspection_request_id`)
    REFERENCES `inspection_requests` (`inspection_request_id`) ON DELETE CASCADE,
  CONSTRAINT `resp_item_fk`    FOREIGN KEY (`checklist_item_id`)
    REFERENCES `checklist_items`      (`checklist_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Add execution fields to inspection_requests
ALTER TABLE `inspection_requests`
  ADD COLUMN `general_remarks` TEXT DEFAULT NULL
  AFTER `request_notes`;

ALTER TABLE `inspection_requests`
  ADD COLUMN `recommendation`
    ENUM('approved','conditional','rejected')
    DEFAULT NULL
  AFTER `general_remarks`;

ALTER TABLE `inspection_requests`
  ADD COLUMN `submitted_at`
    TIMESTAMP NULL DEFAULT NULL
  AFTER `recommendation`;

ALTER TABLE `inspection_requests`
  ADD COLUMN `submitted_by`
    INT(11) DEFAULT NULL
  AFTER `submitted_at`;
  
-- ── 3. Inspection Approvals ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inspection_approvals` (
  `inspection_approval_id` INT(11)      NOT NULL AUTO_INCREMENT,
  `inspection_request_id`  INT(11)      NOT NULL,
  `approval_status`        ENUM('approved','rejected') NOT NULL,
  `approval_note`          TEXT         NOT NULL,
  `receiving_store_id`     INT(11)      DEFAULT NULL COMMENT 'Store where goods will be received',
  `approved_by`            INT(11)      NOT NULL,
  `approved_at`            TIMESTAMP    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`inspection_approval_id`),
  UNIQUE KEY `uq_approval_request` (`inspection_request_id`),
  KEY `idx_approval_store`     (`receiving_store_id`),
  CONSTRAINT `approval_request_fk` FOREIGN KEY (`inspection_request_id`)
    REFERENCES `inspection_requests` (`inspection_request_id`),
  CONSTRAINT `approval_store_fk`   FOREIGN KEY (`receiving_store_id`)
    REFERENCES `stores`             (`store_id`),
  CONSTRAINT `approval_user_fk`    FOREIGN KEY (`approved_by`)
    REFERENCES `users`              (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── 4. Store Inventory (stock levels per store) ───────────────────────────────
CREATE TABLE IF NOT EXISTS `store_inventory` (
  `store_inventory_id` INT(11)       NOT NULL AUTO_INCREMENT,
  `store_id`           INT(11)       NOT NULL,
  `product_id`         INT(11)       NOT NULL,
  `quantity`           DECIMAL(18,4) NOT NULL DEFAULT 0,
  `last_updated`       TIMESTAMP     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`store_inventory_id`),
  UNIQUE KEY `uq_store_product` (`store_id`, `product_id`),
  CONSTRAINT `si_store_fk`   FOREIGN KEY (`store_id`)   REFERENCES `stores`   (`store_id`),
  CONSTRAINT `si_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── 5. Stock Transactions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `stock_transactions` (
  `stock_transaction_id` INT(11)       NOT NULL AUTO_INCREMENT,
  `transaction_type`     ENUM('STOCK_IN','STOCK_OUT','ADJUSTMENT') NOT NULL DEFAULT 'STOCK_IN',
  `store_id`             INT(11)       NOT NULL,
  `product_id`           INT(11)       NOT NULL,
  `quantity`             DECIMAL(18,4) NOT NULL,
  `source_type`          VARCHAR(50)   DEFAULT NULL COMMENT 'e.g. INSPECTION_APPROVAL',
  `source_id`            INT(11)       DEFAULT NULL COMMENT 'FK to source record (approval_id)',
  `notes`                TEXT          DEFAULT NULL,
  `transaction_date`     TIMESTAMP     NOT NULL DEFAULT current_timestamp(),
  `created_by`           INT(11)       NOT NULL,
  PRIMARY KEY (`stock_transaction_id`),
  KEY `idx_st_store`   (`store_id`),
  KEY `idx_st_product` (`product_id`),
  KEY `idx_st_type`    (`transaction_type`),
  KEY `idx_st_source`  (`source_type`, `source_id`),
  CONSTRAINT `st_store_fk`   FOREIGN KEY (`store_id`)   REFERENCES `stores`   (`store_id`),
  CONSTRAINT `st_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`),
  CONSTRAINT `st_user_fk`    FOREIGN KEY (`created_by`) REFERENCES `users`    (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
