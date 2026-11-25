'use strict';

const { createHash, randomBytes } = require('node:crypto');

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = 'heraap_sesion';

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function createSessionStore({
  db,
  now = () => new Date(),
  ttlMs = SEVEN_DAYS_MS,
  generateToken = () => randomBytes(32).toString('base64url'),
}) {
  if (!db || typeof db.query !== 'function') throw new Error('createSessionStore requiere la base de datos.');

  return {
    ttlMs,

    async create(usuarioId, { ip = null, userAgent = null } = {}) {
      const token = generateToken();
      const expira = new Date(now().getTime() + ttlMs);
      await db.query(
        `INSERT INTO sesiones (usuario_id, token_hash, expira_en, ip, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [usuarioId, hashToken(token), expira, ip, userAgent],
      );
      return { token, expira };
    },

    async find(token) {
      if (typeof token !== 'string' || !token) return null;
      const { rows } = await db.query(
        `SELECT s.id AS sesion_id, s.usuario_id, u.email, u.nombre
           FROM sesiones s
           JOIN usuarios u ON u.id = s.usuario_id
          WHERE s.token_hash = $1 AND s.expira_en > $2`,
        [hashToken(token), now()],
      );
      const row = rows[0];
      if (!row) return null;
      return {
        sesionId: row.sesion_id,
        id: row.usuario_id,
        email: row.email,
        nombre: row.nombre,
      };
    },

    async destroy(token) {
      if (typeof token !== 'string' || !token) return;
      await db.query('DELETE FROM sesiones WHERE token_hash = $1', [hashToken(token)]);
    },

    async purgeExpired() {
      const { rowCount } = await db.query('DELETE FROM sesiones WHERE expira_en <= $1', [now()]);
      return rowCount ?? 0;
    },
  };
}

module.exports = { COOKIE_NAME, SEVEN_DAYS_MS, createSessionStore, hashToken };
