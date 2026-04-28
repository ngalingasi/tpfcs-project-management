const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const activityModel = require('../models/activity.model');

const createActivity = catchAsync(async (req, res) => {
  const activity = await activityModel.createActivity(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).send(activity);
});

const getActivities = catchAsync(async (req, res) => {
  const result = await activityModel.getActivities(req.query);
  res.send(result);
});

const getActivity = catchAsync(async (req, res) => {
  const activity = await activityModel.getActivityById(req.params.activityId);
  res.send(activity);
});

const updateActivity = catchAsync(async (req, res) => {
  const activity = await activityModel.updateActivity(req.params.activityId, req.body, req.user.user_id);
  res.send(activity);
});

const deleteActivity = catchAsync(async (req, res) => {
  await activityModel.deleteActivity(req.params.activityId);
  res.status(httpStatus.NO_CONTENT).send();
});

const getStatusHistory = catchAsync(async (req, res) => {
  const history = await activityModel.getActivityStatusHistory(req.params.activityId);
  res.send(history);
});

module.exports = { createActivity, getActivities, getActivity, updateActivity, deleteActivity, getStatusHistory };
