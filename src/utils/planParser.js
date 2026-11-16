/**
 * Implementation-plan (WBS) Excel parser.
 *
 * Pure function: takes a workbook buffer and returns a normalised structure
 * plus warnings / errors. It never touches the database, so it can be unit
 * tested on its own and reused for the "check before import" preview.
 *
 * Two layouts are understood:
 *
 *  1. TEMPLATE layout — a header row with named columns:
 *       WBS | TASK | LEAD | AFTER | START | END | [TARGET] [REGION] [ASSIGNEE] [BUDGET] [DESCRIPTION]
 *     (also START DATE / END DATE for real dates). Anything else is ignored,
 *     which is why a file exported by this system can be re-imported.
 *
 *  2. LEGACY / printed layout — one text cell "2.3   Task name" followed by
 *     lead, after, start-week, end-week cells (the layout of the original
 *     Safe City plan). Section rows look like "2  PERMITS AND CLIENT PREREQUISITES".
 *
 * Hierarchy comes from the WBS code:
 *   "2"      -> objective
 *   "2.3"    -> activity
 *   "2.3.1"  -> sub-activity of "2.3"
 */
const ExcelJS = require('exceljs');
const { isValidWbs, wbsDepth, wbsParent, compareWbs } = require('./wbs');

const MAX_ROWS = 5000;

// ── Cell helpers ─────────────────────────────────────────────────────────────

/** Flatten ExcelJS cell values (rich text, formulas, hyperlinks) to a primitive. */
const norm = (v) => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
    if ('result' in v) return norm(v.result);
    if ('text' in v) return norm(v.text);
    return null;
  }
  if (typeof v === 'string') {
    const s = v.replace(/ /g, ' ').trim();
    return s === '' ? null : s;
  }
  return v;
};

const text = (v) => {
  const n = norm(v);
  if (n === null) return null;
  if (n instanceof Date) return n.toISOString().slice(0, 10);
  return String(n).trim();
};

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Interpret a START / END cell as either a week number ("W12", 12) or an
 * absolute calendar date. Returns { week } | { date } | null.
 */
const parseWhen = (raw) => {
  const v = norm(raw);
  if (v === null) return null;
  if (v instanceof Date) return { date: v.toISOString().slice(0, 10) };
  if (typeof v === 'number') {
    if (Number.isInteger(v) && v >= 1 && v <= 520) return { week: v };
    return { invalid: String(v) };
  }
  const s = String(v).trim();
  let m = s.match(/^w(?:eek)?\s*(\d{1,3})$/i);
  if (m) return { week: Number(m[1]) };
  m = s.match(/^(\d{1,3})$/);
  if (m) return { week: Number(m[1]) };
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { date: `${m[1]}-${pad2(m[2])}-${pad2(m[3])}` };
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // dd/mm/yyyy (Tanzania)
  if (m) return { date: `${m[3]}-${pad2(m[2])}-${pad2(m[1])}` };
  return { invalid: s };
};

const isRealDate = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
};

// ── Header detection ─────────────────────────────────────────────────────────

const HEADER_ALIASES = {
  wbs:         ['WBS', 'WBS CODE', 'CODE', 'ID'],
  task:        ['TASK', 'TASK NAME', 'ACTIVITY', 'ACTIVITY NAME', 'NAME', 'DESCRIPTION OF WORK'],
  lead:        ['LEAD', 'RESPONSIBLE', 'LEAD PARTY', 'OWNER'],
  after:       ['AFTER', 'PREDECESSORS', 'PREDECESSOR', 'DEPENDS ON', 'DEPENDENCIES'],
  start:       ['START', 'START WEEK'],
  end:         ['END', 'END WEEK', 'FINISH'],
  startDate:   ['START DATE'],
  endDate:     ['END DATE', 'FINISH DATE'],
  target:      ['TARGET', 'TARGET NAME'],
  region:      ['REGION'],
  assignee:    ['ASSIGNEE', 'ASSIGNED TO', 'ASSIGNEE EMAIL'],
  budget:      ['BUDGET', 'BUDGETED AMOUNT'],
  description: ['NOTES', 'DETAILS'],
};

const findHeader = (ws) => {
  const limit = Math.min(ws.rowCount, 40);
  for (let r = 1; r <= limit; r += 1) {
    const row = ws.getRow(r);
    const map = {};
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      if (cell.type === ExcelJS.ValueType.Merge) return;
      const label = (text(cell.value) || '').toUpperCase().replace(/\s+/g, ' ');
      if (!label) return;
      Object.entries(HEADER_ALIASES).forEach(([key, aliases]) => {
        if (map[key] === undefined && aliases.includes(label)) map[key] = col;
      });
    });
    // A real column header has WBS and TASK in *different* cells.
    if (map.wbs && map.task && map.wbs !== map.task) return { row: r, map };
  }
  return null;
};

// ── Row readers ──────────────────────────────────────────────────────────────

const isSkippableRuler = (s) => s && !/[A-Za-z]/.test(s); // "1   2   4   6 ..." week ruler

/** Read one row in TEMPLATE layout. */
const readTemplateRow = (ws, rowNumber, map) => {
  const row = ws.getRow(rowNumber);
  const get = (key) => (map[key] ? row.getCell(map[key]).value : null);
  const codeRaw = norm(get('wbs'));
  if (codeRaw === null) return null;
  const rec = {
    rowNumber,
    code: text(codeRaw),
    codeWasNumeric: typeof codeRaw === 'number',
    name: text(get('task')),
    lead: text(get('lead')),
    afterRaw: norm(get('after')),
    startRaw: map.startDate && norm(get('startDate')) !== null ? get('startDate') : get('start'),
    endRaw: map.endDate && norm(get('endDate')) !== null ? get('endDate') : get('end'),
    target: text(get('target')),
    region: text(get('region')),
    assignee: text(get('assignee')),
    budgetRaw: norm(get('budget')),
    description: text(get('description')),
  };
  return rec;
};

/** Read one row in LEGACY layout (WBS + task in one text cell). */
const readLegacyRow = (ws, rowNumber) => {
  const row = ws.getRow(rowNumber);
  const vals = [];
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (cell.type === ExcelJS.ValueType.Merge) return; // merged slave cell
    const n = norm(cell.value);
    if (n !== null) vals.push(n);
  });
  if (!vals.length) return null;
  const first = text(vals[0]);
  if (!first || /^WBS\b/i.test(first)) return null; // repeated page header
  const m = first.match(/^(\d+(?:\.\d+)*)\s+(.+)$/s);
  if (!m) return null;
  const [, code, name] = m;
  if (isSkippableRuler(name)) return null; // week ruler row
  const rest = vals.slice(1);
  const weeks = rest.filter((x) => /^W\d+$/i.test(String(x)));
  const others = rest.filter((x) => !/^W\d+$/i.test(String(x)));
  return {
    rowNumber,
    code,
    codeWasNumeric: false,
    name: name.replace(/\s+/g, ' ').trim(),
    lead: others.length ? text(others[0]) : null,
    afterRaw: others.length > 1 ? others[1] : null,
    startRaw: weeks[0] ?? null,
    endRaw: weeks[1] ?? weeks[0] ?? null,
    target: null,
    region: null,
    assignee: null,
    budgetRaw: null,
    description: null,
  };
};

// ── Main ─────────────────────────────────────────────────────────────────────

const parsePlanWorkbook = async (buffer) => {
  const warnings = [];
  const errors = [];
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (e) {
    return { objectives: [], activities: [], warnings, errors: ['The file is not a valid .xlsx workbook.'] };
  }

  const ws = wb.getWorksheet('Plan') || wb.worksheets.find((s) => s.rowCount > 0);
  if (!ws) {
    return { objectives: [], activities: [], warnings, errors: ['The workbook has no sheets with data.'] };
  }
  if (ws.rowCount > MAX_ROWS) {
    return { objectives: [], activities: [], warnings, errors: [`Sheet has more than ${MAX_ROWS} rows.`] };
  }

  const header = findHeader(ws);
  const records = [];
  for (let r = header ? header.row + 1 : 1; r <= ws.rowCount; r += 1) {
    const rec = header ? readTemplateRow(ws, r, header.map) : readLegacyRow(ws, r);
    if (rec && rec.code) records.push(rec);
  }

  const objectives = [];
  const activities = [];
  const objByCode = new Map();
  const actByCode = new Map();

  const addObjective = (code, title, rowNumber) => {
    if (objByCode.has(code)) return objByCode.get(code);
    const o = { code, title, rowNumber, auto: false };
    objectives.push(o);
    objByCode.set(code, o);
    return o;
  };

  records.forEach((rec) => {
    let { code } = rec;
    if (!isValidWbs(code)) {
      // Header-mode rows with free text in the WBS column (notes, totals…) are ignored with a warning.
      warnings.push(`Row ${rec.rowNumber}: "${code}" is not a valid WBS code (use 1, 1.2, 1.2.3). Row skipped.`);
      return;
    }
    if (rec.codeWasNumeric && /^\d+\.\d$/.test(code)) {
      warnings.push(`Row ${rec.rowNumber}: WBS "${code}" was typed as a number — if you meant "${code}0", format the WBS column as Text.`);
    }
    const depth = wbsDepth(code);
    const name = (rec.name || '').replace(/\s*\(continued\)\s*$/i, '').trim();

    if (depth === 1) {
      if (!name) { errors.push(`Row ${rec.rowNumber}: section ${code} has no title.`); return; }
      if (objByCode.has(code)) {
        if (!/\(continued\)/i.test(rec.name || '')) {
          errors.push(`Row ${rec.rowNumber}: duplicate section code ${code}.`);
        }
        return; // "(continued)" page-break repeat — ignore
      }
      addObjective(code, name, rec.rowNumber);
      return;
    }

    if (!name) { errors.push(`Row ${rec.rowNumber}: task ${code} has no name.`); return; }
    if (actByCode.has(code)) { errors.push(`Row ${rec.rowNumber}: duplicate WBS code ${code} (first used on row ${actByCode.get(code).rowNumber}).`); return; }
    if (depth > 3) { errors.push(`Row ${rec.rowNumber}: ${code} is nested too deep (maximum is 3 levels, e.g. 2.3.1).`); return; }

    const objectiveCode = code.split('.')[0];
    const act = {
      code,
      name,
      depth,
      parentCode: depth === 3 ? wbsParent(code) : null,
      objectiveCode,
      lead: rec.lead,
      afterRaw: rec.afterRaw,
      after: [],
      start: parseWhen(rec.startRaw),
      end: parseWhen(rec.endRaw),
      target: rec.target,
      region: rec.region,
      assignee: rec.assignee,
      budget: 0,
      description: rec.description,
      rowNumber: rec.rowNumber,
    };

    if (rec.budgetRaw !== null) {
      const b = Number(String(rec.budgetRaw).replace(/,/g, ''));
      if (Number.isNaN(b) || b < 0) errors.push(`Row ${rec.rowNumber}: budget "${rec.budgetRaw}" is not a valid amount.`);
      else act.budget = b;
    }
    activities.push(act);
    actByCode.set(code, act);
  });

  // Objectives implied by task codes but with no section row
  activities.forEach((a) => {
    if (!objByCode.has(a.objectiveCode)) {
      const o = addObjective(a.objectiveCode, `Workstream ${a.objectiveCode}`, a.rowNumber);
      o.auto = true;
      warnings.push(`No section row for WBS ${a.objectiveCode}; created "${o.title}". Add a row "${a.objectiveCode}" with a title to name it.`);
    }
  });

  // Sub-activity parents
  activities.forEach((a) => {
    if (a.depth === 3 && !actByCode.has(a.parentCode)) {
      errors.push(`Row ${a.rowNumber}: ${a.code} needs a parent task ${a.parentCode}, which is not in the file.`);
    }
  });

  // Dates
  activities.forEach((a) => {
    ['start', 'end'].forEach((k) => {
      const w = a[k];
      if (w && w.invalid) {
        errors.push(`Row ${a.rowNumber}: ${k.toUpperCase()} "${w.invalid}" is not a week (W12) or a date (2026-03-01 / 01/03/2026).`);
        a[k] = null;
      } else if (w && w.date && !isRealDate(w.date)) {
        errors.push(`Row ${a.rowNumber}: ${k.toUpperCase()} "${w.date}" is not a real date.`);
        a[k] = null;
      } else if (w && w.week !== undefined && w.week < 1) {
        errors.push(`Row ${a.rowNumber}: ${k.toUpperCase()} week must be 1 or higher.`);
        a[k] = null;
      }
    });
    if (!a.start || !a.end) {
      if (!a.start && !a.end) warnings.push(`Row ${a.rowNumber}: ${a.code} has no START/END — it will be created without dates.`);
      else {
        // One side only: treat as a single-point task
        if (!a.start) a.start = a.end;
        if (!a.end) a.end = a.start;
      }
    } else if ((a.start.week !== undefined) !== (a.end.week !== undefined)) {
      errors.push(`Row ${a.rowNumber}: START and END must both be weeks or both be dates.`);
    } else if (a.start.week !== undefined && a.end.week < a.start.week) {
      errors.push(`Row ${a.rowNumber}: END week W${a.end.week} is before START week W${a.start.week}.`);
    } else if (a.start.date && a.end.date && a.end.date < a.start.date) {
      errors.push(`Row ${a.rowNumber}: END date ${a.end.date} is before START date ${a.start.date}.`);
    }
  });

  // Predecessors ("AFTER")
  // A single predecessor typed as a number loses trailing zeros (9.10 becomes
  // 9.1), so "1.1" may really mean 1.10. We keep the literal reading but
  // report every such cell once so the user can check them.
  const ambiguous = [];
  activities.forEach((a) => {
    const raw = a.afterRaw;
    if (raw === null || raw === undefined) return;
    const numeric = typeof raw === 'number';
    const tokens = String(raw).split(/[,;\s]+/).map((t) => t.trim()).filter(Boolean);
    tokens.forEach((tok) => {
      let code = tok;
      if (!actByCode.has(code) && numeric && actByCode.has(`${tok}0`)) {
        code = `${tok}0`;
        warnings.push(`Row ${a.rowNumber}: AFTER "${tok}" is a number; read as ${code} because ${tok} does not exist. Format the AFTER column as Text to avoid this.`);
      } else if (numeric && actByCode.has(tok) && actByCode.has(`${tok}0`)) {
        ambiguous.push(`${a.code} (row ${a.rowNumber}) → ${tok}`);
      }
      if (code === a.code) { warnings.push(`Row ${a.rowNumber}: ${a.code} lists itself as a predecessor; ignored.`); return; }
      if (!actByCode.has(code)) {
        warnings.push(`Row ${a.rowNumber}: predecessor "${tok}" of ${a.code} is not a task in this file; ignored.`);
        return;
      }
      if (!a.after.includes(code)) a.after.push(code);
    });
  });

  if (ambiguous.length) {
    warnings.push(
      `${ambiguous.length} AFTER cell(s) hold a number that could be read two ways (e.g. 9.1 vs 9.10). ` +
      `The literal code was used. Please check: ${ambiguous.slice(0, 6).join('; ')}${ambiguous.length > 6 ? '; …' : ''}. ` +
      'Format the AFTER column as Text to avoid this.'
    );
  }

  // Circular dependencies
  const state = new Map();
  const stack = [];
  const visit = (code) => {
    if (state.get(code) === 2) return;
    if (state.get(code) === 1) {
      const cycle = [...stack.slice(stack.indexOf(code)), code];
      errors.push(`Circular dependency: ${cycle.join(' → ')}.`);
      return;
    }
    state.set(code, 1);
    stack.push(code);
    actByCode.get(code).after.forEach(visit);
    stack.pop();
    state.set(code, 2);
  };
  activities.forEach((a) => visit(a.code));

  objectives.sort((a, b) => compareWbs(a.code, b.code));
  activities.sort((a, b) => compareWbs(a.code, b.code));

  return { objectives, activities, warnings, errors, layout: header ? 'template' : 'legacy' };
};

module.exports = { parsePlanWorkbook, parseWhen };
