const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const userModel = require('../models/user.model');
const emailModel = require('../models/email.model');
const crypto = require('crypto');

const createUser = catchAsync(async (req, res) => {
  // Generate temp password if not provided
  if (!req.body.password) {
    req.body.password = crypto.randomBytes(8).toString('hex');
    // Send welcome email with temp credentials
    const user = await userModel.createUser(req.body, req.user.user_id);
    await emailModel.sendWelcomeEmail(user.email, user.full_name, user.username, req.body.password).catch(() => {});
    return res.status(httpStatus.CREATED).send(user);
  }
  const user = await userModel.createUser(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).send(user);
});

const getUsers = catchAsync(async (req, res) => {
  const result = await userModel.getUsers(req.query);
  res.send(result);
});

const getUser = catchAsync(async (req, res) => {
  const user = await userModel.getUserById(req.params.userId);
  res.send(user);
});

const updateUser = catchAsync(async (req, res) => {
  const user = await userModel.updateUser(req.params.userId, req.body);
  res.send(user);
});

const deleteUser = catchAsync(async (req, res) => {
  await userModel.deleteUser(req.params.userId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = { createUser, getUsers, getUser, updateUser, deleteUser };
