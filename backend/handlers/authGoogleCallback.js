'use strict';

const { context, googleClient } = require('../lib/context');
const { clientIp, userAgent } = require('../lib/auth');
const { COOKIE_NAME, hashToken } = require('../lib/session');
const { serializeCookie } = require('../lib/cookies');
const { requestId, log } = require('../lib/response');

function redirectTo(url, params = {}) {
  const target = new URL(url);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return target.toString();
}

function createHandler({
  load = context,
  client = googleClient,
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
      return { statusCode: 500, headers: {}, body: '' };
    }
    const frontend = deps.settings.FRONTEND_URL;
    const fail = (motivo, statusCode = 302) => {
      log(logger, 'info', {
        requestId: trace, action: 'authGoogleCallback', statusCode, motivo,
      });
      return {
        statusCode,
        headers: { Location: redirectTo(frontend, { acceso: 'error', motivo }), 'Cache-Control': 'no-store' },
        body: '',
      };
    };

    if (params.error) return fail('cancelado');
    if (!params.state || !params.code) return fail('parametros_invalidos');

    let estado;
    try {
      estado = await deps.repo.consumirEstado(hashToken(params.state));
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
      return {
        statusCode: 302,
        headers: {
          Location: frontend,
          'Set-Cookie': serializeCookie(COOKIE_NAME, token, { maxAge: deps.sessions.ttlMs / 1000 }),
          'Cache-Control': 'no-store',
        },
        body: '',
      };
    } catch (error) {
      log(logger, 'error', {
        requestId: trace, action: 'authGoogleCallback', statusCode: 500, error: error.name,
      });
      return fail('error_interno', 500);
    }
  };
}

module.exports = { createHandler, handler: createHandler() };
