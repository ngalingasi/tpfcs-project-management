-- Migration 013: Stock Transfer Module

-- ── Extend transaction_type ENUM ──────────────────────────────────────────────
ALTER TABLE `stock_transactions`
  MODIFY COLUMN `transaction_type`
    ENUM('STOCK_IN','STOCK_OUT','ADJUSTMENT','STOCK_TRANSFER_IN','STOCK_TRANSFER_OUT')
    NOT NULL DEFAULT 'STOCK_IN';

-- ── Stock Transfers ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `stock_transfers` (
  `transfer_id`          INT(11)       NOT NULL AUTO_INCREMENT,
  `transfer_number`      VARCHAR(20)   NOT NULL COMMENT 'Auto: TRF-YYYY-NNNNN',
  `source_store_id`      INT(11)       NOT NULL,
  `destination_store_id` INT(11)       NOT NULL,
  `transfer_date`        DATE          NOT NULL,
  `notes`                TEXT          DEFAULT NULL,
  `status`               ENUM('draft','approved','dispatched',
                               'under_inspection','inspection_approved',
                               'received','closed','cancelled')
                         NOT NULL DEFAULT 'draft',
  `requires_inspection`  TINYINT(1)    NOT NULL DEFAULT 1,
  `dispatched_at`        TIMESTAMP     NULL DEFAULT NULL,
  `dispatched_by`        INT(11)       DEFAULT NULL,
  `received_at`          TIMESTAMP     NULL DEFAULT NULL,
  `received_by`          INT(11)       DEFAULT NULL,
  `created_by`           INT(11)       NOT NULL,
  `updated_by`           INT(11)       DEFAULT NULL,
  `created_at`           TIMESTAMP     NOT NULL DEFAULT current_timestamp(),
  `updated_at`           TIMESTAMP     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at`           TIMESTAMP     NULL DEFAULT NULL,
  PRIMARY KEY (`transfer_id`),
  UNIQUE KEY `uq_transfer_number` (`transfer_number`),
  KEY `idx_tf_source`      (`source_store_id`),
  KEY `idx_tf_destination` (`destination_store_id`),
  KEY `idx_tf_status`      (`status`),
  CONSTRAINT `tf_source_fk` FOREIGN KEY (`source_store_id`)
    REFERENCES `stores` (`store_id`),
  CONSTRAINT `tf_dest_fk`   FOREIGN KEY (`destination_store_id`)
    REFERENCES `stores` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── Transfer Items ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `stock_transfer_items` (
  `transfer_item_id` INT(11)       NOT NULL AUTO_INCREMENT,
  `transfer_id`      INT(11)       NOT NULL,
  `product_id`       INT(11)       NOT NULL,
  `quantity`         DECIMAL(18,4) NOT NULL,
  `notes`            TEXT          DEFAULT NULL,
  PRIMARY KEY (`transfer_item_id`),
  KEY `idx_tfi_transfer` (`transfer_id`),
  KEY `idx_tfi_product`  (`product_id`),
  CONSTRAINT `tfi_transfer_fk` FOREIGN KEY (`transfer_id`) REFERENCES `stock_transfers` (`transfer_id`) ON DELETE CASCADE,
  CONSTRAINT `tfi_product_fk`  FOREIGN KEY (`product_id`)  REFERENCES `products`        (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── Transfer Number Sequence ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `transfer_number_sequences` (
  `year`     YEAR(4) NOT NULL,
  `last_seq` INT(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── Link inspection_requests to transfers ─────────────────────────────────────
ALTER TABLE `inspection_requests`
  ADD COLUMN IF NOT EXISTS `source_type`      VARCHAR(50)  DEFAULT NULL
    COMMENT 'e.g. TRANSFER, ORDER'                          AFTER `purchase_order_id`,
  ADD COLUMN IF NOT EXISTS `source_id`        INT(11)      DEFAULT NULL
    COMMENT 'FK to stock_transfers.transfer_id'             AFTER `source_type`,
  ADD COLUMN IF NOT EXISTS `destination_store_id` INT(11)  DEFAULT NULL
    COMMENT 'Auto-set from transfer destination'            AFTER `source_id`,
  ADD KEY IF NOT EXISTS `idx_ir_source` (`source_type`, `source_id`);
