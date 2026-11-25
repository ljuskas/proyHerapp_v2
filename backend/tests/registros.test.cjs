'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHandler: createRegistro } = require('../handlers/createRegistro');
const { createHandler: getRegistro } = require('../handlers/getRegistro');
const { createStore } = require('../lib/dynamodb');

const context = { awsRequestId: 'request-de-prueba' };
const authorize = async () => ({ id: 'usuario-de-prueba', email: 'prueba@example.com' });
function logs() {
  const lines = [];
  return { lines, logger: { info: (line) => lines.push(JSON.parse(line)), error: (line) => lines.push(JSON.parse(line)) } };
}

test('rechaza JSON inválido y nombres ausentes, vacíos o de otro tipo sin escribir', async () => {
  let writes = 0;
  const { logger } = logs();
  const handler = createRegistro({ authorize, put: async () => { writes++; }, logger });
  for (const body of ['{', '{}', 'null', '[]', '{"nombre":null}', '{"nombre":42}', '{"nombre":""}', '{"nombre":"  "}']) {
    const result = await handler({ body }, context);
    assert.equal(result.statusCode, 400, body);
    assert.equal(result.headers['Access-Control-Allow-Origin'], '*');
  }
  assert.equal(writes, 0);
});

test('crea un registro con UUID v4, nombre normalizado, fecha e identificador de petición', async () => {
  let saved;
  const { logger, lines } = logs();
  const handler = createRegistro({ authorize, put: async (item) => { saved = item; }, logger });
  const result = await handler({ body: '{"nombre":"  Laboratorio  "}' }, context);
  assert.equal(result.statusCode, 201);
  assert.deepEqual(JSON.parse(result.body), saved);
  assert.match(saved.id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(saved.nombre, 'Laboratorio');
  assert.equal(saved.usuarioId, 'usuario-de-prueba');
  assert.equal(new Date(saved.createdAt).toISOString(), saved.createdAt);
  assert.equal(lines[0].requestId, context.awsRequestId);
});

test('acepta el cuerpo base64 que puede entregar API Gateway', async () => {
  const { logger } = logs();
  const handler = createRegistro({ authorize, put: async () => {}, logger });
  const result = await handler({ isBase64Encoded: true, body: Buffer.from('{"nombre":"Base64"}').toString('base64') }, context);
  assert.equal(result.statusCode, 201);
});

test('errores de escritura producen 500 genérico y log correlacionado', async () => {
  const { logger, lines } = logs();
  const handler = createRegistro({ authorize, put: async () => { throw new Error('detalle privado'); }, logger });
  const result = await handler({ body: '{"nombre":"Error"}' }, context);
  assert.equal(result.statusCode, 500);
  assert.equal(JSON.parse(result.body).message, 'Error interno del servidor.');
  assert.ok(!result.body.includes('detalle privado'));
  assert.equal(lines[0].requestId, context.awsRequestId);
  assert.equal(lines[0].level, 'error');
});

test('consulta devuelve el registro existente y 404 cuando no existe', async () => {
  const item = { id: 'registro-1', nombre: 'Guardado', createdAt: '2026-11-24T00:00:00.000Z' };
  const { logger } = logs();
  const handler = getRegistro({ authorize, get: async (id) => id === item.id ? item : undefined, logger });
  const found = await handler({ pathParameters: { id: item.id } }, context);
  assert.equal(found.statusCode, 200);
  assert.deepEqual(JSON.parse(found.body), item);
  const missing = await handler({ pathParameters: { id: 'inexistente' } }, context);
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.headers['Access-Control-Allow-Origin'], '*');
});

test('errores de lectura producen 500 genérico', async () => {
  const { logger } = logs();
  const handler = getRegistro({ authorize, get: async () => { throw new Error('detalle privado'); }, logger });
  const result = await handler({ pathParameters: { id: 'registro-1' } }, context);
  assert.equal(result.statusCode, 500);
  assert.ok(!result.body.includes('detalle privado'));
});

test('DynamoDB usa la tabla configurada y lectura consistente por PK id', async () => {
  const commands = [];
  const item = { id: 'a', nombre: 'Prueba' };
  const store = createStore({ send: async (command) => { commands.push(command); return { Item: item }; } }, 'tabla-local');
  await store.put(item);
  assert.equal(await store.get('a'), item);
  assert.equal(commands[0].input.TableName, 'tabla-local');
  assert.equal(commands[0].input.ConditionExpression, 'attribute_not_exists(id)');
  assert.deepEqual(commands[1].input, { TableName: 'tabla-local', Key: { id: 'a' }, ConsistentRead: true });
});

test('rechaza la creación sin sesión y no escribe', async () => {
  let writes = 0;
  const { logger } = logs();
  const handler = createRegistro({ authorize: async () => null, put: async () => { writes++; }, logger });
  const result = await handler({ body: '{"nombre":"Sin sesión"}' }, context);
  assert.equal(result.statusCode, 401);
  assert.equal(writes, 0);
});

test('rechaza la consulta sin sesión y no lee', async () => {
  let reads = 0;
  const { logger } = logs();
  const handler = getRegistro({ authorize: async () => null, get: async () => { reads++; }, logger });
  const result = await handler({ pathParameters: { id: 'cualquiera' } }, context);
  assert.equal(result.statusCode, 401);
  assert.equal(reads, 0);
});
