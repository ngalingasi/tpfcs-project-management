-- Migration 009c: Inventory structure updates
-- 1. Remove purchase_price and selling_price from products (pricing belongs in Purchase Orders)
-- 2. Add country and currency to suppliers (global procurement support)

-- Remove pricing columns from products if they exist
ALTER TABLE `products`
  DROP COLUMN IF EXISTS `purchase_price`,
  DROP COLUMN IF EXISTS `selling_price`;

-- Add global supplier fields
ALTER TABLE `suppliers`
  ADD COLUMN IF NOT EXISTS `country`  VARCHAR(100) DEFAULT NULL
    COMMENT 'Supplier country — not limited to Tanzania, supports global suppliers'
    AFTER `region_id`,
  ADD COLUMN IF NOT EXISTS `currency` VARCHAR(10)  DEFAULT NULL
    COMMENT 'Preferred currency for this supplier (optional, e.g. USD, EUR, TZS)'
    AFTER `country`;
