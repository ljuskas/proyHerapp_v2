'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase, createPool } = require('../lib/db');

test('createDatabase reenvía texto y parámetros al pool', async () => {
  const calls = [];
  const database = createDatabase({
    query: async (text, params) => {
      calls.push([text, params]);
      return { rows: [{ id: 'uno' }] };
    },
    end: async () => {},
  });
  const result = await database.query('SELECT * FROM usuarios WHERE id = $1', ['uno']);
  assert.deepEqual(calls, [['SELECT * FROM usuarios WHERE id = $1', ['uno']]]);
  assert.deepEqual(result.rows, [{ id: 'uno' }]);
});

test('createDatabase cierra el pool y rechaza pools incompletos', async () => {
  let closed = false;
  const database = createDatabase({ query: async () => ({ rows: [] }), end: async () => { closed = true; } });
  await database.close();
  assert.equal(closed, true);
  assert.throws(() => createDatabase({}), /requiere un pool/i);
});

test('createPool usa una sola conexión, puerto numérico y tiempos acotados', () => {
  const pool = createPool({
    DB_HOST: '172.18.0.1',
    DB_PORT: '5432',
    DB_NAME: 'heraap',
    DB_USER: 'heraap',
    DB_PASSWORD: 'secreto-de-prueba',
  });
  assert.equal(pool.options.max, 1);
  assert.equal(pool.options.port, 5432);
  assert.equal(pool.options.host, '172.18.0.1');
  assert.equal(pool.options.database, 'heraap');
  assert.equal(pool.options.connectionTimeoutMillis, 5000);
});
