const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const model      = require('../models/inspection.model');
const ApiError   = require('../utils/ApiError');

const canManage = (user) => {
  if (!['admin','manager'].includes(user.role)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only admins and managers can manage inspections');
  }
};

// ── Checklists ────────────────────────────────────────────────────────────────
const listChecklists  = catchAsync(async (req, res) => res.send(await model.getChecklists(req.query)));
const getChecklist    = catchAsync(async (req, res) => res.send(await model.getChecklistById(req.params.id)));
const createChecklist = catchAsync(async (req, res) => { canManage(req.user); res.status(httpStatus.CREATED).send(await model.createChecklist(req.body, req.user.user_id)); });
const updateChecklist = catchAsync(async (req, res) => { canManage(req.user); res.send(await model.updateChecklist(req.params.id, req.body, req.user.user_id)); });
const deleteChecklist = catchAsync(async (req, res) => { canManage(req.user); await model.deleteChecklist(req.params.id, req.user.user_id); res.status(httpStatus.NO_CONTENT).send(); });

// ── Requests ──────────────────────────────────────────────────────────────────
const listRequests  = catchAsync(async (req, res) => res.send(await model.getRequests(req.query)));
const getRequest    = catchAsync(async (req, res) => res.send(await model.getRequestById(req.params.id)));
const createRequest = catchAsync(async (req, res) => { canManage(req.user); res.status(httpStatus.CREATED).send(await model.createRequest(req.body, req.user.user_id)); });
const updateRequest = catchAsync(async (req, res) => { canManage(req.user); res.send(await model.updateRequest(req.params.id, req.body, req.user.user_id)); });
const cancelRequest = catchAsync(async (req, res) => { canManage(req.user); res.send(await model.cancelRequest(req.params.id, req.user.user_id)); });
const deleteRequest = catchAsync(async (req, res) => { canManage(req.user); await model.deleteRequest(req.params.id, req.user.user_id); res.status(httpStatus.NO_CONTENT).send(); });

// ── Assignments ───────────────────────────────────────────────────────────────
const acceptAssignment = catchAsync(async (req, res) => {
  res.send(await model.acceptAssignment(req.params.assignmentId, req.user.user_id, req.body.remarks));
});
const rejectAssignment = catchAsync(async (req, res) => {
  if (!req.body.remarks?.trim()) throw new ApiError(httpStatus.BAD_REQUEST, 'Remarks are required when rejecting');
  res.send(await model.rejectAssignment(req.params.assignmentId, req.user.user_id, req.body.remarks));
});

const uploadEvidence = catchAsync(async (req, res) => {
  if (!req.file) throw new (require('../utils/ApiError'))(400, 'No file uploaded');
  res.status(201).send(await model.uploadAssignmentEvidence(req.params.assignmentId, req.file, req.user.user_id));
});

const getEvidence = catchAsync(async (req, res) => {
  res.send(await model.getAssignmentEvidence(req.params.assignmentId));
});

module.exports = {
  listChecklists, getChecklist, createChecklist, updateChecklist, deleteChecklist,
  listRequests, getRequest, createRequest, updateRequest, cancelRequest, deleteRequest,
  acceptAssignment, rejectAssignment, uploadEvidence, getEvidence,
};
