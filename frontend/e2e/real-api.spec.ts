import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

test.skip(process.env.HERAAP_E2E_REAL_API !== '1', 'Requiere backend desplegado en LocalEmu.');

test('flujo real: crear, recargar y consultar el registro conservado', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.HERAAP_E2E_FRONTEND_URL || '/');
  const nombre = `Prueba de interfaz ${testInfo.project.name}`;
  await page.getByLabel('Nombre', { exact: true }).fill(nombre);
  await page.getByRole('button', { name: 'Crear registro', exact: true }).click();
  const create = page.getByRole('region', { name: 'Nuevo registro' });
  await expect(create.getByRole('status').filter({ hasText: 'Registro creado' })).toBeVisible();
  const id = await create.locator('code').textContent();
  expect(id).toBeTruthy();
  await create.getByRole('button', { name: 'Copiar ID' }).click();
  await expect(create.getByText('ID copiado.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('ID del registro', { exact: true })).toHaveValue(id!);
  await page.getByRole('button', { name: 'Buscar registro', exact: true }).click();
  const query = page.getByRole('region', { name: 'Consultar registro' });
  await expect(query.getByRole('status').filter({ hasText: 'Registro encontrado' })).toBeVisible();
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
