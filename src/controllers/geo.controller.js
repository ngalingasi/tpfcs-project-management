const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { query } = require('../config/database');
const geo = require('../models/geo.model');

/** Everyone who can see the project can see its map. Only admins and the project's own manager may change it. */
const assertCanManage = async (req) => {
  const rows = await query('SELECT project_manager_id FROM projects WHERE project_id = ?', [req.params.projectId]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  const isPm = rows[0].project_manager_id != null && Number(rows[0].project_manager_id) === Number(req.user.user_id);
  if (req.user.role !== 'admin' && !isPm) throw new ApiError(httpStatus.FORBIDDEN, 'Only an admin or the project manager can change map points');
};

const isTrue = (v) => v === true || v === 'true' || v === '1' || v === 1 || v === 'on';
const pid = (req) => Number(req.params.projectId);

const summary = catchAsync(async (req, res) => res.send(await geo.getSummary(pid(req))));
const map = catchAsync(async (req, res) => res.send(await geo.getMapPoints(pid(req), req.query)));
const list = catchAsync(async (req, res) => res.send(await geo.listPoints(pid(req), req.query)));
const get = catchAsync(async (req, res) => res.send(await geo.getPoint(pid(req), Number(req.params.pointId))));

const update = catchAsync(async (req, res) => {
  await assertCanManage(req);
  res.send(await geo.updatePoint(pid(req), Number(req.params.pointId), req.body || {}));
});

const remove = catchAsync(async (req, res) => {
  await assertCanManage(req);
  await geo.deletePoint(pid(req), Number(req.params.pointId));
  res.status(httpStatus.NO_CONTENT).send();
});

const removeMany = catchAsync(async (req, res) => {
  await assertCanManage(req);
  res.send(await geo.deletePoints(pid(req), req.body || {}));
});

const importCsv = catchAsync(async (req, res) => {
  await assertCanManage(req);
  if (!req.file) throw new ApiError(httpStatus.BAD_REQUEST, 'Attach the points as a .csv file in the "file" field');
  const b = req.body || {};
  const result = await geo.importPoints({
    projectId: pid(req),
    text: req.file.buffer.toString('utf8'),
    userId: req.user.user_id,
    // Safe default: anything that does not explicitly say dry_run=false is only a preview.
    dryRun: b.dry_run === undefined ? true : isTrue(b.dry_run),
    createMissing: isTrue(b.create_missing),
    linkRegions: isTrue(b.link_regions),
    skipInvalid: isTrue(b.skip_invalid),
  });
  res.status(result.ok ? (result.imported ? httpStatus.CREATED : httpStatus.OK) : httpStatus.UNPROCESSABLE_ENTITY).send(result);
});

const template = catchAsync(async (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="map_points_template.csv"');
  res.send(geo.templateCsv());
});

const exportCsv = catchAsync(async (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="project_${pid(req)}_map_points.csv"`);
  res.send(`﻿${await geo.exportCsv(pid(req), req.query)}`);
});

module.exports = { summary, map, list, get, update, remove, removeMany, importCsv, template, exportCsv };
