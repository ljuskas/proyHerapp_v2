import { test, expect } from '@playwright/test';

test.skip(process.env.HERAAP_E2E_REAL_API === '1', 'La ejecución real tiene sus propios casos sin mocks.');
const registro = { id: 'e861a782-59c3-49c9-a1c8-e71c4ff12345', nombre: 'Mi primer registro', createdAt: '2026-11-24T20:00:00.000Z' };
const usuario = { id: 'usuario-1', email: 'persona@example.com', nombre: 'Persona de Prueba' };

test.beforeEach(async ({ page }) => {
  let saved = { ...registro };
  await page.route(/\/sesion$/, (route) => route.fulfill({ json: { usuario } }));
  await page.route(/\/logout$/, (route) => route.fulfill({ status: 204, body: '' }));
  await page.route(/\/registros(?:\/[^?]*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      saved = { ...registro, nombre: request.postDataJSON().nombre };
      await route.fulfill({ status: 201, json: saved, headers: { 'Access-Control-Allow-Origin': '*' } });
    } else if (request.url().endsWith('/' + saved.id)) {
      await route.fulfill({ json: saved, headers: { 'Access-Control-Allow-Origin': '*' } });
    } else {
      await route.fulfill({ status: 404, json: { message: 'Registro no encontrado.' }, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
  });
  await page.goto('/');
});

test('crea, muestra y copia el ID; después de recargar permite consultarlo', async ({ page }) => {
  const create = page.getByRole('region', { name: 'Nuevo registro' });
  const query = page.getByRole('region', { name: 'Consultar registro' });
  await page.getByLabel('Nombre', { exact: true }).fill('  Mi primer registro  ');
  await create.getByRole('button', { name: 'Crear registro', exact: true }).click();
  await expect(create.getByRole('status').filter({ hasText: 'Registro creado' })).toBeVisible();
  await expect(create.locator('code')).toHaveText(registro.id);
  await create.getByRole('button', { name: 'Copiar ID' }).click();
  await expect(create.getByText('ID copiado.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('ID del registro', { exact: true })).toHaveValue(registro.id);
  await page.reload();
  await expect(page.getByLabel('ID del registro', { exact: true })).toHaveValue(registro.id);
  await query.getByRole('button', { name: 'Buscar registro', exact: true }).click();
  await expect(query.getByRole('status').filter({ hasText: 'Registro encontrado' })).toBeVisible();
  await expect(query.getByText(registro.nombre, { exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('valida nombre e ID vacíos sin realizar peticiones', async ({ page }) => {
  let calls = 0;
  page.on('request', (request) => { if (request.url().includes('/registros')) calls++; });
  await page.getByRole('button', { name: 'Crear registro', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Escribe un nombre para el registro.');
  await page.getByRole('button', { name: 'Buscar registro', exact: true }).click();
  await expect(page.getByText('Escribe el ID que quieres consultar.')).toBeVisible();
  expect(calls).toBe(0);
});

test('informa ID inexistente y permite corregirlo', async ({ page }) => {
  const query = page.getByRole('region', { name: 'Consultar registro' });
  await page.getByLabel('ID del registro', { exact: true }).fill('no-existe');
  await query.getByRole('button', { name: 'Buscar registro', exact: true }).click();
  await expect(query.getByRole('alert')).toHaveText('No encontramos un registro con ese ID.');
  await page.getByLabel('ID del registro', { exact: true }).fill(registro.id);
  await query.getByRole('button', { name: 'Buscar registro', exact: true }).click();
  await expect(query.getByRole('status').filter({ hasText: 'Registro encontrado' })).toBeVisible();
});

test('muestra fallo de red y permite reintentar la creación', async ({ page }) => {
  await page.route('**/registros', (route) => route.abort('failed'));
  await page.getByLabel('Nombre', { exact: true }).fill('Prueba de red');
  await page.getByRole('button', { name: 'Crear registro', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Revisa tu conexión');
  await page.unroute('**/registros');
  await page.getByRole('button', { name: 'Crear registro', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Registro creado' })).toBeVisible();
});

test('no expone detalles internos cuando la API devuelve 500', async ({ page }) => {
  await page.route('**/registros', (route) => route.fulfill({ status: 500, json: { stack: 'detalle interno secreto' } }));
  await page.getByLabel('Nombre', { exact: true }).fill('Error');
  await page.getByRole('button', { name: 'Crear registro', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('No pudimos completar la solicitud. Inténtalo de nuevo.');
  await expect(page.getByText('detalle interno secreto')).toHaveCount(0);
});

test('bloquea envíos repetidos mientras está creando', async ({ page }) => {
  let finish: (() => void) | undefined;
  let calls = 0;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  await page.route('**/registros', async (route) => {
    calls++;
    await pending;
    await route.fulfill({ status: 201, json: registro });
  });
  await page.getByLabel('Nombre', { exact: true }).fill('Espera');
  await page.getByRole('button', { name: 'Crear registro', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Creando registro…' })).toBeDisabled();
  await expect(page.getByLabel('Nombre', { exact: true })).toBeDisabled();
  expect(calls).toBe(1);
  finish?.();
  await expect(page.getByRole('status').filter({ hasText: 'Registro creado' })).toBeVisible();
});

test('si el navegador no puede recordar el ID, conserva el resultado y avisa', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new Error('Almacenamiento no disponible'); };
  });
  await page.reload();
  await page.getByLabel('Nombre', { exact: true }).fill('Sin almacenamiento');
  await page.getByRole('button', { name: 'Crear registro', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Registro creado' })).toBeVisible();
  await expect(page.getByText('Tu navegador no pudo recordar este ID. Cópialo para conservarlo.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Nuevo registro' }).locator('code')).toHaveText(registro.id);
});

test('cambiar el ID cancela la consulta anterior y evita resultados desactualizados', async ({ page }) => {
  const next = { ...registro, id: 'f1695a18-a854-4ac3-b261-2777ce4ec000', nombre: 'Registro nuevo' };
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/registros/*', async (route) => {
    if (route.request().url().endsWith('/' + registro.id)) {
      await pending;
      try { await route.fulfill({ json: registro }); } catch { /* La petición anterior fue cancelada. */ }
    } else {
      await route.fulfill({ json: next });
    }
  });
  const query = page.getByRole('region', { name: 'Consultar registro' });
  await page.getByLabel('ID del registro', { exact: true }).fill(registro.id);
  await query.getByRole('button', { name: 'Buscar registro', exact: true }).click();
  await expect(query.getByRole('button', { name: 'Buscando registro…' })).toBeDisabled();
  await page.getByLabel('ID del registro', { exact: true }).fill(next.id);
  await query.getByRole('button', { name: 'Buscar registro', exact: true }).click();
  await expect(query.getByText(next.nombre, { exact: true })).toBeVisible();
  release?.();
  await expect(query.locator('code')).toHaveText(next.id);
  await expect(query.getByText(registro.nombre, { exact: true })).toHaveCount(0);
});

test('sin sesión muestra el acceso y no carga los paneles', async ({ page }) => {
  await page.route(/\/sesion$/, (route) => route.fulfill({ status: 401, json: { message: 'Inicia sesión para continuar.' } }));
  let registros = 0;
  page.on('request', (request) => { if (request.url().includes('/registros')) registros++; });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Entra para ver tus registros.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continuar con Google' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Nuevo registro' })).toHaveCount(0);
  expect(registros).toBe(0);
});

test('informa un acceso cancelado al volver de Google', async ({ page }) => {
  await page.route(/\/sesion$/, (route) => route.fulfill({ status: 401, json: {} }));
  await page.goto('/?acceso=error&motivo=cancelado');
  await expect(page.getByRole('alert')).toContainText('Cancelaste el acceso con Google');
});

test('muestra el usuario y cierra la sesión', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(usuario.nombre, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Entra para ver tus registros.' })).toBeVisible();
});
