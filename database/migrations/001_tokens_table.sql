-- Migration: Add tokens table for JWT refresh/reset/verify tokens
-- Run this against your tpfcs_projects database

CREATE TABLE IF NOT EXISTS `tokens` (
  `id`          int(11) NOT NULL AUTO_INCREMENT,
  `token`       varchar(512) NOT NULL,
  `user_id`     int(11) NOT NULL,
  `type`        enum('refresh','resetPassword','verifyEmail') NOT NULL,
  `expires`     datetime NOT NULL,
  `blacklisted` tinyint(1) NOT NULL DEFAULT 0,
  `created_at`  timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`(255)),
  KEY `idx_tokens_user_type` (`user_id`, `type`),
  CONSTRAINT `tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
