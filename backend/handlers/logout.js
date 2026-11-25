'use strict';

const { context } = require('../lib/context');
const { COOKIE_NAME } = require('../lib/session');
const { clearCookie } = require('../lib/cookies');
const { response, requestId, log } = require('../lib/response');

function createHandler({ load = context, logger = console } = {}) {
  return async (event, lambdaContext) => {
    const trace = requestId(event, lambdaContext);
    try {
      const deps = await load();
      const token = deps.auth.token(event);
      if (token) await deps.sessions.destroy(token);
      log(logger, 'info', { requestId: trace, action: 'logout', statusCode: 204 });
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Set-Cookie': clearCookie(COOKIE_NAME),
          'Cache-Control': 'no-store',
        },
        body: '',
      };
    } catch (error) {
      log(logger, 'error', {
        requestId: trace, action: 'logout', statusCode: 500, error: error.name,
      });
      return response(500, { message: 'Error interno del servidor.' });
    }
  };
}

module.exports = { createHandler, handler: createHandler() };
