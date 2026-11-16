const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const planModel = require('../models/plan.model');
const { buildTemplateWorkbook, buildPlanWorkbook, streamPlanPdf } = require('../utils/planExport');

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const safeName = (s) => String(s || 'plan').replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'plan';
const isTrue = (v) => v === true || v === 'true' || v === '1' || v === 'on';
const emptyToNull = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
const numOrNull = (v) => (emptyToNull(v) === null ? null : Number(v));

const downloadTemplate = catchAsync(async (req, res) => {
  const wb = await buildTemplateWorkbook();
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', 'attachment; filename="project-plan-template.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

const getPlan = catchAsync(async (req, res) => {
  res.send(await planModel.getPlan(req.params.projectId));
});

/**
 * POST /projects/:projectId/plan/import   -> into an existing project
 * POST /projects/plan/import              -> creates a new project
 * multipart fields: file, start_date, dry_run, [project_name, estimated_cost, sector_id, project_manager_id]
 */
const importPlan = catchAsync(async (req, res) => {
  if (!req.file) throw new ApiError(httpStatus.BAD_REQUEST, 'Attach the plan as an .xlsx file in the "file" field');
  const projectId = req.params.projectId ? Number(req.params.projectId) : null;
  const b = req.body || {};

  const result = await planModel.importPlan({
    buffer: req.file.buffer,
    user: req.user,
    projectId,
    newProject: projectId ? null : {
      name: emptyToNull(b.project_name),
      start_date: emptyToNull(b.start_date),
      estimated_cost: numOrNull(b.estimated_cost),
      sector_id: numOrNull(b.sector_id),
      project_manager_id: numOrNull(b.project_manager_id),
    },
    startDate: emptyToNull(b.start_date),
    // Safe default: anything that does not explicitly say dry_run=false is only a preview.
    dryRun: b.dry_run === undefined ? true : isTrue(b.dry_run),
  });

  // Validation problems are a normal outcome, so they are returned as data (200 for preview, 422 for a real import).
  res.status(result.ok ? (result.imported ? httpStatus.CREATED : httpStatus.OK) : httpStatus.UNPROCESSABLE_ENTITY).send(result);
});

const exportExcel = catchAsync(async (req, res) => {
  const plan = await planModel.getPlan(req.params.projectId);
  const wb = await buildPlanWorkbook(plan);
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${safeName(plan.project.name)}_plan.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

const exportPdf = catchAsync(async (req, res) => {
  const plan = await planModel.getPlan(req.params.projectId);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName(plan.project.name)}_plan.pdf"`);
  streamPlanPdf(plan, res);
});

const getDependencies = catchAsync(async (req, res) => {
  res.send(await planModel.getActivityDependencies(req.params.activityId));
});

const setDependencies = catchAsync(async (req, res) => {
  res.send(await planModel.setActivityPredecessors(req.params.activityId, req.body.predecessor_ids));
});

module.exports = { downloadTemplate, getPlan, importPlan, exportExcel, exportPdf, getDependencies, setDependencies };
