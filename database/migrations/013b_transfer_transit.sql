-- Migration 013b: Stock Transfer Transit & Logistics Fields

ALTER TABLE `stock_transfers`
  ADD COLUMN IF NOT EXISTS `requires_transit`      TINYINT(1)    NOT NULL DEFAULT 0
    COMMENT 'Whether transfer requires external logistics/transit'
    AFTER `requires_inspection`,
  ADD COLUMN IF NOT EXISTS `transit_method`        VARCHAR(100)  DEFAULT NULL
    COMMENT 'Internal Vehicle, Courier, Air Freight, Sea Freight, etc.'
    AFTER `requires_transit`,
  ADD COLUMN IF NOT EXISTS `transit_provider`      VARCHAR(255)  DEFAULT NULL
    AFTER `transit_method`,
  ADD COLUMN IF NOT EXISTS `tracking_number`       VARCHAR(255)  DEFAULT NULL
    AFTER `transit_provider`,
  ADD COLUMN IF NOT EXISTS `expected_arrival_date` DATE          DEFAULT NULL
    AFTER `tracking_number`,
  ADD COLUMN IF NOT EXISTS `vehicle_information`   VARCHAR(255)  DEFAULT NULL
    AFTER `expected_arrival_date`,
  ADD COLUMN IF NOT EXISTS `driver_information`    VARCHAR(255)  DEFAULT NULL
    AFTER `vehicle_information`,
  ADD COLUMN IF NOT EXISTS `logistics_notes`       TEXT          DEFAULT NULL
    AFTER `driver_information`;
