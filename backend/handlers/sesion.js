'use strict';

const { context } = require('../lib/context');
const { unauthorized } = require('../lib/auth');
const { response, requestId, log } = require('../lib/response');

function createHandler({ load = context, logger = console } = {}) {
  return async (event, lambdaContext) => {
    const trace = requestId(event, lambdaContext);
    try {
      const deps = await load();
      const sesion = await deps.auth.current(event);
      if (!sesion) {
        log(logger, 'info', { requestId: trace, action: 'sesion', statusCode: 401 });
        return unauthorized();
      }
      log(logger, 'info', { requestId: trace, action: 'sesion', statusCode: 200, usuarioId: sesion.id });
      return response(200, {
        usuario: { id: sesion.id, email: sesion.email, nombre: sesion.nombre },
      });
    } catch (error) {
      log(logger, 'error', {
        requestId: trace, action: 'sesion', statusCode: 500, error: error.name,
      });
      return response(500, { message: 'Error interno del servidor.' });
    }
  };
}

module.exports = { createHandler, handler: createHandler() };
