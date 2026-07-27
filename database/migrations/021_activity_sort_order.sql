-- Migration 021: Add sort_order to activities
-- Lets activities be arranged in a user-controlled order (set at creation,
-- editable later) instead of always falling back to creation-date order.

ALTER TABLE `activities`
  ADD COLUMN `sort_order` INT(11) NOT NULL DEFAULT 0 AFTER `main_activity_id`;
