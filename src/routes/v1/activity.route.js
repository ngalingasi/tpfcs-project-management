const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validate = require('../../middlewares/validate');
const auth = require('../../middlewares/auth');
const activityController = require('../../controllers/activity.controller');
const { ACTIVITY_STATUS_LIST } = require('../../config/statuses');

const activitySchema = {
  body: Joi.object().keys({
    target_id:        Joi.number().integer().required(),
    region_id:        Joi.number().integer().optional().allow(null),
    name:             Joi.string().required(),
    description:      Joi.string().optional().allow('', null),
    main_activity_id: Joi.number().integer().optional().allow(null),
    council:          Joi.string().optional().allow('', null),
    ward:             Joi.string().optional().allow('', null),
    street:           Joi.string().optional().allow('', null),
    road_name:        Joi.string().optional().allow('', null),
    latitude:         Joi.number().optional().allow(null),
    longitude:        Joi.number().optional().allow(null),
    global_id:        Joi.string().optional().allow('', null),
    assigned_user_id: Joi.number().integer().optional().allow(null),
    supervisor_id:    Joi.number().integer().optional().allow(null),
    start_date:       Joi.date().optional().allow(null),
    end_date:         Joi.date().optional().allow(null),
    status:           Joi.string().valid(...ACTIVITY_STATUS_LIST).optional(),
    budgeted_amount:  Joi.number().positive().required()
      .description('Budget allocated to this activity — must not exceed target available budget'),
  }),
};

const updateActivitySchema = {
  params: Joi.object().keys({
    activityId: Joi.number().integer().required(),
  }),
  body: Joi.object().keys({
    // Location & identity fields (editable after creation)
    name:             Joi.string().optional(),
    description:      Joi.string().optional().allow('', null),
    region_id:        Joi.number().integer().optional().allow(null),
    council:          Joi.string().optional().allow('', null),
    ward:             Joi.string().optional().allow('', null),
    street:           Joi.string().optional().allow('', null),
    road_name:        Joi.string().optional().allow('', null),
    latitude:         Joi.number().optional().allow(null),
    longitude:        Joi.number().optional().allow(null),
    global_id:        Joi.string().optional().allow('', null),
    // Assignment
    assigned_user_id: Joi.number().integer().optional().allow(null),
    supervisor_id:    Joi.number().integer().optional().allow(null),
    // Schedule
    start_date:       Joi.date().optional().allow(null),
    end_date:         Joi.date().optional().allow(null),
    // Progress & status
    progress:         Joi.number().min(0).max(100).optional(),
    status:           Joi.string().valid(...ACTIVITY_STATUS_LIST).optional(),
    // target_id is intentionally excluded — cannot change target after creation
    // budgeted_amount is intentionally excluded — must use budget revision request
  }).min(1),
};

router.route('/')
  .post(auth('manageActivities'), validate(activitySchema), activityController.createActivity)
  .get(auth('getActivities'), activityController.getActivities);

// IMPORTANT: /meta/statuses must come BEFORE /:activityId to avoid route conflict
router.get('/meta/statuses', auth(), (req, res) => {
  const { ACTIVITY_STATUS_TRANSITIONS } = require('../../config/statuses');
  res.send({
    statuses: ACTIVITY_STATUS_LIST,
    transitions: ACTIVITY_STATUS_TRANSITIONS,
  });
});

router.route('/:activityId')
  .get(auth('getActivities'), activityController.getActivity)
  .patch(auth('updateActivity'), validate(updateActivitySchema), activityController.updateActivity)
  .delete(auth('manageActivities'), activityController.deleteActivity);

router.get('/:activityId/history', auth('getActivities'), activityController.getStatusHistory);

module.exports = router;
