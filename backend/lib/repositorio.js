'use strict';

function createRepositorio(db) {
  if (!db || typeof db.query !== 'function') throw new Error('createRepositorio requiere la base de datos.');

  return {
    async upsertUsuario({ email, nombre }) {
      const { rows } = await db.query(
        `INSERT INTO usuarios (email, nombre)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET nombre = EXCLUDED.nombre
         RETURNING id, email, nombre`,
        [email, nombre],
      );
      return rows[0];
    },

    async usuarioPorIdentidad(proveedor, sub) {
      const { rows } = await db.query(
        `SELECT u.id, u.email, u.nombre
           FROM identidades i
           JOIN usuarios u ON u.id = i.usuario_id
          WHERE i.proveedor = $1 AND i.proveedor_sub = $2`,
        [proveedor, sub],
      );
      return rows[0] || null;
    },

    async vincularIdentidad({ usuarioId, proveedor, sub, email }) {
      await db.query(
        `INSERT INTO identidades (usuario_id, proveedor, proveedor_sub, email)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (proveedor, proveedor_sub) DO UPDATE SET email = EXCLUDED.email`,
        [usuarioId, proveedor, sub, email],
      );
    },

    async registrarAuditoria({ actorId = null, accion, resultado, detalle = {} }) {
      await db.query(
        `INSERT INTO auditoria (actor_id, accion, resultado, detalle)
         VALUES ($1, $2, $3, $4)`,
        [actorId, accion, resultado, JSON.stringify(detalle)],
      );
    },

    async crearEstado({ hash, verifier, nonce, redirectTo = null, expiraEn }) {
      await db.query(
        `INSERT INTO auth_estados (estado_hash, code_verifier, nonce, redirect_to, expira_en)
         VALUES ($1, $2, $3, $4, $5)`,
        [hash, verifier, nonce, redirectTo, expiraEn],
      );
    },

    async consumirEstado(hash, ahora = new Date()) {
      const { rows } = await db.query(
        `DELETE FROM auth_estados
          WHERE estado_hash = $1 AND expira_en > $2
          RETURNING code_verifier, nonce, redirect_to`,
        [hash, ahora],
      );
      const row = rows[0];
      return row ? { verifier: row.code_verifier, nonce: row.nonce, redirectTo: row.redirect_to } : null;
    },

    async limpiarEstados(ahora = new Date()) {
      const { rowCount } = await db.query('DELETE FROM auth_estados WHERE expira_en <= $1', [ahora]);
      return rowCount ?? 0;
    },
  };
}

module.exports = { createRepositorio };
