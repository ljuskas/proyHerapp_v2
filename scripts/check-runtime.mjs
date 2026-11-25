import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const expected = readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8').trim();
if (process.versions.node !== expected) {
  console.error(`Se requiere Node.js ${expected}; actual: ${process.versions.node}. Ejecuta nvm use.`);
  process.exit(1);
}

const npmVersion = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
if (npmVersion !== '10.9.9') {
  console.error(`Se requiere npm 10.9.9; actual: ${npmVersion}.`);
  process.exit(1);
}

console.log(`Entorno verificado: Node.js ${expected}, npm ${npmVersion}`);
