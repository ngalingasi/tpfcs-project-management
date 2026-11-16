/**
 * Plan exports (Excel + PDF) and the blank import template.
 *
 * Both exports are built from the rows returned by plan.model.getPlan so the
 * on-screen plan, the Excel file and the PDF always show the same thing.
 * The Excel export uses the same columns as the import template, so a
 * downloaded plan can be edited and imported again.
 */
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const WEEKS_PER_MONTH = 4.345;
const COLORS = {
  navy: 'FF1F2A44',
  section: 'FFDCE6F2',
  sectionText: 'FF1F2A44',
  bar: 'FF2E6FD8',
  barDone: 'FF1E9E5A',
  barSummary: 'FF1F2A44',
  grid: 'FFD0D5DD',
  white: 'FFFFFFFF',
};

const monthOfWeek = (week) => Math.floor((week - 1) / WEEKS_PER_MONTH) + 1;

/** Month groups for a plan of N weeks: [{ month, firstWeek, lastWeek }] */
const monthGroups = (totalWeeks) => {
  const groups = [];
  for (let w = 1; w <= totalWeeks; w += 1) {
    const m = monthOfWeek(w);
    const last = groups[groups.length - 1];
    if (last && last.month === m) last.lastWeek = w;
    else groups.push({ month: m, firstWeek: w, lastWeek: w });
  }
  return groups;
};

const barColor = (row) => {
  if (row.type === 'objective') return COLORS.barSummary;
  return row.progress >= 100 ? COLORS.barDone : COLORS.bar;
};

const fmtDate = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

// ── Excel template (blank) ───────────────────────────────────────────────────

const buildTemplateWorkbook = async () => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TPFCS Project Management';

  const ws = wb.addWorksheet('Plan', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'WBS', key: 'wbs', width: 9 },
    { header: 'TASK', key: 'task', width: 58 },
    { header: 'LEAD', key: 'lead', width: 20 },
    { header: 'AFTER', key: 'after', width: 14 },
    { header: 'START', key: 'start', width: 10 },
    { header: 'END', key: 'end', width: 10 },
    { header: 'TARGET', key: 'target', width: 28 },
    { header: 'REGION', key: 'region', width: 16 },
    { header: 'ASSIGNEE', key: 'assignee', width: 26 },
    { header: 'BUDGET', key: 'budget', width: 16 },
    { header: 'NOTES', key: 'notes', width: 36 },
  ];
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: COLORS.white } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
  head.alignment = { vertical: 'middle' };
  head.height = 22;

  // Text format on WBS / AFTER so Excel never turns "1.10" into 1.1
  ws.getColumn('wbs').numFmt = '@';
  ws.getColumn('after').numFmt = '@';

  const sample = [
    ['1', 'PROGRAMME MANAGEMENT', null, null, null, null],
    ['1.1', 'Project kickoff and mobilisation', 'Contractor', null, 'W1', 'W2', 'Mobilisation', 'Dar es Salaam', null, 0, null],
    ['1.2', 'Site survey', 'Contractor', '1.1', 'W3', 'W8', 'Mobilisation'],
    ['1.2.1', 'Survey, Dar es Salaam', 'Contractor', null, 'W3', 'W5'],
    ['2', 'PERMITS AND CLIENT PREREQUISITES', null, null, null, null],
    ['2.1', 'Road-reserve permits', 'Client', '1.2', 'W9', 'W14'],
  ];
  sample.forEach((r) => ws.addRow(r));
  ws.eachRow((row, n) => {
    if (n > 1 && !String(row.getCell(1).value).includes('.')) {
      row.font = { bold: true };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.section } };
    }
  });

  const help = wb.addWorksheet('How to use');
  help.getColumn(1).width = 16;
  help.getColumn(2).width = 100;
  const lines = [
    ['Sheet', 'Fill the "Plan" sheet, then upload it under Project → Plan → Import. Delete the sample rows first.'],
    ['WBS', 'Numbered code. "1" is a section (becomes an Objective). "1.2" is a task (becomes an Activity). "1.2.1" is a sub-task (becomes a Sub-activity of 1.2). Keep the column formatted as Text.'],
    ['TASK', 'Name of the section / task. Required.'],
    ['LEAD', 'Who is responsible, as free text (e.g. Client, Contractor, Client / ROM). Optional.'],
    ['AFTER', 'WBS code(s) that must finish first, separated by commas (e.g. 1.2, 1.4). Keep the column formatted as Text.'],
    ['START / END', 'Week numbers (W1, W2 … W52) counted from the plan start date you enter at import, or real dates (2026-03-01 or 01/03/2026). Use one style per file.'],
    ['TARGET', 'Optional. Tasks with the same TARGET name inside one section are grouped under one Target. If empty, one Target per section is created automatically.'],
    ['REGION', 'Optional. Must match a region name already in the system.'],
    ['ASSIGNEE', 'Optional. Email or username of an active user.'],
    ['BUDGET', 'Optional number. Left empty or 0 = no budget. Budgets must fit inside the project estimated cost.'],
    ['Re-import', 'A plan exported from the system uses this same layout, so it can be edited and imported into a new project.'],
  ];
  lines.forEach((l) => help.addRow(l));
  help.getColumn(1).font = { bold: true };
  help.getColumn(2).alignment = { wrapText: true, vertical: 'top' };

  return wb;
};

// ── Excel export (Gantt) ─────────────────────────────────────────────────────

const buildPlanWorkbook = async (plan) => {
  const { project, rows } = plan;
  const weeks = project.total_weeks || 0;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TPFCS Project Management';

  // Sheet 1: Gantt (same look as the source plan) ─────────────────────────────
  const ws = wb.addWorksheet('Plan', {
    views: [{ state: 'frozen', xSplit: 6, ySplit: 3 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  const FIXED = 6;
  const widths = [8, 56, 18, 14, 8, 8];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  for (let w = 1; w <= weeks; w += 1) ws.getColumn(FIXED + w).width = 3.2;

  ws.mergeCells(1, 1, 1, FIXED);
  ws.getCell(1, 1).value = project.name;
  ws.getCell(1, 1).font = { bold: true, size: 14 };
  ws.getRow(1).height = 24;

  // Row 2: months, row 3: column header + week numbers
  const groups = monthGroups(weeks);
  groups.forEach((g) => {
    const c1 = FIXED + g.firstWeek;
    const c2 = FIXED + g.lastWeek;
    if (c2 > c1) ws.mergeCells(2, c1, 2, c2);
    const cell = ws.getCell(2, c1);
    cell.value = `M${g.month}`;
    cell.alignment = { horizontal: 'center' };
  });
  ['WBS', 'TASK', 'LEAD', 'AFTER', 'START', 'END'].forEach((h, i) => { ws.getCell(3, i + 1).value = h; });
  for (let w = 1; w <= weeks; w += 1) {
    const c = ws.getCell(3, FIXED + w);
    c.value = w;
    c.alignment = { horizontal: 'center', textRotation: 90 };
    c.font = { size: 8 };
  }
  [2, 3].forEach((r) => {
    const row = ws.getRow(r);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > FIXED + weeks) return;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
      cell.font = { bold: true, color: { argb: COLORS.white }, size: cell.font?.size || 10 };
    });
  });
  ws.getRow(3).height = 28;

  rows.forEach((r) => {
    const row = ws.addRow([
      r.code,
      `${'    '.repeat(Math.max(r.depth - 2, 0))}${r.name}`,
      r.lead || '',
      r.after.join(', '),
      r.start_week ? `W${r.start_week}` : '',
      r.end_week ? `W${r.end_week}` : '',
    ]);
    row.getCell(1).numFmt = '@';
    row.getCell(4).numFmt = '@';
    const isObj = r.type === 'objective';
    if (isObj) {
      row.font = { bold: true, color: { argb: COLORS.sectionText } };
      for (let c = 1; c <= FIXED + weeks; c += 1) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.section } };
      }
    }
    if (r.start_week && r.end_week) {
      for (let w = r.start_week; w <= r.end_week && w <= weeks; w += 1) {
        const cell = row.getCell(FIXED + w);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: barColor(r) } };
      }
    }
    for (let c = 1; c <= FIXED + weeks; c += 1) {
      row.getCell(c).border = { bottom: { style: 'hair', color: { argb: COLORS.grid } } };
    }
  });

  // Sheet 2: flat import-ready layout ─────────────────────────────────────────
  const data = wb.addWorksheet('Plan data');
  data.columns = [
    { header: 'WBS', key: 'wbs', width: 9 },
    { header: 'TASK', key: 'task', width: 58 },
    { header: 'LEAD', key: 'lead', width: 20 },
    { header: 'AFTER', key: 'after', width: 14 },
    { header: 'START', key: 'start', width: 12 },
    { header: 'END', key: 'end', width: 12 },
    { header: 'START DATE', key: 'sd', width: 13 },
    { header: 'END DATE', key: 'ed', width: 13 },
    { header: 'PROGRESS %', key: 'progress', width: 12 },
    { header: 'STATUS', key: 'status', width: 14 },
    { header: 'ASSIGNEE', key: 'assignee', width: 24 },
  ];
  const dh = data.getRow(1);
  dh.font = { bold: true, color: { argb: COLORS.white } };
  dh.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
  data.getColumn('wbs').numFmt = '@';
  data.getColumn('after').numFmt = '@';
  data.views = [{ state: 'frozen', ySplit: 1 }];
  rows.forEach((r) => {
    const row = data.addRow({
      wbs: r.code,
      task: r.name,
      lead: r.lead || '',
      after: r.after.join(', '),
      start: r.start_week ? `W${r.start_week}` : '',
      end: r.end_week ? `W${r.end_week}` : '',
      sd: r.start_date || '',
      ed: r.end_date || '',
      progress: r.progress,
      status: r.status,
      assignee: r.assigned_user_name || '',
    });
    if (r.type === 'objective') {
      row.font = { bold: true };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.section } };
    }
  });

  return wb;
};

// ── PDF export (Gantt) ───────────────────────────────────────────────────────

/**
 * Stream a landscape A3 PDF of the plan into `res` (any writable stream).
 * Columns: WBS | TASK | LEAD | AFTER | START | END | week grid with M1..Mn.
 */
const streamPlanPdf = (plan, res) => {
  const { project, rows } = plan;
  const weeks = Math.max(project.total_weeks || 0, 1);

  const doc = new PDFDocument({ size: 'A3', layout: 'landscape', margin: 28, bufferPages: true });
  doc.pipe(res);

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const m = doc.page.margins.left;
  const colW = { wbs: 40, task: 300, lead: 90, after: 70, start: 34, end: 34 };
  const fixedW = Object.values(colW).reduce((a, b) => a + b, 0);
  const gridW = pageW - m * 2 - fixedW;
  const cell = Math.min(gridW / weeks, 14);
  const rowH = 15;
  const headH = 34;
  const topY = m + 34;

  const drawHeader = (y) => {
    doc.save().rect(m, y, fixedW + cell * weeks, headH).fill(`#${COLORS.navy.slice(2)}`).restore();
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
    let x = m;
    [['WBS', colW.wbs], ['TASK', colW.task], ['LEAD', colW.lead], ['AFTER', colW.after], ['START', colW.start], ['END', colW.end]]
      .forEach(([t, w]) => { doc.text(t, x + 3, y + headH - 13, { width: w - 4, lineBreak: false }); x += w; });
    monthGroups(weeks).forEach((g) => {
      const gx = m + fixedW + (g.firstWeek - 1) * cell;
      const gw = (g.lastWeek - g.firstWeek + 1) * cell;
      doc.save().rect(gx, y, gw, 15).lineWidth(0.4).strokeColor('#FFFFFF').stroke().restore();
      doc.fillColor('#FFFFFF').fontSize(7.5).text(`M${g.month}`, gx, y + 4, { width: gw, align: 'center', lineBreak: false });
    });
    doc.fontSize(5.5);
    for (let w = 1; w <= weeks; w += 1) {
      doc.text(String(w), m + fixedW + (w - 1) * cell, y + 21, { width: cell, align: 'center', lineBreak: false });
    }
    doc.fillColor('#000000');
  };

  const title = () => {
    doc.fillColor('#1F2A44').font('Helvetica-Bold').fontSize(14).text(project.name, m, m, { lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor('#667085').text(
      `Implementation plan · ${weeks} weeks${project.base_date ? ` · Week 1 starts ${fmtDate(project.base_date)}` : ''} · generated ${fmtDate(new Date().toISOString().slice(0, 10))}`,
      m, m + 17, { lineBreak: false });
  };

  title();
  let y = topY;
  drawHeader(y);
  y += headH;

  const clip = (s, w, size) => {
    doc.fontSize(size);
    let t = String(s || '');
    if (doc.widthOfString(t) <= w) return t;
    while (t.length > 1 && doc.widthOfString(`${t}…`) > w) t = t.slice(0, -1);
    return `${t}…`;
  };

  rows.forEach((r) => {
    if (y + rowH > pageH - m - 14) {
      doc.addPage({ size: 'A3', layout: 'landscape', margin: 28 });
      title();
      y = topY;
      drawHeader(y);
      y += headH;
    }
    const isObj = r.type === 'objective';
    if (isObj) {
      doc.save().rect(m, y, fixedW + cell * weeks, rowH).fill(`#${COLORS.section.slice(2)}`).restore();
    }
    doc.fillColor(isObj ? '#1F2A44' : '#101828').font(isObj ? 'Helvetica-Bold' : 'Helvetica');
    const indent = Math.max(r.depth - 2, 0) * 10;
    let x = m;
    const put = (t, w, pad = 0) => { doc.text(clip(t, w - 6 - pad, 7.5), x + 3 + pad, y + 4, { lineBreak: false }); x += w; };
    put(r.code, colW.wbs);
    put(r.name, colW.task, indent);
    put(r.lead || '', colW.lead);
    put(r.after.join(', '), colW.after);
    put(r.start_week ? `W${r.start_week}` : '', colW.start);
    put(r.end_week ? `W${r.end_week}` : '', colW.end);

    if (r.start_week && r.end_week) {
      const bx = m + fixedW + (r.start_week - 1) * cell;
      const bw = (Math.min(r.end_week, weeks) - r.start_week + 1) * cell;
      doc.save().rect(bx + 0.5, y + 3.5, Math.max(bw - 1, 1.5), rowH - 7).fill(`#${barColor(r).slice(2)}`).restore();
    }
    doc.save().moveTo(m, y + rowH).lineTo(m + fixedW + cell * weeks, y + rowH)
      .lineWidth(0.25).strokeColor('#D0D5DD').stroke().restore();
    y += rowH;
  });

  // Page numbers
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0; // writing in the footer must not trigger an automatic new page
    doc.font('Helvetica').fontSize(7).fillColor('#667085')
      .text(`Page ${i + 1} of ${range.count}`, m, pageH - m - 4, { width: pageW - m * 2, align: 'right', lineBreak: false });
  }
  doc.end();
};

module.exports = { buildTemplateWorkbook, buildPlanWorkbook, streamPlanPdf, monthGroups };
