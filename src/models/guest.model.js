const httpStatus = require('http-status');
const bcrypt = require('bcryptjs');
const { query, transaction } = require('../config/database');
const ApiError = require('../utils/ApiError');
const userModel = require('./user.model');

const GUEST_FIELDS = `u.user_id, u.full_name, u.username, u.email, u.mobile, u.organisation, u.status,
  u.must_change_password, DATE_FORMAT(u.guest_expires_at, '%Y-%m-%d') AS guest_expires_at, u.created_at`;

const attachProjects = async (guests) => {
  if (!guests.length) return guests;
  const rows = await query(
    `SELECT gp.user_id, p.project_id, p.name FROM guest_projects gp
     JOIN projects p ON p.project_id = gp.project_id
     WHERE gp.user_id IN (${guests.map(() => '?').join(',')}) ORDER BY p.name`,
    guests.map((g) => g.user_id)
  );
  guests.forEach((g) => {
    g.projects = rows.filter((r) => r.user_id === g.user_id).map((r) => ({ project_id: r.project_id, name: r.name }));
  });
  return guests;
};

const listGuests = async () => {
  const guests = await query(`SELECT ${GUEST_FIELDS} FROM users u WHERE u.role = 'guest' ORDER BY u.created_at DESC`);
  return attachProjects(guests);
};

const getGuest = async (id) => {
  const rows = await query(`SELECT ${GUEST_FIELDS} FROM users u WHERE u.user_id = ? AND u.role = 'guest'`, [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Guest not found');
  return (await attachProjects(rows))[0];
};

const checkProjects = async (ids) => {
  const unique = [...new Set((ids || []).map(Number).filter(Boolean))];
  if (!unique.length) return unique;
  const found = await query(`SELECT project_id FROM projects WHERE project_id IN (${unique.map(() => '?').join(',')})`, unique);
  if (found.length !== unique.length) throw new ApiError(httpStatus.BAD_REQUEST, 'One or more projects do not exist');
  return unique;
};

const writeProjects = async (conn, userId, ids, creatorId) => {
  await conn.query('DELETE FROM guest_projects WHERE user_id = ?', [userId]);
  for (const pid of ids) {
    await conn.query('INSERT INTO guest_projects (user_id, project_id, created_by) VALUES (?,?,?)', [userId, pid, creatorId]);
  }
};

const createGuest = async (body, creatorId) => {
  const { full_name, username, email = null, mobile = null, organisation = null, guest_expires_at = null } = body;
  const projectIds = await checkProjects(body.project_ids);

  const dupe = await query('SELECT user_id FROM users WHERE username = ? OR (? IS NOT NULL AND email = ?)', [username, email || null, email || null]);
  if (dupe.length) throw new ApiError(httpStatus.CONFLICT, 'Username or email already taken');

  const { password } = body.password ? { password: body.password } : userModel.pickPassword();
  const hash = await bcrypt.hash(password, 10);

  const id = await transaction(async (conn) => {
    const [res] = await conn.query(
      `INSERT INTO users (full_name, username, email, mobile, organisation, password_hash, role, status, must_change_password, guest_expires_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'guest', 'active', 1, ?, ?)`,
      [full_name, username, email || null, mobile || null, organisation || null, hash, guest_expires_at || null, creatorId]
    );
    await writeProjects(conn, res.insertId, projectIds, creatorId);
    return res.insertId;
  });
  return { ...(await getGuest(id)), temporary_password: password };
};

const updateGuest = async (id, body, editorId) => {
  await getGuest(id);
  const allowed = ['full_name', 'email', 'mobile', 'organisation', 'status', 'guest_expires_at'];
  const fields = Object.keys(body).filter((k) => allowed.includes(k));
  const projectIds = body.project_ids !== undefined ? await checkProjects(body.project_ids) : null;

  await transaction(async (conn) => {
    if (fields.length) {
      await conn.query(
        `UPDATE users SET ${fields.map((f) => `${f} = ?`).join(', ')} WHERE user_id = ? AND role = 'guest'`,
        [...fields.map((f) => (body[f] === '' ? null : body[f])), id]
      );
    }
    if (projectIds) await writeProjects(conn, id, projectIds, editorId);
  });
  return getGuest(id);
};

module.exports = { listGuests, getGuest, createGuest, updateGuest };
