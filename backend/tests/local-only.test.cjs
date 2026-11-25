'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const AWS = require('serverless/lib/aws/sdk-v2');
const LocalOnly = require('../plugins/local-only.cjs');

function fixture() {
  return {
    service: { provider: { stage: 'local', region: 'us-east-1' } },
    getProvider: () => ({ sdk: AWS }),
    configSchemaHandler: { schema: { definitions: { awsLambdaRuntime: { enum: ['nodejs20.x'] } } } },
  };
}

beforeEach(() => {
  process.env.AWS_ENDPOINT_URL = 'http://127.0.0.1:4566';
  process.env.AWS_ACCESS_KEY_ID = 'test';
  process.env.AWS_SECRET_ACCESS_KEY = 'test';
  delete process.env.AWS_SESSION_TOKEN;
  delete process.env.AWS_PROFILE;
  delete process.env.AWS_DEFAULT_PROFILE;
});

test('guarda de despliegue bloquea stages, endpoints y credenciales externos', () => {
  assert.throws(() => new LocalOnly(fixture(), { stage: 'production' }), /stage local/);
  process.env.AWS_ENDPOINT_URL = 'https://dynamodb.us-east-1.amazonaws.com';
  assert.throws(() => new LocalOnly(fixture(), {}), /AWS_ENDPOINT_URL/);
  process.env.AWS_ENDPOINT_URL = 'http://127.0.0.1:4566';
  process.env.AWS_ACCESS_KEY_ID = 'otra-clave';
  assert.throws(() => new LocalOnly(fixture(), {}), /credenciales ficticias/);
  process.env.AWS_ACCESS_KEY_ID = 'test';
});

test('guarda intercepta una petición real SDK antes de acceder a otro puerto', async () => {
  const serverless = fixture();
  new LocalOnly(serverless, {});
  assert.ok(serverless.configSchemaHandler.schema.definitions.awsLambdaRuntime.enum.includes('nodejs22.x'));
  const sts = new AWS.STS({
    endpoint: 'http://127.0.0.1:9', region: 'us-east-1',
    accessKeyId: 'test', secretAccessKey: 'test', maxRetries: 0,
  });
  await assert.rejects(sts.getCallerIdentity().promise(), /destino no es LocalEmu/);
});
