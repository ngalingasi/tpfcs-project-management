-- Migration 020: Tag documents/pictures and payments to a specific site
-- Lets uploads and payments be explicitly scoped to one of the project's
-- sites (optional — NULL means "not tied to a specific site", preserving
-- all existing records). This is what makes "view only this site's
-- documents/pictures/payments" possible when drilling down from the
-- Project Overview's Site -> Objective -> Target -> Activity view.

ALTER TABLE `documents`
  ADD COLUMN `site_id` INT(11) DEFAULT NULL AFTER `activity_id`,
  ADD KEY `idx_documents_site` (`site_id`),
  ADD CONSTRAINT `documents_site_fk` FOREIGN KEY (`site_id`) REFERENCES `project_sites` (`site_id`) ON DELETE SET NULL;

ALTER TABLE `activity_payments`
  ADD COLUMN `site_id` INT(11) DEFAULT NULL AFTER `activity_id`,
  ADD KEY `idx_activity_payments_site` (`site_id`),
  ADD CONSTRAINT `activity_payments_site_fk` FOREIGN KEY (`site_id`) REFERENCES `project_sites` (`site_id`) ON DELETE SET NULL;
