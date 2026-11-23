const express = require('express');
const Joi = require('joi');
const validate = require('../../middlewares/validate');
const auth = require('../../middlewares/auth');
const guestController = require('../../controllers/guest.controller');

const router = express.Router();

const projectIds = Joi.array().items(Joi.number().integer().positive()).max(200);

const createSchema = {
  body: Joi.object().keys({
    full_name:        Joi.string().required(),
    username:         Joi.string().alphanum().min(3).required(),
    email:            Joi.string().email().optional().allow('', null),
    mobile:           Joi.string().optional().allow('', null),
    organisation:     Joi.string().max(150).optional().allow('', null),
    password:         Joi.string().min(8).optional(),
    guest_expires_at: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().allow('', null),
    project_ids:      projectIds.required(),
  }),
};

const updateSchema = {
  params: Joi.object().keys({ userId: Joi.number().integer().required() }),
  body: Joi.object().keys({
    full_name:        Joi.string().optional(),
    email:            Joi.string().email().optional().allow('', null),
    mobile:           Joi.string().optional().allow('', null),
    organisation:     Joi.string().max(150).optional().allow('', null),
    status:           Joi.string().valid('active', 'inactive').optional(),
    guest_expires_at: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().allow('', null),
    project_ids:      projectIds.optional(),
  }).min(1),
};

// Admin only (manageUsers)
router.route('/')
  .get(auth('manageUsers'), guestController.listGuests)
  .post(auth('manageUsers'), validate(createSchema), guestController.createGuest);

router.route('/:userId')
  .get(auth('manageUsers'), guestController.getGuest)
  .patch(auth('manageUsers'), validate(updateSchema), guestController.updateGuest);

module.exports = router;
