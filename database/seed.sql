-- Seed: Initial admin user
-- Password: Admin@1234 (bcrypt hash)
-- Change this after first login!

INSERT INTO `users` (full_name, username, email, gender, password_hash, role, status, must_change_password)
VALUES (
  'System Administrator',
  'admin',
  'admin@tpfcs.go.tz',
  'male',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: password (change!)
  'admin',
  'active',
  1
)
ON DUPLICATE KEY UPDATE username = username;
