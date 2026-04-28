const httpStatus = require('http-status');
const { query, transaction } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

/**
 * Create a project with optional regions and implementers
 */
const createProject = async (body, creatorId) => {
  return transaction(async (conn) => {
    const {
      name,
      programme_name         = null,
      project_nature         = null,
      sector_id              = null,
      start_date             = null,
      end_date               = null,
      fund_structure         = null,
      funding                = null,
      estimated_cost         = null,
      project_life_span      = null,
      project_background     = null,
      cost_center            = null,
      project_reference      = null,
      relevancy_fypds        = null,
      implementation_modality = null,
      compensation           = null,
      job_created_no         = null,
      project_manager_id     = null,
      regions                = [],
      implementers           = [],
    } = body;

    const [result] = await conn.query(
      `INSERT INTO projects (name, programme_name, project_nature, sector_id, start_date, end_date,
        fund_structure, funding, estimated_cost, project_life_span, project_background,
        cost_center, project_reference, relevancy_fypds, implementation_modality,
        compensation, job_created_no, project_manager_id, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name, programme_name, project_nature, sector_id, start_date, end_date,
       fund_structure, funding, estimated_cost, project_life_span, project_background,
       cost_center, project_reference, relevancy_fypds, implementation_modality,
       compensation, job_created_no, project_manager_id, creatorId]
    );
    const projectId = result.insertId;

    // Insert regions
    for (const regionId of regions) {
      await conn.query(
        'INSERT INTO project_regions (project_id, region_id, created_by) VALUES (?,?,?)',
        [projectId, regionId, creatorId]
      );
    }

    // Insert implementers
    for (const impl of implementers) {
      await conn.query(
        `INSERT INTO project_implementers (project_id, implementer_id, vote_name, vote_code, sub_vote_code, sub_vote_name, cost_center, involvement, created_by)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [projectId, impl.implementer_id, impl.vote_name ?? null, impl.vote_code ?? null, impl.sub_vote_code ?? null, impl.sub_vote_name ?? null, impl.cost_center ?? null, impl.involvement ?? null, creatorId]
      );
    }

    return getProjectById(projectId, conn);
  });
};

/**
 * Get paginated list of projects
 */
const getProjects = async ({ page, limit, sector_id, search }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);

  let where = '1=1';
  const params = [];

  if (sector_id) { where += ' AND p.sector_id = ?'; params.push(parseInt(sector_id, 10)); }
  if (search) {
    where += ' AND (p.name LIKE ? OR p.programme_name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s);
  }

  const [countRow] = await query(`SELECT COUNT(*) AS total FROM projects p WHERE ${where}`, params);
  const projects = await query(
    `SELECT p.*, s.name AS sector_name,
            u.full_name AS project_manager_name
     FROM projects p
     LEFT JOIN sectors s ON s.sector_id = p.sector_id
     LEFT JOIN users u ON u.user_id = p.project_manager_id
     WHERE ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );

  return { results: projects, ...paginate(countRow.total) };
};

/**
 * Get a single project with all details
 */
const getProjectById = async (id, conn = null) => {
  const execute = conn
    ? (sql, params) => conn.query(sql, params).then(([rows]) => rows)
    : (sql, params) => query(sql, params);

  const rows = await execute(
    `SELECT p.*, s.name AS sector_name, u.full_name AS project_manager_name
     FROM projects p
     LEFT JOIN sectors s ON s.sector_id = p.sector_id
     LEFT JOIN users u ON u.user_id = p.project_manager_id
     WHERE p.project_id = ?`,
    [id]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  const project = rows[0];

  // Attach regions
  project.regions = await execute(
    `SELECT r.*, pr.project_region_id FROM regions r
     JOIN project_regions pr ON pr.region_id = r.region_id
     WHERE pr.project_id = ?`,
    [id]
  );

  // Attach implementers
  project.implementers = await execute(
    `SELECT i.*, pi.vote_name, pi.vote_code, pi.sub_vote_code, pi.sub_vote_name, pi.cost_center, pi.involvement, pi.id AS link_id
     FROM implementers i
     JOIN project_implementers pi ON pi.implementer_id = i.implementer_id
     WHERE pi.project_id = ?`,
    [id]
  );

  // Attach objectives summary
  project.objectives = await execute(
    'SELECT objective_id, title, priority, status FROM objectives WHERE project_id = ?',
    [id]
  );

  return project;
};

/**
 * Update a project
 */
const updateProject = async (id, body, updatorId) => {
  const allowed = [
    'name', 'programme_name', 'project_nature', 'sector_id', 'start_date', 'end_date',
    'fund_structure', 'funding', 'estimated_cost', 'project_life_span', 'project_background',
    'cost_center', 'project_reference', 'relevancy_fypds', 'implementation_modality',
    'compensation', 'job_created_no', 'project_manager_id',
  ];
  const fields = Object.keys(body).filter((k) => allowed.includes(k));
  if (!fields.length) throw new ApiError(httpStatus.BAD_REQUEST, 'No valid fields to update');

  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => body[f]);
  await query(`UPDATE projects SET ${setClauses} WHERE project_id = ?`, [...values, id]);
  return getProjectById(id);
};

/**
 * Delete a project
 */
const deleteProject = async (id) => {
  const rows = await query('SELECT project_id FROM projects WHERE project_id = ?', [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  await query('DELETE FROM projects WHERE project_id = ?', [id]);
};

module.exports = { createProject, getProjects, getProjectById, updateProject, deleteProject };
