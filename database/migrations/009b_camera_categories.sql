-- Migration 009b: Add Camera categories (run if 009 was already executed)
INSERT IGNORE INTO `product_categories` (name, product_type) VALUES
  ('CCTV Cameras',            'hardware'),
  ('IP Cameras',              'hardware'),
  ('Analog Cameras',          'hardware'),
  ('Wireless Cameras',        'hardware'),
  ('Security Camera Systems', 'hardware');
