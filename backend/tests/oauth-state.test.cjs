'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  STATE_COOKIE_NAME,
  STATE_TTL_MS,
  clearStateCookie,
  hashState,
  readStateCookie,
  sameStateHash,
  stateCookie,
} = require('../lib/oauth-state');
const { hashToken } = require('../lib/session');

test('hashState guarda solo el SHA-256 del state en la cookie', () => {
  const state = 'estado-en-claro';
  const hash = hashState(state);
  assert.equal(hash, hashToken(state));
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, state);

  const cookie = stateCookie(hash);
  assert.match(cookie, new RegExp(`^${STATE_COOKIE_NAME}=${hash}(;|$)`));
  assert.ok(!cookie.includes(state), 'la cookie no debe contener el state en claro');
  assert.match(cookie, /Max-Age=600/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.equal(STATE_TTL_MS / 1000, 600);
});

test('readStateCookie extrae la cookie del encabezado Cookie', () => {
  const hash = hashState('estado-1');
  const event = { headers: { Cookie: `otra=1; ${STATE_COOKIE_NAME}=${hash}; sesion=x` } };
  assert.equal(readStateCookie(event), hash);
  assert.equal(readStateCookie({ headers: {} }), null);
  assert.equal(readStateCookie({}), null);
});

test('sameStateHash solo acepta el hash exacto y usa comparación segura', () => {
  const hash = hashState('estado-1');
  assert.equal(sameStateHash(hash, hash), true);
  assert.equal(sameStateHash(hashState('estado-2'), hash), false);
  assert.equal(sameStateHash('estado-1', hash), false);
  assert.equal(sameStateHash(hash.slice(0, -1), hash), false);
  assert.equal(sameStateHash(null, hash), false);
  assert.equal(sameStateHash(hash, undefined), false);
});

test('clearStateCookie expira la cookie con el mismo nombre y ámbito', () => {
  const cookie = clearStateCookie();
  assert.match(cookie, new RegExp(`^${STATE_COOKIE_NAME}=;`));
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
});
