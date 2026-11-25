'use strict';

const { context, googleClient } = require('../lib/context');
const { clientIp, userAgent } = require('../lib/auth');
const { COOKIE_NAME } = require('../lib/session');
const { serializeCookie } = require('../lib/cookies');
const {
  clearStateCookie, hashState, readStateCookie, sameStateHash,
} = require('../lib/oauth-state');
const { requestId, log } = require('../lib/response');

function redirectTo(url, params = {}) {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return target.toString();
}

function withCookies(result, cookies) {
  return { ...result, multiValueHeaders: { 'Set-Cookie': cookies } };
}

function createHandler({
  load = context,
  client = googleClient,
  now = () => new Date(),
  logger = console,
} = {}) {
  return async (event, lambdaContext) => {
    const trace = requestId(event, lambdaContext);
    const params = event?.queryStringParameters || {};
    let deps;
    try {
      deps = await load();
    } catch (error) {
      log(logger, 'error', {
        requestId: trace, action: 'authGoogleCallback', statusCode: 500, error: error.name,
      });
      return withCookies({ statusCode: 500, headers: {}, body: '' }, [clearStateCookie()]);
    }
    const frontend = deps.settings.FRONTEND_URL;
    const fail = (motivo, statusCode = 302) => {
      log(logger, 'info', {
        requestId: trace, action: 'authGoogleCallback', statusCode, motivo,
      });
      return withCookies({
        statusCode,
        headers: { Location: redirectTo(frontend, { acceso: 'error', motivo }), 'Cache-Control': 'no-store' },
        body: '',
      }, [clearStateCookie()]);
    };

    if (params.error) return fail('cancelado');
    if (typeof params.state !== 'string' || !params.state
      || typeof params.code !== 'string' || !params.code) {
      return fail('parametros_invalidos');
    }

    const esperado = hashState(params.state);
    const cookie = readStateCookie(event);
    if (!cookie) return fail('estado_sin_cookie');
    if (!sameStateHash(cookie, esperado)) return fail('estado_cookie_invalida');

    let estado;
    try {
      estado = await deps.repo.consumirEstado(esperado, now());
    } catch (error) {
      log(logger, 'error', {
        requestId: trace, action: 'authGoogleCallback', statusCode: 500, error: error.name,
      });
      return fail('error_interno', 500);
    }
    if (!estado) return fail('estado_invalido');

    let claims;
    try {
      claims = await client(deps.settings).finish({ code: params.code, verifier: estado.verifier, nonce: estado.nonce });
    } catch (error) {
      log(logger, 'error', {
        requestId: trace, action: 'authGoogleCallback', statusCode: 401, error: error.name,
      });
      return fail('google_rechazo');
    }

    try {
      const registrado = await deps.repo.usuarioPorIdentidad('google', claims.sub);
      const usuario = registrado || await deps.repo.upsertUsuario({ email: claims.email, nombre: claims.nombre });
      if (!usuario) return fail('error_interno', 500);
      await deps.repo.vincularIdentidad({
        usuarioId: usuario.id, proveedor: 'google', sub: claims.sub, email: claims.email,
      });
      const { token } = await deps.sessions.create(usuario.id, {
        ip: clientIp(event), userAgent: userAgent(event),
      });
      await deps.repo.registrarAuditoria({
        actorId: usuario.id, accion: 'login', resultado: 'ok', detalle: { proveedor: 'google' },
      });
      log(logger, 'info', { requestId: trace, action: 'authGoogleCallback', statusCode: 302, usuarioId: usuario.id });
      return withCookies({
        statusCode: 302,
        headers: { Location: frontend, 'Cache-Control': 'no-store' },
        body: '',
      }, [
        serializeCookie(COOKIE_NAME, token, { maxAge: deps.sessions.ttlMs / 1000 }),
        clearStateCookie(),
      ]);
    } catch (error) {
      log(logger, 'error', {
        requestId: trace, action: 'authGoogleCallback', statusCode: 500, error: error.name,
      });
      return fail('error_interno', 500);
    }
  };
}

module.exports = { createHandler, handler: createHandler() };
