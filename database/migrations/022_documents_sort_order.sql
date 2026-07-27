-- Migration 022: Add sort_order to documents
-- Lets uploaded documents/pictures be arranged in a user-controlled order
-- (set at upload time, editable later) instead of always falling back to
-- upload-date order — same pattern as activities.sort_order.

ALTER TABLE `documents`
  ADD COLUMN `sort_order` INT(11) NOT NULL DEFAULT 0 AFTER `category`;
