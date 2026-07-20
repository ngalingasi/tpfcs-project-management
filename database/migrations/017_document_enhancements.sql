-- Migration 017: Document enhancements
-- Adds a description field and a document/picture category to `documents`,
-- and a lightweight comment thread per document (used by both the
-- Documents tab and the new Pictures tab on the Activity panel).

ALTER TABLE `documents`
  ADD COLUMN `description` TEXT DEFAULT NULL AFTER `name`,
  ADD COLUMN `category` ENUM('document','picture') NOT NULL DEFAULT 'document' AFTER `description`;

CREATE TABLE IF NOT EXISTS `document_comments` (
  `comment_id`  INT(11)   NOT NULL AUTO_INCREMENT,
  `document_id` INT(11)   NOT NULL,
  `comment`     TEXT      NOT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  `created_by`  INT(11)   DEFAULT NULL,
  PRIMARY KEY (`comment_id`),
  KEY `idx_doc_comment_document` (`document_id`),
  CONSTRAINT `document_comments_document_fk` FOREIGN KEY (`document_id`) REFERENCES `documents` (`document_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
