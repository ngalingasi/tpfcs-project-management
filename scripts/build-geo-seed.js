#!/usr/bin/env node
/**
 * Turns the old CSMIS `map_types_coordinates` dump into a clean CSV that the geo importer accepts.
 *
 *   node scripts/build-geo-seed.js path/to/port_db.sql
 *
 * Writes database/seeds/geo_points_seed.csv and database/seeds/geo_cleaning_report.txt.
 * Nothing is dropped: every row is kept. Only spelling of place names is fixed, and every change is listed in the report.
 */
const fs = require('fs');
const path = require('path');
const { normKey, tidy, distance } = require('../src/utils/textMatch');

const src = process.argv[2];
if (!src) { console.error('Usage: node scripts/build-geo-seed.js <dump.sql>'); process.exit(1); }
const sql = fs.readFileSync(src, 'utf8');

// ---- read rows -------------------------------------------------------------------------------
const LAYERS = { 1: 'Camera Poles', 2: 'Electric Poles', 3: 'TTCL Closure' };
const rows = [];
for (const m of sql.matchAll(/^\((\d+), (\d+), (.*)\)[,;]$/gm)) {
  const vals = [...m[3].matchAll(/'((?:[^'\\]|\\.|'')*)'|(NULL)/g)].map((x) => (x[2] ? null : x[1].replace(/\\'|''/g, "'")));
  const [region, district, council, ward, street, pointNo, road, desc, gid, lat, lng] = vals;
  rows.push({ layer: LAYERS[m[2]] || `Layer ${m[2]}`, region, district, council, ward, street, pointNo, road, desc, gid, lat, lng });
}

const changes = new Map(); // "level: from -> to" -> count
const note = (level, from, to) => { if (from !== to) { const k = `${level}: "${from}" -> "${to}"`; changes.set(k, (changes.get(k) || 0) + 1); } };
const count = (arr) => arr.reduce((m, v) => m.set(v, (m.get(v) || 0) + 1), new Map());
const mostCommon = (arr) => [...count(arr)].sort((a, b) => b[1] - a[1])[0][0];

// ---- districts: match to the known list, typos allowed -----------------------------------------
const KNOWN_DISTRICTS = { Ilala: 'Dar es Salaam', Kinondoni: 'Dar es Salaam', Temeke: 'Dar es Salaam', Kigamboni: 'Dar es Salaam', Ubungo: 'Dar es Salaam', Dodoma: 'Dodoma', Arusha: 'Arusha' };
const knownKeys = Object.keys(KNOWN_DISTRICTS).map((n) => [normKey(n), n]);
const matchDistrict = (raw) => {
  const k = normKey(raw);
  if (!k) return null;
  const exact = knownKeys.find(([kk]) => kk === k);
  if (exact) return exact[1];
  let best = null; let bd = 3;
  knownKeys.forEach(([kk, n]) => { const d = distance(k, kk, 2); if (d < bd) { bd = d; best = n; } });
  if (best) return best;
  const pre = knownKeys.find(([kk]) => k.length >= 3 && kk.startsWith(k)); // "Aru" -> Arusha
  return pre ? pre[1] : null;
};
rows.forEach((r) => { r.districtRaw = r.district; r.district = matchDistrict(r.district); });

// rows whose district is unusable ("Mjimwema", "", ...): take the district most other rows of the same ward have
const wardDistrict = new Map();
rows.filter((r) => r.district).forEach((r) => {
  const k = normKey(r.ward); if (!wardDistrict.has(k)) wardDistrict.set(k, []); wardDistrict.get(k).push(r.district);
});
rows.forEach((r) => {
  if (!r.district) {
    const g = wardDistrict.get(normKey(r.ward));
    r.district = g ? mostCommon(g) : (matchDistrict(r.council) || null);
    note('district (inferred from ward)', r.districtRaw || '(blank)', r.district || '(unresolved)');
  } else note('district', tidy(r.districtRaw), r.district);
});

// ---- region: derived from the district (it is the same information, and the source region is full of typos) ----
rows.forEach((r) => { const reg = KNOWN_DISTRICTS[r.district] || null; note('region', tidy(r.region) || '(blank)', reg || '(unresolved)'); r.regionName = reg; });

// ---- council / ward / street: merge spellings of the same name within its parent, keep the commonest spelling ----
const canon = (level, keyOf, valOf, setVal, uniq = false) => {
  const groups = new Map();
  rows.forEach((r) => { const k = keyOf(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(tidy(valOf(r))); });
  const pick = new Map([...groups].map(([k, arr]) => [k, mostCommon(arr)]));
  rows.forEach((r) => { const to = pick.get(keyOf(r)); note(level, tidy(valOf(r)), to); setVal(r, to); });
  return pick;
};
canon('council', (r) => `${r.regionName}|${r.district}|${normKey(r.council)}`, (r) => r.council, (r, v) => { r.council = v; });

/** Fold rare misspellings into a clearly dominant name of the same parent (e.g. "Kivikoni" x1 -> "Kivukoni" x55). */
const REVIEW = [];
const foldRare = (level, parentOf, valOf, setVal, maxD, maxRare) => {
  const parents = new Map();
  rows.forEach((r) => { const k = parentOf(r); if (!parents.has(k)) parents.set(k, new Map()); const c = parents.get(k); const v = valOf(r); c.set(v, (c.get(v) || 0) + 1); });
  const target = new Map();
  parents.forEach((c, pk) => {
    const names = [...c.keys()];
    names.forEach((n) => {
      const nk = normKey(n);
      let best = null;
      names.forEach((o) => {
        if (o === n || c.get(o) < c.get(n) * 8) return;
        const ok = normKey(o);
        const near = distance(nk, ok, maxD) <= maxD || (nk.length >= 2 && ok.startsWith(nk) && ok.length > nk.length);
        if (near && c.get(n) <= maxRare && (!best || c.get(o) > c.get(best))) best = o;
      });
      if (best) target.set(`${pk}|${n}`, best);
    });
    names.forEach((a, i) => names.slice(i + 1).forEach((b) => {
      if (!target.has(`${pk}|${a}`) && !target.has(`${pk}|${b}`) && distance(normKey(a), normKey(b), 2) <= 2 && normKey(a).length > 3) REVIEW.push(`${level} [${pk}]: "${a}" (${c.get(a)}) / "${b}" (${c.get(b)})`);
    }));
  });
  rows.forEach((r) => { const to = target.get(`${parentOf(r)}|${valOf(r)}`); if (to) { note(`${level} (typo)`, valOf(r), to); setVal(r, to); } });
};
foldRare('council', (r) => `${r.regionName}/${r.district}`, (r) => r.council, (r, v) => { r.council = v; }, 2, 30);
// Each district here has one real council. A handful of rows carry a ward/street name (or nothing) in the council column:
// put those under the district's main council.
{
  const byDistrict = new Map();
  rows.forEach((r) => { const k = `${r.regionName}/${r.district}`; if (!byDistrict.has(k)) byDistrict.set(k, new Map()); const c = byDistrict.get(k); c.set(r.council, (c.get(r.council) || 0) + 1); });
  rows.forEach((r) => {
    const c = byDistrict.get(`${r.regionName}/${r.district}`);
    const [main, mainN] = [...c].sort((a, b) => b[1] - a[1])[0];
    if (r.council !== main && c.get(r.council) <= 10 && mainN >= 8 * c.get(r.council)) { note('council (not a council name)', r.council || '(blank)', main); r.council = main; }
  });
}
rows.forEach((r) => { if (!tidy(r.ward)) { note('ward (blank)', '(blank)', 'Unknown'); r.ward = 'Unknown'; } });
canon('ward', (r) => `${r.regionName}|${r.district}|${normKey(r.council)}|${normKey(r.ward)}`, (r) => r.ward, (r, v) => { r.ward = v; });
foldRare('ward', (r) => `${r.regionName}/${r.district}/${r.council}`, (r) => r.ward, (r, v) => { r.ward = v; }, 1, 5);
canon('street', (r) => `${r.regionName}|${r.district}|${normKey(r.council)}|${normKey(r.ward)}|${normKey(r.street)}`, (r) => r.street, (r, v) => { r.street = v; });

// ---- write -----------------------------------------------------------------------------------
const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const header = ['layer', 'region', 'district', 'council', 'ward', 'street', 'point_no', 'road_name', 'description', 'global_id', 'latitude', 'longitude'];
const out = [header.join(',')];
rows.forEach((r) => out.push([r.layer, r.regionName, r.district, r.council, r.ward, r.street, r.pointNo, r.road, r.desc, r.gid, r.lat, r.lng].map(csvCell).join(',')));
const dir = path.join(__dirname, '..', 'database', 'seeds');
fs.writeFileSync(path.join(dir, 'geo_points_seed.csv'), `${out.join('\n')}\n`);

const unresolved = rows.filter((r) => !r.regionName || !r.district);
const tree = new Map();
rows.forEach((r) => { const k = `${r.regionName} / ${r.district}`; tree.set(k, (tree.get(k) || 0) + 1); });
const report = [
  `Source: ${path.basename(src)}   Rows read: ${rows.length}   Rows written: ${rows.length}`,
  `Rows still without a region/district: ${unresolved.length}`,
  '', 'Points per region / district:', ...[...tree].sort().map(([k, n]) => `  ${k}: ${n}`),
  '', `Similar names left separate - a person should check these (${REVIEW.length}):`, ...REVIEW.map((x) => `  ${x}`),
  '', `Spelling fixes (${changes.size} kinds, ${[...changes.values()].reduce((a, b) => a + b, 0)} cells):`,
  ...[...changes].sort((a, b) => b[1] - a[1]).map(([k, n]) => `  ${n}x  ${k}`),
];
fs.writeFileSync(path.join(dir, 'geo_cleaning_report.txt'), `${report.join('\n')}\n`);
console.log(report.slice(0, 14).join('\n'));
