-- Migration 015: Logistics Management Module (Independent)

-- ── Logistics Companies ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `logistics_companies` (
  `logistics_company_id` INT(11)      NOT NULL AUTO_INCREMENT,
  `company_name`         VARCHAR(255) NOT NULL,
  `company_type`         ENUM('External Logistics Provider','Courier Service','Freight Forwarder',
                               'Internal Fleet','Air Cargo','Sea Freight','Ground Transport')
                         NOT NULL DEFAULT 'Courier Service',
  `contact_person`       VARCHAR(255) DEFAULT NULL,
  `phone_number`         VARCHAR(50)  DEFAULT NULL,
  `email`                VARCHAR(255) DEFAULT NULL,
  `address`              TEXT         DEFAULT NULL,
  `city`                 VARCHAR(100) DEFAULT NULL,
  `country`              VARCHAR(100) DEFAULT NULL,
  `website`              VARCHAR(255) DEFAULT NULL,
  `tracking_url`         VARCHAR(500) DEFAULT NULL
    COMMENT 'Base URL for tracking — append tracking number to this URL',
  `notes`                TEXT         DEFAULT NULL,
  `status`               ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
  `created_by`           INT(11)      NOT NULL,
  `updated_by`           INT(11)      DEFAULT NULL,
  `created_at`           TIMESTAMP    NOT NULL DEFAULT current_timestamp(),
  `updated_at`           TIMESTAMP    NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`logistics_company_id`),
  UNIQUE KEY `uq_logistics_company_name` (`company_name`),
  KEY `idx_lc_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── Logistics Number Sequence ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `logistics_number_sequences` (
  `year`     YEAR(4) NOT NULL,
  `last_seq` INT(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── Logistics Transactions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `logistics_transactions` (
  `logistics_transaction_id` INT(11)      NOT NULL AUTO_INCREMENT,
  `logistics_number`         VARCHAR(20)  NOT NULL COMMENT 'Auto: LOG-YYYY-NNNNN',
  `source_type`              ENUM('TRANSFER','PROCUREMENT','DELIVERY','OTHER')
                             NOT NULL DEFAULT 'TRANSFER',
  `stock_transfer_id`        INT(11)      DEFAULT NULL,
  `logistics_company_id`     INT(11)      NOT NULL,
  `tracking_number`          VARCHAR(255) DEFAULT NULL COMMENT 'Provider tracking number',
  `external_reference_number`VARCHAR(255) DEFAULT NULL,
  `shipment_description`     TEXT         DEFAULT NULL,
  `pickup_location`          VARCHAR(255) NOT NULL,
  `delivery_location`        VARCHAR(255) NOT NULL,
  `pickup_date`              DATE         DEFAULT NULL,
  `dispatch_date`            DATE         DEFAULT NULL,
  `expected_delivery_date`   DATE         DEFAULT NULL,
  `actual_delivery_date`     DATE         DEFAULT NULL,
  `transit_notes`            TEXT         DEFAULT NULL,
  `vehicle_information`      VARCHAR(255) DEFAULT NULL,
  `driver_information`       VARCHAR(255) DEFAULT NULL,
  `delivered_by`             VARCHAR(255) DEFAULT NULL,
  `delivered_at`             TIMESTAMP    NULL DEFAULT NULL,
  `delivery_notes`           TEXT         DEFAULT NULL,
  `status`                   ENUM('draft','pending_pickup','picked_up','in_transit',
                                   'delayed','arrived','delivered','cancelled')
                             NOT NULL DEFAULT 'draft',
  `created_by`               INT(11)      NOT NULL,
  `updated_by`               INT(11)      DEFAULT NULL,
  `created_at`               TIMESTAMP    NOT NULL DEFAULT current_timestamp(),
  `updated_at`               TIMESTAMP    NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`logistics_transaction_id`),
  UNIQUE KEY `uq_logistics_number` (`logistics_number`),
  KEY `idx_lt_company`  (`logistics_company_id`),
  KEY `idx_lt_transfer` (`stock_transfer_id`),
  KEY `idx_lt_status`   (`status`),
  KEY `idx_lt_source`   (`source_type`),
  CONSTRAINT `lt_company_fk`  FOREIGN KEY (`logistics_company_id`)
    REFERENCES `logistics_companies` (`logistics_company_id`),
  CONSTRAINT `lt_transfer_fk` FOREIGN KEY (`stock_transfer_id`)
    REFERENCES `stock_transfers` (`transfer_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── Logistics Timeline Events ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `logistics_events` (
  `event_id`                 INT(11)      NOT NULL AUTO_INCREMENT,
  `logistics_transaction_id` INT(11)      NOT NULL,
  `event_type`               VARCHAR(50)  NOT NULL COMMENT 'created,pickup_scheduled,picked_up,in_transit,arrived,delivered,delayed,note',
  `event_description`        TEXT         NOT NULL,
  `event_location`           VARCHAR(255) DEFAULT NULL,
  `event_time`               TIMESTAMP    NOT NULL DEFAULT current_timestamp(),
  `created_by`               INT(11)      NOT NULL,
  PRIMARY KEY (`event_id`),
  KEY `idx_le_transaction` (`logistics_transaction_id`),
  CONSTRAINT `le_transaction_fk` FOREIGN KEY (`logistics_transaction_id`)
    REFERENCES `logistics_transactions` (`logistics_transaction_id`) ON DELETE CASCADE,
  CONSTRAINT `le_user_fk`        FOREIGN KEY (`created_by`)
    REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
