'use strict';

const { createHash, randomBytes } = require('node:crypto');

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const SCOPES = 'openid email profile';

function randomUrlSafe(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

function codeChallenge(verifier) {
  return createHash('sha256').update(verifier).digest('base64url');
}

function authorizationUrl({ clientId, redirectUri, state, nonce, challenge }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

let josePromise;
function loadJose() {
  if (!josePromise) josePromise = import('jose');
  return josePromise;
}

async function defaultVerify(idToken, { clientId, nonce }) {
  const { createRemoteJWKSet, jwtVerify } = await loadJose();
  const jwks = createRemoteJWKSet(new URL(JWKS_URL));
  const { payload } = await jwtVerify(idToken, jwks, { issuer: ISSUERS, audience: clientId });
  if (!nonce || payload.nonce !== nonce) throw new Error('El nonce del token no coincide.');
  if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('El token no trae sub.');
  if (typeof payload.email !== 'string' || !payload.email) throw new Error('El token no trae email.');
  return {
    sub: payload.sub,
    email: payload.email,
    nombre: typeof payload.name === 'string' && payload.name.trim() ? payload.name : payload.email,
  };
}

function createGoogleClient({
  clientId,
  clientSecret,
  redirectUri,
  fetchImpl = fetch,
  verify = defaultVerify,
}) {
  if (!clientId || !clientSecret) throw new Error('Falta la configuración de Google.');
  if (!redirectUri) throw new Error('Falta la URL de redirección de Google.');
  if (!/\/auth\/google\/callback$/.test(redirectUri)) {
    throw new Error('GOOGLE_REDIRECT_URI debe apuntar a /auth/google/callback del backend.');
  }

  return {
    start() {
      const state = randomUrlSafe(24);
      const nonce = randomUrlSafe(24);
      const verifier = randomUrlSafe(32);
      return {
        state,
        nonce,
        verifier,
        url: authorizationUrl({
          clientId, redirectUri, state, nonce, challenge: codeChallenge(verifier),
        }),
      };
    },

    async finish({ code, verifier, nonce }) {
      if (!code) throw new Error('Falta el código de autorización.');
      const body = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      });
      const result = await fetchImpl(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      if (!result.ok) throw new Error('Google rechazó el código de autorización.');
      const tokens = await result.json();
      if (typeof tokens.id_token !== 'string' || !tokens.id_token) {
        throw new Error('Google no devolvió un id_token.');
      }
      return verify(tokens.id_token, { clientId, nonce });
    },
  };
}

module.exports = {
  authorizationUrl,
  codeChallenge,
  createGoogleClient,
  defaultVerify,
  randomUrlSafe,
};
