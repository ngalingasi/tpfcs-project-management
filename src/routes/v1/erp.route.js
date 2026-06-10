const express   = require('express');
const router    = express.Router();
const erpSecret = require('../../middlewares/erpSecret');
const ctrl      = require('../../controllers/erp.controller');

// All routes protected by ERP secret
router.use(erpSecret);
router.post('/lookup-user', ctrl.lookupUser);

module.exports = router;
