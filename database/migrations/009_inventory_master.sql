-- Migration 009: Inventory Master Data (Phase 1)
-- Suppliers, Products/Equipment, Store Locations

-- ── Product Categories (lookup) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `product_categories` (
  `category_id`  INT(11)      NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(255) NOT NULL,
  `product_type` ENUM('hardware','software','both') NOT NULL DEFAULT 'both',
  `description`  TEXT         DEFAULT NULL,
  `created_at`   TIMESTAMP    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`category_id`),
  UNIQUE KEY `uq_category_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Seed common categories
INSERT IGNORE INTO `product_categories` (name, product_type) VALUES
  ('Computers & Laptops',    'hardware'),
  ('Networking Equipment',   'hardware'),
  ('Office Furniture',       'hardware'),
  ('Printers & Scanners',    'hardware'),
  ('Servers & Storage',      'hardware'),
  ('Power & UPS',            'hardware'),
  ('Tools & Equipment',      'hardware'),
  ('Vehicles',               'hardware'),
  ('Operating Systems',      'software'),
  ('Office Software',        'software'),
  ('Security Software',      'software'),
  ('Enterprise Software',    'software'),
  ('Miscellaneous Hardware', 'hardware'),
  ('Miscellaneous Software', 'software'),
  -- Camera group
  ('CCTV Cameras',           'hardware'),
  ('IP Cameras',             'hardware'),
  ('Analog Cameras',         'hardware'),
  ('Wireless Cameras',       'hardware'),
  ('Security Camera Systems','hardware');

-- ── Suppliers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `suppliers` (
  `supplier_id`    INT(11)       NOT NULL AUTO_INCREMENT,
  `company_name`   VARCHAR(255)  NOT NULL,
  `contact_person` VARCHAR(255)  DEFAULT NULL,
  `email`          VARCHAR(255)  DEFAULT NULL,
  `phone_number`   VARCHAR(50)   DEFAULT NULL,
  `address`        TEXT          DEFAULT NULL,
  `region_id`      INT(11)       DEFAULT NULL,
  `tax_number`     VARCHAR(100)  DEFAULT NULL,
  `notes`          TEXT          DEFAULT NULL,
  `status`         ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
  `created_by`     INT(11)       NOT NULL,
  `updated_by`     INT(11)       DEFAULT NULL,
  `created_at`     TIMESTAMP     NOT NULL DEFAULT current_timestamp(),
  `updated_at`     TIMESTAMP     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at`     TIMESTAMP     NULL DEFAULT NULL,
  PRIMARY KEY (`supplier_id`),
  UNIQUE KEY `uq_supplier_email` (`email`, `deleted_at`),
  KEY `idx_suppliers_region`  (`region_id`),
  KEY `idx_suppliers_status`  (`status`),
  KEY `idx_suppliers_deleted` (`deleted_at`),
  CONSTRAINT `suppliers_region_fk`
    FOREIGN KEY (`region_id`) REFERENCES `regions` (`region_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── Products / Equipment ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `products` (
  `product_id`    INT(11)       NOT NULL AUTO_INCREMENT,
  `sku_barcode`   VARCHAR(100)  DEFAULT NULL,
  `product_name`  VARCHAR(255)  NOT NULL,
  `product_type`  ENUM('hardware','software') NOT NULL,
  `category_id`   INT(11)       DEFAULT NULL,
  `brand`         VARCHAR(255)  DEFAULT NULL,
  `unit_type`     VARCHAR(50)   DEFAULT NULL COMMENT 'e.g. piece, set, box, license',
  `purchase_price` DECIMAL(18,2) DEFAULT NULL,
  `description`   TEXT          DEFAULT NULL,
  `status`        ENUM('active','inactive','discontinued') NOT NULL DEFAULT 'active',
  `created_by`    INT(11)       NOT NULL,
  `updated_by`    INT(11)       DEFAULT NULL,
  `created_at`    TIMESTAMP     NOT NULL DEFAULT current_timestamp(),
  `updated_at`    TIMESTAMP     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at`    TIMESTAMP     NULL DEFAULT NULL,
  PRIMARY KEY (`product_id`),
  UNIQUE KEY `uq_product_sku` (`sku_barcode`, `deleted_at`),
  KEY `idx_products_category`    (`category_id`),
  KEY `idx_products_type`        (`product_type`),
  KEY `idx_products_status`      (`status`),
  KEY `idx_products_deleted`     (`deleted_at`),
  CONSTRAINT `products_category_fk`
    FOREIGN KEY (`category_id`) REFERENCES `product_categories` (`category_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── Store Locations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `stores` (
  `store_id`       INT(11)       NOT NULL AUTO_INCREMENT,
  `store_name`     VARCHAR(255)  NOT NULL,
  `region_id`      INT(11)       NOT NULL,
  `address`        TEXT          DEFAULT NULL,
  `latitude`       DECIMAL(10,6) DEFAULT NULL,
  `longitude`      DECIMAL(10,6) DEFAULT NULL,
  `contact_number` VARCHAR(50)   DEFAULT NULL,
  `manager_name`   VARCHAR(255)  DEFAULT NULL,
  `capacity`       INT(11)       DEFAULT NULL COMMENT 'Storage capacity in units',
  `notes`          TEXT          DEFAULT NULL,
  `status`         ENUM('active','inactive','maintenance') NOT NULL DEFAULT 'active',
  `created_by`     INT(11)       NOT NULL,
  `updated_by`     INT(11)       DEFAULT NULL,
  `created_at`     TIMESTAMP     NOT NULL DEFAULT current_timestamp(),
  `updated_at`     TIMESTAMP     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at`     TIMESTAMP     NULL DEFAULT NULL,
  PRIMARY KEY (`store_id`),
  KEY `idx_stores_region`  (`region_id`),
  KEY `idx_stores_status`  (`status`),
  KEY `idx_stores_deleted` (`deleted_at`),
  CONSTRAINT `stores_region_fk`
    FOREIGN KEY (`region_id`) REFERENCES `regions` (`region_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
