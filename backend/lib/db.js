'use strict';

const { Pool } = require('pg');
const config = require('./config');

function createDatabase(pool) {
  if (!pool || typeof pool.query !== 'function' || typeof pool.end !== 'function') {
    throw new Error('createDatabase requiere un pool con query y end.');
  }
  return {
    query: (text, params) => pool.query(text, params),
    close: () => pool.end(),
  };
}

function createPool(settings) {
  return new Pool({
    host: settings.DB_HOST,
    port: Number(settings.DB_PORT),
    database: settings.DB_NAME,
    user: settings.DB_USER,
    password: settings.DB_PASSWORD,
    max: 1,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

let database;
async function localDatabase() {
  if (!database) {
    const settings = await config.load();
    database = createDatabase(createPool(settings));
  }
  return database;
}

module.exports = {
  createDatabase,
  createPool,
  localDatabase,
};
