const httpStatus = require('http-status');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const ApiError = require('../utils/ApiError');

/**
 * Create a document record and save the first version
 */
const createDocument = async ({ project_id, activity_id, name, description = null, category = 'document' }, file, creatorId) => {
  const docResult = await query(
    'INSERT INTO documents (project_id, activity_id, name, description, category, created_by) VALUES (?,?,?,?,?,?)',
    [project_id || null, activity_id || null, name, description, category, creatorId]
  );
  const docId = docResult.insertId;

  await query(
    'INSERT INTO document_versions (document_id, file_path, mime_type, size, version_number, uploaded_by) VALUES (?,?,?,?,1,?)',
    [docId, file.path, file.mimetype, file.size, creatorId]
  );

  return getDocumentById(docId);
};

/**
 * Upload a new version of an existing document
 */
const addDocumentVersion = async (docId, file, uploaderId) => {
  const existing = await getDocumentById(docId);
  const maxRow = await query(
    'SELECT COALESCE(MAX(version_number),0)+1 AS next_ver FROM document_versions WHERE document_id = ?',
    [docId]
  );
  await query(
    'INSERT INTO document_versions (document_id, file_path, mime_type, size, version_number, uploaded_by) VALUES (?,?,?,?,?,?)',
    [docId, file.path, file.mimetype, file.size, maxRow[0].next_ver, uploaderId]
  );
  return getDocumentById(docId);
};

/**
 * Get documents for a project
 */
const getDocumentsByProject = async (projectId) => {
  return query(
    `SELECT d.*, dv.file_path, dv.mime_type, dv.size, dv.version_number, dv.uploaded_at
     FROM documents d
     JOIN document_versions dv ON dv.document_id = d.document_id
       AND dv.version_number = (SELECT MAX(version_number) FROM document_versions WHERE document_id = d.document_id)
     WHERE d.project_id = ? ORDER BY d.created_at DESC`,
    [projectId]
  );
};

/**
 * Get a single document with all versions
 */
const getDocumentById = async (id) => {
  const rows = await query('SELECT * FROM documents WHERE document_id = ?', [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
  const doc = rows[0];
  doc.versions = await query(
    `SELECT dv.*, u.full_name AS uploaded_by_name
     FROM document_versions dv
     LEFT JOIN users u ON u.user_id = dv.uploaded_by
     WHERE dv.document_id = ? ORDER BY dv.version_number DESC`,
    [id]
  );
  const cnt = await query('SELECT COUNT(*) AS c FROM document_comments WHERE document_id = ?', [id]);
  doc.comment_count = cnt[0]?.c ?? 0;
  return doc;
};

/**
 * Comments on a document
 */
const getDocumentComments = async (documentId) => {
  return query(
    `SELECT c.*, u.full_name AS created_by_name
     FROM document_comments c
     LEFT JOIN users u ON u.user_id = c.created_by
     WHERE c.document_id = ?
     ORDER BY c.created_at ASC`,
    [documentId]
  );
};

const addDocumentComment = async (documentId, comment, creatorId) => {
  const result = await query(
    'INSERT INTO document_comments (document_id, comment, created_by) VALUES (?,?,?)',
    [documentId, comment, creatorId]
  );
  const rows = await query(
    `SELECT c.*, u.full_name AS created_by_name
     FROM document_comments c
     LEFT JOIN users u ON u.user_id = c.created_by
     WHERE c.comment_id = ?`,
    [result.insertId]
  );
  return rows[0];
};

const deleteDocumentComment = async (commentId) => {
  const rows = await query('SELECT comment_id FROM document_comments WHERE comment_id = ?', [commentId]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Comment not found');
  await query('DELETE FROM document_comments WHERE comment_id = ?', [commentId]);
};

/**
 * Delete a document and all its files
 */
const deleteDocument = async (id) => {
  const doc = await getDocumentById(id);
  // Remove physical files
  for (const v of doc.versions) {
    if (v.file_path && fs.existsSync(v.file_path)) {
      fs.unlinkSync(v.file_path);
    }
  }
  await query('DELETE FROM documents WHERE document_id = ?', [id]);
};

module.exports = { createDocument, addDocumentVersion, getDocumentsByProject, getDocumentById, deleteDocument };

const getDocumentsByActivity = async (activityId, category = null) => {
  const params = [activityId];
  let categoryClause = '';
  if (category) { categoryClause = ' AND d.category = ?'; params.push(category); }
  return query(
    `SELECT d.*, dv.file_path, dv.mime_type, dv.size, dv.version_number,
            u.full_name AS uploaded_by_name,
            (SELECT COUNT(*) FROM document_comments dc WHERE dc.document_id = d.document_id) AS comment_count
     FROM documents d
     JOIN document_versions dv ON dv.document_id = d.document_id
       AND dv.version_number = (
         SELECT MAX(v2.version_number) FROM document_versions v2 WHERE v2.document_id = d.document_id
       )
     LEFT JOIN users u ON u.user_id = dv.uploaded_by
     WHERE d.activity_id = ?${categoryClause}
     ORDER BY d.created_at DESC`,
    params
  );
};

module.exports = Object.assign(module.exports || {}, {
  getDocumentsByActivity, getDocumentComments, addDocumentComment, deleteDocumentComment,
});
