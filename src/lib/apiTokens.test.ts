import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  API_TOKEN_PREFIX,
  MAX_TOKENS_PER_EMAIL,
  canCreateMoreTokens,
  cleanLabel,
  findApiTokenByRaw,
  generateApiToken,
  hashApiToken,
  isReadOnlyPulseRoute,
  type ApiTokenRecord,
} from './apiTokens.ts';

test('generateApiToken produce un token con prefijo, único, y su hash correspondiente', () => {
  const a = generateApiToken();
  const b = generateApiToken();
  assert.equal(a.raw.startsWith(API_TOKEN_PREFIX), true);
  assert.notEqual(a.raw, b.raw);
  assert.equal(a.hash, hashApiToken(a.raw));
  assert.notEqual(a.hash, b.hash);
});

test('findApiTokenByRaw encuentra el registro cuyo hash corresponde al token crudo', () => {
  const record: ApiTokenRecord = {
    id: 'tok-1',
    email: 'santiago@toroto.mx',
    label: 'Brief semanal',
    tokenHash: hashApiToken('pt_abc'),
    createdAt: '2026-10-13T00:00:00.000Z',
    lastUsedAt: null,
  };
  assert.deepEqual(findApiTokenByRaw({ [record.id]: record }, 'pt_abc'), record);
});

test('findApiTokenByRaw regresa null para un token desconocido o revocado', () => {
  const record: ApiTokenRecord = {
    id: 'tok-1',
    email: 'santiago@toroto.mx',
    label: 'Brief semanal',
    tokenHash: hashApiToken('pt_abc'),
    createdAt: '2026-10-13T00:00:00.000Z',
    lastUsedAt: null,
  };
  assert.equal(findApiTokenByRaw({ [record.id]: record }, 'pt_other'), null);
  assert.equal(findApiTokenByRaw({}, 'pt_abc'), null);
});

test('cleanLabel recorta espacios y limita la longitud', () => {
  assert.equal(cleanLabel('  Brief semanal  '), 'Brief semanal');
  assert.equal(cleanLabel('a'.repeat(200)).length, 100);
});

test('cleanLabel maneja entradas vacías', () => {
  assert.equal(cleanLabel(undefined), '');
  assert.equal(cleanLabel(null), '');
});

test('canCreateMoreTokens respeta el máximo de tokens por correo', () => {
  const tokens: Record<string, ApiTokenRecord> = {};
  for (let i = 0; i < MAX_TOKENS_PER_EMAIL; i++) {
    tokens[`tok-${i}`] = {
      id: `tok-${i}`,
      email: 'santiago@toroto.mx',
      label: `t${i}`,
      tokenHash: hashApiToken(`pt_${i}`),
      createdAt: '2026-10-13T00:00:00.000Z',
      lastUsedAt: null,
    };
  }
  assert.equal(canCreateMoreTokens(tokens, 'santiago@toroto.mx'), false);
  assert.equal(canCreateMoreTokens(tokens, 'otra@toroto.mx'), true);
});

test('isReadOnlyPulseRoute permite GET /me y GET /pulse/*', () => {
  assert.equal(isReadOnlyPulseRoute('GET', '/me'), true);
  assert.equal(isReadOnlyPulseRoute('GET', '/pulse/overview'), true);
  assert.equal(isReadOnlyPulseRoute('GET', '/pulse/person/santiago@toroto.mx'), true);
});

test('isReadOnlyPulseRoute bloquea escrituras y rutas fuera de Pulso', () => {
  assert.equal(isReadOnlyPulseRoute('POST', '/pulse/overview'), false);
  assert.equal(isReadOnlyPulseRoute('GET', '/tokens'), false);
  assert.equal(isReadOnlyPulseRoute('DELETE', '/feedback/1'), false);
  assert.equal(isReadOnlyPulseRoute('GET', '/recognitions/pending'), false);
});
