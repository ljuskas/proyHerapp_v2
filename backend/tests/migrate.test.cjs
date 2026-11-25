'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { applyMigrations, listMigrations } = require('../db/migrate.cjs');

function migrationDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'heraap-migraciones-'));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

function fakeQuery({ applied = [], failOn = null } = {}) {
  const statements = [];
  return {
    statements,
    query: async (text, params) => {
      statements.push({ text, params });
      if (failOn && text.includes(failOn)) throw new Error('fallo simulado');
      if (/^SELECT version FROM/.test(text)) return { rows: applied.map((version) => ({ version })) };
      return { rows: [] };
    },
  };
}

test('aplica las migraciones pendientes en orden y registra su versión', async () => {
  const dir = migrationDir({
    '002_segunda.sql': 'CREATE TABLE dos (id int);',
    '001_primera.sql': 'CREATE TABLE uno (id int);',
    'nota.txt': 'ignorado',
  });
  const { statements, query } = fakeQuery();
  const executed = await applyMigrations({ query, dir });
  assert.deepEqual(executed, ['001_primera', '002_segunda']);
  assert.deepEqual(listMigrations(dir), ['001_primera.sql', '002_segunda.sql']);
  const inserts = statements.filter((item) => item.text.startsWith('INSERT INTO schema_migrations'));
  assert.deepEqual(inserts.map((item) => item.params[0]), ['001_primera', '002_segunda']);
  const create = statements.find((item) => item.text.includes('CREATE TABLE IF NOT EXISTS schema_migrations'));
  assert.ok(create, 'debe crear la tabla de control');
  rmSync(dir, { recursive: true, force: true });
});

test('omite las migraciones ya aplicadas sin volver a ejecutarlas', async () => {
  const dir = migrationDir({
    '001_primera.sql': 'CREATE TABLE uno (id int);',
    '002_segunda.sql': 'CREATE TABLE dos (id int);',
  });
  const { statements, query } = fakeQuery({ applied: ['001_primera'] });
  const executed = await applyMigrations({ query, dir });
  assert.deepEqual(executed, ['002_segunda']);
  assert.equal(statements.filter((item) => item.text.includes('CREATE TABLE uno')).length, 0);
  rmSync(dir, { recursive: true, force: true });
});

test('un fallo revierte la migración y no registra su versión', async () => {
  const dir = migrationDir({
    '001_primera.sql': 'CREATE TABLE uno (id int);',
    '002_rota.sql': 'CREATE TABLA rota;',
  });
  const { statements, query } = fakeQuery({ applied: ['001_primera'], failOn: 'CREATE TABLA' });
  await assert.rejects(applyMigrations({ query, dir }), /fallo simulado/);
  assert.ok(statements.some((item) => item.text === 'ROLLBACK'));
  const inserts = statements.filter((item) => item.text.startsWith('INSERT INTO schema_migrations'));
  assert.equal(inserts.length, 0);
  rmSync(dir, { recursive: true, force: true });
});
