-- Inspection Checklist Seeds — Hardware & Software default templates
-- Run after migrations 011 and 011b

SET @hw_id = NULL;
SET @sw_id = NULL;

-- ── Hardware Inspection Checklist ─────────────────────────────────────────────
INSERT INTO `inspection_checklists` (checklist_name, inspection_type, description, status, created_by)
VALUES ('Hardware Inspection — Default Template', 'GRI',
        'Standard hardware goods receiving inspection checklist', 'active', 1);

SET @hw_id = LAST_INSERT_ID();

INSERT INTO `checklist_items`
  (checklist_id, item_title, item_description, item_order, response_type, is_required, requires_comment)
VALUES
  (@hw_id, 'Physical condition verified',    'Check for dents, scratches, or physical damage',          1,  'pass_fail', 1, 1),
  (@hw_id, 'Quantity matches order',          'Count items and verify against purchase order',           2,  'pass_fail', 1, 1),
  (@hw_id, 'Model number verified',           'Confirm model number matches order specification',        3,  'pass_fail', 1, 0),
  (@hw_id, 'Serial number verified',          'Record and verify serial numbers for all units',          4,  'text',      1, 0),
  (@hw_id, 'Packaging condition checked',     'Original packaging intact and undamaged',                 5,  'pass_fail', 1, 1),
  (@hw_id, 'Accessories included',            'All listed accessories present (cables, adapters, etc.)', 6,  'pass_fail', 1, 1),
  (@hw_id, 'Power test completed',            'Device powers on and off successfully',                   7,  'pass_fail', 1, 1),
  (@hw_id, 'Device functionality verified',   'Core features operate as expected',                       8,  'pass_fail', 1, 1),
  (@hw_id, 'Camera functionality checked',    'If applicable — camera captures and displays correctly',  9,  'yes_no',    0, 0),
  (@hw_id, 'Network ports tested',            'If applicable — LAN/WAN ports functional',                10, 'yes_no',    0, 0),
  (@hw_id, 'Warranty card available',         'Warranty documentation present',                          11, 'yes_no',    1, 0),
  (@hw_id, 'User manuals included',           'Printed or digital user manuals provided',                12, 'yes_no',    0, 0),
  (@hw_id, 'No visible damage',               'No external or internal visible damage',                  13, 'pass_fail', 1, 1),
  (@hw_id, 'Correct branding verified',       'Brand markings match specification',                      14, 'pass_fail', 1, 0),
  (@hw_id, 'Safety compliance checked',       'CE/RoHS/safety markings present where required',          15, 'pass_fail', 1, 1);

-- ── Software Inspection Checklist ─────────────────────────────────────────────
INSERT INTO `inspection_checklists` (checklist_name, inspection_type, description, status, created_by)
VALUES ('Software Inspection — Default Template', 'GRI',
        'Standard software delivery and activation inspection checklist', 'active', 1);

SET @sw_id = LAST_INSERT_ID();

INSERT INTO `checklist_items`
  (checklist_id, item_title, item_description, item_order, response_type, is_required, requires_comment)
VALUES
  (@sw_id, 'Correct software version verified', 'Version number matches purchase order specification',    1,  'pass_fail', 1, 0),
  (@sw_id, 'License key provided',              'All license keys received and documented',               2,  'text',      1, 0),
  (@sw_id, 'Installation successful',           'Software installs without errors on target environment', 3,  'pass_fail', 1, 1),
  (@sw_id, 'Activation successful',             'License activates and registers correctly',              4,  'pass_fail', 1, 1),
  (@sw_id, 'User access verified',              'Required user accounts created and accessible',          5,  'pass_fail', 1, 0),
  (@sw_id, 'Required modules available',        'All contracted modules/features accessible',             6,  'pass_fail', 1, 1),
  (@sw_id, 'Security settings configured',      'Default security settings applied per spec',             7,  'pass_fail', 1, 0),
  (@sw_id, 'Performance test completed',        'Basic performance benchmarks met',                       8,  'pass_fail', 0, 1),
  (@sw_id, 'Compatibility verified',            'Compatible with existing infrastructure',                9,  'pass_fail', 1, 1),
  (@sw_id, 'Documentation provided',            'User guides, admin manuals received',                    10, 'yes_no',    1, 0),
  (@sw_id, 'Backup/restore tested',             'If applicable — backup and restore process verified',    11, 'yes_no',    0, 1),
  (@sw_id, 'Authentication working',            'Login, MFA, and roles function correctly',               12, 'pass_fail', 1, 1),
  (@sw_id, 'Expiry/subscription verified',      'License expiry date confirmed and documented',           13, 'text',      1, 0),
  (@sw_id, 'Virus/malware scan completed',      'Installation media scanned — no threats detected',       14, 'pass_fail', 1, 1);

-- ── Factory Assessment — Hardware Template ─────────────────────────────────────
INSERT INTO `inspection_checklists` (checklist_name, inspection_type, description, status, created_by)
VALUES ('Factory Assessment — Hardware', 'FA',
        'Pre-shipment factory assessment for hardware products', 'active', 1);

SET @fa_id = LAST_INSERT_ID();

INSERT INTO `checklist_items`
  (checklist_id, item_title, item_description, item_order, response_type, is_required, requires_comment)
VALUES
  (@fa_id, 'Factory certification verified',   'ISO or relevant certifications confirmed',               1,  'pass_fail', 1, 0),
  (@fa_id, 'Production line inspection done',  'Production line meets quality standards',                2,  'pass_fail', 1, 1),
  (@fa_id, 'Sample unit functionality tested', 'Random sample units tested and passed',                  3,  'pass_fail', 1, 1),
  (@fa_id, 'Quantity count verified',          'Production output matches order quantity',               4,  'number',    1, 0),
  (@fa_id, 'Packaging standards confirmed',    'Export packaging meets requirements',                    5,  'pass_fail', 1, 0),
  (@fa_id, 'Shipping documents prepared',      'Commercial invoice, packing list ready',                 6,  'yes_no',    1, 0),
  (@fa_id, 'Export compliance verified',       'Customs and export regulations met',                     7,  'pass_fail', 1, 1),
  (@fa_id, 'Photo documentation taken',        'Factory floor and product photos captured',              8,  'photo',     1, 0);
