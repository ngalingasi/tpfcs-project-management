-- ============================================================
-- Tanzania Regions Seeder
-- Seeds the `regions` lookup table with all 31 administrative
-- regions of Tanzania (26 Mainland + 5 Zanzibar).
-- Safe to re-run: adds a unique key (if missing) and uses
-- INSERT IGNORE so existing rows (e.g. Dar es Salaam, Mwanza,
-- Arusha, Dodoma, Kilimanjaro already seeded) are left untouched.
-- ============================================================

-- Ensure region_name is unique so INSERT IGNORE can dedupe safely.
-- (Wrapped so it doesn't error out if the key already exists.)
SET @key_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'regions'
    AND INDEX_NAME = 'uq_region_name'
);
SET @sql := IF(@key_exists = 0,
  'ALTER TABLE `regions` ADD UNIQUE KEY `uq_region_name` (`region_name`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── Seed: All Tanzania Regions ──────────────────────────────────────────────
INSERT IGNORE INTO `regions` (`region_name`) VALUES
  -- Mainland Tanzania (26 regions)
  ('Arusha'),
  ('Dar es Salaam'),
  ('Dodoma'),
  ('Geita'),
  ('Iringa'),
  ('Kagera'),
  ('Katavi'),
  ('Kigoma'),
  ('Kilimanjaro'),
  ('Lindi'),
  ('Manyara'),
  ('Mara'),
  ('Mbeya'),
  ('Morogoro'),
  ('Mtwara'),
  ('Mwanza'),
  ('Njombe'),
  ('Pwani'),
  ('Rukwa'),
  ('Ruvuma'),
  ('Shinyanga'),
  ('Simiyu'),
  ('Singida'),
  ('Songwe'),
  ('Tabora'),
  ('Tanga'),
  -- Zanzibar (5 regions)
  ('Kaskazini Pemba'),
  ('Kaskazini Unguja'),
  ('Kusini Pemba'),
  ('Kusini Unguja'),
  ('Mjini Magharibi');
