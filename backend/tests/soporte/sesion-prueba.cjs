'use strict';

// Sesión de prueba sin endpoint de acceso: crea la fila en PostgreSQL con las
// credenciales del laboratorio. Solo se usa en pruebas locales y en el
// despliegue automático; nunca en un entorno real.

const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const ROOT = resolve(__dirname, '../../..');
const EMAIL_POR_DEFECTO = 'prueba-sesion@heraap.local';
const CLAVES_BD = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];

function leerDotEnv() {
  const ruta = resolve(ROOT, '.env');
  if (!existsSync(ruta)) return {};
  const valores = {};
  for (const linea of readFileSync(ruta, 'utf8').split('\n')) {
    const coincidencia = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(linea);
    if (!coincidencia) continue;
    valores[coincidencia[1]] = coincidencia[2].trim().replace(/^["']|["']$/g, '');
  }
  return valores;
}

function ajustesDesdeEntorno(fuente) {
  if (!CLAVES_BD.every((clave) => fuente[clave])) return null;
  return Object.fromEntries(CLAVES_BD.map((clave) => [clave, fuente[clave]]));
}

function prepararLocalEmu() {
  const valores = {
    AWS_ACCESS_KEY_ID: 'test',
    AWS_SECRET_ACCESS_KEY: 'test',
    AWS_REGION: 'us-east-1',
    AWS_DEFAULT_REGION: 'us-east-1',
    AWS_EC2_METADATA_DISABLED: 'true',
    SECRET_ID: 'heraap/config',
    SECRETS_ENDPOINT_URL: 'http://127.0.0.1:4566',
  };
  for (const [clave, valor] of Object.entries(valores)) {
    if (!process.env[clave]) process.env[clave] = valor;
  }
}

async function ajustesBase() {
  const locales = ajustesDesdeEntorno(process.env) || ajustesDesdeEntorno(leerDotEnv());
  if (locales) return locales;
  prepararLocalEmu();
  return require('../../lib/config').load();
}

async function crearSesionPrueba({
  email = EMAIL_POR_DEFECTO,
  nombre = 'Sesión de prueba',
  ttlMs = 60 * 60 * 1000,
} = {}) {
  const { Client } = require('pg');
  const { createRepositorio } = require('../../lib/repositorio');
  const { createSessionStore, COOKIE_NAME } = require('../../lib/session');

  const ajustes = await ajustesBase();
  const client = new Client({
    host: ajustes.DB_HOST,
    port: Number(ajustes.DB_PORT),
    database: ajustes.DB_NAME,
    user: ajustes.DB_USER,
    password: ajustes.DB_PASSWORD,
  });
  await client.connect();
  try {
    const db = { query: (texto, parametros) => client.query(texto, parametros) };
    const repo = createRepositorio(db);
    const sessions = createSessionStore({ db, ttlMs });
    const usuario = await repo.upsertUsuario({ email, nombre });
    await repo.vincularIdentidad({ usuarioId: usuario.id, proveedor: 'prueba', sub: email, email });
    await db.query('DELETE FROM sesiones WHERE usuario_id = $1', [usuario.id]);
    const { token, expira } = await sessions.create(usuario.id, {
      ip: '127.0.0.1',
      userAgent: 'heraap-sesion-prueba',
    });
    await repo.registrarAuditoria({
      actorId: usuario.id,
      accion: 'login',
      resultado: 'ok',
      detalle: { proveedor: 'prueba' },
    });
    return {
      usuario,
      token,
      cookieName: COOKIE_NAME,
      cookie: `${COOKIE_NAME}=${token}`,
      expiraEn: expira.toISOString(),
    };
  } finally {
    await client.end().catch(() => {});
  }
}

if (require.main === module) {
  crearSesionPrueba({ email: process.argv[2] })
    .then((sesion) => console.log(JSON.stringify(sesion)))
    .catch((error) => {
      console.error(`No se pudo crear la sesión de prueba: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { crearSesionPrueba };
