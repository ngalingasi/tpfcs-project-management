-- Migration 008: Activity Payments
-- Each payment records money spent against an activity budget
-- Total payments cannot exceed effective_budget (budgeted_amount or revised_amount)

CREATE TABLE IF NOT EXISTS `activity_payments` (
  `payment_id`      INT(11)       NOT NULL AUTO_INCREMENT,
  `activity_id`     INT(11)       NOT NULL,
  `amount`          DECIMAL(18,2) NOT NULL,
  `payment_date`    DATE          NOT NULL,
  `payment_method`  VARCHAR(100)  DEFAULT NULL COMMENT 'e.g. Bank Transfer, Cheque, Mobile Money',
  `reference_no`    VARCHAR(255)  DEFAULT NULL COMMENT 'Cheque no, transaction ref, etc.',
  `payee`           VARCHAR(255)  DEFAULT NULL COMMENT 'Who received the payment',
  `description`     TEXT          DEFAULT NULL,
  `status`          ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `evidence_path`   VARCHAR(500)  DEFAULT NULL COMMENT 'Uploaded receipt/document path',
  `evidence_name`   VARCHAR(255)  DEFAULT NULL,
  `created_by`      INT(11)       NOT NULL,
  `approved_by`     INT(11)       DEFAULT NULL,
  `approved_at`     TIMESTAMP     NULL DEFAULT NULL,
  `created_at`      TIMESTAMP     NOT NULL DEFAULT current_timestamp(),
  `updated_at`      TIMESTAMP     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`payment_id`),
  KEY `idx_payments_activity`  (`activity_id`),
  KEY `idx_payments_created_by`(`created_by`),
  CONSTRAINT `payments_activity_fk`   FOREIGN KEY (`activity_id`) REFERENCES `activities` (`activity_id`) ON DELETE CASCADE,
  CONSTRAINT `payments_created_by_fk` FOREIGN KEY (`created_by`)  REFERENCES `users`      (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Add total_paid to activities for quick lookup (maintained by triggers/app logic)
ALTER TABLE `activities`
  ADD COLUMN `total_paid` DECIMAL(18,2) NOT NULL DEFAULT 0
    COMMENT 'Sum of approved payments — maintained by application'
    AFTER `revised_amount`;
