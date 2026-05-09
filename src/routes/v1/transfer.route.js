const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const validate = require('../../middlewares/validate');
const auth     = require('../../middlewares/auth');
const transfer    = require('../../controllers/transfer.controller');
const catchAsync  = require('../../utils/catchAsync');
const { query }   = require('../../config/database');

const itemSchema = Joi.object({ product_id: Joi.number().integer().required(), quantity: Joi.number().positive().required(), notes: Joi.string().optional().allow('',null) });

const createSchema = { body: Joi.object().keys({
  source_store_id:      Joi.number().integer().required(),
  destination_store_id: Joi.number().integer().required(),
  transfer_date:        Joi.date().required(),
  notes:                Joi.string().optional().allow('',null),
  requires_inspection:  Joi.boolean().optional(),
  requires_transit:     Joi.boolean().optional(),
  transit_method:       Joi.string().optional().allow('',null),
  transit_provider:     Joi.string().optional().allow('',null),
  tracking_number:      Joi.string().optional().allow('',null),
  expected_arrival_date:Joi.date().optional().allow(null),
  vehicle_information:  Joi.string().optional().allow('',null),
  driver_information:   Joi.string().optional().allow('',null),
  logistics_notes:      Joi.string().optional().allow('',null),
  items:                Joi.array().items(itemSchema).min(1).required(),
})};

// Stock levels for a store (used by transfer form for validation)
router.get('/store-stock/:storeId', auth('getInventory'), catchAsync(async (req, res) => {
  const rows = await query(
    `SELECT si.product_id, si.quantity, p.product_name, p.sku_barcode, p.unit_type
     FROM store_inventory si
     JOIN products p ON p.product_id = si.product_id
     WHERE si.store_id = ? AND si.quantity > 0
     ORDER BY p.product_name`,
    [req.params.storeId]
  );
  // Return as a map: product_id -> quantity
  const map = {};
  rows.forEach(r => { map[r.product_id] = { quantity: Number(r.quantity), product_name: r.product_name, sku_barcode: r.sku_barcode, unit_type: r.unit_type }; });
  res.json(map);
}));

router.route('/').get(auth('getInventory'), transfer.list).post(auth('manageInventory'), validate(createSchema), transfer.create);
router.route('/:id').get(auth('getInventory'), transfer.get).put(auth('manageInventory'), transfer.update);
router.post('/:id/approve',   auth('manageInventory'), transfer.approve);
router.post('/:id/dispatch',  auth('manageInventory'), transfer.dispatch);
router.post('/:id/receive',   auth('manageInventory'), transfer.receive);
router.post('/:id/cancel',    auth('manageInventory'), transfer.cancel);

module.exports = router;
