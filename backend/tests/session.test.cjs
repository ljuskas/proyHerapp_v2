'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSessionStore, hashToken } = require('../lib/session');

function fakeDb(handler) {
  const calls = [];
  return {
    calls,
    query: async (text, params) => {
      calls.push({ text, params });
      return handler ? handler(text, params) : { rows: [], rowCount: 0 };
    },
  };
}

const now = () => new Date('2026-11-25T12:00:00.000Z');

test('create guarda solo el hash del token y su expiración', async () => {
  const db = fakeDb();
  const sessions = createSessionStore({ db, now, generateToken: () => 'token-en-claro' });
  const { token, expira } = await sessions.create('usuario-1', { ip: '10.0.0.1', userAgent: 'pruebas' });
  assert.equal(token, 'token-en-claro');
  assert.equal(expira.toISOString(), '2026-12-02T12:00:00.000Z');
  const insert = db.calls[0];
  assert.match(insert.text, /INSERT INTO sesiones/);
  assert.deepEqual(insert.params.slice(0, 2), ['usuario-1', hashToken('token-en-claro')]);
  assert.ok(!JSON.stringify(insert.params).includes('token-en-claro'), 'no debe guardar el token en claro');
  assert.equal(insert.params[3], '10.0.0.1');
});

test('find devuelve el usuario de una sesión vigente y excluye las vencidas', async () => {
  const db = fakeDb(() => ({ rows: [{ sesion_id: 's-1', usuario_id: 'u-1', email: 'a@b.cl', nombre: 'A' }] }));
  const sessions = createSessionStore({ db, now });
  const sesion = await sessions.find('token-vigente');
  assert.deepEqual(sesion, { sesionId: 's-1', id: 'u-1', email: 'a@b.cl', nombre: 'A' });
  const query = db.calls[0];
  assert.match(query.text, /expira_en > \$2/);
  assert.equal(query.params[0], hashToken('token-vigente'));
  assert.equal(query.params[1].toISOString(), '2026-11-25T12:00:00.000Z');
});

test('find devuelve null sin token o cuando no hay filas', async () => {
  const db = fakeDb();
  const sessions = createSessionStore({ db, now });
  assert.equal(await sessions.find(''), null);
  assert.equal(db.calls.length, 0);
  assert.equal(await sessions.find('token-desconocido'), null);
});

test('destroy borra por hash y purgeExpired informa cuántas eliminó', async () => {
  const db = fakeDb(() => ({ rows: [], rowCount: 3 }));
  const sessions = createSessionStore({ db, now });
  await sessions.destroy('token-a-borrar');
  assert.equal(db.calls[0].params[0], hashToken('token-a-borrar'));
  assert.match(db.calls[0].text, /DELETE FROM sesiones/);
  assert.equal(await sessions.purgeExpired(), 3);
});
