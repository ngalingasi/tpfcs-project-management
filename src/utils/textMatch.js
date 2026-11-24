/** Small helpers for matching place names that were typed by hand. */

/** "Dar  Es Salaam." -> "daressalaam": ignores case, spaces and punctuation. */
const normKey = (s) => String(s == null ? '' : s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** Tidy a name for storing: trim, collapse spaces, drop trailing dots/commas. */
const tidy = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').replace(/[.,;]+$/, '').trim();

/** Edit distance, stops early once it exceeds `max`. */
const distance = (a, b, max = 3) => {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
};

/** Closest of `names` to `name` within `max` edits (null when nothing is close). */
const closest = (name, names, max = 2) => {
  const k = normKey(name);
  if (k.length < 4) return null;
  let best = null;
  let bestD = max + 1;
  names.forEach((n) => {
    const d = distance(k, normKey(n), max);
    if (d < bestD && d > 0) { best = n; bestD = d; }
  });
  return best;
};

module.exports = { normKey, tidy, distance, closest };
