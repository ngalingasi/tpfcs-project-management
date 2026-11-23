const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const guestModel = require('../models/guest.model');
const emailModel = require('../models/email.model');

const listGuests = catchAsync(async (req, res) => res.send(await guestModel.listGuests()));
const getGuest = catchAsync(async (req, res) => res.send(await guestModel.getGuest(req.params.userId)));

const createGuest = catchAsync(async (req, res) => {
  const guest = await guestModel.createGuest(req.body, req.user.user_id);
  if (guest.email) await emailModel.sendWelcomeEmail(guest.email, guest.full_name, guest.username, guest.temporary_password).catch(() => {});
  res.status(httpStatus.CREATED).send(guest);
});

const updateGuest = catchAsync(async (req, res) =>
  res.send(await guestModel.updateGuest(req.params.userId, req.body, req.user.user_id)));

module.exports = { listGuests, getGuest, createGuest, updateGuest };
