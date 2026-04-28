/**
 * Build pagination metadata and LIMIT/OFFSET clause
 * @param {number} page - 1-based page number
 * @param {number} limit - items per page
 * @returns {{ limit, offset, paginate }}
 */
const buildPagination = (page = 1, limit = 10) => {
  const p = Math.max(parseInt(page, 10), 1);
  const l = Math.min(Math.max(parseInt(limit, 10), 1), 100);
  const offset = (p - 1) * l;

  const paginate = (totalResults) => ({
    page: p,
    limit: l,
    totalPages: Math.ceil(totalResults / l),
    totalResults,
  });

  return { limit: l, offset, paginate };
};

module.exports = { buildPagination };
