const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const config = require('./config');
const { tokenTypes } = require('./tokens');
const { query } = require('./database');

const jwtOptions = {
  secretOrKey: config.jwt.secret,
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
};

const jwtVerify = async (payload, done) => {
  try {
    if (payload.type !== tokenTypes.ACCESS) {
      throw new Error('Invalid token type');
    }
    const base = 'user_id, full_name, username, email, mobile, gender, avatar, role, status, must_change_password';
    let rows;
    try {
      rows = await query(
        `SELECT ${base}, organisation, guest_expires_at FROM users WHERE user_id = ? AND status = "active"`,
        [payload.sub]
      );
    } catch (e) {
      // Migration 024 (guest users) not applied yet: keep everyone signed in instead of failing every request
      if (e && (e.code === 'ER_BAD_FIELD_ERROR' || /unknown column/i.test(e.message || ''))) {
        console.warn('[auth] users.organisation / guest_expires_at missing - run database/migrations/024_guest_users.sql');
        rows = await query(`SELECT ${base} FROM users WHERE user_id = ? AND status = "active"`, [payload.sub]);
      } else {
        throw e;
      }
    }
    if (!rows.length) {
      return done(null, false);
    }
    const u = rows[0];
    // A guest whose access end date has passed is treated as signed out
    if (u.role === 'guest' && u.guest_expires_at && new Date(u.guest_expires_at) < new Date(new Date().toDateString())) {
      return done(null, false);
    }
    done(null, u);
  } catch (error) {
    done(error, false);
  }
};

const jwtStrategy = new JwtStrategy(jwtOptions, jwtVerify);

module.exports = { jwtStrategy };
