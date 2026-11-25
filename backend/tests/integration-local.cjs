'use strict';

const assert = require('node:assert/strict');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const { crearSesionPrueba } = require('./soporte/sesion-prueba.cjs');

const root = resolve(__dirname, '../..');
const outputs = Object.fromEntries(JSON.parse(readFileSync(resolve(root, '.state/backend-outputs.json'), 'utf8'))
  .map(({ OutputKey, OutputValue }) => [OutputKey, OutputValue]));
const base = outputs.ApiUrl;
const target = new URL(base);
if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || target.port !== '4566') {
  throw new Error('La prueba solo puede acceder a LocalEmu en 127.0.0.1:4566.');
}
const statePath = resolve(root, '.state/backend-smoke.json');
const origin = 'http://localhost:5173';

let cookie = '';

async function request(path, options = {}) {
  return fetch(base + path, {
    ...options,
    headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...options.headers },
    signal: AbortSignal.timeout(60000),
  });
}

async function iniciarSesion() {
  const sesion = await crearSesionPrueba({ email: 'integracion@example.com', nombre: 'Integración' });
  cookie = sesion.cookie;
  const actual = await request('/sesion');
  if (actual.status !== 200) throw new Error('La sesión creada no es válida.');
}

async function main() {
  if (process.argv[2] === 'verify-saved') {
    await iniciarSesion();
    const saved = JSON.parse(readFileSync(statePath, 'utf8'));
    const result = await request('/registros/' + saved.id);
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), saved);
    console.log('OK: registro de prueba conservado:', saved.id);
    return;
  }
  const sinSesion = await request('/registros', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"nombre":"Sin sesión"}',
  });
  assert.equal(sinSesion.status, 401);

  const sinAtajo = await request('/auth/dev', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email":"a@b.cl"}',
  });
  assert.ok(sinAtajo.status >= 400, 'El acceso de desarrollo no debe existir: ' + sinAtajo.status);
  assert.equal(sinAtajo.headers.get('set-cookie'), null);

  await iniciarSesion();

  const created = await request('/registros', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'Prueba de integración Heraap' }),
  });
  assert.equal(created.status, 201, await created.clone().text());
  const item = await created.json();
  assert.match(item.id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(new Date(item.createdAt).toISOString(), item.createdAt);
  const found = await request('/registros/' + item.id);
  assert.equal(found.status, 200);
  assert.deepEqual(await found.json(), item);
  assert.equal(found.headers.get('Access-Control-Allow-Origin'), '*');
  for (const body of ['{"nombre":""}', '{"nombre":"  "}', '{"nombre":42}', '{']) {
    const invalid = await request('/registros', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    });
    assert.equal(invalid.status, 400, await invalid.text());
  }
  const missing = await request('/registros/' + randomUUID());
  assert.equal(missing.status, 404);
  for (const [path, method] of [['/registros', 'POST'], ['/registros/' + item.id, 'GET']]) {
    const preflight = await request(path, {
      method: 'OPTIONS', headers: {
        'Access-Control-Request-Method': method,
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });
    assert.ok([200, 204].includes(preflight.status), await preflight.text());
    assert.ok(preflight.headers.get('Access-Control-Allow-Methods').includes(method));
    assert.ok(preflight.headers.get('Access-Control-Allow-Headers').toLowerCase().includes('content-type'));
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), '*');
  }
  const cierre = await request('/logout', { method: 'POST' });
  assert.equal(cierre.status, 204);
  const trasCerrar = await request('/registros/' + item.id);
  assert.equal(trasCerrar.status, 401);
  await iniciarSesion();

  mkdirSync(resolve(root, '.state'), { recursive: true });
  writeFileSync(statePath, JSON.stringify(item, null, 2));
  console.log('OK: API devuelve 201, 200, 400, 404 y preflight CORS válido.');
  console.log('Registro de prueba conservado para verificar el redeploy:', item.id);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
