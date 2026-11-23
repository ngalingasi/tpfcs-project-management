const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const userModel  = require('../models/user.model');
const emailModel = require('../models/email.model');
const ApiError   = require('../utils/ApiError');

const createUser = catchAsync(async (req, res) => {
  if (!req.body.password) {
    // No password typed: use the configured default (or a random one) and show it once to the admin
    const { password } = userModel.pickPassword();
    req.body.password = password;
    const user = await userModel.createUser(req.body, req.user.user_id);
    if (user.email) await emailModel.sendWelcomeEmail(user.email, user.full_name, user.username, password).catch(() => {});
    return res.status(httpStatus.CREATED).send({ ...user, temporary_password: password });
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

const resetPassword = catchAsync(async (req, res) => {
  if (Number(req.params.userId) === Number(req.user.user_id)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Use Change password to change your own password');
  }
  res.send(await userModel.resetPassword(req.params.userId));
});

const deleteUser = catchAsync(async (req, res) => {
  await userModel.deleteUser(req.params.userId);
  res.status(httpStatus.NO_CONTENT).send();
});

const getSkills = catchAsync(async (req, res) => {
  const skills = await userModel.getSkills();
  res.send(skills);
});

const updateSkills = catchAsync(async (req, res) => {
  await userModel.updateUserSkills(req.params.userId, req.body.skill_ids ?? []);
  const user = await userModel.getUserById(req.params.userId);
  res.send(user);
});

// Single clean export — no Object.assign
module.exports = { resetPassword, createUser, getUsers, getUser, updateUser, deleteUser, getSkills, updateSkills };
