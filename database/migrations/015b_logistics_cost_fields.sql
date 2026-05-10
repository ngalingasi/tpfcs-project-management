-- Migration 015b: Add cost/payment fields to logistics_transactions

ALTER TABLE `logistics_transactions`
  ADD COLUMN  `shipment_cost`      DECIMAL(18,4)  DEFAULT NULL         AFTER `driver_information`,
  ADD COLUMN  `currency_code`      VARCHAR(10)    DEFAULT 'TZS'        AFTER `shipment_cost`,
  ADD COLUMN  `exchange_rate`      DECIMAL(18,6)  DEFAULT 1.000000     AFTER `currency_code`,
  ADD COLUMN  `base_cost_tzs`      DECIMAL(18,4)  DEFAULT NULL
    COMMENT 'shipment_cost * exchange_rate (always in TZS)'  AFTER `exchange_rate`,
  ADD COLUMN  `payment_status`     ENUM('pending','partially_paid','paid','cancelled')
    NOT NULL DEFAULT 'pending'                               AFTER `base_cost_tzs`,
  ADD COLUMN  `payment_reference`  VARCHAR(255)   DEFAULT NULL         AFTER `payment_status`,
  ADD COLUMN  `expense_notes`      TEXT           DEFAULT NULL         AFTER `payment_reference`;

-- Add logistics_company_id to stock_transfers for direct provider linkage
ALTER TABLE `stock_transfers`
  ADD COLUMN  `logistics_company_id` INT(11) DEFAULT NULL
    COMMENT 'Selected logistics provider when requires_transit = 1'
    AFTER `logistics_notes`,
  ADD KEY  `idx_tf_logistics_co` (`logistics_company_id`);
