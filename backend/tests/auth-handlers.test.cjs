'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const startHandler = require('../handlers/authGoogleStart');
const callbackHandler = require('../handlers/authGoogleCallback');
const authDev = require('../handlers/authDev');
const sesion = require('../handlers/sesion');
const logout = require('../handlers/logout');
const { hashToken } = require('../lib/session');

const settings = {
  FRONTEND_URL: 'https://local.deptofeliz.uk/heraap-frontend-local/',
  GOOGLE_CLIENT_ID: 'cliente',
  GOOGLE_CLIENT_SECRET: 'secreto',
  GOOGLE_REDIRECT_URI: 'https://local.deptofeliz.uk/heraap-frontend-local/',
};

function deps(overrides = {}) {
  const calls = [];
  const base = {
    settings,
    sessions: {
      ttlMs: 604800000,
      create: async (usuarioId) => { calls.push(['sesion', usuarioId]); return { token: 'token-nuevo' }; },
      destroy: async (token) => calls.push(['destroy', token]),
      find: async () => ({ id: 'u-1', email: 'a@b.cl', nombre: 'A' }),
    },
    repo: {
      crearEstado: async (estado) => calls.push(['estado', estado]),
      consumirEstado: async () => ({ verifier: 'v', nonce: 'n', redirectTo: null }),
      usuarioPorIdentidad: async () => null,
      upsertUsuario: async () => ({ id: 'u-1', email: 'a@b.cl', nombre: 'A' }),
      vincularIdentidad: async (datos) => calls.push(['vinculo', datos]),
      registrarAuditoria: async (datos) => calls.push(['auditoria', datos]),
    },
    auth: {
      current: async () => ({ id: 'u-1', email: 'a@b.cl', nombre: 'A' }),
      token: () => 'token-actual',
    },
  };
  return { deps: { ...base, ...overrides }, calls };
}

const google = () => ({
  start: () => ({ state: 'estado-1', nonce: 'nonce-1', verifier: 'verifier-1', url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' }),
  finish: async () => ({ sub: 'google-1', email: 'a@b.cl', nombre: 'A' }),
});

test('start redirige a Google y guarda el estado hasheado', async () => {
  const { deps: d, calls } = deps();
  const handler = startHandler.createHandler({ load: async () => d, client: google });
  const result = await handler({}, { awsRequestId: 'r-1' });
  assert.equal(result.statusCode, 302);
  assert.match(result.headers.Location, /^https:\/\/accounts\.google\.com/);
  const estado = calls.find(([tipo]) => tipo === 'estado')[1];
  assert.equal(estado.hash, hashToken('estado-1'));
  assert.equal(estado.verifier, 'verifier-1');
  assert.ok(!JSON.stringify(estado).includes('estado-1'), 'no guardar el estado en claro');
});

test('start responde 503 si Google no está configurado', async () => {
  const { deps: d } = deps();
  const handler = startHandler.createHandler({
    load: async () => d,
    client: () => { throw new Error('sin configurar'); },
  });
  const result = await handler({}, { awsRequestId: 'r-2' });
  assert.equal(result.statusCode, 503);
});

test('callback sin parámetros vuelve al frontend con error', async () => {
  const { deps: d } = deps();
  const handler = callbackHandler.createHandler({ load: async () => d, client: google });
  const result = await handler({ queryStringParameters: {} }, { awsRequestId: 'r-3' });
  assert.equal(result.statusCode, 302);
  const url = new URL(result.headers.Location);
  assert.equal(url.searchParams.get('acceso'), 'error');
  assert.equal(url.searchParams.get('motivo'), 'parametros_invalidos');
});

test('callback con state desconocido no crea sesión', async () => {
  const { deps: d, calls } = deps();
  d.repo.consumirEstado = async () => null;
  const handler = callbackHandler.createHandler({ load: async () => d, client: google });
  const result = await handler({ queryStringParameters: { state: 's', code: 'c' } }, { awsRequestId: 'r-4' });
  assert.equal(new URL(result.headers.Location).searchParams.get('motivo'), 'estado_invalido');
  assert.equal(calls.some(([tipo]) => tipo === 'sesion'), false);
});

test('callback válido crea sesión, vincula identidad y fija cookie segura', async () => {
  const { deps: d, calls } = deps();
  const handler = callbackHandler.createHandler({ load: async () => d, client: google });
  const result = await handler({ queryStringParameters: { state: 'estado-1', code: 'codigo' } }, { awsRequestId: 'r-5' });
  assert.equal(result.statusCode, 302);
  assert.equal(result.headers.Location, settings.FRONTEND_URL);
  const cookie = result.headers['Set-Cookie'];
  assert.match(cookie, /^heraap_sesion=token-nuevo/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Max-Age=604800/);
  assert.ok(calls.some(([tipo, datos]) => tipo === 'vinculo' && datos.proveedor === 'google' && datos.sub === 'google-1'));
  assert.ok(calls.some(([tipo, datos]) => tipo === 'auditoria' && datos.accion === 'login'));
});

test('callback con error de Google informa cancelación sin tocar la base', async () => {
  const { deps: d, calls } = deps();
  const handler = callbackHandler.createHandler({ load: async () => d, client: google });
  const result = await handler({ queryStringParameters: { error: 'access_denied' } }, { awsRequestId: 'r-6' });
  assert.equal(new URL(result.headers.Location).searchParams.get('motivo'), 'cancelado');
  assert.equal(calls.length, 0);
});

test('authDev está desactivado salvo con la bandera del laboratorio', async () => {
  delete process.env.DEV_LOGIN_ENABLED;
  const { deps: d } = deps();
  const handler = authDev.createHandler({ load: async () => d });
  assert.equal((await handler({ body: '{"email":"a@b.cl"}' }, {})).statusCode, 404);
});

test('authDev crea sesión con correo válido y rechaza el inválido', async () => {
  process.env.DEV_LOGIN_ENABLED = '1';
  try {
    const { deps: d, calls } = deps();
    const handler = authDev.createHandler({ load: async () => d });
    const invalido = await handler({ body: '{"email":"sin-arroba"}' }, {});
    assert.equal(invalido.statusCode, 400);
    const ok = await handler({ body: '{"email":"A@B.CL","nombre":"Ana"}' }, { awsRequestId: 'r-7' });
    assert.equal(ok.statusCode, 200);
    assert.match(ok.headers['Set-Cookie'], /HttpOnly/);
    assert.deepEqual(JSON.parse(ok.body).usuario, { id: 'u-1', email: 'a@b.cl', nombre: 'A' });
    assert.ok(calls.some(([tipo]) => tipo === 'sesion'));
  } finally {
    delete process.env.DEV_LOGIN_ENABLED;
  }
});

test('sesion devuelve 200 con el usuario y 401 sin cookie', async () => {
  const { deps: d } = deps();
  const handler = sesion.createHandler({ load: async () => d });
  const ok = await handler({}, { awsRequestId: 'r-8' });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(JSON.parse(ok.body).usuario, { id: 'u-1', email: 'a@b.cl', nombre: 'A' });
  d.auth.current = async () => null;
  const anonimo = await handler({}, { awsRequestId: 'r-9' });
  assert.equal(anonimo.statusCode, 401);
  assert.equal(anonimo.headers['Access-Control-Allow-Origin'], '*');
});

test('logout destruye la sesión y expira la cookie', async () => {
  const { deps: d, calls } = deps();
  const handler = logout.createHandler({ load: async () => d });
  const result = await handler({}, { awsRequestId: 'r-10' });
  assert.equal(result.statusCode, 204);
  assert.match(result.headers['Set-Cookie'], /Max-Age=0/);
  assert.deepEqual(calls[0], ['destroy', 'token-actual']);
});
