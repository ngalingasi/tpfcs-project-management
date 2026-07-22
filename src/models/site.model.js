const httpStatus = require('http-status');
const { query } = require('../config/database');
const ApiError = require('../utils/ApiError');

const createSite = async (body, creatorId) => {
  const {
    project_id,
    region_id    = null,
    objective_id = null,
    site_name,
    district     = null,
    ward         = null,
    street       = null,
    road_name    = null,
    description  = null,
    latitude     = null,
    longitude    = null,
    status       = 'planned',
  } = body;

  const result = await query(
    `INSERT INTO project_sites
       (project_id, region_id, objective_id, site_name, district, ward, street, road_name,
        description, latitude, longitude, status, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [project_id, region_id, objective_id, site_name, district, ward, street, road_name,
      description, latitude, longitude, status, creatorId]
  );
  return getSiteById(result.insertId);
};

const getSitesByProject = async (projectId) => {
  return query(
    `SELECT s.*, r.region_name, o.title AS objective_title, o.status AS objective_status
     FROM project_sites s
     LEFT JOIN regions r    ON r.region_id    = s.region_id
     LEFT JOIN objectives o ON o.objective_id = s.objective_id
     WHERE s.project_id = ?
     ORDER BY s.created_at`,
    [projectId]
  );
};

const getSiteById = async (id) => {
  const rows = await query(
    `SELECT s.*, r.region_name, o.title AS objective_title, o.status AS objective_status
     FROM project_sites s
     LEFT JOIN regions r    ON r.region_id    = s.region_id
     LEFT JOIN objectives o ON o.objective_id = s.objective_id
     WHERE s.site_id = ?`,
    [id]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Site not found');
  return rows[0];
};

const updateSite = async (id, body) => {
  const allowed = [
    'region_id', 'objective_id', 'site_name', 'district', 'ward', 'street', 'road_name',
    'description', 'latitude', 'longitude', 'status',
  ];
  const fields = Object.keys(body).filter((k) => allowed.includes(k));
  if (!fields.length) throw new ApiError(httpStatus.BAD_REQUEST, 'No valid fields to update');

  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values     = fields.map((f) => body[f]);
  await query(`UPDATE project_sites SET ${setClauses} WHERE site_id = ?`, [...values, id]);
  return getSiteById(id);
};

const deleteSite = async (id) => {
  const rows = await query('SELECT site_id FROM project_sites WHERE site_id = ?', [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Site not found');
  await query('DELETE FROM project_sites WHERE site_id = ?', [id]);
};

module.exports = { createSite, getSitesByProject, getSiteById, updateSite, deleteSite };
