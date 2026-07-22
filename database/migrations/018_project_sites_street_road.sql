-- Migration 018: Add street/road to project_sites
-- These let a site pre-fill an activity's Location fields (street, road) in
-- addition to region/council/ward/lat/long when a site is selected during
-- activity creation.

ALTER TABLE `project_sites`
  ADD COLUMN `street`    VARCHAR(255) DEFAULT NULL AFTER `ward`,
  ADD COLUMN `road_name` VARCHAR(255) DEFAULT NULL AFTER `street`;
