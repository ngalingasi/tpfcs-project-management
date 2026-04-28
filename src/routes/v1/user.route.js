const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validate = require('../../middlewares/validate');
const auth = require('../../middlewares/auth');
const userController = require('../../controllers/user.controller');

const createUserSchema = {
  body: Joi.object().keys({
    full_name: Joi.string().required(),
    username: Joi.string().alphanum().min(3).required(),
    email: Joi.string().email().optional(),
    mobile: Joi.string().optional(),
    gender: Joi.string().valid('male', 'female').optional(),
    role: Joi.string().valid('user', 'manager', 'admin').optional(),
    password: Joi.string().min(8).optional(),
  }),
};

const updateUserSchema = {
  params: Joi.object().keys({ userId: Joi.number().integer().required() }),
  body: Joi.object().keys({
    full_name: Joi.string().optional(),
    email: Joi.string().email().optional(),
    mobile: Joi.string().optional(),
    gender: Joi.string().valid('male', 'female').optional(),
    role: Joi.string().valid('user', 'manager', 'admin').optional(),
    status: Joi.string().valid('active', 'inactive').optional(),
  }).min(1),
};

router.route('/')
  .post(auth('manageUsers'), validate(createUserSchema), userController.createUser)
  .get(auth('getUsers'), userController.getUsers);

router.route('/:userId')
  .get(auth('getUsers'), userController.getUser)
  .patch(auth('manageUsers'), validate(updateUserSchema), userController.updateUser)
  .delete(auth('manageUsers'), userController.deleteUser);

module.exports = router;
