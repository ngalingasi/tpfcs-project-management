-- ============================================================
-- 025: Map points (poles, cameras, closures ...) linked to projects.
--
-- Places are normalised (3NF):
--   regions (existing) -> districts -> councils -> wards -> streets
-- A point stores only its ward (and optionally street); region/district/council are derived through the
-- chain, so they can never disagree with each other.
-- Which regions a project works in is still `project_regions` (existing).
-- Safe to run more than once.
-- ============================================================

CREATE TABLE IF NOT EXISTS `districts` (
  `district_id` INT(11)       NOT NULL AUTO_INCREMENT,
  `region_id`   INT(11)       NOT NULL,
  `name`        VARCHAR(150)  NOT NULL,
  PRIMARY KEY (`district_id`),
  UNIQUE KEY `uq_district_region_name` (`region_id`, `name`),
  CONSTRAINT `districts_region_fk` FOREIGN KEY (`region_id`) REFERENCES `regions` (`region_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `councils` (
  `council_id`  INT(11)       NOT NULL AUTO_INCREMENT,
  `district_id` INT(11)       NOT NULL,
  `name`        VARCHAR(150)  NOT NULL,
  PRIMARY KEY (`council_id`),
  UNIQUE KEY `uq_council_district_name` (`district_id`, `name`),
  CONSTRAINT `councils_district_fk` FOREIGN KEY (`district_id`) REFERENCES `districts` (`district_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `wards` (
  `ward_id`     INT(11)       NOT NULL AUTO_INCREMENT,
  `council_id`  INT(11)       NOT NULL,
  `name`        VARCHAR(150)  NOT NULL,
  PRIMARY KEY (`ward_id`),
  UNIQUE KEY `uq_ward_council_name` (`council_id`, `name`),
  CONSTRAINT `wards_council_fk` FOREIGN KEY (`council_id`) REFERENCES `councils` (`council_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `streets` (
  `street_id`   INT(11)       NOT NULL AUTO_INCREMENT,
  `ward_id`     INT(11)       NOT NULL,
  `name`        VARCHAR(150)  NOT NULL,
  PRIMARY KEY (`street_id`),
  UNIQUE KEY `uq_street_ward_name` (`ward_id`, `name`),
  CONSTRAINT `streets_ward_fk` FOREIGN KEY (`ward_id`) REFERENCES `wards` (`ward_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- What kind of point it is (Camera Poles, Electric Poles, ...). Shared by all projects.
CREATE TABLE IF NOT EXISTS `geo_layers` (
  `layer_id`    INT(11)       NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(100)  NOT NULL,
  `color`       VARCHAR(9)    NOT NULL DEFAULT '#2563eb',
  `status`      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  PRIMARY KEY (`layer_id`),
  UNIQUE KEY `uq_geo_layer_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `geo_points` (
  `point_id`    INT(11)       NOT NULL AUTO_INCREMENT,
  `project_id`  INT(11)       NOT NULL,
  `layer_id`    INT(11)       NOT NULL,
  `ward_id`     INT(11)       NOT NULL,
  `street_id`   INT(11)       DEFAULT NULL,
  `point_no`    VARCHAR(50)   DEFAULT NULL,
  `road_name`   VARCHAR(255)  DEFAULT NULL,
  `description` TEXT          DEFAULT NULL,
  `global_id`   VARCHAR(64)   DEFAULT NULL COMMENT 'ID from the source GIS file; lets a re-upload update instead of duplicate',
  `latitude`    DECIMAL(9,6)  NOT NULL,
  `longitude`   DECIMAL(9,6)  NOT NULL,
  `status`      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_by`  INT(11)       DEFAULT NULL,
  `created_at`  TIMESTAMP     NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`point_id`),
  UNIQUE KEY `uq_geo_point_global` (`project_id`, `global_id`),
  KEY `idx_geo_project_layer` (`project_id`, `layer_id`),
  KEY `idx_geo_ward`   (`ward_id`),
  KEY `idx_geo_street` (`street_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT IGNORE INTO `geo_layers` (`name`, `color`) VALUES
  ('Camera Poles',   '#2563eb'),
  ('Electric Poles', '#f59e0b'),
  ('TTCL Closure',   '#10b981');
