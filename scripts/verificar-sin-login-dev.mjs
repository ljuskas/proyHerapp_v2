// Impide que vuelva el acceso sin Google: la ruta solo puede existir si alguien
// la vuelve a declarar en el stack, así que se comprueba ahí y en el handler.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pila = readFileSync(resolve(root, 'backend/serverless.yml'), 'utf8');
const errores = [];

if (/^\s*path:\s*auth\/dev\s*$/m.test(pila)) {
  errores.push('backend/serverless.yml declara la ruta auth/dev');
}
if (/DEV_LOGIN_ENABLED/.test(pila)) {
  errores.push('backend/serverless.yml declara DEV_LOGIN_ENABLED');
}
if (existsSync(resolve(root, 'backend/handlers/authDev.js'))) {
  errores.push('existe backend/handlers/authDev.js');
}

if (errores.length > 0) {
  console.error(`No debe existir un acceso sin Google:\n- ${errores.join('\n- ')}`);
  process.exit(1);
}

console.log('OK: sin acceso de desarrollo en el despliegue.');
