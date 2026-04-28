-- Migration 004: OTP Verifications table
CREATE TABLE IF NOT EXISTS `otp_verifications` (
  `id`         INT(11)      NOT NULL AUTO_INCREMENT,
  `email`      VARCHAR(255) NOT NULL,
  `otp_code`   VARCHAR(6)   NOT NULL,
  `expires_at` DATETIME     NOT NULL,
  `used`       TINYINT(1)   DEFAULT 0,
  `created_at` TIMESTAMP    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_otp_email`   (`email`),
  KEY `idx_otp_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
