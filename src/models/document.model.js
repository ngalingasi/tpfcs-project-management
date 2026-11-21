const httpStatus = require('http-status');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const config = require('../config/config');
const ApiError = require('../utils/ApiError');

/**
 * Create a document record and save the first version
 */
const createDocument = async ({ project_id, activity_id, site_id = null, name, description = null, category = 'document', sort_order = 0 }, file, creatorId) => {
  const docResult = await query(
    'INSERT INTO documents (project_id, activity_id, site_id, name, description, category, sort_order, created_by) VALUES (?,?,?,?,?,?,?,?)',
    [project_id || null, activity_id || null, site_id || null, name, description, category, sort_order || 0, creatorId]
  );
  const docId = docResult.insertId;

  await query(
    'INSERT INTO document_versions (document_id, file_path, mime_type, size, version_number, uploaded_by) VALUES (?,?,?,?,1,?)',
    [docId, file.path, file.mimetype, file.size, creatorId]
  );

  return getDocumentRow(docId);
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
 * Public path of a stored file relative to the uploads folder (served at /uploads), e.g.
 * "projects/4/1700000000-123.pdf". Files live in sub-folders, so the front end must not
 * rebuild the link from the bare file name.
 */
const toFileUrl = (filePath) => {
  if (!filePath) return null;
  const root = path.join(process.cwd(), config.upload.dir);
  const rel = path.relative(root, path.resolve(process.cwd(), filePath));
  return rel.startsWith('..') || path.isAbsolute(rel) ? null : rel.split(path.sep).join('/');
};

const withFileUrl = (rows) => rows.map((r) => ({ ...r, file_url: toFileUrl(r.file_path) }));

const DOCUMENT_LIST_SELECT = `
  SELECT d.*, dv.file_path, dv.mime_type, dv.size, dv.version_number, dv.uploaded_at,
         u.full_name AS uploaded_by_name,
         ps.site_name AS site_name,
         (SELECT COUNT(*) FROM document_comments dc WHERE dc.document_id = d.document_id) AS comment_count
  FROM documents d
  JOIN document_versions dv ON dv.document_id = d.document_id
    AND dv.version_number = (SELECT MAX(v2.version_number) FROM document_versions v2 WHERE v2.document_id = d.document_id)
  LEFT JOIN users u ON u.user_id = dv.uploaded_by
  LEFT JOIN project_sites ps ON ps.site_id = d.site_id`;

/**
 * General (project-level) documents: attached to the project but not to any activity.
 * Activity documents are listed from the activity itself.
 */
const getDocumentsByProject = async (projectId, category = null) => {
  const params = [projectId];
  let extra = '';
  if (category) { extra = ' AND d.category = ?'; params.push(category); }
  const rows = await query(
    `${DOCUMENT_LIST_SELECT}
     WHERE d.project_id = ? AND d.activity_id IS NULL${extra}
     ORDER BY d.sort_order ASC, d.created_at DESC`,
    params
  );
  return withFileUrl(rows);
};

/** One document in the same shape as the list rows (used after create / edit). */
const getDocumentRow = async (id) => {
  const rows = await query(`${DOCUMENT_LIST_SELECT} WHERE d.document_id = ?`, [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
  return withFileUrl(rows)[0];
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

const getDocumentsByActivity = async (activityId, category = null, siteId = null) => {
  const params = [activityId];
  let extraClause = '';
  if (category) { extraClause += ' AND d.category = ?'; params.push(category); }
  if (siteId)   { extraClause += ' AND d.site_id = ?';  params.push(siteId); }
  const rows = await query(
    `SELECT d.*, dv.file_path, dv.mime_type, dv.size, dv.version_number,
            u.full_name AS uploaded_by_name,
            ps.site_name AS site_name,
            (SELECT COUNT(*) FROM document_comments dc WHERE dc.document_id = d.document_id) AS comment_count
     FROM documents d
     JOIN document_versions dv ON dv.document_id = d.document_id
       AND dv.version_number = (
         SELECT MAX(v2.version_number) FROM document_versions v2 WHERE v2.document_id = d.document_id
       )
     LEFT JOIN users u ON u.user_id = dv.uploaded_by
     LEFT JOIN project_sites ps ON ps.site_id = d.site_id
     WHERE d.activity_id = ?${extraClause}
     ORDER BY d.sort_order ASC, d.created_at DESC`,
    params
  );
  return withFileUrl(rows);
};

/**
 * Update a document's own metadata (currently just sort_order — name/description
 * edits aren't exposed yet, this is intentionally narrow).
 */
const updateDocumentSortOrder = async (id, sortOrder) => {
  await query('UPDATE documents SET sort_order = ? WHERE document_id = ?', [sortOrder, id]);
  return getDocumentById(id);
};

/** Edit name / description / site / category of a document. Only the given fields change. */
const updateDocumentDetails = async (id, { name, description, site_id, category }) => {
  const sets = [];
  const params = [];
  if (name !== undefined)        { sets.push('name = ?');        params.push(String(name).trim().slice(0, 255)); }
  if (description !== undefined) { sets.push('description = ?'); params.push(description ? String(description) : null); }
  if (site_id !== undefined)     { sets.push('site_id = ?');     params.push(site_id ? Number(site_id) : null); }
  if (category !== undefined)    { sets.push('category = ?');    params.push(category === 'picture' ? 'picture' : 'document'); }
  if (sets.length) await query(`UPDATE documents SET ${sets.join(', ')} WHERE document_id = ?`, [...params, id]);
  return getDocumentRow(id);
};

const getDocumentCommentById = async (commentId) => {
  const rows = await query('SELECT * FROM document_comments WHERE comment_id = ?', [commentId]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Comment not found');
  return rows[0];
};

module.exports = Object.assign(module.exports || {}, {
  getDocumentsByActivity, getDocumentComments, addDocumentComment, deleteDocumentComment,
  updateDocumentSortOrder, updateDocumentDetails, getDocumentCommentById, getDocumentRow, toFileUrl,
});
