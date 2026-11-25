'use strict';

const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const MIGRATIONS_DIR = join(__dirname, 'migrations');
const MIGRATIONS_TABLE = 'schema_migrations';

function listMigrations(dir = MIGRATIONS_DIR) {
  return readdirSync(dir)
    .filter((file) => /^\d{3}_.+\.sql$/.test(file))
    .sort();
}

async function applyMigrations({ query, dir = MIGRATIONS_DIR, log = () => {} }) {
  if (typeof query !== 'function') throw new Error('applyMigrations requiere una función query.');

  await query(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
       version text PRIMARY KEY,
       aplicada_en timestamptz NOT NULL DEFAULT now()
     )`,
  );
  const { rows } = await query(`SELECT version FROM ${MIGRATIONS_TABLE}`);
  const applied = new Set(rows.map((row) => row.version));
  const executed = [];

  for (const file of listMigrations(dir)) {
    const version = file.replace(/\.sql$/, '');
    if (applied.has(version)) continue;
    const sql = readFileSync(join(dir, file), 'utf8');
    await query('BEGIN');
    try {
      await query(sql);
      await query(`INSERT INTO ${MIGRATIONS_TABLE} (version) VALUES ($1)`, [version]);
      await query('COMMIT');
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
    executed.push(version);
    log(`Migración aplicada: ${version}`);
  }
  return executed;
}

function settingsFromEnv() {
  const keys = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) throw new Error(`Faltan variables de base: ${missing.join(', ')}.`);
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

async function main() {
  const { Client } = require('pg');
  const settings = process.env.HERAAP_DB_FROM_ENV === '1'
    ? settingsFromEnv()
    : await require('../lib/config').load();
  const client = new Client({
    host: settings.DB_HOST,
    port: Number(settings.DB_PORT),
    database: settings.DB_NAME,
    user: settings.DB_USER,
    password: settings.DB_PASSWORD,
  });
  await client.connect();
  try {
    const executed = await applyMigrations({
      query: (text, params) => client.query(text, params),
      log: (message) => console.log(message),
    });
    console.log(executed.length > 0
      ? `${executed.length} migración(es) aplicada(s).`
      : 'Sin migraciones pendientes.');
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Error de migración: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { applyMigrations, listMigrations };
