const jwt      = require('jsonwebtoken');
const moment   = require('moment');
const httpStatus = require('http-status');
const config   = require('../config/config');
const { query } = require('../config/database');
const ApiError  = require('../utils/ApiError');
const { tokenTypes } = require('../config/tokens');

/**
 * Generate a signed JWT.
 * user param is optional — when provided, embeds full_name, email, role
 * into the payload so child system frontends can read them on ERP redirect
 * without waiting for /auth/me.
 */
const generateToken = (userId, expires, type, secret = config.jwt.secret, user = null) => {
  const payload = {
    sub:  userId,
    iat:  moment().unix(),
    exp:  expires.unix(),
    type,
  };

  // Embed user profile fields so ERP redirect can build a complete user object
  // from the token alone — no /auth/me round-trip needed on first render.
  if (user) {
    payload.full_name            = user.full_name  ?? null;
    payload.username             = user.username   ?? null;
    payload.email                = user.email      ?? null;
    payload.role                 = user.role       ?? null;
    payload.must_change_password = user.must_change_password ?? 0;
  }

  return jwt.sign(payload, secret);
};

/**
 * Save a refresh/reset/verify token in the DB.
 * Access tokens are stateless — only non-access tokens are stored.
 */
const saveToken = async (token, userId, expires, type, blacklisted = false) => {
  await query(
    `INSERT INTO tokens (token, user_id, expires, type, blacklisted) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE expires = VALUES(expires), blacklisted = VALUES(blacklisted)`,
    [token, userId, expires.toDate(), type, blacklisted ? 1 : 0]
  );
  return { token, userId, expires: expires.toDate(), type, blacklisted };
};

/**
 * Verify a token and return its DB record.
 */
const verifyToken = async (token, type) => {
  const payload = jwt.verify(token, config.jwt.secret);
  const rows = await query(
    'SELECT * FROM tokens WHERE token = ? AND type = ? AND user_id = ? AND blacklisted = 0',
    [token, type, payload.sub]
  );
  if (!rows.length) {
    throw new Error('Token not found');
  }
  return rows[0];
};

/**
 * Generate access + refresh tokens for a user.
 * Accepts a full user object so profile fields are embedded in the JWT.
 */
const generateAuthTokens = async (user) => {
  const accessTokenExpires  = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
  const accessToken         = generateToken(user.user_id, accessTokenExpires, tokenTypes.ACCESS, config.jwt.secret, user);

  const refreshTokenExpires = moment().add(config.jwt.refreshExpirationDays, 'days');
  const refreshToken        = generateToken(user.user_id, refreshTokenExpires, tokenTypes.REFRESH, config.jwt.secret);
  await saveToken(refreshToken, user.user_id, refreshTokenExpires, tokenTypes.REFRESH);

  return {
    access:  { token: accessToken,  expires: accessTokenExpires.toDate()  },
    refresh: { token: refreshToken, expires: refreshTokenExpires.toDate() },
  };
};

const generateResetPasswordToken = async (email) => {
  const rows = await query('SELECT user_id FROM users WHERE email = ? AND status = "active"', [email]);
  if (!rows.length) return null;
  const userId  = rows[0].user_id;
  const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
  const resetToken = generateToken(userId, expires, tokenTypes.RESET_PASSWORD);
  await saveToken(resetToken, userId, expires, tokenTypes.RESET_PASSWORD);
  return resetToken;
};

const generateVerifyEmailToken = async (user) => {
  const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
  const verifyEmailToken = generateToken(user.user_id, expires, tokenTypes.VERIFY_EMAIL);
  await saveToken(verifyEmailToken, user.user_id, expires, tokenTypes.VERIFY_EMAIL);
  return verifyEmailToken;
};

const deleteTokensByUserAndType = async (userId, type) => {
  await query('DELETE FROM tokens WHERE user_id = ? AND type = ?', [userId, type]);
};

module.exports = {
  generateToken,
  saveToken,
  verifyToken,
  generateAuthTokens,
  generateResetPasswordToken,
  generateVerifyEmailToken,
  deleteTokensByUserAndType,
};
