'use strict';

const ENDPOINT = 'http://127.0.0.1:4566';

module.exports = class LocalOnly {
  constructor(serverless, options) {
    const provider = serverless.getProvider('aws');
    const stage = options.stage || serverless.service.provider.stage;
    if (stage !== 'local') throw new Error('Heraap solo permite el stage local.');
    if ((options.region || serverless.service.provider.region) !== 'us-east-1') {
      throw new Error('El laboratorio Heraap usa únicamente us-east-1.');
    }
    if (process.env.AWS_ENDPOINT_URL !== ENDPOINT) {
      throw new Error(`AWS_ENDPOINT_URL debe ser ${ENDPOINT}.`);
    }
    if (process.env.AWS_ACCESS_KEY_ID !== 'test' || process.env.AWS_SECRET_ACCESS_KEY !== 'test'
        || process.env.AWS_SESSION_TOKEN || process.env.AWS_PROFILE || process.env.AWS_DEFAULT_PROFILE
        || serverless.service.provider.profile || options['aws-profile']) {
      throw new Error('Heraap requiere credenciales ficticias test, sin perfil ni sesión AWS.');
    }

    // Adaptación acotada del esquema de Serverless 3.40.0; no desactiva su validación.
    const runtimes = serverless.configSchemaHandler.schema.definitions.awsLambdaRuntime.enum;
    if (!runtimes.includes('nodejs22.x')) runtimes.push('nodejs22.x');

    // Guardar cada solicitud SDK v2 antes de enviarla, incluso si un adaptador falla.
    provider.sdk.events.on('validate', (request) => {
      const endpoint = request.httpRequest.endpoint;
      if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1'
          || Number(endpoint.port) !== 4566) {
        throw new Error('Solicitud AWS bloqueada: el destino no es LocalEmu local.');
      }
    });
  }
};
