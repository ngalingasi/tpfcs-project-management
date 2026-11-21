const httpStatus = require('http-status');
const path = require('path');
const catchAsync = require('../utils/catchAsync');
const documentModel = require('../models/document.model');
const ApiError = require('../utils/ApiError');
const { query } = require('../config/database');

/**
 * General documents (attached to a project, not to an activity) can be added, edited and deleted by
 * admins and by that project's own project manager. Everyone who can see the project can read them.
 */
const getProjectAccess = async (req, projectId) => {
  const rows = await query('SELECT project_manager_id FROM projects WHERE project_id = ?', [projectId]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  const isAdmin = req.user.role === 'admin';
  const isProjectManager = rows[0].project_manager_id != null && Number(rows[0].project_manager_id) === Number(req.user.user_id);
  return { canManage: isAdmin || isProjectManager, isAdmin, isProjectManager };
};

const isGeneral = (doc) => doc.project_id != null && doc.activity_id == null;

/**
 * Who may change a document by its own id. General documents follow the project rule above;
 * activity documents keep the previous admin/manager rule (they are normally managed from the activity).
 */
const assertCanManage = async (req, doc) => {
  if (isGeneral(doc)) {
    const access = await getProjectAccess(req, doc.project_id);
    if (!access.canManage) throw new ApiError(httpStatus.FORBIDDEN, 'Only an admin or the project manager can change project documents');
    return access;
  }
  if (!['admin', 'manager'].includes(req.user.role)) throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to change this document');
  return { canManage: true, isAdmin: req.user.role === 'admin', isProjectManager: false };
};

const cleanFile = (file) => { try { if (file) require('fs').unlinkSync(file.path); } catch (e) { /* already gone */ } };

const uploadDocument = catchAsync(async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const access = await getProjectAccess(req, projectId);
    if (!access.canManage) throw new ApiError(httpStatus.FORBIDDEN, 'Only an admin or the project manager can upload project documents');
    if (!req.file) throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');

    let siteId = null;
    if (req.body.site_id) {
      siteId = Number(req.body.site_id);
      const site = await query('SELECT site_id FROM project_sites WHERE site_id = ? AND project_id = ?', [siteId, projectId]);
      if (!site.length) throw new ApiError(httpStatus.BAD_REQUEST, 'That site does not belong to this project');
    }

    const doc = await documentModel.createDocument(
      {
        project_id: projectId,
        activity_id: null, // general document: never attached to an activity
        site_id: siteId,
        name: (req.body.name || req.file.originalname || '').trim().slice(0, 255),
        description: req.body.description || null,
        category: req.body.category === 'picture' ? 'picture' : 'document',
        sort_order: req.body.sort_order ? Number(req.body.sort_order) : 0,
      },
      req.file,
      req.user.user_id
    );
    res.status(httpStatus.CREATED).send(doc);
  } catch (err) {
    cleanFile(req.file); // do not leave an orphan file behind when the upload is refused
    throw err;
  }
});

const getDocumentsByProject = catchAsync(async (req, res) => {
  const category = req.query.category === 'picture' || req.query.category === 'document' ? req.query.category : null;
  res.send(await documentModel.getDocumentsByProject(req.params.projectId, category));
});

const uploadNewVersion = catchAsync(async (req, res) => {
  try {
    if (!req.file) throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');
    const doc = await documentModel.getDocumentById(req.params.documentId);
    await assertCanManage(req, doc);
    await documentModel.addDocumentVersion(req.params.documentId, req.file, req.user.user_id);
    res.send(await documentModel.getDocumentRow(req.params.documentId));
  } catch (err) {
    cleanFile(req.file);
    throw err;
  }
});

const getDocument = catchAsync(async (req, res) => {
  const doc = await documentModel.getDocumentById(req.params.documentId);
  res.send(doc);
});

const downloadDocument = catchAsync(async (req, res) => {
  const doc = await documentModel.getDocumentById(req.params.documentId);
  const version = doc.versions.find((v) => v.version_number === Number(req.params.version)) || doc.versions[0];
  if (!version) throw new ApiError(httpStatus.NOT_FOUND, 'File version not found');
  res.download(version.file_path, path.basename(version.file_path));
});

const updateDocument = catchAsync(async (req, res) => {
  const doc = await documentModel.getDocumentById(req.params.documentId);
  await assertCanManage(req, doc);
  const { name, description, site_id: siteId, category } = req.body;
  if (name !== undefined && !String(name).trim()) throw new ApiError(httpStatus.BAD_REQUEST, 'Name cannot be empty');
  if (siteId && isGeneral(doc)) {
    const site = await query('SELECT site_id FROM project_sites WHERE site_id = ? AND project_id = ?', [Number(siteId), doc.project_id]);
    if (!site.length) throw new ApiError(httpStatus.BAD_REQUEST, 'That site does not belong to this project');
  }
  res.send(await documentModel.updateDocumentDetails(req.params.documentId, { name, description, site_id: siteId, category }));
});

const deleteDocument = catchAsync(async (req, res) => {
  const doc = await documentModel.getDocumentById(req.params.documentId);
  await assertCanManage(req, doc);
  await documentModel.deleteDocument(req.params.documentId);
  res.status(httpStatus.NO_CONTENT).send();
});

// ── Comments on general documents (activity documents use the activity comment routes) ──
const loadGeneralDocument = async (documentId) => {
  const doc = await documentModel.getDocumentById(documentId);
  if (!isGeneral(doc)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'This document belongs to an activity; use the activity to comment on it');
  }
  return doc;
};

const getComments = catchAsync(async (req, res) => {
  await loadGeneralDocument(req.params.documentId);
  res.send(await documentModel.getDocumentComments(req.params.documentId));
});

const addComment = catchAsync(async (req, res) => {
  await loadGeneralDocument(req.params.documentId);
  const text = (req.body.comment || '').trim();
  if (!text) throw new ApiError(httpStatus.BAD_REQUEST, 'Comment text is required');
  res.status(httpStatus.CREATED).send(await documentModel.addDocumentComment(req.params.documentId, text, req.user.user_id));
});

const deleteComment = catchAsync(async (req, res) => {
  const doc = await loadGeneralDocument(req.params.documentId);
  const comment = await documentModel.getDocumentCommentById(req.params.commentId);
  if (Number(comment.document_id) !== Number(doc.document_id)) throw new ApiError(httpStatus.NOT_FOUND, 'Comment not found');
  const access = await getProjectAccess(req, doc.project_id);
  const isAuthor = Number(comment.created_by) === Number(req.user.user_id);
  if (!isAuthor && !access.canManage) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You can only delete your own comments');
  }
  await documentModel.deleteDocumentComment(req.params.commentId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  uploadDocument, uploadNewVersion, getDocumentsByProject, getDocument, downloadDocument,
  updateDocument, deleteDocument, getComments, addComment, deleteComment,
};
