const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const siteModel = require('../models/site.model');

const createSite = catchAsync(async (req, res) => {
  const site = await siteModel.createSite(
    { ...req.body, project_id: req.params.projectId },
    req.user.user_id
  );
  res.status(httpStatus.CREATED).send(site);
});

const getSitesByProject = catchAsync(async (req, res) => {
  const sites = await siteModel.getSitesByProject(req.params.projectId);
  res.send(sites);
});

const getSite = catchAsync(async (req, res) => {
  const site = await siteModel.getSiteById(req.params.siteId);
  res.send(site);
});

const updateSite = catchAsync(async (req, res) => {
  const site = await siteModel.updateSite(req.params.siteId, req.body);
  res.send(site);
});

const deleteSite = catchAsync(async (req, res) => {
  await siteModel.deleteSite(req.params.siteId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = { createSite, getSitesByProject, getSite, updateSite, deleteSite };
