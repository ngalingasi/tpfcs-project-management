-- ============================================================
-- Migration 003: Budget Management
-- ============================================================

-- 1. Add allocated_budget to targets
ALTER TABLE `targets`
  ADD COLUMN `allocated_budget`  DECIMAL(18,2) NOT NULL DEFAULT 0.00
    COMMENT 'Budget allocated from project to this target'
    AFTER `current_value`,
  ADD COLUMN `spent_amount`      DECIMAL(18,2) NOT NULL DEFAULT 0.00
    COMMENT 'Sum of all approved activity budgets under this target'
    AFTER `allocated_budget`;

-- 2. Add budget fields to activities
ALTER TABLE `activities`
  ADD COLUMN `budgeted_amount`   DECIMAL(18,2) NOT NULL DEFAULT 0.00
    COMMENT 'Original approved budget for this activity'
    AFTER `progress`,
  ADD COLUMN `revised_amount`    DECIMAL(18,2)          DEFAULT NULL
    COMMENT 'Latest approved revised budget (NULL = no revision yet)'
    AFTER `budgeted_amount`,
  ADD COLUMN `spent_amount`      DECIMAL(18,2) NOT NULL DEFAULT 0.00
    COMMENT 'Actual expenditure recorded against this activity'
    AFTER `revised_amount`;

-- 3. Budget revision requests
CREATE TABLE IF NOT EXISTS `budget_revisions` (
  `revision_id`       INT(11)        NOT NULL AUTO_INCREMENT,
  `activity_id`       INT(11)        NOT NULL,
  `requested_by`      INT(11)        NOT NULL,
  `current_amount`    DECIMAL(18,2)  NOT NULL COMMENT 'Budget at time of request',
  `requested_amount`  DECIMAL(18,2)  NOT NULL COMMENT 'Amount being requested',
  `difference`        DECIMAL(18,2)  GENERATED ALWAYS AS (`requested_amount` - `current_amount`) STORED,
  `reason`            TEXT           NOT NULL COMMENT 'Justification for extra budget',
  `status`            ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reviewed_by`       INT(11)                  DEFAULT NULL,
  `review_notes`      TEXT                     DEFAULT NULL,
  `reviewed_at`       DATETIME                 DEFAULT NULL,
  `created_at`        TIMESTAMP      NOT NULL  DEFAULT current_timestamp(),
  PRIMARY KEY (`revision_id`),
  KEY `idx_budget_revisions_activity`  (`activity_id`),
  KEY `idx_budget_revisions_status`    (`status`),
  CONSTRAINT `budget_revisions_activity_fk`
    FOREIGN KEY (`activity_id`) REFERENCES `activities` (`activity_id`) ON DELETE CASCADE,
  CONSTRAINT `budget_revisions_requested_fk`
    FOREIGN KEY (`requested_by`) REFERENCES `users` (`user_id`),
  CONSTRAINT `budget_revisions_reviewed_fk`
    FOREIGN KEY (`reviewed_by`)  REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. Project budget summary view (handy for dashboards)
CREATE OR REPLACE VIEW `v_project_budget_summary` AS
SELECT
  p.project_id,
  p.name                                        AS project_name,
  p.estimated_cost                              AS total_budget,
  COALESCE(SUM(t.allocated_budget), 0)          AS allocated_to_targets,
  p.estimated_cost - COALESCE(SUM(t.allocated_budget), 0) AS unallocated_budget,
  COALESCE(SUM(t.spent_amount), 0)              AS total_spent,
  p.estimated_cost - COALESCE(SUM(t.spent_amount), 0)     AS remaining_budget,
  CASE
    WHEN p.estimated_cost = 0 THEN 0
    ELSE ROUND(COALESCE(SUM(t.spent_amount), 0) / p.estimated_cost * 100, 2)
  END                                           AS spent_percentage
FROM projects p
LEFT JOIN objectives o  ON o.project_id  = p.project_id
LEFT JOIN targets t     ON t.objective_id = o.objective_id
GROUP BY p.project_id, p.name, p.estimated_cost;

-- 5. Target budget summary view
CREATE OR REPLACE VIEW `v_target_budget_summary` AS
SELECT
  t.target_id,
  t.name                                           AS target_name,
  t.allocated_budget,
  COALESCE(SUM(a.budgeted_amount), 0)              AS committed_to_activities,
  t.allocated_budget - COALESCE(SUM(a.budgeted_amount), 0) AS available_budget,
  t.spent_amount                                   AS total_spent,
  CASE
    WHEN t.allocated_budget = 0 THEN 0
    ELSE ROUND(t.spent_amount / t.allocated_budget * 100, 2)
  END                                              AS spent_percentage
FROM targets t
LEFT JOIN activities a ON a.target_id = t.target_id
GROUP BY t.target_id, t.name, t.allocated_budget, t.spent_amount;
