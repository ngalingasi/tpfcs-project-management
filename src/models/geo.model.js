const httpStatus = require('http-status');
const { query, transaction } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { parseCsv, toCsv } = require('../utils/csv');
const { normKey, tidy, closest } = require('../utils/textMatch');

/* ------------------------------------------------------------------ places chain used in every read */
const JOINS = `
  FROM geo_points p
  JOIN geo_layers l ON l.layer_id    = p.layer_id
  JOIN wards w      ON w.ward_id     = p.ward_id
  JOIN councils c   ON c.council_id  = w.council_id
  JOIN districts d  ON d.district_id = c.district_id
  JOIN regions r    ON r.region_id   = d.region_id
  LEFT JOIN streets s ON s.street_id = p.street_id`;

const POINT_COLUMNS = `
  p.point_id, p.project_id, p.layer_id, l.name AS layer_name, l.color AS layer_color,
  p.point_no, p.road_name, p.description, p.global_id, p.latitude, p.longitude, p.status,
  w.ward_id, w.name AS ward, c.council_id, c.name AS council, d.district_id, d.name AS district,
  r.region_id, r.region_name AS region, s.street_id, s.name AS street, p.created_at`;

const toId = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

/** Builds the WHERE for the filters the list, the map and bulk delete all share. */
const buildWhere = (projectId, f = {}) => {
  const where = ['p.project_id = ?'];
  const params = [projectId];
  [['layer_id', 'p.layer_id'], ['region_id', 'r.region_id'], ['district_id', 'd.district_id'],
    ['council_id', 'c.council_id'], ['ward_id', 'w.ward_id'], ['street_id', 'p.street_id']].forEach(([key, col]) => {
    const v = toId(f[key]);
    if (v != null && !Number.isNaN(v)) { where.push(`${col} = ?`); params.push(v); }
  });
  if (f.layer_ids) {
    const ids = String(f.layer_ids).split(',').map(Number).filter(Number.isInteger);
    if (ids.length) { where.push('p.layer_id IN (?)'); params.push(ids); }
  }
  if (f.status === 'active' || f.status === 'inactive') { where.push('p.status = ?'); params.push(f.status); }
  const q = tidy(f.q);
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    where.push('(p.point_no LIKE ? OR p.road_name LIKE ? OR p.global_id LIKE ? OR s.name LIKE ? OR w.name LIKE ?)');
    params.push(like, like, like, like, like);
  }
  return { sql: where.join(' AND '), params };
};

/* ------------------------------------------------------------------ reads */
const getSummary = async (projectId) => {
  const [totals] = await query('SELECT COUNT(*) AS total FROM geo_points WHERE project_id = ?', [projectId]);
  const layers = await query(
    `SELECT l.layer_id, l.name, l.color, COUNT(p.point_id) AS count
       FROM geo_layers l JOIN geo_points p ON p.layer_id = l.layer_id AND p.project_id = ?
      GROUP BY l.layer_id, l.name, l.color ORDER BY l.name`, [projectId]);
  const places = await query(
    `SELECT r.region_id, r.region_name AS region, d.district_id, d.name AS district,
            c.council_id, c.name AS council, w.ward_id, w.name AS ward, COUNT(*) AS count
       ${JOINS}
      WHERE p.project_id = ?
      GROUP BY r.region_id, r.region_name, d.district_id, d.name, c.council_id, c.name, w.ward_id, w.name
      ORDER BY r.region_name, d.name, c.name, w.name`, [projectId]);
  const regions = await query(
    `SELECT r.region_id, r.region_name FROM project_regions pr JOIN regions r ON r.region_id = pr.region_id
      WHERE pr.project_id = ? ORDER BY r.region_name`, [projectId]);
  return { total: Number(totals.total), layers: layers.map((x) => ({ ...x, count: Number(x.count) })), places, project_regions: regions };
};

const MAP_LIMIT = 50000;
/** Compact data for drawing pins: [id, layer_id, lat, lng]. Details are fetched when a pin is clicked. */
const getMapPoints = async (projectId, filters) => {
  const { sql, params } = buildWhere(projectId, filters);
  const rows = await query(`SELECT p.point_id, p.layer_id, p.latitude, p.longitude ${JOINS} WHERE ${sql} LIMIT ${MAP_LIMIT + 1}`, params);
  const truncated = rows.length > MAP_LIMIT;
  return { truncated, points: rows.slice(0, MAP_LIMIT).map((x) => [x.point_id, x.layer_id, Number(x.latitude), Number(x.longitude)]) };
};

const listPoints = async (projectId, filters = {}) => {
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(filters.limit, 10) || 50));
  const { sql, params } = buildWhere(projectId, filters);
  const [{ total }] = await query(`SELECT COUNT(*) AS total ${JOINS} WHERE ${sql}`, params);
  const results = await query(
    `SELECT ${POINT_COLUMNS} ${JOINS} WHERE ${sql} ORDER BY r.region_name, d.name, w.name, p.point_id LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params);
  return { results, page, limit, total: Number(total), totalPages: Math.max(1, Math.ceil(Number(total) / limit)) };
};

const getPoint = async (projectId, pointId) => {
  const rows = await query(`SELECT ${POINT_COLUMNS} ${JOINS} WHERE p.project_id = ? AND p.point_id = ?`, [projectId, pointId]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Point not found');
  return rows[0];
};

/* ------------------------------------------------------------------ edit / delete */
const EDITABLE = ['point_no', 'road_name', 'description', 'latitude', 'longitude', 'status', 'layer_id'];

const updatePoint = async (projectId, pointId, body) => {
  await getPoint(projectId, pointId);
  const sets = [];
  const params = [];
  EDITABLE.forEach((k) => {
    if (body[k] === undefined) return;
    let v = body[k];
    if (k === 'latitude' || k === 'longitude') {
      v = Number(v);
      const max = k === 'latitude' ? 90 : 180;
      if (!Number.isFinite(v) || Math.abs(v) > max) throw new ApiError(httpStatus.BAD_REQUEST, `${k} is not a valid number`);
    } else if (k === 'layer_id') v = Number(v);
    else if (k === 'status') { if (!['active', 'inactive'].includes(v)) throw new ApiError(httpStatus.BAD_REQUEST, 'status must be active or inactive'); } else v = tidy(v) || null;
    sets.push(`${k} = ?`); params.push(v);
  });
  if (!sets.length) throw new ApiError(httpStatus.BAD_REQUEST, 'Nothing to update');
  if (body.layer_id !== undefined) {
    const l = await query('SELECT layer_id FROM geo_layers WHERE layer_id = ?', [Number(body.layer_id)]);
    if (!l.length) throw new ApiError(httpStatus.BAD_REQUEST, 'Unknown layer');
  }
  await query(`UPDATE geo_points SET ${sets.join(', ')} WHERE project_id = ? AND point_id = ?`, [...params, projectId, pointId]);
  return getPoint(projectId, pointId);
};

const deleteChunked = async (projectId, ids) => {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 1000) {
    const res = await query('DELETE FROM geo_points WHERE project_id = ? AND point_id IN (?)', [projectId, ids.slice(i, i + 1000)]);
    deleted += res.affectedRows || 0;
  }
  return deleted;
};

const deletePoint = async (projectId, pointId) => {
  await getPoint(projectId, pointId);
  await query('DELETE FROM geo_points WHERE project_id = ? AND point_id = ?', [projectId, pointId]);
};

/**
 * Bulk delete, either by explicit ids or by "everything matching these filters".
 * The filter form must say how many points the person was shown (expected_count); if the data changed since, nothing is deleted.
 */
const deletePoints = async (projectId, { ids, filters, expected_count: expected }) => {
  if (Array.isArray(ids)) {
    const clean = [...new Set(ids.map(Number).filter(Number.isInteger))];
    if (!clean.length) throw new ApiError(httpStatus.BAD_REQUEST, 'No points selected');
    return { deleted: await deleteChunked(projectId, clean) };
  }
  if (filters && typeof filters === 'object') {
    const { sql, params } = buildWhere(projectId, filters);
    const found = await query(`SELECT p.point_id ${JOINS} WHERE ${sql}`, params);
    if (Number(expected) !== found.length) {
      throw new ApiError(httpStatus.CONFLICT, `The list now has ${found.length} points, not ${expected}. Reload and try again.`);
    }
    return { deleted: await deleteChunked(projectId, found.map((x) => x.point_id)) };
  }
  throw new ApiError(httpStatus.BAD_REQUEST, 'Send either ids, or filters with expected_count');
};

/* ------------------------------------------------------------------ CSV: template / export */
const CSV_HEADER = ['layer', 'region', 'district', 'council', 'ward', 'street', 'point_no', 'road_name', 'description', 'global_id', 'latitude', 'longitude'];

const templateCsv = () => toCsv(CSV_HEADER, [
  ['Camera Poles', 'Dar es Salaam', 'Ilala', 'Ilala', 'Kariakoo', 'Msimbazi', '01', 'Msimbazi/Tandamti', '', '{D6B2A36E-35FB-4771-91C6-C8023BB89ECF}', '-6.82091', '39.2729'],
]);

const exportCsv = async (projectId, filters) => {
  const { sql, params } = buildWhere(projectId, filters);
  const rows = await query(`SELECT ${POINT_COLUMNS} ${JOINS} WHERE ${sql} ORDER BY r.region_name, d.name, w.name, p.point_id`, params);
  return toCsv(CSV_HEADER, rows.map((x) => [x.layer_name, x.region, x.district, x.council, x.ward, x.street, x.point_no, x.road_name,
    x.description, x.global_id, x.latitude, x.longitude]));
};

/* ------------------------------------------------------------------ CSV: import */
const HEADER_ALIASES = {
  layer: ['layer', 'type', 'maptype', 'maptypename', 'category'],
  region: ['region', 'mkoa'],
  district: ['district', 'wilaya'],
  council: ['council', 'lga', 'halmashauri'],
  ward: ['ward', 'kata'],
  street: ['street', 'mtaa', 'village', 'kijiji'],
  point_no: ['pointno', 'point', 'no', 'number', 'camerano', 'poleno', 'id'],
  road_name: ['roadname', 'road', 'location', 'landmark'],
  description: ['description', 'notes', 'note', 'remarks'],
  global_id: ['globalid', 'guid', 'gid', 'uid'],
  latitude: ['latitude', 'lat', 'y'],
  longitude: ['longitude', 'lng', 'lon', 'long', 'x'],
};

// Mainland + Zanzibar bounding box; points outside get a warning, not an error.
const TZ = { latMin: -11.8, latMax: -0.9, lngMin: 29.3, lngMax: 40.5 };
const MAX_ISSUES = 200;

const mapHeader = (headerRow) => {
  const idx = {};
  headerRow.forEach((h, i) => {
    const k = normKey(h);
    const field = Object.keys(HEADER_ALIASES).find((f) => HEADER_ALIASES[f].includes(k));
    if (field && idx[field] === undefined) idx[field] = i;
  });
  return idx;
};

/**
 * Reads a points CSV and works out what an import would do. Nothing is written unless `commit` is true.
 *
 *   createMissing  add layers/places that do not exist yet (otherwise rows naming them are errors)
 *   linkRegions    add regions named in the file to the project (otherwise they are errors)
 *   skipInvalid    commit the good rows and leave the bad ones out (otherwise any error stops the import)
 *
 * `db` is { q(sql, params) -> rows }; commit runs inside a transaction.
 */
const planImport = async (db, { projectId, text, createMissing, linkRegions }) => {
  const table = parseCsv(text);
  if (table.length < 2) throw new ApiError(httpStatus.BAD_REQUEST, 'The file has no data rows');
  const col = mapHeader(table[0]);
  const missingCols = ['ward', 'latitude', 'longitude', 'district', 'council'].filter((f) => col[f] === undefined);
  if (missingCols.length) throw new ApiError(httpStatus.BAD_REQUEST, `Missing column(s): ${missingCols.join(', ')}. Download the template to see the expected columns.`);
  if (col.layer === undefined) throw new ApiError(httpStatus.BAD_REQUEST, 'Missing column: layer');

  const issues = { errors: [], warnings: [] };
  const counts = { errors: 0, warnings: 0 };
  const addIssue = (kind, line, message) => {
    counts[kind] += 1;
    if (issues[kind].length < MAX_ISSUES) issues[kind].push({ line, message });
  };

  // existing data ----------------------------------------------------------------------------------------
  const allRegions = await db.q('SELECT region_id, region_name FROM regions');
  const regionByKey = new Map(allRegions.map((r) => [normKey(r.region_name), r]));
  const linked = await db.q('SELECT region_id FROM project_regions WHERE project_id = ?', [projectId]);
  const linkedIds = new Set(linked.map((x) => Number(x.region_id)));
  const layers = await db.q('SELECT layer_id, name FROM geo_layers');
  const layerByKey = new Map(layers.map((l) => [normKey(l.name), { uid: `l${l.layer_id}`, id: l.layer_id, name: l.name }]));

  // place entries: {uid,id,name,parent,level}; new ones have id null until commit
  const entries = new Map();      // `${parentUid}|${key}` -> entry
  const created = [];             // new entries in creation order (parents always before children)
  const loadedRegions = new Set();
  const siblingsOf = new Map();   // `${level}|${parentUid}` -> [names] (for "did you mean")
  let seq = 0;

  const loadRegion = async (region) => {
    if (loadedRegions.has(region.region_id)) return;
    loadedRegions.add(region.region_id);
    const ds = await db.q('SELECT district_id, name FROM districts WHERE region_id = ?', [region.region_id]);
    const cs = ds.length ? await db.q('SELECT council_id, district_id, name FROM councils WHERE district_id IN (?)', [ds.map((d) => d.district_id)]) : [];
    const ws = cs.length ? await db.q('SELECT ward_id, council_id, name FROM wards WHERE council_id IN (?)', [cs.map((c) => c.council_id)]) : [];
    const ss = ws.length ? await db.q('SELECT street_id, ward_id, name FROM streets WHERE ward_id IN (?)', [ws.map((w) => w.ward_id)]) : [];
    const put = (level, parentUid, idField, row) => {
      const e = { uid: `${level[0]}${row[idField]}`, id: row[idField], name: row.name, level, parentUid };
      entries.set(`${parentUid}|${normKey(row.name)}`, e);
      const sk = `${level}|${parentUid}`;
      if (!siblingsOf.has(sk)) siblingsOf.set(sk, []);
      siblingsOf.get(sk).push(row.name);
    };
    ds.forEach((d) => put('district', `r${region.region_id}`, 'district_id', d));
    cs.forEach((c) => put('council', `d${c.district_id}`, 'council_id', c));
    ws.forEach((w) => put('ward', `c${w.council_id}`, 'ward_id', w));
    ss.forEach((s) => put('street', `w${s.ward_id}`, 'street_id', s));
  };

  const newLayers = [];
  const similar = [];   // "did you mean" notes for places that would be created
  const suggestions = new Set();

  /** Finds (or plans) one place under a parent. Returns the entry, or null when it does not exist and may not be created. */
  const place = (level, parent, name, line) => {
    const key = `${parent.uid}|${normKey(name)}`;
    let e = entries.get(key);
    if (e) return e;
    if (!createMissing) return null;
    seq += 1;
    e = { uid: `n${seq}`, id: null, name, level, parent, parentUid: parent.uid };
    entries.set(key, e);
    created.push(e);
    const sk = `${level}|${parent.uid}`;
    const sibs = siblingsOf.get(sk) || [];
    const near = closest(name, sibs, 2);
    if (near && !suggestions.has(`${level}|${parent.uid}|${name}`)) {
      suggestions.add(`${level}|${parent.uid}|${name}`);
      similar.push({ level, name, similar_to: near, parent: parent.name, line });
    }
    if (!siblingsOf.has(sk)) siblingsOf.set(sk, []);
    siblingsOf.get(sk).push(name);
    return e;
  };

  // rows -------------------------------------------------------------------------------------------------
  const projectRegionList = allRegions.filter((r) => linkedIds.has(Number(r.region_id)));
  const planned = [];
  const seenGlobal = new Map();
  const get = (row, f) => (col[f] === undefined ? '' : tidy(row[col[f]]));

  for (let i = 1; i < table.length; i += 1) {
    const row = table[i];
    const line = i + 1;
    const before = counts.errors;
    const bad = (msg) => addIssue('errors', line, msg);

    // layer
    const layerName = get(row, 'layer');
    let layer = null;
    if (!layerName) bad('layer is empty');
    else {
      layer = layerByKey.get(normKey(layerName));
      if (!layer) {
        if (createMissing) {
          layer = { uid: `nl${newLayers.length}`, id: null, name: layerName };
          layerByKey.set(normKey(layerName), layer);
          newLayers.push(layer);
        } else bad(`Unknown layer "${layerName}"${closest(layerName, layers.map((l) => l.name), 3) ? ` (did you mean "${closest(layerName, layers.map((l) => l.name), 3)}"?)` : ''}`);
      }
    }

    // coordinates
    const lat = Number(get(row, 'latitude'));
    const lng = Number(get(row, 'longitude'));
    if (!get(row, 'latitude') || !get(row, 'longitude') || !Number.isFinite(lat) || !Number.isFinite(lng)) bad('latitude/longitude must be numbers');
    else if (Math.abs(lat) > 90 || Math.abs(lng) > 180) bad('latitude/longitude out of range');
    else if (lat < TZ.latMin || lat > TZ.latMax || lng < TZ.lngMin || lng > TZ.lngMax) {
      addIssue('warnings', line, `Coordinates ${lat}, ${lng} are outside Tanzania - check they are not swapped`);
    }

    // region
    let region = null;
    const regionName = get(row, 'region');
    if (!regionName) {
      if (projectRegionList.length === 1) region = projectRegionList[0];
      else bad(projectRegionList.length ? 'region is empty and the project has several regions' : 'region is empty and the project has no regions set');
    } else {
      region = regionByKey.get(normKey(regionName)) || null;
      if (!region) {
        const near = closest(regionName, allRegions.map((r) => r.region_name), 3);
        bad(`Unknown region "${regionName}"${near ? ` (did you mean "${near}"?)` : ''}`);
      }
    }
    if (region && !linkedIds.has(Number(region.region_id))) {
      if (!linkRegions) {
        bad(`Region "${region.region_name}" is not one of this project's regions. Add it to the project first.`);
        region = null; // no point checking its places as well
      }
    }

    // places
    let ward = null;
    let street = null;
    const dName = get(row, 'district'); const cName = get(row, 'council'); const wName = get(row, 'ward'); const sName = get(row, 'street');
    if (!dName || !cName || !wName) bad('district, council and ward are required');
    else if (region) {
      // eslint-disable-next-line no-await-in-loop
      await loadRegion(region);
      const d = place('district', { uid: `r${region.region_id}`, name: region.region_name }, dName, line);
      const c = d && place('council', d, cName, line);
      ward = c && place('ward', c, wName, line);
      if (!d) bad(`District "${dName}" does not exist in ${region.region_name}`);
      else if (!c) bad(`Council "${cName}" does not exist in district ${d.name}`);
      else if (!ward) bad(`Ward "${wName}" does not exist in council ${c.name}`);
      else if (sName) street = place('street', ward, sName, line);
    }

    // global id
    const gid = get(row, 'global_id') || null;
    if (gid && gid.length > 64) bad('global_id is longer than 64 characters');
    if (gid && seenGlobal.has(gid.toLowerCase())) addIssue('warnings', line, `global_id repeats line ${seenGlobal.get(gid.toLowerCase())}; the later row wins`);
    if (gid) seenGlobal.set(gid.toLowerCase(), line);

    const pointNo = get(row, 'point_no') || null;
    if (pointNo && pointNo.length > 50) bad('point_no is longer than 50 characters');
    const road = get(row, 'road_name') || null;
    if (road && road.length > 255) bad('road_name is longer than 255 characters');

    planned.push({ line, ok: counts.errors === before, regionId: region ? Number(region.region_id) : null, layer, ward, street, pointNo, road, description: get(row, 'description') || null, gid, lat, lng });
  }

  // work out insert vs update -------------------------------------------------------------------------------
  const existing = new Set((await db.q('SELECT global_id FROM geo_points WHERE project_id = ? AND global_id IS NOT NULL', [projectId])).map((x) => x.global_id.toLowerCase()));
  const good = planned.filter((p) => p.ok);
  // a repeated global_id inside the file collapses to its last row
  const lastByGid = new Map();
  good.forEach((p) => { if (p.gid) lastByGid.set(p.gid.toLowerCase(), p); });
  const finalRows = good.filter((p) => !p.gid || lastByGid.get(p.gid.toLowerCase()) === p);
  // regions/layers that only bad rows needed are left out
  const linksNeeded = new Set(finalRows.map((p) => p.regionId).filter((id) => id != null && !linkedIds.has(id)));
  const layersNeeded = newLayers.filter((l) => finalRows.some((p) => p.layer === l));
  const toUpdate = finalRows.filter((p) => p.gid && existing.has(p.gid.toLowerCase())).length;

  // only count places that some good row actually uses
  const used = new Set();
  finalRows.forEach((p) => { for (let e = p.street || p.ward; e; e = e.parent) used.add(e.uid); });
  const usedCreated = created.filter((e) => used.has(e.uid));
  const usedCounts = { districts: 0, councils: 0, wards: 0, streets: 0 };
  usedCreated.forEach((e) => { usedCounts[`${e.level}s`] += 1; });

  const summary = {
    rows: table.length - 1,
    valid_rows: good.length,
    invalid_rows: planned.length - good.length,
    to_insert: finalRows.length - toUpdate,
    to_update: toUpdate,
    new_layers: layersNeeded.map((l) => l.name),
    new_places: usedCounts,
    new_project_regions: [...linksNeeded].map((id) => allRegions.find((r) => Number(r.region_id) === id).region_name),
    error_total: counts.errors,
    warning_total: counts.warnings,
  };
  return { summary, errors: issues.errors, warnings: issues.warnings, similar: similar.slice(0, 100), finalRows, usedCreated, newLayers: layersNeeded, newLinks: linksNeeded };
};

const ensureProject = async (projectId) => {
  const rows = await query('SELECT project_id FROM projects WHERE project_id = ?', [projectId]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
};

const importPoints = async ({ projectId, text, userId = null, dryRun = true, createMissing = false, linkRegions = false, skipInvalid = false }) => {
  await ensureProject(projectId);
  const db = { q: (sql, p) => query(sql, p) };
  const plan = await planImport(db, { projectId, text, createMissing, linkRegions });
  const { summary } = plan;
  const base = { dry_run: dryRun, summary, errors: plan.errors, warnings: plan.warnings, similar: plan.similar };
  const blocked = summary.error_total > 0 && !skipInvalid;
  if (dryRun || blocked || summary.valid_rows === 0) {
    return { ...base, ok: !blocked && summary.valid_rows > 0, imported: false };
  }

  await transaction(async (conn) => {
    const q = async (sql, p) => (await conn.query(sql, p))[0];
    for (const regionId of plan.newLinks) {
      // eslint-disable-next-line no-await-in-loop
      await q('INSERT INTO project_regions (project_id, region_id, created_by) VALUES (?,?,?)', [projectId, regionId, userId]);
    }
    for (const l of plan.newLayers) {
      // eslint-disable-next-line no-await-in-loop
      const res = await q('INSERT INTO geo_layers (name) VALUES (?)', [l.name]);
      l.id = res.insertId;
    }
    const TABLE = {
      district: ['districts', 'region_id', 'district_id'], council: ['councils', 'district_id', 'council_id'],
      ward: ['wards', 'council_id', 'ward_id'], street: ['streets', 'ward_id', 'street_id'],
    };
    for (const e of plan.usedCreated) {
      const [table, parentCol] = TABLE[e.level];
      const parentId = e.level === 'district' ? Number(String(e.parentUid).slice(1)) : e.parent.id;
      // eslint-disable-next-line no-await-in-loop
      const res = await q(`INSERT INTO ${table} (${parentCol}, name) VALUES (?, ?)`, [parentId, e.name]);
      e.id = res.insertId;
    }
    for (let i = 0; i < plan.finalRows.length; i += 500) {
      const chunk = plan.finalRows.slice(i, i + 500).map((p) => [projectId, p.layer.id, p.ward.id, p.street ? p.street.id : null,
        p.pointNo, p.road, p.description, p.gid, p.lat, p.lng, userId]);
      // eslint-disable-next-line no-await-in-loop
      await q(
        `INSERT INTO geo_points (project_id, layer_id, ward_id, street_id, point_no, road_name, description, global_id, latitude, longitude, created_by)
         VALUES ?
         ON DUPLICATE KEY UPDATE layer_id = VALUES(layer_id), ward_id = VALUES(ward_id), street_id = VALUES(street_id),
           point_no = VALUES(point_no), road_name = VALUES(road_name), description = VALUES(description),
           latitude = VALUES(latitude), longitude = VALUES(longitude)`,
        [chunk]
      );
    }
  });
  return { ...base, ok: true, imported: true };
};

module.exports = {
  getSummary, getMapPoints, listPoints, getPoint, updatePoint, deletePoint, deletePoints,
  templateCsv, exportCsv, importPoints, planImport,
};
