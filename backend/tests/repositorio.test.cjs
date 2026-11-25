'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRepositorio } = require('../lib/repositorio');

function fakeDb(responses = {}) {
  const calls = [];
  return {
    calls,
    query: async (text, params) => {
      calls.push({ text, params });
      const key = Object.keys(responses).find((pattern) => text.includes(pattern));
      return key ? responses[key] : { rows: [], rowCount: 0 };
    },
  };
}

test('upsertUsuario crea o actualiza por email y devuelve el usuario', async () => {
  const db = fakeDb({ 'INSERT INTO usuarios': { rows: [{ id: 'u-1', email: 'a@b.cl', nombre: 'A' }] } });
  const repo = createRepositorio(db);
  const usuario = await repo.upsertUsuario({ email: 'a@b.cl', nombre: 'A' });
  assert.deepEqual(usuario, { id: 'u-1', email: 'a@b.cl', nombre: 'A' });
  assert.match(db.calls[0].text, /ON CONFLICT \(email\)/);
  assert.deepEqual(db.calls[0].params, ['a@b.cl', 'A']);
});

test('usuarioPorIdentidad devuelve null cuando no hay vínculo', async () => {
  const db = fakeDb();
  const repo = createRepositorio(db);
  assert.equal(await repo.usuarioPorIdentidad('google', 'sin-vinculo'), null);
});

test('consumirEstado devuelve el estado una sola vez con sus datos', async () => {
  const db = fakeDb({
    'DELETE FROM auth_estados': { rows: [{ code_verifier: 'v', nonce: 'n', redirect_to: '/x' }], rowCount: 1 },
  });
  const repo = createRepositorio(db);
  const estado = await repo.consumirEstado('hash-1', new Date('2026-11-25T12:00:00Z'));
  assert.deepEqual(estado, { verifier: 'v', nonce: 'n', redirectTo: '/x' });
  assert.match(db.calls[0].text, /expira_en > \$2/);
  assert.equal(db.calls[0].params[0], 'hash-1');
});

test('consumirEstado devuelve null si el estado no existe o expiró', async () => {
  const repo = createRepositorio(fakeDb());
  assert.equal(await repo.consumirEstado('hash-2'), null);
});

test('crearEstado y registrarAuditoria envían los parámetros esperados', async () => {
  const db = fakeDb();
  const repo = createRepositorio(db);
  const expiraEn = new Date('2026-11-25T12:10:00Z');
  await repo.crearEstado({ hash: 'h', verifier: 'v', nonce: 'n', expiraEn });
  assert.deepEqual(db.calls[0].params, ['h', 'v', 'n', null, expiraEn]);
  await repo.registrarAuditoria({ actorId: 'u-1', accion: 'login', resultado: 'ok', detalle: { proveedor: 'dev' } });
  assert.deepEqual(db.calls[1].params, ['u-1', 'login', 'ok', JSON.stringify({ proveedor: 'dev' })]);
});

test('limpiarEstados informa cuántos estados eliminó', async () => {
  const repo = createRepositorio(fakeDb({ 'DELETE FROM auth_estados': { rows: [], rowCount: 2 } }));
  assert.equal(await repo.limpiarEstados(), 2);
});
