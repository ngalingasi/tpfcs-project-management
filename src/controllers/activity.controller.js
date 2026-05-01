const httpStatus   = require('http-status');
const catchAsync   = require('../utils/catchAsync');
const activityService = require('../models/activity.model');

const createActivity = catchAsync(async (req, res) => {
  const activity = await activityService.createActivity(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).send(activity);
});

const getActivities = catchAsync(async (req, res) => {
  const result = await activityService.getActivities(req.query);
  res.send(result);
});

const getActivity = catchAsync(async (req, res) => {
  const activity = await activityService.getActivityById(req.params.activityId);
  res.send(activity);
});

const updateActivity = catchAsync(async (req, res) => {
  const activity = await activityService.updateActivity(req.params.activityId, req.body, req.user.user_id);
  res.send(activity);
});

const deleteActivity = catchAsync(async (req, res) => {
  await activityService.deleteActivity(req.params.activityId);
  res.status(httpStatus.NO_CONTENT).send();
});

const getStatusHistory = catchAsync(async (req, res) => {
  const history = await activityService.getActivityStatusHistory(req.params.activityId);
  res.send(history);
});

const getSubActivities = catchAsync(async (req, res) => {
  const subs = await activityService.getSubActivities(req.params.activityId);
  res.send(subs);
});

module.exports = {
  createActivity, getActivities, getActivity,
  updateActivity, deleteActivity, getStatusHistory, getSubActivities,
};
