import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

test.skip(process.env.HERAAP_E2E_REAL_API !== '1', 'Requiere backend desplegado en LocalEmu.');
// El primer acceso puede arrancar el contenedor Lambda. Esperar el timeout
// del cliente (15 s) antes de declarar fallida una respuesta real.
test.use({ actionTimeout: 20000 });
test.setTimeout(60000);

test('flujo real: crear, recargar y consultar el registro conservado', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.HERAAP_E2E_FRONTEND_URL || '/');
  // El flujo real de Google no se automatiza: se abre sesión con el atajo local.
  const acceso = page.getByRole('heading', { name: 'Entra para ver tus registros.' });
  const paneles = page.getByRole('region', { name: 'Nuevo registro' });
  await expect(acceso.or(paneles)).toBeVisible({ timeout: 20000 });
  if (await acceso.isVisible()) {
    const href = await page.getByRole('link', { name: 'Continuar con Google' }).getAttribute('href');
    expect(href).toBeTruthy();
    const respuesta = await page.request.post(href!.replace('/auth/google/start', '/auth/dev'), {
      data: { email: 'e2e@example.com', nombre: 'Prueba E2E' },
    });
    expect(respuesta.ok()).toBeTruthy();
    await page.reload();
  }
  await expect(page.getByRole('region', { name: 'Nuevo registro' })).toBeVisible({ timeout: 20000 });
  const nombre = `Prueba de interfaz ${testInfo.project.name}`;
  await page.getByLabel('Nombre', { exact: true }).fill(nombre);
  await page.getByRole('button', { name: 'Crear registro', exact: true }).click();
  const create = page.getByRole('region', { name: 'Nuevo registro' });
  await expect(create.getByRole('status').filter({ hasText: 'Registro creado' })).toBeVisible({ timeout: 20000 });
  const id = await create.locator('code').textContent();
  expect(id).toBeTruthy();
  await create.getByRole('button', { name: 'Copiar ID' }).click();
  await expect(create.getByText('ID copiado.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('ID del registro', { exact: true })).toHaveValue(id!);
  await page.getByRole('button', { name: 'Buscar registro', exact: true }).click();
  const query = page.getByRole('region', { name: 'Consultar registro' });
  await expect(query.getByRole('status').filter({ hasText: 'Registro encontrado' })).toBeVisible({ timeout: 20000 });
  await expect(query.getByText(nombre, { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  const screenshots = resolve(process.cwd(), '../.state/screenshots');
  mkdirSync(screenshots, { recursive: true });
  await page.screenshot({ path: resolve(screenshots, `frontend-${testInfo.project.name}.png`), fullPage: true });
  await page.getByRole('link', { name: 'Heraap, inicio' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByLabel('ID del registro', { exact: true })).toHaveValue(id!);
});
