const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth');
const siteController = require('../../controllers/site.controller');

router.route('/:siteId')
  .get(auth('getProjects'), siteController.getSite)
  .patch(auth('manageProjects'), siteController.updateSite)
  .delete(auth('manageProjects'), siteController.deleteSite);

module.exports = router;
