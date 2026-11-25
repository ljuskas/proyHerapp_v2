'use strict';

const { context } = require('../lib/context');
const { clientIp, userAgent } = require('../lib/auth');
const { COOKIE_NAME } = require('../lib/session');
const { serializeCookie } = require('../lib/cookies');
const { response, requestId, log } = require('../lib/response');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createHandler({ load = context, logger = console } = {}) {
  return async (event, lambdaContext) => {
    const trace = requestId(event, lambdaContext);
    if (process.env.DEV_LOGIN_ENABLED !== '1') {
      log(logger, 'info', { requestId: trace, action: 'authDev', statusCode: 404 });
      return response(404, { message: 'No encontrado.' });
    }
    let body;
    try {
      const raw = event?.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64').toString('utf8') : event?.body;
      body = JSON.parse(raw);
    } catch {
      return response(400, { message: 'El cuerpo debe ser JSON válido.' });
    }
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!EMAIL.test(email)) return response(400, { message: 'Indica un correo válido.' });
    const nombre = typeof body?.nombre === 'string' && body.nombre.trim() ? body.nombre.trim() : email;

    try {
      const deps = await load();
      const usuario = await deps.repo.upsertUsuario({ email, nombre });
      await deps.repo.vincularIdentidad({ usuarioId: usuario.id, proveedor: 'dev', sub: email, email });
      const { token } = await deps.sessions.create(usuario.id, {
        ip: clientIp(event), userAgent: userAgent(event),
      });
      await deps.repo.registrarAuditoria({
        actorId: usuario.id, accion: 'login', resultado: 'ok', detalle: { proveedor: 'dev' },
      });
      log(logger, 'info', { requestId: trace, action: 'authDev', statusCode: 200, usuarioId: usuario.id });
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Set-Cookie': serializeCookie(COOKIE_NAME, token, { maxAge: deps.sessions.ttlMs / 1000 }),
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({ usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre } }),
      };
    } catch (error) {
      log(logger, 'error', {
        requestId: trace, action: 'authDev', statusCode: 500, error: error.name,
      });
      return response(500, { message: 'Error interno del servidor.' });
    }
  };
}

module.exports = { createHandler, handler: createHandler() };
