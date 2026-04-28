const mysql = require('mysql2/promise');
const config = require('./config');
const logger = require('./logger');

let pool;

/**
 * Create and return the MySQL connection pool (singleton)
 */
const getPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: '+00:00',
      charset: 'utf8mb4',
    });
    logger.info('MySQL connection pool created');
  }
  return pool;
};

/**
 * Test the database connection
 */
const testConnection = async () => {
  const conn = await getPool().getConnection();
  logger.info('Connected to MySQL database');
  conn.release();
};

/**
 * Execute a query using the pool
 * @param {string} sql
 * @param {Array} params
 */
const query = async (sql, params = []) => {
  // MySQL2 rejects undefined — coerce to null globally as a safety net
  const safeParams = params.map((p) => (p === undefined ? null : p));
  const [rows] = await getPool().execute(sql, safeParams);
  return rows;
};

/**
 * Execute within a transaction
 * @param {Function} fn - async function receiving a connection
 */
const transaction = async (fn) => {
  const conn = await getPool().getConnection();
  await conn.beginTransaction();
  try {
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = { getPool, testConnection, query, transaction };
