'use strict';

const { getRegistro } = require('../lib/dynamodb');
const { unauthorized } = require('../lib/auth');
const { context: loadContext } = require('../lib/context');
const { response, requestId, log } = require('../lib/response');

function createHandler({ get = getRegistro, logger = console, authorize } = {}) {
  const autorizar = authorize || (async (event) => (await loadContext()).auth.current(event));
  return async (event, context) => {
    const trace = requestId(event, context);
    let sesion;
    try {
      sesion = await autorizar(event);
    } catch (error) {
      log(logger, 'error', { requestId: trace, action: 'getRegistro', statusCode: 500, error: error.name });
      return response(500, { message: 'Error interno del servidor.' });
    }
    if (!sesion) {
      log(logger, 'info', { requestId: trace, action: 'getRegistro', statusCode: 401 });
      return unauthorized();
    }
    const id = event?.pathParameters?.id;
    if (typeof id !== 'string' || !id.trim()) {
      log(logger, 'info', { requestId: trace, action: 'getRegistro', statusCode: 400 });
      return response(400, { message: 'El parámetro id es obligatorio.' });
    }
    try {
      const item = await get(id);
      const statusCode = item ? 200 : 404;
      log(logger, 'info', { requestId: trace, action: 'getRegistro', statusCode, id });
      return item ? response(200, item) : response(404, { message: 'Registro no encontrado.' });
    } catch (error) {
      log(logger, 'error', { requestId: trace, action: 'getRegistro', statusCode: 500, error: error.name });
      return response(500, { message: 'Error interno del servidor.' });
    }
  };
}

module.exports = { createHandler, handler: createHandler() };
