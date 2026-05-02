-- Migration 007: Activity comments table
CREATE TABLE IF NOT EXISTS `activity_comments` (
  `comment_id`  INT(11)      NOT NULL AUTO_INCREMENT,
  `activity_id` INT(11)      NOT NULL,
  `user_id`     INT(11)      NOT NULL,
  `comment`     TEXT         NOT NULL,
  `created_at`  TIMESTAMP    NOT NULL DEFAULT current_timestamp(),
  `updated_at`  TIMESTAMP    NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`comment_id`),
  KEY `idx_activity_comments_activity` (`activity_id`),
  KEY `idx_activity_comments_user` (`user_id`),
  CONSTRAINT `activity_comments_activity_fk` FOREIGN KEY (`activity_id`) REFERENCES `activities` (`activity_id`) ON DELETE CASCADE,
  CONSTRAINT `activity_comments_user_fk`     FOREIGN KEY (`user_id`)     REFERENCES `users`      (`user_id`)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
