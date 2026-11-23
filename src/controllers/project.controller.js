const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const projectModel = require('../models/project.model');

const createProject = catchAsync(async (req, res) => {
  const project = await projectModel.createProject(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).send(project);
});

const getProjects = catchAsync(async (req, res) => {
  const filters = { ...req.query };
  if (req.user.role === 'guest') filters.project_ids = req.guestProjectIds || [];
  const result = await projectModel.getProjects(filters);
  res.send(result);
});

const getProject = catchAsync(async (req, res) => {
  const project = await projectModel.getProjectById(req.params.projectId);
  res.send(project);
});

const updateProject = catchAsync(async (req, res) => {
  const project = await projectModel.updateProject(req.params.projectId, req.body, req.user.user_id);
  res.send(project);
});

const deleteProject = catchAsync(async (req, res) => {
  await projectModel.deleteProject(req.params.projectId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = { createProject, getProjects, getProject, updateProject, deleteProject };
