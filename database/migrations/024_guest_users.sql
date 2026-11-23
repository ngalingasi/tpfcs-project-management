-- Guest users: external, read-only (comment-only) accounts limited to chosen projects.
-- users.role is a plain VARCHAR(50) so the new value 'guest' needs no column change.

ALTER TABLE `users`
  ADD COLUMN `organisation`      VARCHAR(150) NULL AFTER `mobile`,
  ADD COLUMN `guest_expires_at`  DATE NULL AFTER `next_password_change`;

CREATE TABLE IF NOT EXISTS `guest_projects` (
  `user_id`    INT(11) NOT NULL,
  `project_id` INT(11) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` INT(11) DEFAULT NULL,
  PRIMARY KEY (`user_id`, `project_id`),
  KEY `guest_projects_project_idx` (`project_id`),
  CONSTRAINT `guest_projects_user_fk`    FOREIGN KEY (`user_id`)    REFERENCES `users`    (`user_id`)    ON DELETE CASCADE,
  CONSTRAINT `guest_projects_project_fk` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
