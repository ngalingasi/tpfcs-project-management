const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const authModel = require('../models/auth.model');
const tokenModel = require('../models/token.model');
const emailModel = require('../models/email.model');
const userModel = require('../models/user.model');

const login = catchAsync(async (req, res) => {
  const { login, password } = req.body;
  const user = await authModel.loginUser(login, password);
  const tokens = await tokenModel.generateAuthTokens(user);
  // Strip hash before sending
  const { password_hash, ...safeUser } = user;
  res.status(httpStatus.OK).send({ user: safeUser, tokens });
});

const logout = catchAsync(async (req, res) => {
  await authModel.logout(req.body.refreshToken);
  res.status(httpStatus.NO_CONTENT).send();
});

const refreshTokens = catchAsync(async (req, res) => {
  const tokens = await authModel.refreshAuth(req.body.refreshToken);
  res.send(tokens);
});

const forgotPassword = catchAsync(async (req, res) => {
  const resetToken = await tokenModel.generateResetPasswordToken(req.body.email);
  await emailModel.sendResetPasswordEmail(req.body.email, resetToken);
  res.status(httpStatus.NO_CONTENT).send();
});

const resetPassword = catchAsync(async (req, res) => {
  await authModel.resetPassword(req.query.token, req.body.password);
  res.status(httpStatus.NO_CONTENT).send();
});

const changePassword = catchAsync(async (req, res) => {
  await authModel.changePassword(req.user.user_id, req.body.currentPassword, req.body.newPassword);
  res.status(httpStatus.NO_CONTENT).send();
});

const getMe = catchAsync(async (req, res) => {
  res.send(req.user);
});

module.exports = { login, logout, refreshTokens, forgotPassword, resetPassword, changePassword, getMe };
