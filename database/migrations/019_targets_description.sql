-- Migration 019: Add description to targets
-- Targets didn't have a free-text description field; adding one so it can
-- carry rich-text notes the same way objectives/activities/project background do.

ALTER TABLE `targets`
  ADD COLUMN `description` TEXT DEFAULT NULL AFTER `name`;
