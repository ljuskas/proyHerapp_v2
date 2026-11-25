'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { authorizationUrl, codeChallenge, createGoogleClient } = require('../lib/google');

const base = {
  clientId: 'cliente-de-prueba.apps.googleusercontent.com',
  clientSecret: 'secreto-de-prueba',
  redirectUri: 'https://local.deptofeliz.uk/_aws/execute-api/xsmydwgk1h/local/auth/google/callback',
};

test('authorizationUrl incluye PKCE, state, nonce y alcance mínimo', () => {
  const url = new URL(authorizationUrl({
    clientId: base.clientId,
    redirectUri: base.redirectUri,
    state: 'estado-123',
    nonce: 'nonce-456',
    challenge: 'reto-789',
  }));
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('client_id'), base.clientId);
  assert.equal(url.searchParams.get('redirect_uri'), base.redirectUri);
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('scope'), 'openid email profile');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), 'reto-789');
  assert.equal(url.searchParams.get('state'), 'estado-123');
  assert.equal(url.searchParams.get('nonce'), 'nonce-456');
});

test('codeChallenge es el SHA-256 base64url del verificador', () => {
  assert.equal(codeChallenge('verificador'), 'Eh2lhg0GRim7FAnnu_O-Mr16osuv3YZvFY23EBiNySY');
});

test('start genera valores distintos y una URL coherente', () => {
  const client = createGoogleClient(base);
  const first = client.start();
  const second = client.start();
  assert.notEqual(first.state, second.state);
  assert.notEqual(first.verifier, second.verifier);
  const url = new URL(first.url);
  assert.equal(url.searchParams.get('state'), first.state);
  assert.equal(url.searchParams.get('code_challenge'), codeChallenge(first.verifier));
});

test('finish canjea el código y verifica el id_token con el nonce', async () => {
  const calls = [];
  const client = createGoogleClient({
    ...base,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ id_token: 'token-firmado' }) };
    },
    verify: async (idToken, options) => {
      assert.equal(idToken, 'token-firmado');
      assert.equal(options.clientId, base.clientId);
      assert.equal(options.nonce, 'nonce-789');
      return { sub: 'google-1', email: 'persona@example.com', nombre: 'Persona' };
    },
  });
  const claims = await client.finish({ code: 'codigo-1', verifier: 'verificador-1', nonce: 'nonce-789' });
  assert.deepEqual(claims, { sub: 'google-1', email: 'persona@example.com', nombre: 'Persona' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://oauth2.googleapis.com/token');
  const body = new URLSearchParams(calls[0].options.body);
  assert.equal(body.get('code'), 'codigo-1');
  assert.equal(body.get('code_verifier'), 'verificador-1');
  assert.equal(body.get('client_secret'), base.clientSecret);
  assert.equal(body.get('grant_type'), 'authorization_code');
});

test('finish falla si Google rechaza el código o no devuelve id_token', async () => {
  const rechazado = createGoogleClient({
    ...base,
    fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
  });
  await assert.rejects(rechazado.finish({ code: 'x', verifier: 'v', nonce: 'n' }), /rechazó/);

  const sinToken = createGoogleClient({
    ...base,
    fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
  });
  await assert.rejects(sinToken.finish({ code: 'x', verifier: 'v', nonce: 'n' }), /id_token/);
});

test('createGoogleClient exige client ID, secret y redirección', () => {
  assert.throws(() => createGoogleClient({ ...base, clientId: '' }), /configuración de Google/);
  assert.throws(() => createGoogleClient({ ...base, clientSecret: '' }), /configuración de Google/);
  assert.throws(() => createGoogleClient({ ...base, redirectUri: '' }), /redirección/);
  assert.throws(() => createGoogleClient({ ...base, redirectUri: 'https://local.deptofeliz.uk/heraap-frontend-local/' }), /callback/);
});
