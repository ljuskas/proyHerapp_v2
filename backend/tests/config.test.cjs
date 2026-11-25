'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createConfigLoader, parseSecret } = require('../lib/config');

test('parseSecret rechaza secretos vacíos, no JSON y estructuras que no son objeto', () => {
  for (const raw of ['', '   ', 'no-json', '{', 'null', '[]', '"texto"', '42']) {
    assert.throws(() => parseSecret(raw), /secreto de configuración/i, String(raw));
  }
});

test('parseSecret devuelve el objeto JSON del secreto', () => {
  assert.deepEqual(parseSecret('{"DB_HOST":"127.0.0.1"}'), { DB_HOST: '127.0.0.1' });
});

test('la carga falla si el secreto no trae las claves obligatorias', async () => {
  const load = createConfigLoader({
    getSecret: async () => '{"DB_HOST":"172.18.0.1","DB_PORT":"5432"}',
    required: ['DB_HOST', 'DB_PORT', 'DB_NAME'],
  });
  await assert.rejects(load, /Faltan claves obligatorias.*DB_NAME/);
});

test('el secreto se cachea y se refresca al vencer el TTL', async () => {
  let calls = 0;
  let current = 0;
  const load = createConfigLoader({
    getSecret: async () => {
      calls++;
      return JSON.stringify({ DB_HOST: current === 0 ? 'primero' : 'segundo' });
    },
    now: () => current,
    ttlMs: 1000,
    required: ['DB_HOST'],
  });
  assert.equal((await load()).DB_HOST, 'primero');
  current = 500;
  assert.equal((await load()).DB_HOST, 'primero');
  assert.equal(calls, 1);
  current = 1500;
  assert.equal((await load()).DB_HOST, 'segundo');
  assert.equal(calls, 2);
});

test('un fallo no queda cacheado y permite reintentar', async () => {
  let calls = 0;
  const load = createConfigLoader({
    getSecret: async () => {
      calls++;
      if (calls === 1) throw new Error('sin conexión');
      return '{"DB_HOST":"recuperado"}';
    },
    required: ['DB_HOST'],
  });
  await assert.rejects(load, /sin conexión/);
  assert.equal((await load()).DB_HOST, 'recuperado');
  assert.equal(calls, 2);
});

test('las llamadas concurrentes comparten una sola lectura del secreto', async () => {
  let calls = 0;
  const load = createConfigLoader({
    getSecret: async () => {
      calls++;
      return '{"DB_HOST":"único"}';
    },
    required: ['DB_HOST'],
  });
  const results = await Promise.all([load(), load(), load()]);
  assert.deepEqual(results.map((item) => item.DB_HOST), ['único', 'único', 'único']);
  assert.equal(calls, 1);
});
