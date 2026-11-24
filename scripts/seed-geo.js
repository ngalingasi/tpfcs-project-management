#!/usr/bin/env node
/**
 * Loads the cleaned CSMIS map points into one project.
 *
 *   node scripts/seed-geo.js --project=12                 (dry run: only shows what would happen)
 *   node scripts/seed-geo.js --project=12 --apply         (writes)
 *   node scripts/seed-geo.js --project=12 --apply --file=path/to/points.csv
 *
 * Run it once per project (e.g. the live project and the development project). It also adds the regions in the
 * file to the project, creates any missing districts/councils/wards/streets, and can be re-run safely: points are
 * matched on global_id and updated instead of duplicated.
 * Run migration 025 first.
 */
const fs = require('fs');
const path = require('path');
const geo = require('../src/models/geo.model');

const arg = (name) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.split('=').slice(1).join('=') : null; };
const projectId = Number(arg('project'));
if (!projectId) { console.error('Usage: node scripts/seed-geo.js --project=<id> [--apply] [--file=points.csv]'); process.exit(1); }
const apply = process.argv.includes('--apply');
const file = arg('file') || path.join(__dirname, '..', 'database', 'seeds', 'geo_points_seed.csv');

(async () => {
  const result = await geo.importPoints({
    projectId, text: fs.readFileSync(file, 'utf8'), userId: null,
    dryRun: !apply, createMissing: true, linkRegions: true, skipInvalid: false,
  });
  console.log(JSON.stringify(result.summary, null, 2));
  if (result.errors.length) console.log('Errors:', result.errors.slice(0, 20));
  console.log(apply ? (result.imported ? 'Imported.' : 'Nothing imported.') : 'Dry run only. Add --apply to write.');
  process.exit(result.ok ? 0 : 1);
})().catch((e) => { console.error(e.message); process.exit(1); });
