const httpStatus = require('http-status');
const { query, transaction } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

// ── Request number generation ─────────────────────────────────────────────────
const generateRequestNumber = async (conn) => {
  const year = new Date().getFullYear();
  const exec = conn ? (s, p) => conn.query(s, p).then(([r]) => r) : query;
  await exec(
    `INSERT INTO inspection_number_sequences (year, last_seq) VALUES (?, 1)
     ON DUPLICATE KEY UPDATE last_seq = last_seq + 1`,
    [year]
  );
  const [row] = await exec('SELECT last_seq FROM inspection_number_sequences WHERE year = ?', [year]);
  return `INS-${year}-${String(row.last_seq).padStart(5, '0')}`;
};

// ══════════════════════════════════════════════════════════════════════════════
// CHECKLISTS
// ══════════════════════════════════════════════════════════════════════════════

const getChecklists = async ({ page, limit, search, inspection_type, status }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  const where = []; const params = [];
  if (search)          { where.push('cl.checklist_name LIKE ?'); params.push(`%${search}%`); }
  if (inspection_type) { where.push('cl.inspection_type = ?');   params.push(inspection_type); }
  if (status)          { where.push('cl.status = ?');             params.push(status); }
  const filter = where.length ? ' AND ' + where.join(' AND ') : '';

  const [countRow] = await query(
    `SELECT COUNT(*) AS total FROM inspection_checklists cl WHERE cl.deleted_at IS NULL${filter}`, params
  );
  const rows = await query(
    `SELECT cl.*, u.full_name AS created_by_name,
            (SELECT COUNT(*) FROM checklist_items ci WHERE ci.checklist_id = cl.checklist_id) AS item_count
     FROM inspection_checklists cl
     LEFT JOIN users u ON u.user_id = cl.created_by
     WHERE cl.deleted_at IS NULL${filter}
     ORDER BY cl.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return { results: rows, ...paginate(countRow.total) };
};

const getChecklistById = async (id) => {
  const rows = await query(
    `SELECT cl.*, u.full_name AS created_by_name
     FROM inspection_checklists cl
     LEFT JOIN users u ON u.user_id = cl.created_by
     WHERE cl.deleted_at IS NULL AND cl.checklist_id = ?`, [id]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Checklist not found');
  const cl = rows[0];
  cl.items = await query(
    'SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY item_order, checklist_item_id',
    [id]
  );
  return cl;
};

const createChecklist = async (body, userId) => {
  return transaction(async (conn) => {
    const { checklist_name, inspection_type, description = null, status = 'active', items = [] } = body;
    if (!items.length) throw new ApiError(httpStatus.BAD_REQUEST, 'At least one checklist item is required');

    const [result] = await conn.query(
      'INSERT INTO inspection_checklists (checklist_name, inspection_type, description, status, created_by) VALUES (?,?,?,?,?)',
      [checklist_name, inspection_type, description, status, userId]
    );
    const clId = result.insertId;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await conn.query(
        `INSERT INTO checklist_items
           (checklist_id, item_title, item_description, item_order, response_type, is_required, requires_comment)
         VALUES (?,?,?,?,?,?,?)`,
        [clId, item.item_title, item.item_description || null, item.item_order ?? i,
         item.response_type ?? 'pass_fail', item.is_required ?? 1, item.requires_comment ?? 0]
      );
    }
    return getChecklistById(clId);
  });
};

const updateChecklist = async (id, body, userId) => {
  await getChecklistById(id);
  return transaction(async (conn) => {
    const allowed = ['checklist_name','inspection_type','description','status'];
    const fields  = Object.keys(body).filter(k => allowed.includes(k));
    if (fields.length) {
      const set = fields.map(f => `${f} = ?`).join(', ');
      await conn.query(
        `UPDATE inspection_checklists SET ${set}, updated_by = ? WHERE checklist_id = ?`,
        [...fields.map(f => body[f]), userId, id]
      );
    }
    if (body.items !== undefined) {
      if (!body.items.length) throw new ApiError(httpStatus.BAD_REQUEST, 'At least one checklist item is required');
      await conn.query('DELETE FROM checklist_items WHERE checklist_id = ?', [id]);
      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i];
        await conn.query(
          `INSERT INTO checklist_items
             (checklist_id, item_title, item_description, item_order, response_type, is_required, requires_comment)
           VALUES (?,?,?,?,?,?,?)`,
          [id, item.item_title, item.item_description || null, item.item_order ?? i,
           item.response_type ?? 'pass_fail', item.is_required ?? 1, item.requires_comment ?? 0]
        );
      }
    }
    return getChecklistById(id);
  });
};

const deleteChecklist = async (id, userId) => {
  await getChecklistById(id);
  await query('UPDATE inspection_checklists SET deleted_at = NOW(), deleted_by = ? WHERE checklist_id = ?', [userId, id]);
};

// ══════════════════════════════════════════════════════════════════════════════
// INSPECTION REQUESTS
// ══════════════════════════════════════════════════════════════════════════════

const IR_BASE = `
  SELECT ir.*,
         po.order_number, s.company_name AS supplier_name,
         p.name AS project_name,
         cl.checklist_name, cl.inspection_type AS cl_type,
         u.full_name AS created_by_name
  FROM inspection_requests ir
  JOIN purchase_orders po ON po.purchase_order_id = ir.purchase_order_id
  JOIN suppliers s ON s.supplier_id = po.supplier_id
  LEFT JOIN projects p ON p.project_id = ir.project_id
  JOIN inspection_checklists cl ON cl.checklist_id = ir.checklist_id
  LEFT JOIN users u ON u.user_id = ir.created_by
  WHERE ir.deleted_at IS NULL`;

const getRequests = async ({ page, limit, search, inspection_type, status, project_id }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  const where = []; const params = [];
  if (search)          { where.push('(ir.request_number LIKE ? OR ir.location_name LIKE ?)'); const q = `%${search}%`; params.push(q, q); }
  if (inspection_type) { where.push('ir.inspection_type = ?'); params.push(inspection_type); }
  if (status)          { where.push('ir.status = ?');          params.push(status); }
  if (project_id)      { where.push('ir.project_id = ?');      params.push(parseInt(project_id, 10)); }
  const filter = where.length ? ' AND ' + where.join(' AND ') : '';

  const [countRow] = await query(
    `SELECT COUNT(*) AS total FROM inspection_requests ir WHERE ir.deleted_at IS NULL${filter}`, params
  );
  const rows = await query(`${IR_BASE}${filter} ORDER BY ir.created_at DESC LIMIT ? OFFSET ?`, [...params, l, offset]);
  return { results: rows, ...paginate(countRow.total) };
};

const getRequestById = async (id, conn = null) => {
  const exec = conn ? (s, p) => conn.query(s, p).then(([r]) => r) : query;
  const rows = await exec(`${IR_BASE} AND ir.inspection_request_id = ?`, [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Inspection request not found');
  const ir = rows[0];

  ir.assignments = await exec(
    `SELECT ia.*, u.full_name, u.email, u.role
     FROM inspection_assignments ia
     JOIN users u ON u.user_id = ia.user_id
     WHERE ia.inspection_request_id = ?`, [id]
  );
  ir.order_items = await exec(
    `SELECT iri.*, poi.*, pr.product_name, pr.sku_barcode
     FROM inspection_request_items iri
     JOIN purchase_order_items poi ON poi.item_id = iri.purchase_order_item_id
     JOIN products pr ON pr.product_id = poi.product_id
     WHERE iri.inspection_request_id = ?`, [id]
  );
  return ir;
};

const createRequest = async (body, userId) => {
  return transaction(async (conn) => {
    const {
      inspection_type, project_id = null, purchase_order_id, checklist_id,
      location_name, location_address = null, location_country = null,
      location_region = null, latitude = null, longitude = null,
      inspection_date, inspection_time = null,
      requires_evidence_upload = 0,
      require_evidence_on_acceptance = 0,
      location_city = null, location_region_id = null,
      request_notes = null,
      status = 'draft', assigned_user_ids = [], order_item_ids = [],
    } = body;

    const requestNumber = await generateRequestNumber(conn);

    const [result] = await conn.query(
      `INSERT INTO inspection_requests
         (request_number, inspection_type, project_id, purchase_order_id, checklist_id,
          location_name, location_address, location_country, location_region, latitude, longitude,
          inspection_date, inspection_time, requires_evidence_upload, request_notes, status, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [requestNumber, inspection_type, project_id, purchase_order_id, checklist_id,
       location_name, location_address, location_country, location_region, latitude, longitude,
       inspection_date, inspection_time, requires_evidence_upload ? 1 : 0, request_notes,
       status, userId]
    );
    const irId = result.insertId;

    // Assign users
    for (const uid of assigned_user_ids) {
      await conn.query(
        'INSERT IGNORE INTO inspection_assignments (inspection_request_id, user_id) VALUES (?,?)',
        [irId, uid]
      );
    }

    // Link order items
    for (const itemId of order_item_ids) {
      await conn.query(
        'INSERT IGNORE INTO inspection_request_items (inspection_request_id, purchase_order_item_id) VALUES (?,?)',
        [irId, itemId]
      );
    }

    return getRequestById(irId, conn);
  });
};

const updateRequest = async (id, body, userId) => {
  const ir = await getRequestById(id);
  if (ir.status === 'cancelled') throw new ApiError(httpStatus.BAD_REQUEST, 'Cancelled requests cannot be edited');
  if (ir.status === 'completed') throw new ApiError(httpStatus.BAD_REQUEST, 'Completed inspections are read-only');

  return transaction(async (conn) => {
    const allowed = ['inspection_type','project_id','purchase_order_id','checklist_id',
                     'location_name','location_address','location_country','location_region',
                     'location_region_id','location_city','latitude','longitude',
                     'inspection_date','inspection_time',
                     'requires_evidence_upload','require_evidence_on_acceptance','request_notes','status'];
    const fields = Object.keys(body).filter(k => allowed.includes(k));
    if (fields.length) {
      const set = fields.map(f => `${f} = ?`).join(', ');
      await conn.query(
        `UPDATE inspection_requests SET ${set}, updated_by = ? WHERE inspection_request_id = ?`,
        [...fields.map(f => body[f]), userId, id]
      );
    }
    if (body.assigned_user_ids !== undefined) {
      await conn.query('DELETE FROM inspection_assignments WHERE inspection_request_id = ?', [id]);
      for (const uid of body.assigned_user_ids) {
        await conn.query(
          'INSERT IGNORE INTO inspection_assignments (inspection_request_id, user_id) VALUES (?,?)',
          [id, uid]
        );
      }
    }
    if (body.order_item_ids !== undefined) {
      await conn.query('DELETE FROM inspection_request_items WHERE inspection_request_id = ?', [id]);
      for (const itemId of body.order_item_ids) {
        await conn.query(
          'INSERT IGNORE INTO inspection_request_items (inspection_request_id, purchase_order_item_id) VALUES (?,?)',
          [id, itemId]
        );
      }
    }
    return getRequestById(id, conn);
  });
};

const cancelRequest = async (id, userId) => {
  const ir = await getRequestById(id);
  if (ir.status === 'cancelled') throw new ApiError(httpStatus.BAD_REQUEST, 'Already cancelled');
  if (ir.status === 'completed') throw new ApiError(httpStatus.BAD_REQUEST, 'Completed inspections cannot be cancelled');
  await query(
    'UPDATE inspection_requests SET status = ?, updated_by = ? WHERE inspection_request_id = ?',
    ['cancelled', userId, id]
  );
  return getRequestById(id);
};

const deleteRequest = async (id, userId) => {
  await getRequestById(id);
  await query(
    'UPDATE inspection_requests SET deleted_at = NOW(), deleted_by = ?, updated_by = ? WHERE inspection_request_id = ?',
    [userId, userId, id]
  );
};

// ── Assignments ───────────────────────────────────────────────────────────────
// ── Assignment Evidence ───────────────────────────────────────────────────────
const uploadAssignmentEvidence = async (assignmentId, file, userId) => {
  const rows = await query('SELECT * FROM inspection_assignments WHERE inspection_assignment_id = ?', [assignmentId]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Assignment not found');
  if (rows[0].user_id !== userId) throw new ApiError(httpStatus.FORBIDDEN, 'You can only upload evidence for your own assignment');

  const result = await query(
    'INSERT INTO assignment_evidence (inspection_assignment_id, file_name, file_path, file_type, uploaded_by) VALUES (?,?,?,?,?)',
    [assignmentId, file.originalname, file.path, file.mimetype || null, userId]
  );
  return query('SELECT * FROM assignment_evidence WHERE assignment_evidence_id = ?', [result.insertId]).then(r => r[0]);
};

const getAssignmentEvidence = async (assignmentId) => {
  return query('SELECT * FROM assignment_evidence WHERE inspection_assignment_id = ? ORDER BY uploaded_at DESC', [assignmentId]);
};

const acceptAssignment = async (assignmentId, userId, remarks = null) => {
  const rows = await query(
    'SELECT * FROM inspection_assignments WHERE inspection_assignment_id = ?', [assignmentId]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Assignment not found');
  if (rows[0].user_id !== userId) throw new ApiError(httpStatus.FORBIDDEN, 'You can only respond to your own assignments');
  if (rows[0].assignment_status !== 'pending') throw new ApiError(httpStatus.BAD_REQUEST, 'Assignment already responded to');

  // Check if evidence is required before acceptance
  const irRows = await query(
    'SELECT require_evidence_on_acceptance FROM inspection_requests WHERE inspection_request_id = ?',
    [rows[0].inspection_request_id]
  );
  if (irRows.length && irRows[0].require_evidence_on_acceptance) {
    const evidence = await query(
      'SELECT COUNT(*) AS cnt FROM assignment_evidence WHERE inspection_assignment_id = ?', [assignmentId]
    );
    if (Number(evidence[0].cnt) === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'You must upload evidence before accepting this inspection request');
    }
  }

  await query(
    `UPDATE inspection_assignments
     SET assignment_status = 'accepted', accepted_at = NOW(), remarks = ?
     WHERE inspection_assignment_id = ?`,
    [remarks, assignmentId]
  );

  // Auto-advance request to scheduled if all assignments accepted
  const irId = rows[0].inspection_request_id;
  const pending = await query(
    "SELECT COUNT(*) AS cnt FROM inspection_assignments WHERE inspection_request_id = ? AND assignment_status = 'pending'",
    [irId]
  );
  if (Number(pending[0].cnt) === 0) {
    await query(
      "UPDATE inspection_requests SET status = 'scheduled' WHERE inspection_request_id = ? AND status = 'pending_acceptance'",
      [irId]
    );
  }
  return query('SELECT * FROM inspection_assignments WHERE inspection_assignment_id = ?', [assignmentId]).then(r => r[0]);
};

const rejectAssignment = async (assignmentId, userId, remarks = null) => {
  const rows = await query(
    'SELECT * FROM inspection_assignments WHERE inspection_assignment_id = ?', [assignmentId]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Assignment not found');
  if (rows[0].user_id !== userId) throw new ApiError(httpStatus.FORBIDDEN, 'You can only respond to your own assignments');
  if (rows[0].assignment_status !== 'pending') throw new ApiError(httpStatus.BAD_REQUEST, 'Assignment already responded to');

  await query(
    `UPDATE inspection_assignments
     SET assignment_status = 'rejected', rejected_at = NOW(), remarks = ?
     WHERE inspection_assignment_id = ?`,
    [remarks, assignmentId]
  );
  return query('SELECT * FROM inspection_assignments WHERE inspection_assignment_id = ?', [assignmentId]).then(r => r[0]);
};

module.exports = {
  getChecklists, getChecklistById, createChecklist, updateChecklist, deleteChecklist,
  getRequests, getRequestById, createRequest, updateRequest, cancelRequest, deleteRequest,
  acceptAssignment, rejectAssignment,
  uploadAssignmentEvidence, getAssignmentEvidence,
};
