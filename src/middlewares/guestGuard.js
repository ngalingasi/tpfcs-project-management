/**
 * Guest guard.
 *
 * A guest is an external viewer. They may only call the routes listed in RULES (everything else is
 * refused), only for projects an admin linked to them, and they never receive budget/payment data.
 *
 * Rule value says how the project of the request is found:
 *   open      no project involved (menu data, own session)
 *   list      project/activity list: the controller filters to req.guestProjectIds
 *   project   :projectId
 *   objective :objectiveId   target :targetId   site :siteId
 *   activity  :activityId (+ :documentId must belong to an accessible project)
 *   document  :documentId
 * Rules ending in "own" additionally require that the comment being deleted was written by the guest.
 */
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const { query } = require('../config/database');

const RULES = {
  // own session
  'GET auth/me': 'open',
  'POST auth/logout': 'open',
  'POST auth/change-password': 'open',
  // plain lookup lists used for display
  'GET lookups/sectors': 'open',
  'GET lookups/regions': 'open',
  'GET lookups/implementers': 'open',
  // projects
  'GET projects': 'list',
  'GET projects/:projectId': 'project',
  'GET projects/:projectId/objectives': 'project',
  'GET projects/:projectId/sites': 'project',
  'GET projects/:projectId/documents': 'project',
  'GET projects/:projectId/geo/summary': 'project',
  'GET projects/:projectId/geo/map': 'project',
  'GET projects/:projectId/geo/points': 'project',
  'GET projects/:projectId/geo/points/:pointId': 'project',
  'GET projects/:projectId/plan': 'project',
  'GET projects/:projectId/plan/export.xlsx': 'project',
  'GET projects/:projectId/plan/export.pdf': 'project',
  'GET objectives/:objectiveId': 'objective',
  'GET objectives/:objectiveId/targets': 'objective',
  'GET targets/:targetId': 'target',
  'GET sites/:siteId': 'site',
  // activities (read)
  'GET activities': 'list',
  'GET activities/meta/statuses': 'open',
  'GET activities/:activityId': 'activity',
  'GET activities/:activityId/dependencies': 'activity',
  'GET activities/:activityId/history': 'activity',
  'GET activities/:activityId/sub-activities': 'activity',
  'GET activities/:activityId/documents': 'activity',
  'GET activities/:activityId/comments': 'activity',
  'GET activities/:activityId/documents/:documentId/comments': 'activity',
  // documents (read + download)
  'GET documents/:documentId': 'document',
  'GET documents/:documentId/download/:version?': 'document',
  'GET documents/:documentId/comments': 'document',
  // comments (the only thing a guest may write)
  'POST activities/:activityId/comments': 'activity',
  'POST activities/:activityId/documents/:documentId/comments': 'activity',
  'POST documents/:documentId/comments': 'document',
  'DELETE activities/:activityId/comments/:commentId': 'activity own activity_comments',
  'DELETE activities/:activityId/documents/:documentId/comments/:commentId': 'activity own document_comments',
  'DELETE documents/:documentId/comments/:commentId': 'document own document_comments',
};

// Money fields guests must never receive (activities, targets, projects, budget summaries)
const HIDDEN_KEYS = new Set([
  'budgeted_amount', 'revised_amount', 'effective_budget', 'available_budget', 'total_paid', 'spent_amount',
  'allocated_budget', 'unallocated_budget', 'estimated_cost', 'funding', 'cost_center',
  'total_budget', 'allocated_to_targets', 'total_spent', 'remaining_budget', 'spent_percentage',
]);

const strip = (v) => {
  if (Array.isArray(v)) { v.forEach(strip); return v; }
  if (v && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v)) {
    Object.keys(v).forEach((k) => { if (HIDDEN_KEYS.has(k)) delete v[k]; else strip(v[k]); });
  }
  return v;
};

const routeKey = (req) => {
  const base = req.baseUrl.replace(/^\/(?:api\/)?(?:v1\/)?/, '');
  const rp = req.route && typeof req.route.path === 'string' ? req.route.path : '';
  return `${req.method} ${base}${rp && rp !== '/' ? rp : ''}`;
};

const one = async (sql, params) => (await query(sql, params))[0];

const PROJECT_OF = {
  objective: (id) => one('SELECT project_id AS pid FROM objectives WHERE objective_id = ?', [id]),
  target: (id) => one('SELECT ob.project_id AS pid FROM targets t JOIN objectives ob ON ob.objective_id = t.objective_id WHERE t.target_id = ?', [id]),
  site: (id) => one('SELECT project_id AS pid FROM project_sites WHERE site_id = ?', [id]),
  activity: (id) => one(
    `SELECT ob.project_id AS pid FROM activities a
       JOIN targets t ON t.target_id = a.target_id
       JOIN objectives ob ON ob.objective_id = t.objective_id WHERE a.activity_id = ?`, [id]),
  document: (id) => one(
    `SELECT COALESCE(d.project_id, ob.project_id) AS pid FROM documents d
       LEFT JOIN activities a ON a.activity_id = d.activity_id
       LEFT JOIN targets t ON t.target_id = a.target_id
       LEFT JOIN objectives ob ON ob.objective_id = t.objective_id WHERE d.document_id = ?`, [id]),
};

const deny = (msg = 'Guests have read-only access') => new ApiError(httpStatus.FORBIDDEN, msg);

const assertProjectAllowed = async (req, projectId) => {
  if (!req.guestProjectIds.includes(Number(projectId))) throw deny('You do not have access to this project');
};

const guestGuard = async (req) => {
  const rule = RULES[routeKey(req)];
  if (!rule) throw deny();

  // Load the projects this guest was given (also used by list controllers)
  const links = await query('SELECT project_id FROM guest_projects WHERE user_id = ?', [req.user.user_id]);
  req.guestProjectIds = links.map((l) => Number(l.project_id));

  const [kind, own, table] = rule.split(' ');
  const p = req.params;

  if (kind === 'project') await assertProjectAllowed(req, p.projectId);
  else if (PROJECT_OF[kind]) {
    const idParam = { objective: p.objectiveId, target: p.targetId, site: p.siteId, activity: p.activityId, document: p.documentId }[kind];
    const row = await PROJECT_OF[kind](idParam);
    if (!row || row.pid == null) throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
    await assertProjectAllowed(req, row.pid);
    // routes that name both an activity and a document: the document must be in an allowed project too
    if (kind === 'activity' && p.documentId) {
      const d = await PROJECT_OF.document(p.documentId);
      if (!d || d.pid == null) throw new ApiError(httpStatus.NOT_FOUND, 'Not found');
      await assertProjectAllowed(req, d.pid);
    }
  }

  if (own === 'own') {
    const col = table === 'activity_comments' ? 'user_id' : 'created_by';
    const c = await one(`SELECT ${col} AS author FROM ${table} WHERE comment_id = ?`, [p.commentId]);
    if (!c) throw new ApiError(httpStatus.NOT_FOUND, 'Comment not found');
    if (Number(c.author) !== Number(req.user.user_id)) throw deny('You can only delete your own comments');
  }
};

/** Call from the auth middleware for guest users. Throws ApiError when the request is not allowed. */
const enforceGuest = async (req, res) => {
  await guestGuard(req);
  const json = res.json.bind(res);
  res.json = (body) => json(strip(body));
};

module.exports = { enforceGuest, strip, RULES };
