import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, createApi } from '../src/api.ts';

const registro = { id: 'e861a782-59c3-49c9-a1c8-e71c4ff12345', nombre: 'Prueba', createdAt: '2026-11-24T20:00:00.000Z' };
const base = 'http://127.0.0.1:4566/api';

test('POST envía JSON normalizado y devuelve el registro recibido', async () => {
  const calls: { url: string; options: RequestInit }[] = [];
  const api = createApi(base + '/', async (url, options) => {
    calls.push({ url: String(url), options: options || {} });
    return Response.json(registro, { status: 201 });
  });
  assert.deepEqual(await api.createRegistro('  Prueba  '), registro);
  assert.equal(calls[0].url, base + '/registros');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.body, '{"nombre":"Prueba"}');
  assert.deepEqual(calls[0].options.headers, { 'Content-Type': 'application/json' });
});

test('los valores vacíos se rechazan antes de llamar al servicio', async () => {
  let calls = 0;
  const api = createApi(base, async () => { calls++; return Response.json(registro); });
  await assert.rejects(api.createRegistro('  '), /Escribe un nombre/);
  await assert.rejects(api.getRegistro(' '), /Escribe el ID/);
  assert.equal(calls, 0);
});

test('GET codifica el ID como un solo segmento y no modifica la URL base', async () => {
  let url = '';
  const api = createApi(base, async (input) => { url = String(input); return Response.json(registro); });
  await api.getRegistro(' a/b?c ');
  assert.equal(url, base + '/registros/a%2Fb%3Fc');
});

test('404 se distingue de fallos internos y no se muestran detalles del servidor', async () => {
  const missing = createApi(base, async () => Response.json({ message: 'not found' }, { status: 404 }));
  await assert.rejects(missing.getRegistro('id'), (error: unknown) => error instanceof ApiError && error.status === 404 && error.message.includes('No encontramos'));
  const failed = createApi(base, async () => Response.json({ stack: 'detalle interno secreto' }, { status: 500 }));
  await assert.rejects(failed.getRegistro('id'), (error: unknown) => error instanceof ApiError && error.status === 500 && !error.message.includes('secreto'));
});

test('errores de red y timeout presentan mensajes recuperables', async () => {
  const offline = createApi(base, async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(offline.getRegistro('id'), /Revisa tu conexión/);
  const timeout = createApi(base, async () => { throw new DOMException('Timeout', 'TimeoutError'); });
  await assert.rejects(timeout.getRegistro('id'), /tardando/);
});

test('respuesta mal formada o configuración ausente no simulan un registro', async () => {
  const malformed = createApi(base, async () => Response.json({ id: 'id' }));
  await assert.rejects(malformed.getRegistro('id'), /respuesta inesperada/);
  const invalidJson = createApi(base, async () => new Response('<html>error</html>'));
  await assert.rejects(invalidJson.getRegistro('id'), /respuesta inesperada/);
  await assert.rejects(createApi(undefined).getRegistro('id'), /no está disponible/);
});

test('cancelar una consulta conserva la señal de aborto para descartar la respuesta', async () => {
  const controller = new AbortController();
  const api = createApi(base, async (_url, options) => {
    controller.abort();
    assert.equal(options?.signal?.aborted, true);
    throw new DOMException('Aborted', 'AbortError');
  });
  await assert.rejects(api.getRegistro('id', controller.signal), (error: unknown) => error instanceof DOMException && error.name === 'AbortError');
});
