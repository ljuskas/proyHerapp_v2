import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

test.skip(process.env.HERAAP_E2E_REAL_API !== '1', 'Requiere backend desplegado en LocalEmu.');
// El primer acceso puede arrancar el contenedor Lambda. Esperar el timeout
// del cliente (15 s) antes de declarar fallida una respuesta real.
test.use({ actionTimeout: 20000 });
test.setTimeout(60000);

test('flujo real: crear, recargar y consultar el registro conservado', async ({ page, context }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.HERAAP_E2E_FRONTEND_URL || '/');
  // El flujo real de Google no se automatiza: la sesión de prueba se crea
  // directamente en PostgreSQL, sin ningún endpoint de acceso alternativo.
  await expect(page.getByRole('heading', { name: 'Entra para ver tus registros.' })).toBeVisible({ timeout: 20000 });
  const sesion = JSON.parse(
    execFileSync(process.execPath, [resolve(process.cwd(), '../backend/tests/soporte/sesion-prueba.cjs')], {
      encoding: 'utf8',
      timeout: 60000,
    }).trim(),
  ) as { token: string; cookieName: string };
  const destino = new URL(page.url());
  await context.addCookies([{
    name: sesion.cookieName,
    value: sesion.token,
    domain: destino.hostname,
    path: '/',
    httpOnly: true,
    secure: destino.protocol === 'https:',
    sameSite: 'Lax',
  }]);
  await page.reload();
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
