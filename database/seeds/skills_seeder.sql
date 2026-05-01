-- ============================================================
-- Skills table + seed data
-- ============================================================

CREATE TABLE IF NOT EXISTS `skills` (
  `skill_id`    INT(11)      NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(255) NOT NULL,
  `category`    VARCHAR(100) DEFAULT NULL COMMENT 'e.g. Technical, Managerial, Field',
  `created_at`  TIMESTAMP    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`skill_id`),
  UNIQUE KEY `uq_skill_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- User skills junction table
CREATE TABLE IF NOT EXISTS `user_skills` (
  `id`         INT(11) NOT NULL AUTO_INCREMENT,
  `user_id`    INT(11) NOT NULL,
  `skill_id`   INT(11) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_skill` (`user_id`, `skill_id`),
  CONSTRAINT `user_skills_user_fk`  FOREIGN KEY (`user_id`)  REFERENCES `users`  (`user_id`)  ON DELETE CASCADE,
  CONSTRAINT `user_skills_skill_fk` FOREIGN KEY (`skill_id`) REFERENCES `skills` (`skill_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── Seed: Skills ─────────────────────────────────────────────────────────────
INSERT IGNORE INTO `skills` (name, category) VALUES
  -- Technical / Engineering
  ('Civil Engineering',             'Technical'),
  ('Electrical Engineering',        'Technical'),
  ('Mechanical Engineering',        'Technical'),
  ('Structural Engineering',        'Technical'),
  ('Water & Sanitation Engineering','Technical'),
  ('GIS & Surveying',               'Technical'),
  ('AutoCAD / Drafting',            'Technical'),
  ('Construction Supervision',      'Technical'),
  ('Borehole Drilling',             'Technical'),
  ('Road Construction',             'Technical'),
  ('Building Construction',         'Technical'),
  -- Project Management
  ('Project Management',            'Managerial'),
  ('Budget Management',             'Managerial'),
  ('Risk Management',               'Managerial'),
  ('Procurement & Contracts',       'Managerial'),
  ('M&E (Monitoring & Evaluation)', 'Managerial'),
  ('Report Writing',                'Managerial'),
  ('Stakeholder Engagement',        'Managerial'),
  ('Team Leadership',               'Managerial'),
  -- Field / Operations
  ('Field Supervision',             'Field'),
  ('Community Mobilization',        'Field'),
  ('Environmental Assessment',      'Field'),
  ('Social Impact Assessment',      'Field'),
  ('Labour Management',             'Field'),
  ('Health & Safety (HSE)',         'Field'),
  -- Finance / Admin
  ('Financial Management',          'Finance'),
  ('Accounting',                    'Finance'),
  ('Auditing',                      'Finance'),
  ('Public Administration',         'Finance'),
  -- IT
  ('Software Development',          'IT'),
  ('Database Administration',       'IT'),
  ('Network & Security',            'IT'),
  ('Data Analysis',                 'IT'),
  -- Legal
  ('Legal & Compliance',            'Legal'),
  ('Land Acquisition & Valuation',  'Legal');
