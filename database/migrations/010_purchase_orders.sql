-- Migration 010: Purchase Orders Module

-- ── Purchase Orders (header) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `purchase_order_id`    INT(11)       NOT NULL AUTO_INCREMENT,
  `order_number`         VARCHAR(20)   NOT NULL COMMENT 'Auto-generated: PO-YYYY-NNNNN',
  `supplier_id`          INT(11)       NOT NULL,
  `project_id`           INT(11)       DEFAULT NULL COMMENT 'Optional project link',
  `currency_code`        VARCHAR(10)   NOT NULL DEFAULT 'TZS',
  `exchange_rate`        DECIMAL(18,6) NOT NULL DEFAULT 1.000000
    COMMENT 'Rate to TZS. 1 if currency is TZS',
  `order_date`           DATE          NOT NULL,
  `expected_delivery_date` DATE        DEFAULT NULL,
  `notes`                TEXT          DEFAULT NULL,
  `status`               ENUM('draft','pending','approved','ordered',
                               'partially_received','completed','cancelled')
                         NOT NULL DEFAULT 'draft',
  `subtotal_foreign`     DECIMAL(18,2) NOT NULL DEFAULT 0.00
    COMMENT 'Sum of item totals in order currency',
  `total_amount_foreign` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `total_amount_tzs`     DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  `created_by`           INT(11)       NOT NULL,
  `updated_by`           INT(11)       DEFAULT NULL,
  `deleted_by`           INT(11)       DEFAULT NULL,
  `created_at`           TIMESTAMP     NOT NULL DEFAULT current_timestamp(),
  `updated_at`           TIMESTAMP     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at`           TIMESTAMP     NULL DEFAULT NULL,
  PRIMARY KEY (`purchase_order_id`),
  UNIQUE KEY `uq_order_number` (`order_number`),
  KEY `idx_po_supplier`  (`supplier_id`),
  KEY `idx_po_project`   (`project_id`),
  KEY `idx_po_status`    (`status`),
  KEY `idx_po_deleted`   (`deleted_at`),
  KEY `idx_po_order_date`(`order_date`),
  CONSTRAINT `po_supplier_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`supplier_id`),
  CONSTRAINT `po_project_fk`  FOREIGN KEY (`project_id`)  REFERENCES `projects`  (`project_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── Order number sequence tracker ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `po_number_sequences` (
  `year`      YEAR(4)  NOT NULL,
  `last_seq`  INT(11)  NOT NULL DEFAULT 0,
  PRIMARY KEY (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── Purchase Order Items ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `purchase_order_items` (
  `item_id`              INT(11)       NOT NULL AUTO_INCREMENT,
  `purchase_order_id`    INT(11)       NOT NULL,
  `product_id`           INT(11)       NOT NULL,
  `description`          TEXT          DEFAULT NULL,
  `unit_type`            VARCHAR(50)   DEFAULT NULL,
  `quantity`             DECIMAL(18,4) NOT NULL,
  `unit_price`           DECIMAL(18,4) NOT NULL COMMENT 'In order currency',
  `total_price_foreign`  DECIMAL(18,2) NOT NULL COMMENT 'quantity × unit_price',
  `base_price_tzs`       DECIMAL(18,2) NOT NULL COMMENT 'total_price_foreign × exchange_rate',
  `created_at`           TIMESTAMP     NOT NULL DEFAULT current_timestamp(),
  `updated_at`           TIMESTAMP     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`item_id`),
  KEY `idx_poi_order`   (`purchase_order_id`),
  KEY `idx_poi_product` (`product_id`),
  CONSTRAINT `poi_order_fk`   FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`purchase_order_id`) ON DELETE CASCADE,
  CONSTRAINT `poi_product_fk` FOREIGN KEY (`product_id`)        REFERENCES `products`        (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
