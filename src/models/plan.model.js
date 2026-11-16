/**
 * Implementation plan (WBS) — import, view and dependency handling.
 *
 *   Plan file section  -> objectives  (wbs_code "2")
 *   Plan file task     -> activities  (wbs_code "2.3")
 *   Plan file sub-task -> activities with main_activity_id (wbs_code "2.3.1")
 *   AFTER column       -> activity_dependencies
 *   TARGET column      -> targets (one default target per objective if absent)
 */
const httpStatus = require('http-status');
const { query, transaction } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { parsePlanWorkbook } = require('../utils/planParser');
const { compareWbs } = require('../utils/wbs');
const { syncTargetSpent } = require('./budget.model');

const DAY = 86400000;

// ── Date helpers (UTC-only so server time zone can never shift a day) ────────
const toUtc = (iso) => new Date(`${iso}T00:00:00Z`);
const toIso = (d) => d.toISOString().slice(0, 10);
const addDays = (iso, n) => toIso(new Date(toUtc(iso).getTime() + n * DAY));
const weekOf = (baseIso, iso) => Math.floor((toUtc(iso).getTime() - toUtc(baseIso).getTime()) / (7 * DAY)) + 1;

/** Week N spans [base + (N-1)*7, base + (N-1)*7 + 6]. */
const resolveWhen = (when, baseIso, edge) => {
  if (!when) return null;
  if (when.date) return when.date;
  const weekStart = addDays(baseIso, (when.week - 1) * 7);
  return edge === 'start' ? weekStart : addDays(weekStart, 6);
};

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate (and optionally persist) a plan workbook.
 *
 * @param {object} opts
 * @param {Buffer} opts.buffer
 * @param {object} opts.user               req.user
 * @param {number|null} opts.projectId     import into this project, or
 * @param {object|null} opts.newProject    { name, start_date, estimated_cost, sector_id, project_manager_id }
 * @param {string|null} opts.startDate     week 1 date (YYYY-MM-DD) for week-based plans
 * @param {boolean} opts.dryRun            validate only
 */
const importPlan = async ({ buffer, user, projectId = null, newProject = null, startDate = null, dryRun = true }) => {
  if (!projectId && !newProject?.name) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Provide project_id to import into an existing project, or project_name to create a new one.');
  }

  const parsed = await parsePlanWorkbook(buffer);
  const errors = [...parsed.errors];
  const warnings = [...parsed.warnings];
  const { objectives, activities } = parsed;

  if (!errors.length && !activities.length) errors.push('No tasks were found in the file. Expected rows with WBS codes like 1.1, 1.2 …');

  // Existing project?
  let project = null;
  if (projectId) {
    const rows = await query(
      `SELECT project_id, name, DATE_FORMAT(start_date,'%Y-%m-%d') AS start_date, estimated_cost, project_manager_id
       FROM projects WHERE project_id = ?`, [projectId]);
    if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    [project] = rows;
  }

  // Base date for week numbers
  const usesWeeks = activities.some((a) => (a.start && a.start.week !== undefined) || (a.end && a.end.week !== undefined));
  const baseDate = startDate || newProject?.start_date || project?.start_date || null;
  if (usesWeeks && !baseDate) {
    errors.push('This plan uses week numbers (W1, W2 …). Enter the date that Week 1 starts on.');
  }
  if (baseDate && !/^\d{4}-\d{2}-\d{2}$/.test(baseDate)) errors.push(`Start date "${baseDate}" must be YYYY-MM-DD.`);

  // Resolve calendar dates
  if (!errors.length) {
    activities.forEach((a) => {
      a.startDate = resolveWhen(a.start, baseDate, 'start');
      a.endDate = resolveWhen(a.end, baseDate, 'end');
      if (a.startDate && a.endDate && a.endDate < a.startDate) {
        errors.push(`Row ${a.rowNumber}: ${a.code} ends before it starts.`);
      }
    });
  }

  // Lookups: users (assignee), regions
  const userMap = new Map();
  const regionMap = new Map();
  const needUsers = activities.some((a) => a.assignee);
  const needRegions = activities.some((a) => a.region);
  if (needUsers) {
    const us = await query("SELECT user_id, email, username FROM users WHERE status = 'active'");
    us.forEach((u) => {
      if (u.email) userMap.set(String(u.email).toLowerCase(), u.user_id);
      userMap.set(String(u.username).toLowerCase(), u.user_id);
    });
  }
  if (needRegions) {
    const rs = await query('SELECT region_id, region_name FROM regions');
    rs.forEach((r) => regionMap.set(String(r.region_name).toLowerCase(), r.region_id));
  }
  activities.forEach((a) => {
    a.assignedUserId = null;
    a.regionId = null;
    if (a.assignee) {
      a.assignedUserId = userMap.get(a.assignee.toLowerCase()) ?? null;
      if (!a.assignedUserId) warnings.push(`Row ${a.rowNumber}: assignee "${a.assignee}" is not an active user; left unassigned.`);
    }
    if (a.region) {
      a.regionId = regionMap.get(a.region.toLowerCase()) ?? null;
      if (!a.regionId) warnings.push(`Row ${a.rowNumber}: region "${a.region}" was not found; left blank.`);
    }
  });

  // Conflicts with an existing project
  if (project) {
    const existing = await query(
      `SELECT a.wbs_code FROM activities a
       JOIN targets t ON t.target_id = a.target_id
       JOIN objectives o ON o.objective_id = t.objective_id
       WHERE o.project_id = ? AND a.wbs_code IS NOT NULL`, [project.project_id]);
    const existingCodes = new Set(existing.map((e) => e.wbs_code));
    const clashes = activities.filter((a) => existingCodes.has(a.code)).map((a) => a.code);
    if (clashes.length) {
      errors.push(`These WBS codes already exist in the project: ${clashes.slice(0, 8).join(', ')}${clashes.length > 8 ? ` … (${clashes.length} total)` : ''}. Import into a new project or change the codes.`);
    }
    const objClash = await query('SELECT wbs_code FROM objectives WHERE project_id = ? AND wbs_code IS NOT NULL', [project.project_id]);
    const objCodes = new Set(objClash.map((o) => o.wbs_code));
    const clashObj = objectives.filter((o) => objCodes.has(o.code)).map((o) => o.code);
    if (clashObj.length) errors.push(`Section code(s) already exist in the project: ${clashObj.join(', ')}.`);
  }

  // Budget fit
  const totalBudget = activities.reduce((s, a) => s + a.budget, 0);
  if (totalBudget > 0 && project) {
    const [agg] = await query(
      `SELECT COALESCE(SUM(t.allocated_budget),0) AS allocated FROM targets t
       JOIN objectives o ON o.objective_id = t.objective_id WHERE o.project_id = ?`, [project.project_id]);
    const available = Number(project.estimated_cost || 0) - Number(agg.allocated);
    if (totalBudget > available) {
      errors.push(`Plan budgets total ${totalBudget.toLocaleString('en-US')} but the project only has ${available.toLocaleString('en-US')} unallocated. Raise the project's estimated cost first.`);
    }
  }

  // Schedule hints: tasks that start before a predecessor finishes
  const byCode = new Map(activities.map((a) => [a.code, a]));
  let overlaps = 0;
  // Week plans compare week numbers (starting in the same week the predecessor ends is fine);
  // date plans compare calendar dates.
  const startsEarly = (a, p) => {
    if (a.start?.week !== undefined && p.end?.week !== undefined) return a.start.week < p.end.week;
    return !!(a.startDate && p.endDate && a.startDate < p.endDate);
  };
  activities.forEach((a) => {
    if (a.after.some((code) => startsEarly(a, byCode.get(code)))) overlaps += 1;
  });

  // Targets per objective
  const targetKey = (a) => `${a.objectiveCode}::${a.target || ''}`;
  const targetKeys = new Set(activities.map(targetKey));
  objectives.forEach((o) => {
    if (!activities.some((a) => a.objectiveCode === o.code)) targetKeys.add(`${o.code}::`); // empty section still gets a target
  });

  const allDates = activities.flatMap((a) => [a.startDate, a.endDate]).filter(Boolean).sort();
  const summary = {
    layout: parsed.layout,
    objectives: objectives.length,
    targets: targetKeys.size,
    activities: activities.filter((a) => a.depth === 2).length,
    sub_activities: activities.filter((a) => a.depth === 3).length,
    dependencies: activities.reduce((s, a) => s + a.after.length, 0),
    schedule_overlaps: overlaps,
    base_date: baseDate,
    first_date: allDates[0] || null,
    last_date: allDates[allDates.length - 1] || null,
    total_budget: totalBudget,
  };
  const outline = objectives.map((o) => ({
    code: o.code,
    title: o.title,
    tasks: activities.filter((a) => a.objectiveCode === o.code).length,
  }));

  if (errors.length || dryRun) {
    return { ok: !errors.length, dry_run: true, imported: false, summary, outline, warnings, errors };
  }

  // ── Write everything in one transaction ────────────────────────────────────
  const result = await transaction(async (conn) => {
    const run = async (sql, params) => (await conn.query(sql, params))[0];

    let pid = project?.project_id;
    if (!pid) {
      const manager = newProject.project_manager_id
        || (user.role === 'manager' ? user.user_id : null);
      const res = await run(
        `INSERT INTO projects (name, start_date, end_date, estimated_cost, sector_id, project_manager_id, created_by)
         VALUES (?,?,?,?,?,?,?)`,
        [
          newProject.name,
          baseDate || summary.first_date,
          summary.last_date,
          newProject.estimated_cost || (totalBudget > 0 ? totalBudget : null),
          newProject.sector_id || null,
          manager,
          user.user_id,
        ]
      );
      pid = res.insertId;
    } else if (baseDate && !project.start_date) {
      await run('UPDATE projects SET start_date = ? WHERE project_id = ?', [baseDate, pid]);
    }

    // Objectives
    const objectiveIds = new Map();
    for (const o of objectives) {
      const res = await run(
        `INSERT INTO objectives (project_id, wbs_code, title, priority, status, created_by)
         VALUES (?,?,?,?,?,?)`,
        [pid, o.code, o.title, 'medium', 'pending', user.user_id]
      );
      objectiveIds.set(o.code, res.insertId);
    }

    // Targets
    const targetIds = new Map();
    for (const key of targetKeys) {
      const [objCode, tName] = key.split('::');
      const obj = objectives.find((o) => o.code === objCode);
      const acts = activities.filter((a) => targetKey(a) === key);
      const ends = acts.map((a) => a.endDate).filter(Boolean).sort();
      const allocated = acts.reduce((s, a) => s + a.budget, 0);
      const res = await run(
        `INSERT INTO targets (objective_id, name, description, metric_type, unit, target_value, current_value,
                              allocated_budget, deadline, status, created_by)
         VALUES (?,?,?,?,?,?,0,?,?,?,?)`,
        [
          objectiveIds.get(objCode),
          tName || `Deliver: ${obj.title}`.slice(0, 250),
          null,
          'count',
          'tasks',
          Math.max(acts.filter((a) => a.depth === 2).length, 1),
          allocated,
          ends.length ? ends[ends.length - 1] : null,
          'on_track',
          user.user_id,
        ]
      );
      targetIds.set(key, res.insertId);
    }

    // Activities — parents (depth 2) first, then sub-activities (depth 3)
    const activityIds = new Map();
    let order = 0;
    const ordered = [...activities].sort((a, b) => a.depth - b.depth || compareWbs(a.code, b.code));
    for (const a of ordered) {
      order += 1;
      const res = await run(
        `INSERT INTO activities (wbs_code, target_id, region_id, name, description, main_activity_id, sort_order,
                                 assigned_user_id, lead_party, start_date, end_date, progress, budgeted_amount,
                                 status, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?,?)`,
        [
          a.code,
          targetIds.get(targetKey(a)),
          a.regionId,
          a.name.slice(0, 250),
          a.description,
          a.parentCode ? activityIds.get(a.parentCode) : null,
          order,
          a.assignedUserId,
          a.lead ? a.lead.slice(0, 150) : null,
          a.startDate,
          a.endDate,
          a.budget,
          'pending',
          user.user_id,
        ]
      );
      activityIds.set(a.code, res.insertId);
    }

    // Dependencies
    for (const a of activities) {
      for (const pred of a.after) {
        await run('INSERT IGNORE INTO activity_dependencies (activity_id, predecessor_id) VALUES (?,?)',
          [activityIds.get(a.code), activityIds.get(pred)]);
      }
    }

    for (const tid of new Set(targetIds.values())) await syncTargetSpent(tid, conn);

    return { project_id: pid };
  });

  return { ok: true, dry_run: false, imported: true, project_id: result.project_id, summary, outline, warnings, errors: [] };
};

// ─────────────────────────────────────────────────────────────────────────────
// VIEW / EXPORT DATA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the plan rows for a project: objectives and activities in WBS order,
 * with week numbers and predecessor codes. Used by the plan view and by the
 * Excel / PDF exports so all three always agree.
 */
const getPlan = async (projectId) => {
  const prj = await query(
    `SELECT project_id, name, DATE_FORMAT(start_date,'%Y-%m-%d') AS start_date,
            DATE_FORMAT(end_date,'%Y-%m-%d') AS end_date
     FROM projects WHERE project_id = ?`, [projectId]);
  if (!prj.length) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  const project = prj[0];

  const objectives = await query(
    'SELECT objective_id, wbs_code, title, status FROM objectives WHERE project_id = ? ORDER BY created_at, objective_id',
    [projectId]);

  const acts = await query(
    `SELECT a.activity_id, a.wbs_code, a.name, a.lead_party, a.main_activity_id, a.sort_order, a.progress, a.status,
            DATE_FORMAT(a.start_date,'%Y-%m-%d') AS start_date, DATE_FORMAT(a.end_date,'%Y-%m-%d') AS end_date,
            t.objective_id, au.full_name AS assigned_user_name
     FROM activities a
     JOIN targets t     ON t.target_id = a.target_id
     JOIN objectives o  ON o.objective_id = t.objective_id
     LEFT JOIN users au ON au.user_id = a.assigned_user_id
     WHERE o.project_id = ?
     ORDER BY a.sort_order, a.activity_id`, [projectId]);

  const deps = acts.length
    ? await query(
      `SELECT d.activity_id, d.predecessor_id FROM activity_dependencies d
       WHERE d.activity_id IN (?)`, [acts.map((a) => a.activity_id)])
    : [];

  // Display codes: real wbs_code if present, otherwise generated so that legacy
  // projects (created before WBS) still produce a usable, re-importable plan.
  const used = new Set([...objectives.map((o) => o.wbs_code), ...acts.map((a) => a.wbs_code)].filter(Boolean));
  const fresh = (prefix, start) => {
    let i = start;
    while (used.has(prefix ? `${prefix}.${i}` : String(i))) i += 1;
    const code = prefix ? `${prefix}.${i}` : String(i);
    used.add(code);
    return { code, next: i + 1 };
  };

  let objCounter = 1;
  objectives.forEach((o) => {
    o.display_code = o.wbs_code;
    if (!o.display_code) {
      const f = fresh('', objCounter);
      o.display_code = f.code;
      objCounter = f.next;
    }
  });
  objectives.sort((a, b) => compareWbs(a.display_code, b.display_code));

  const byId = new Map(acts.map((a) => [a.activity_id, a]));
  const childCount = new Map();
  objectives.forEach((o) => {
    const mine = acts.filter((a) => a.objective_id === o.objective_id);
    let counter = 1;
    mine.filter((a) => !a.main_activity_id).forEach((a) => {
      a.display_code = a.wbs_code;
      if (!a.display_code) {
        const f = fresh(o.display_code, counter);
        a.display_code = f.code;
        counter = f.next;
      }
    });
  });
  acts.filter((a) => a.main_activity_id).forEach((a) => {
    const parent = byId.get(a.main_activity_id);
    a.display_code = a.wbs_code;
    if (!a.display_code) {
      const n = (childCount.get(parent.activity_id) || 0) + 1;
      childCount.set(parent.activity_id, n);
      const f = fresh(parent.display_code, n);
      a.display_code = f.code;
    }
  });

  const allStarts = [project.start_date, ...acts.map((a) => a.start_date)].filter(Boolean).sort();
  const allEnds = [project.end_date, ...acts.map((a) => a.end_date)].filter(Boolean).sort();
  const baseDate = allStarts[0] || null;
  const lastDate = allEnds[allEnds.length - 1] || null;
  const totalWeeks = baseDate && lastDate ? Math.max(weekOf(baseDate, lastDate), 1) : 0;

  const predsOf = new Map();
  deps.forEach((d) => {
    if (!predsOf.has(d.activity_id)) predsOf.set(d.activity_id, []);
    const p = byId.get(d.predecessor_id);
    if (p) predsOf.get(d.activity_id).push(p.display_code);
  });

  const rows = [];
  objectives.forEach((o) => {
    const mine = acts.filter((a) => a.objective_id === o.objective_id)
      .sort((a, b) => compareWbs(a.display_code, b.display_code));
    const dated = mine.filter((a) => a.start_date && a.end_date);
    const oStart = dated.map((a) => a.start_date).sort()[0] || null;
    const oEnd = dated.map((a) => a.end_date).sort().slice(-1)[0] || null;
    const avg = mine.length ? mine.reduce((s, a) => s + Number(a.progress || 0), 0) / mine.length : 0;
    rows.push({
      type: 'objective',
      id: o.objective_id,
      objective_id: o.objective_id,
      code: o.display_code,
      has_code: !!o.wbs_code,
      depth: 1,
      name: o.title,
      lead: null,
      after: [],
      start_date: oStart,
      end_date: oEnd,
      start_week: oStart && baseDate ? weekOf(baseDate, oStart) : null,
      end_week: oEnd && baseDate ? weekOf(baseDate, oEnd) : null,
      progress: Math.round(avg),
      status: o.status,
      assigned_user_name: null,
    });
    mine.forEach((a) => {
      rows.push({
        type: 'activity',
        id: a.activity_id,
        objective_id: o.objective_id,
        code: a.display_code,
        has_code: !!a.wbs_code,
        depth: a.main_activity_id ? 3 : 2,
        name: a.name,
        lead: a.lead_party,
        after: (predsOf.get(a.activity_id) || []).sort(compareWbs),
        start_date: a.start_date,
        end_date: a.end_date,
        start_week: a.start_date && baseDate ? weekOf(baseDate, a.start_date) : null,
        end_week: a.end_date && baseDate ? weekOf(baseDate, a.end_date) : null,
        progress: Number(a.progress || 0),
        status: a.status,
        assigned_user_name: a.assigned_user_name,
      });
    });
  });

  return {
    project: { project_id: project.project_id, name: project.name, base_date: baseDate, last_date: lastDate, total_weeks: totalWeeks },
    rows,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// DEPENDENCIES (single activity)
// ─────────────────────────────────────────────────────────────────────────────

const getActivityDependencies = async (activityId) => {
  const pred = await query(
    `SELECT a.activity_id, a.wbs_code, a.name, a.status, DATE_FORMAT(a.end_date,'%Y-%m-%d') AS end_date
     FROM activity_dependencies d JOIN activities a ON a.activity_id = d.predecessor_id
     WHERE d.activity_id = ? ORDER BY a.wbs_code, a.activity_id`, [activityId]);
  const succ = await query(
    `SELECT a.activity_id, a.wbs_code, a.name, a.status, DATE_FORMAT(a.start_date,'%Y-%m-%d') AS start_date
     FROM activity_dependencies d JOIN activities a ON a.activity_id = d.activity_id
     WHERE d.predecessor_id = ? ORDER BY a.wbs_code, a.activity_id`, [activityId]);
  return { predecessors: pred, successors: succ };
};

/** Replace the predecessor list of an activity. Rejects cross-project links and cycles. */
const setActivityPredecessors = async (activityId, predecessorIds) => {
  const ids = [...new Set(predecessorIds.map(Number))];
  if (ids.includes(Number(activityId))) throw new ApiError(httpStatus.BAD_REQUEST, 'An activity cannot depend on itself');

  const [me] = await query(
    `SELECT o.project_id FROM activities a JOIN targets t ON t.target_id = a.target_id
     JOIN objectives o ON o.objective_id = t.objective_id WHERE a.activity_id = ?`, [activityId]);
  if (!me) throw new ApiError(httpStatus.NOT_FOUND, 'Activity not found');

  if (ids.length) {
    const found = await query(
      `SELECT a.activity_id, o.project_id FROM activities a JOIN targets t ON t.target_id = a.target_id
       JOIN objectives o ON o.objective_id = t.objective_id WHERE a.activity_id IN (?)`, [ids]);
    if (found.length !== ids.length) throw new ApiError(httpStatus.BAD_REQUEST, 'One or more predecessor activities do not exist');
    if (found.some((f) => f.project_id !== me.project_id)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Predecessors must belong to the same project');
    }
  }

  // Cycle check: would any chosen predecessor already depend (transitively) on this activity?
  const all = await query(
    `SELECT d.activity_id, d.predecessor_id FROM activity_dependencies d
     JOIN activities a ON a.activity_id = d.activity_id JOIN targets t ON t.target_id = a.target_id
     JOIN objectives o ON o.objective_id = t.objective_id WHERE o.project_id = ? AND d.activity_id <> ?`,
    [me.project_id, activityId]);
  const preds = new Map();
  all.forEach((d) => { if (!preds.has(d.activity_id)) preds.set(d.activity_id, []); preds.get(d.activity_id).push(d.predecessor_id); });
  const seen = new Set();
  const stack = [...ids];
  while (stack.length) {
    const cur = stack.pop();
    if (cur === Number(activityId)) throw new ApiError(httpStatus.BAD_REQUEST, 'That would create a circular dependency');
    if (seen.has(cur)) continue;
    seen.add(cur);
    (preds.get(cur) || []).forEach((p) => stack.push(p));
  }

  await transaction(async (conn) => {
    await conn.query('DELETE FROM activity_dependencies WHERE activity_id = ?', [activityId]);
    for (const pid of ids) {
      await conn.query('INSERT INTO activity_dependencies (activity_id, predecessor_id) VALUES (?,?)', [activityId, pid]);
    }
  });
  return getActivityDependencies(activityId);
};

module.exports = { importPlan, getPlan, getActivityDependencies, setActivityPredecessors, weekOf };
