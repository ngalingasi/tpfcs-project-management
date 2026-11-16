/**
 * WBS (Work Breakdown Structure) code helpers.
 *
 *   "2"      depth 1  -> objective (workstream)
 *   "2.3"    depth 2  -> activity
 *   "2.3.1"  depth 3  -> sub-activity of "2.3"
 */

const WBS_PATTERN = /^\d+(\.\d+)*$/;

const isValidWbs = (code) => typeof code === 'string' && WBS_PATTERN.test(code);

const wbsDepth = (code) => String(code).split('.').length;

/** Parent code of "2.3.1" is "2.3"; of "2" is null. */
const wbsParent = (code) => {
  const parts = String(code).split('.');
  return parts.length > 1 ? parts.slice(0, -1).join('.') : null;
};

/**
 * Natural comparator so that 1.2 < 1.10 < 2.1. Codes that are missing sort
 * after every real code.
 */
const compareWbs = (a, b) => {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const x = pa[i] ?? -1;
    const y = pb[i] ?? -1;
    if (x !== y) return x - y;
  }
  return 0;
};

module.exports = { WBS_PATTERN, isValidWbs, wbsDepth, wbsParent, compareWbs };
