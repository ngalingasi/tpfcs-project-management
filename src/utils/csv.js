/** Minimal CSV reader/writer (RFC 4180 quoting; comma, semicolon or tab separated; UTF-8 BOM tolerated). */

const detectDelimiter = (firstLine) => {
  const count = (ch) => (firstLine.split(ch).length - 1);
  const best = [[',', count(',')], [';', count(';')], ['\t', count('\t')]].sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ',';
};

/** Returns an array of rows, each an array of strings. Blank lines are skipped. */
const parseCsv = (text) => {
  const src = String(text).replace(/^﻿/, '');
  const delim = detectDelimiter(src.split(/\r?\n/, 1)[0] || '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
};

const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header, records) => `${[header.join(','), ...records.map((r) => r.map(cell).join(','))].join('\r\n')}\r\n`;

module.exports = { parseCsv, toCsv };
