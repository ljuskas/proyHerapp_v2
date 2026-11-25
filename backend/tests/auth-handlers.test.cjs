'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const startHandler = require('../handlers/authGoogleStart');
const callbackHandler = require('../handlers/authGoogleCallback');
const sesion = require('../handlers/sesion');
const logout = require('../handlers/logout');
const { COOKIE_NAME, hashToken } = require('../lib/session');
const {
  STATE_COOKIE_NAME, STATE_TTL_MS, hashState,
} = require('../lib/oauth-state');

const settings = {
  FRONTEND_URL: 'https://local.deptofeliz.uk/heraap-frontend-local/',
  GOOGLE_CLIENT_ID: 'cliente',
  GOOGLE_CLIENT_SECRET: 'secreto',
  GOOGLE_REDIRECT_URI: 'https://local.deptofeliz.uk/heraap-frontend-local/',
};

const STATE = 'estado-1';
const STATE_HASH = hashState(STATE);
const COOKIE_ESTADO = `${STATE_COOKIE_NAME}=${STATE_HASH}`;

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
  start: () => ({ state: STATE, nonce: 'nonce-1', verifier: 'verifier-1', url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' }),
  finish: async () => ({ sub: 'google-1', email: 'a@b.cl', nombre: 'A' }),
});

function cookies(result) {
  const multiple = result?.multiValueHeaders?.['Set-Cookie'];
  if (Array.isArray(multiple)) return multiple;
  const single = result?.headers?.['Set-Cookie'];
  return single ? [single] : [];
}

function cookieNamed(result, name) {
  return cookies(result).find((cookie) => cookie.startsWith(`${name}=`)) || null;
}

function cookiePair(result, name) {
  const cookie = cookieNamed(result, name);
  return cookie ? cookie.split(';')[0] : null;
}

function callbackEvent({ query = { state: STATE, code: 'codigo' }, cookie = COOKIE_ESTADO } = {}) {
  return {
    queryStringParameters: query,
    headers: cookie ? { Cookie: cookie } : {},
  };
}

function repoEnMemoria(reloj) {
  let guardado = null;
  const calls = [];
  return {
    calls,
    async crearEstado(datos) {
      calls.push(['estado', datos]);
      guardado = { ...datos };
    },
    async consumirEstado(hash, ahora = reloj()) {
      calls.push(['consumir', hash, ahora]);
      if (!guardado || guardado.hash !== hash || guardado.expiraEn <= ahora) return null;
      const consumido = guardado;
      guardado = null;
      return {
        verifier: consumido.verifier,
        nonce: consumido.nonce,
        redirectTo: consumido.redirectTo ?? null,
      };
    },
    usuarioPorIdentidad: async () => null,
    upsertUsuario: async () => ({ id: 'u-1', email: 'a@b.cl', nombre: 'A' }),
    vincularIdentidad: async () => {},
    registrarAuditoria: async () => {},
  };
}

test('start redirige a Google, guarda el hash y fija la cookie temporal con el hash', async () => {
  const { deps: d, calls } = deps();
  const handler = startHandler.createHandler({ load: async () => d, client: google });
  const result = await handler({}, { awsRequestId: 'r-1' });
  assert.equal(result.statusCode, 302);
  assert.match(result.headers.Location, /^https:\/\/accounts\.google\.com/);

  const estado = calls.find(([tipo]) => tipo === 'estado')[1];
  assert.equal(estado.hash, hashToken(STATE));
  assert.equal(estado.verifier, 'verifier-1');
  assert.ok(!JSON.stringify(estado).includes(STATE), 'no guardar el state en claro');

  const cookie = result.headers['Set-Cookie'];
  assert.match(cookie, new RegExp(`^${STATE_COOKIE_NAME}=${hashToken(STATE)};`));
  assert.match(cookie, /Max-Age=600/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.ok(!cookie.includes(STATE), 'la cookie no debe contener el state en claro');
});

test('start responde 503 si Google no está configurado y no fija cookie', async () => {
  const { deps: d } = deps();
  const handler = startHandler.createHandler({
    load: async () => d,
    client: () => { throw new Error('sin configurar'); },
  });
  const result = await handler({}, { awsRequestId: 'r-2' });
  assert.equal(result.statusCode, 503);
  assert.equal(cookieNamed(result, STATE_COOKIE_NAME), null);
});

test('callback sin parámetros vuelve al frontend con error y limpia la cookie', async () => {
  const { deps: d } = deps();
  const handler = callbackHandler.createHandler({ load: async () => d, client: google });
  const result = await handler(callbackEvent({ query: {} }), { awsRequestId: 'r-3' });
  assert.equal(result.statusCode, 302);
  const url = new URL(result.headers.Location);
  assert.equal(url.searchParams.get('acceso'), 'error');
  assert.equal(url.searchParams.get('motivo'), 'parametros_invalidos');
  assert.match(cookieNamed(result, STATE_COOKIE_NAME), /Max-Age=0/);
});

test('callback con state desconocido no crea sesión y limpia la cookie', async () => {
  const { deps: d, calls } = deps();
  let recibido;
  d.repo.consumirEstado = async (hash) => { recibido = hash; return null; };
  const handler = callbackHandler.createHandler({ load: async () => d, client: google });
  const result = await handler(callbackEvent(), { awsRequestId: 'r-4' });
  assert.equal(new URL(result.headers.Location).searchParams.get('motivo'), 'estado_invalido');
  assert.equal(recibido, hashToken(STATE));
  assert.equal(calls.some(([tipo]) => tipo === 'sesion'), false);
  assert.match(cookieNamed(result, STATE_COOKIE_NAME), /Max-Age=0/);
});

test('callback válido crea sesión, vincula identidad, fija cookie de sesión y limpia la de estado', async () => {
  const { deps: d, calls } = deps();
  const handler = callbackHandler.createHandler({ load: async () => d, client: google });
  const result = await handler(callbackEvent(), { awsRequestId: 'r-5' });
  assert.equal(result.statusCode, 302);
  assert.equal(result.headers.Location, settings.FRONTEND_URL);

  const sesionCookie = cookieNamed(result, COOKIE_NAME);
  assert.match(sesionCookie, /^heraap_sesion=token-nuevo/);
  assert.match(sesionCookie, /HttpOnly/);
  assert.match(sesionCookie, /Secure/);
  assert.match(sesionCookie, /SameSite=Lax/);
  assert.match(sesionCookie, /Max-Age=604800/);

  const estadoCookie = cookieNamed(result, STATE_COOKIE_NAME);
  assert.match(estadoCookie, /Max-Age=0/);
  assert.equal(cookies(result).length, 2);
  assert.ok(calls.some(([tipo, datos]) => tipo === 'vinculo' && datos.proveedor === 'google' && datos.sub === 'google-1'));
  assert.ok(calls.some(([tipo, datos]) => tipo === 'auditoria' && datos.accion === 'login'));
});

test('callback con error de Google informa cancelación, limpia la cookie y no toca la base', async () => {
  const { deps: d, calls } = deps();
  const handler = callbackHandler.createHandler({ load: async () => d, client: google });
  const result = await handler(callbackEvent({ query: { error: 'access_denied' } }), { awsRequestId: 'r-6' });
  assert.equal(new URL(result.headers.Location).searchParams.get('motivo'), 'cancelado');
  assert.equal(calls.length, 0);
  assert.match(cookieNamed(result, STATE_COOKIE_NAME), /Max-Age=0/);
});

test('callback con rechazo de Google limpia la cookie de estado', async () => {
  const { deps: d, calls } = deps();
  const client = () => ({ finish: async () => { throw new Error('rechazo'); } });
  const handler = callbackHandler.createHandler({
    load: async () => d,
    client,
    logger: { error: () => {}, info: () => {} },
  });
  const result = await handler(callbackEvent(), { awsRequestId: 'r-17' });
  assert.equal(new URL(result.headers.Location).searchParams.get('motivo'), 'google_rechazo');
  assert.equal(calls.some(([tipo]) => tipo === 'sesion'), false);
  assert.match(cookieNamed(result, STATE_COOKIE_NAME), /Max-Age=0/);
});

test('callback con error interno limpia la cookie de estado y responde 500', async () => {
  const { deps: d, calls } = deps();
  d.repo.consumirEstado = async () => { throw new Error('base caída'); };
  const handler = callbackHandler.createHandler({
    load: async () => d,
    client: google,
    logger: { error: () => {}, info: () => {} },
  });
  const result = await handler(callbackEvent(), { awsRequestId: 'r-18' });
  assert.equal(result.statusCode, 500);
  assert.equal(new URL(result.headers.Location).searchParams.get('motivo'), 'error_interno');
  assert.equal(calls.some(([tipo]) => tipo === 'sesion'), false);
  assert.match(cookieNamed(result, STATE_COOKIE_NAME), /Max-Age=0/);
});

test('callback rechaza un state válido sin cookie de estado', async () => {
  const { deps: d, calls } = deps();
  let consumido = false;
  d.repo.consumirEstado = async () => { consumido = true; return null; };
  const handler = callbackHandler.createHandler({ load: async () => d, client: google });
  const result = await handler(callbackEvent({ cookie: null }), { awsRequestId: 'r-7' });
  assert.equal(new URL(result.headers.Location).searchParams.get('motivo'), 'estado_sin_cookie');
  assert.equal(consumido, false, 'no debe consumir un state sin la cookie del navegador');
  assert.equal(calls.some(([tipo]) => tipo === 'sesion'), false);
  assert.match(cookieNamed(result, STATE_COOKIE_NAME), /Max-Age=0/);
});

test('callback rechaza una cookie de estado que no corresponde', async () => {
  const { deps: d, calls } = deps();
  let consumido = false;
  d.repo.consumirEstado = async () => { consumido = true; return null; };
  const handler = callbackHandler.createHandler({ load: async () => d, client: google });
  const result = await handler(callbackEvent({
    cookie: `${STATE_COOKIE_NAME}=${hashState('otro-estado')}`,
  }), { awsRequestId: 'r-8' });
  assert.equal(new URL(result.headers.Location).searchParams.get('motivo'), 'estado_cookie_invalida');
  assert.equal(consumido, false, 'no debe consumir el state si la cookie no coincide');
  assert.equal(calls.some(([tipo]) => tipo === 'sesion'), false);
  assert.match(cookieNamed(result, STATE_COOKIE_NAME), /Max-Age=0/);
});

test('callback rechaza un state vencido aunque la cookie coincida', async () => {
  const { deps: d, calls } = deps();
  const inicio = new Date('2026-11-25T12:00:00.000Z');
  let ahora = inicio;
  const repo = repoEnMemoria(() => ahora);
  d.repo = repo;
  const start = startHandler.createHandler({ load: async () => d, client: google, now: () => ahora });
  const startResult = await start({}, { awsRequestId: 'r-9' });
  const estado = repo.calls.find(([tipo]) => tipo === 'estado')[1];
  assert.equal(estado.expiraEn.getTime(), inicio.getTime() + STATE_TTL_MS);
  const cookie = cookiePair(startResult, STATE_COOKIE_NAME);
  assert.ok(cookie);

  ahora = new Date(inicio.getTime() + STATE_TTL_MS + 1);
  const callback = callbackHandler.createHandler({ load: async () => d, client: google, now: () => ahora });
  const result = await callback(callbackEvent({ cookie }), { awsRequestId: 'r-10' });
  assert.equal(new URL(result.headers.Location).searchParams.get('motivo'), 'estado_invalido');
  assert.equal(calls.some(([tipo]) => tipo === 'sesion'), false);
  assert.match(cookieNamed(result, STATE_COOKIE_NAME), /Max-Age=0/);
  const consumo = repo.calls.find(([tipo]) => tipo === 'consumir');
  assert.equal(consumo[2].getTime(), ahora.getTime(), 'debe validar el vencimiento con la hora actual');
});

test('callback consume el state una sola vez y rechaza el doble uso', async () => {
  const { deps: d, calls } = deps();
  let ahora = new Date('2026-11-25T12:00:00.000Z');
  const repo = repoEnMemoria(() => ahora);
  d.repo = repo;
  const start = startHandler.createHandler({ load: async () => d, client: google, now: () => ahora });
  const startResult = await start({}, { awsRequestId: 'r-11' });
  const cookie = cookiePair(startResult, STATE_COOKIE_NAME);
  assert.ok(cookie);

  const callback = callbackHandler.createHandler({ load: async () => d, client: google, now: () => ahora });
  const primero = await callback(callbackEvent({ cookie }), { awsRequestId: 'r-12' });
  assert.equal(primero.statusCode, 302);
  assert.equal(primero.headers.Location, settings.FRONTEND_URL);
  assert.equal(calls.filter(([tipo]) => tipo === 'sesion').length, 1);

  ahora = new Date(ahora.getTime() + 1000);
  const segundo = await callback(callbackEvent({ cookie }), { awsRequestId: 'r-13' });
  assert.equal(new URL(segundo.headers.Location).searchParams.get('motivo'), 'estado_invalido');
  assert.equal(calls.filter(([tipo]) => tipo === 'sesion').length, 1, 'no debe crear una segunda sesión');
  assert.match(cookieNamed(segundo, STATE_COOKIE_NAME), /Max-Age=0/);
});

test('sesion devuelve 200 con el usuario y 401 sin cookie', async () => {
  const { deps: d } = deps();
  const handler = sesion.createHandler({ load: async () => d });
  const ok = await handler({}, { awsRequestId: 'r-14' });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(JSON.parse(ok.body).usuario, { id: 'u-1', email: 'a@b.cl', nombre: 'A' });
  d.auth.current = async () => null;
  const anonimo = await handler({}, { awsRequestId: 'r-15' });
  assert.equal(anonimo.statusCode, 401);
  assert.equal(anonimo.headers['Access-Control-Allow-Origin'], '*');
});

test('logout destruye la sesión y expira la cookie', async () => {
  const { deps: d, calls } = deps();
  const handler = logout.createHandler({ load: async () => d });
  const result = await handler({}, { awsRequestId: 'r-16' });
  assert.equal(result.statusCode, 204);
  assert.match(result.headers['Set-Cookie'], /Max-Age=0/);
  assert.deepEqual(calls[0], ['destroy', 'token-actual']);
});
