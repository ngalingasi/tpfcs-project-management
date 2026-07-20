-- Migration 016: Project Sites
-- A project can span multiple physical sites. Each site belongs to a
-- region, is optionally linked to one of the project's objectives
-- (so the Project Overview can drill down: Site -> Objective -> Targets -> Activities),
-- and carries its own location/descriptive details.

CREATE TABLE IF NOT EXISTS `project_sites` (
  `site_id`      INT(11)        NOT NULL AUTO_INCREMENT,
  `project_id`   INT(11)        NOT NULL,
  `region_id`    INT(11)        DEFAULT NULL,
  `objective_id` INT(11)        DEFAULT NULL,
  `site_name`    VARCHAR(255)   NOT NULL,
  `district`     VARCHAR(255)   DEFAULT NULL,
  `ward`         VARCHAR(255)   DEFAULT NULL,
  `description`  TEXT           DEFAULT NULL,
  `latitude`     DECIMAL(10,6)  DEFAULT NULL,
  `longitude`    DECIMAL(10,6)  DEFAULT NULL,
  `status`       ENUM('planned','active','completed','on_hold') NOT NULL DEFAULT 'planned',
  `created_at`   TIMESTAMP      NOT NULL DEFAULT current_timestamp(),
  `created_by`   INT(11)        DEFAULT NULL,
  PRIMARY KEY (`site_id`),
  KEY `idx_site_project`   (`project_id`),
  KEY `idx_site_region`    (`region_id`),
  KEY `idx_site_objective` (`objective_id`),
  CONSTRAINT `project_sites_project_fk`   FOREIGN KEY (`project_id`)   REFERENCES `projects`   (`project_id`)   ON DELETE CASCADE,
  CONSTRAINT `project_sites_region_fk`    FOREIGN KEY (`region_id`)    REFERENCES `regions`    (`region_id`)    ON DELETE SET NULL,
  CONSTRAINT `project_sites_objective_fk` FOREIGN KEY (`objective_id`) REFERENCES `objectives` (`objective_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
