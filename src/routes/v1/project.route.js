const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validate = require('../../middlewares/validate');
const auth = require('../../middlewares/auth');
const projectController = require('../../controllers/project.controller');
const objectiveController = require('../../controllers/objective.controller');
const documentController = require('../../controllers/document.controller');
const siteController = require('../../controllers/site.controller');
const planController = require('../../controllers/plan.controller');
const upload = require('../../middlewares/upload');
const multer = require('multer');
const httpStatus = require('http-status');
const ApiError = require('../../utils/ApiError');

// Plan files are only parsed, never kept, so they stay in memory.
const planUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.xlsx$/i.test(file.originalname);
    cb(ok ? null : new ApiError(httpStatus.BAD_REQUEST, 'Only .xlsx files are accepted for plan import'), ok);
  },
});

const siteSchema = {
  body: Joi.object().keys({
    region_id:    Joi.number().integer().optional().allow(null),
    objective_id: Joi.number().integer().optional().allow(null),
    site_name:    Joi.string().required(),
    district:     Joi.string().optional().allow('', null),
    ward:         Joi.string().optional().allow('', null),
    street:       Joi.string().optional().allow('', null),
    road_name:    Joi.string().optional().allow('', null),
    description:  Joi.string().optional().allow('', null),
    latitude:     Joi.number().optional().allow(null),
    longitude:    Joi.number().optional().allow(null),
    status:       Joi.string().valid('planned', 'active', 'completed', 'on_hold').optional(),
  }),
};

const coordinatorSchema = Joi.object({
  full_name:    Joi.string().required(),
  email:        Joi.string().email().optional().allow('', null),
  phone_number: Joi.string().optional().allow('', null),
  address:      Joi.string().optional().allow('', null),
});

const employmentSchema = Joi.object({
  category:       Joi.string().required(),
  type:           Joi.string().required(),
  foreign_count:  Joi.number().integer().min(0).optional().default(0),
  domestic_count: Joi.number().integer().min(0).optional().default(0),
});

const financingSchema = Joi.object({
  fund_source:        Joi.string().optional().allow('', null),
  financial_modality: Joi.string().optional().allow('', null),
  financial_category: Joi.string().optional().allow('', null),
  financier:          Joi.string().optional().allow('', null),
  committed_amount:   Joi.number().optional().allow(null),
  exchange_rate:      Joi.number().optional().allow(null),
  currency:           Joi.string().max(10).optional().allow('', null),
});

const regionSchema = Joi.alternatives().try(
  Joi.number().integer(),
  Joi.object({
    region_id:   Joi.number().integer().required(),
    district:    Joi.string().optional().allow('', null),
    ward:        Joi.string().optional().allow('', null),
    description: Joi.string().optional().allow('', null),
    latitude:    Joi.number().optional().allow(null),
    longitude:   Joi.number().optional().allow(null),
  })
);

const projectSchema = {
  body: Joi.object().keys({
    name:                   Joi.string().required(),
    programme_name:         Joi.string().optional().allow('', null),
    project_nature:         Joi.string().optional().allow('', null),
    sector_id:              Joi.number().integer().optional().allow(null),
    sub_sector:             Joi.string().optional().allow('', null),
    start_date:             Joi.date().optional().allow(null),
    end_date:               Joi.date().optional().allow(null),
    // Financing
    fund_structure:         Joi.string().optional().allow('', null),
    financial_modality:     Joi.string().optional().allow('', null),
    financial_category:     Joi.string().optional().allow('', null),
    financier:              Joi.string().optional().allow('', null),
    committed_amount:       Joi.number().optional().allow(null),
    exchange_rate:          Joi.number().optional().allow(null),
    currency:               Joi.string().max(10).optional().allow('', null),
    funding:                Joi.string().optional().allow('', null),
    estimated_cost:         Joi.number().optional().allow(null),
    project_life_span:      Joi.number().integer().optional().allow(null),
    // Narrative fields
    project_background:     Joi.string().optional().allow('', null),
    project_objectives:     Joi.string().optional().allow('', null),
    project_main_activities:Joi.string().optional().allow('', null),
    project_beneficiaries:  Joi.string().optional().allow('', null),
    project_use_capacity:   Joi.string().optional().allow('', null),
    project_scope:          Joi.string().optional().allow('', null),
    // Admin
    cost_center:            Joi.string().optional().allow('', null),
    project_reference:      Joi.string().optional().allow('', null),
    relevancy_fypds:        Joi.string().optional().allow('', null),
    implementation_modality:Joi.string().optional().allow('', null),
    compensation:           Joi.string().optional().allow('', null),
    has_land:               Joi.number().valid(0, 1).optional(),
    job_created_no:         Joi.string().optional().allow('', null),
    project_manager_id:     Joi.number().integer().optional().allow(null),
    // Relations
    regions:                Joi.array().items(regionSchema).optional(),
    implementers:           Joi.array().items(Joi.object()).optional(),
    coordinators:           Joi.array().items(coordinatorSchema).optional(),
    employment:             Joi.array().items(employmentSchema).optional(),
    financing:              Joi.array().items(financingSchema).optional(),
  }),
};

// Implementation plan (WBS): template, import, view, export.
// These fixed paths must stay above '/:projectId'.
router.get('/plan/template', auth('getProjects'), planController.downloadTemplate);
router.post('/plan/import', auth('manageProjects'), planUpload.single('file'), planController.importPlan);
router.post('/:projectId/plan/import', auth('manageProjects'), planUpload.single('file'), planController.importPlan);
router.get('/:projectId/plan', auth('getProjects'), planController.getPlan);
router.get('/:projectId/plan/export.xlsx', auth('getProjects'), planController.exportExcel);
router.get('/:projectId/plan/export.pdf', auth('getProjects'), planController.exportPdf);

router.route('/')
  .post(auth('manageProjects'), validate(projectSchema), projectController.createProject)
  .get(auth('getProjects'), projectController.getProjects);

router.route('/:projectId')
  .get(auth('getProjects'), projectController.getProject)
  .patch(auth('manageProjects'), projectController.updateProject)
  .delete(auth('manageProjects'), projectController.deleteProject);

// Objectives nested
router.route('/:projectId/objectives')
  .post(auth('manageProjects'), objectiveController.createObjective)
  .get(auth('getProjects'), objectiveController.getObjectivesByProject);

// Documents nested
router.route('/:projectId/documents')
  // any signed-in user may reach the route; the controller allows only admin / this project's manager
  .post(auth('getProjects'), upload.single('file'), documentController.uploadDocument)
  .get(auth('getProjects'), documentController.getDocumentsByProject);

// Sites nested
router.route('/:projectId/sites')
  .post(auth('manageProjects'), validate(siteSchema), siteController.createSite)
  .get(auth('getProjects'), siteController.getSitesByProject);

module.exports = router;
