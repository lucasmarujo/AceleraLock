import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mergeBlockedPackages } from '../src/state/blockedApps';

test('grava o que a tela marcou', () => {
  assert.deepEqual(
    mergeBlockedPackages([], ['com.a', 'com.b'], ['com.a']).sort(),
    ['com.a']
  );
});

test('desmarcar na tela remove de verdade', () => {
  assert.deepEqual(mergeBlockedPackages(['com.a'], ['com.a', 'com.b'], []), []);
});

test('bloqueio de app que sumiu da lista sobrevive ao salvar', () => {
  assert.deepEqual(
    mergeBlockedPackages(['com.desinstalado'], ['com.a'], ['com.a']).sort(),
    ['com.a', 'com.desinstalado']
  );
});

test('nao duplica pacote que esta nos dois lados', () => {
  assert.deepEqual(mergeBlockedPackages(['com.a'], ['com.a'], ['com.a']), ['com.a']);
});

test('lista vazia nos tres: nada bloqueado', () => {
  assert.deepEqual(mergeBlockedPackages([], [], []), []);
});
