'use strict';

const { randomUUID } = require('node:crypto');
const { putRegistro } = require('../lib/dynamodb');
const { response, requestId, log } = require('../lib/response');

function createHandler({ put = putRegistro, uuid = randomUUID, now = () => new Date(), logger = console } = {}) {
  return async (event, context) => {
    const trace = requestId(event, context);
    let body;
    try {
      const raw = event?.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64').toString('utf8') : event?.body;
      body = JSON.parse(raw);
    } catch {
      log(logger, 'info', { requestId: trace, action: 'createRegistro', statusCode: 400 });
      return response(400, { message: 'El cuerpo debe ser JSON válido.' });
    }
    if (typeof body?.nombre !== 'string' || !body.nombre.trim()) {
      log(logger, 'info', { requestId: trace, action: 'createRegistro', statusCode: 400 });
      return response(400, { message: 'El campo nombre debe ser un texto no vacío.' });
    }
    try {
      const item = { id: uuid(), nombre: body.nombre.trim(), createdAt: now().toISOString() };
      await put(item);
      log(logger, 'info', { requestId: trace, action: 'createRegistro', statusCode: 201, id: item.id });
      return response(201, item);
    } catch (error) {
      log(logger, 'error', { requestId: trace, action: 'createRegistro', statusCode: 500, error: error.name });
      return response(500, { message: 'Error interno del servidor.' });
    }
  };
}

module.exports = { createHandler, handler: createHandler() };
