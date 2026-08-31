import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PREFERENCIAS,
  ROTULOS_PREFERENCIA,
  ehPreferenciaTema,
  resolverEsquema,
} from '../src/theme/preferenciaTema';

test('sistema delega pro aparelho — e o comportamento que o app tinha antes da tela existir', () => {
  assert.equal(resolverEsquema('sistema', 'escuro'), 'escuro');
  assert.equal(resolverEsquema('sistema', 'claro'), 'claro');
});

test('escolha manual ignora o aparelho nos dois sentidos', () => {
  assert.equal(resolverEsquema('claro', 'escuro'), 'claro');
  assert.equal(resolverEsquema('escuro', 'claro'), 'escuro');
});

test('ehPreferenciaTema aceita so as tres opcoes', () => {
  for (const opcao of PREFERENCIAS) {
    assert.ok(ehPreferenciaTema(opcao));
  }
});

test('valor gravado corrompido, ausente ou de versao futura nao passa', () => {
  for (const invalido of [null, '', 'dark', 'light', 'auto', 'sistema ', 'SISTEMA']) {
    assert.equal(ehPreferenciaTema(invalido), false, `"${invalido}" nao devia passar`);
  }
});

test('sistema e a primeira opcao — o padrao aparece no topo da lista', () => {
  assert.equal(PREFERENCIAS[0], 'sistema');
});

test('toda preferencia tem rotulo em pt-BR, senao a linha do perfil fica vazia', () => {
  for (const opcao of PREFERENCIAS) {
    assert.equal(typeof ROTULOS_PREFERENCIA[opcao], 'string');
    assert.ok(ROTULOS_PREFERENCIA[opcao].length > 0);
  }
});
