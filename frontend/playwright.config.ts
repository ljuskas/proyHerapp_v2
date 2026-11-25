import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { isIPv4 } from 'node:net';

const realApi = process.env.HERAAP_E2E_REAL_API === '1';
const frontendUrl = process.env.HERAAP_E2E_FRONTEND_URL;
if (frontendUrl) {
  const endpoint = new URL(frontendUrl);
  const privateIp = isIPv4(endpoint.hostname) && /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(endpoint.hostname);
  if (!realApi || endpoint.protocol !== 'http:' || endpoint.port !== '4566' || !privateIp) {
    throw new Error('La interfaz publicada de prueba debe pertenecer al laboratorio local.');
  }
}
let apiBase = process.env.HERAAP_E2E_API_BASE;
if (realApi && !apiBase) {
  const outputs = JSON.parse(readFileSync(new URL('../.state/backend-outputs.json', import.meta.url), 'utf8')) as { OutputKey: string; OutputValue: string }[];
  apiBase = outputs.find((entry) => entry.OutputKey === 'ApiUrl')?.OutputValue;
}
if (realApi) {
  const endpoint = new URL(apiBase || '');
  if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || endpoint.port !== '4566') {
    throw new Error('Las pruebas reales solo pueden acceder al LocalEmu del servidor.');
  }
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: frontendUrl || 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: frontendUrl ? undefined : {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    env: { VITE_API_BASE_URL: apiBase || 'http://127.0.0.1:4566/_aws/execute-api/mock/local' },
  },
});
