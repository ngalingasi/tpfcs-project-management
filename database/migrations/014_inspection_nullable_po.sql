-- Migration 014: Make purchase_order_id nullable in inspection_requests
-- Required for TRANSFER source type inspections

ALTER TABLE `inspection_requests`
  MODIFY COLUMN `purchase_order_id` INT(11) DEFAULT NULL
    COMMENT 'NULL when source_type = TRANSFER';
