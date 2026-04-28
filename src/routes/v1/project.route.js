const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { OBJECTIVE_STATUS_LIST } = require('../../config/statuses');
const validate = require('../../middlewares/validate');
const auth = require('../../middlewares/auth');
const projectController = require('../../controllers/project.controller');
const objectiveController = require('../../controllers/objective.controller');
const documentController = require('../../controllers/document.controller');
const upload = require('../../middlewares/upload');

const projectSchema = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    programme_name: Joi.string().optional().allow('', null),
    project_nature: Joi.string().optional().allow('', null),
    sector_id: Joi.number().integer().optional().allow(null),
    start_date: Joi.date().optional().allow(null),
    end_date: Joi.date().optional().allow(null),
    fund_structure: Joi.string().optional().allow('', null),
    funding: Joi.string().optional().allow('', null),
    estimated_cost: Joi.number().optional().allow(null),
    project_life_span: Joi.number().integer().optional().allow(null),
    project_background: Joi.string().optional().allow('', null),
    cost_center: Joi.string().optional().allow('', null),
    project_reference: Joi.string().optional().allow('', null),
    relevancy_fypds: Joi.string().optional().allow('', null),
    implementation_modality: Joi.string().optional().allow('', null),
    compensation: Joi.string().optional().allow('', null),
    job_created_no: Joi.string().optional().allow('', null),
    project_manager_id: Joi.number().integer().optional().allow(null),
    regions: Joi.array().items(Joi.number().integer()).optional(),
    implementers: Joi.array().items(Joi.object()).optional(),
  }),
};

// Projects CRUD
router.route('/')
  .post(auth('manageProjects'), validate(projectSchema), projectController.createProject)
  .get(auth('getProjects'), projectController.getProjects);

router.route('/:projectId')
  .get(auth('getProjects'), projectController.getProject)
  .patch(auth('manageProjects'), projectController.updateProject)
  .delete(auth('manageProjects'), projectController.deleteProject);

// Objectives (nested under project)
router.route('/:projectId/objectives')
  .post(auth('manageProjects'), objectiveController.createObjective)
  .get(auth('getProjects'), objectiveController.getObjectivesByProject);

// Documents (nested under project)
router.route('/:projectId/documents')
  .post(auth('manageProjects'), upload.single('file'), documentController.uploadDocument)
  .get(auth('getProjects'), documentController.getDocumentsByProject);

module.exports = router;
