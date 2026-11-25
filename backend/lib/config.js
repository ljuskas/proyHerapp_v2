'use strict';

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const REQUIRED_KEYS = [
  'TABLE_NAME',
  'DYNAMODB_ENDPOINT_URL',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
];
const CACHE_TTL_MS = 5 * 60 * 1000;
const LOCAL_ENDPOINTS = ['http://localemu:4566', 'http://127.0.0.1:4566'];

function parseSecret(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('El secreto de configuración está vacío.');
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('El secreto de configuración no es JSON válido.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('El secreto de configuración debe ser un objeto JSON.');
  }
  return data;
}

function validate(data, required) {
  const missing = required.filter((key) => typeof data[key] !== 'string' || !data[key].trim());
  if (missing.length > 0) {
    throw new Error(`Faltan claves obligatorias en el secreto: ${missing.join(', ')}.`);
  }
  return data;
}

function createConfigLoader({
  getSecret,
  now = () => Date.now(),
  ttlMs = CACHE_TTL_MS,
  required = REQUIRED_KEYS,
}) {
  if (typeof getSecret !== 'function') throw new Error('createConfigLoader requiere getSecret.');
  let cached = null;
  let cachedAt = 0;
  let pending = null;

  return async function load() {
    if (cached && now() - cachedAt < ttlMs) return cached;
    if (!pending) {
      pending = Promise.resolve()
        .then(getSecret)
        .then((raw) => validate(parseSecret(raw), required))
        .then((data) => {
          cached = data;
          cachedAt = now();
          return data;
        })
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  };
}

function localEndpoint() {
  const endpoint = process.env.SECRETS_ENDPOINT_URL;
  if (!LOCAL_ENDPOINTS.includes(endpoint)) {
    throw new Error('SECRETS_ENDPOINT_URL debe apuntar al laboratorio LocalEmu.');
  }
  return endpoint;
}

let loader;
function load() {
  if (!loader) {
    const secretId = process.env.SECRET_ID;
    if (!secretId) throw new Error('Falta SECRET_ID.');
    const client = new SecretsManagerClient({
      endpoint: localEndpoint(),
      region: process.env.AWS_REGION || 'us-east-1',
    });
    loader = createConfigLoader({
      getSecret: async () => {
        const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
        return result.SecretString;
      },
    });
  }
  return loader();
}

module.exports = {
  REQUIRED_KEYS,
  createConfigLoader,
  parseSecret,
  load,
};
