'use strict';

const { context, googleClient } = require('../lib/context');
const { hashToken } = require('../lib/session');
const { response, requestId, log } = require('../lib/response');

const STATE_TTL_MS = 10 * 60 * 1000;

function createHandler({
  load = context,
  client = googleClient,
  now = () => new Date(),
  logger = console,
} = {}) {
  return async (event, lambdaContext) => {
    const trace = requestId(event, lambdaContext);
    try {
      const deps = await load();
      const flow = client(deps.settings).start();
      await deps.repo.crearEstado({
        hash: hashToken(flow.state),
        verifier: flow.verifier,
        nonce: flow.nonce,
        expiraEn: new Date(now().getTime() + STATE_TTL_MS),
      });
      log(logger, 'info', { requestId: trace, action: 'authGoogleStart', statusCode: 302 });
      return {
        statusCode: 302,
        headers: { Location: flow.url, 'Cache-Control': 'no-store' },
        body: '',
      };
    } catch (error) {
      log(logger, 'error', {
        requestId: trace, action: 'authGoogleStart', statusCode: 503, error: error.name,
      });
      return response(503, { message: 'El acceso con Google no está configurado en el laboratorio.' });
    }
  };
}

module.exports = { createHandler, handler: createHandler() };
