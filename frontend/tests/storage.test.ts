import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLastId, rememberId } from '../src/storage.ts';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
  };
}

test('el último ID se recupera con una nueva lectura del almacenamiento', () => {
  const storage = memoryStorage();
  assert.equal(readLastId(storage), '');
  assert.equal(rememberId('registro-guardado', storage), true);
  assert.equal(readLastId(storage), 'registro-guardado');
});

test('almacenamiento restringido no rompe la creación ni la carga de la app', () => {
  const storage = memoryStorage();
  storage.getItem = () => { throw new Error('Acceso restringido'); };
  storage.setItem = () => { throw new Error('Cuota superada'); };
  assert.equal(readLastId(storage), '');
  assert.equal(rememberId('id', storage), false);
});
