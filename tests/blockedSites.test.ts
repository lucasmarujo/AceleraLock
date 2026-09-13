import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizarDominio } from '../src/state/blockedSites';

test('feliz: dominio puro vira host', () => {
  assert.equal(normalizarDominio('instagram.com'), 'instagram.com');
});

test('feliz: esquema, caminho, query, fragmento, porta e maiusculas sao ignorados', () => {
  assert.equal(normalizarDominio('  HTTPS://Instagram.com:443/reels?x=1#topo '), 'instagram.com');
  assert.equal(normalizarDominio('m.instagram.com/explore'), 'm.instagram.com');
  assert.equal(normalizarDominio('user:senha@instagram.com/p'), 'instagram.com');
});

test('feliz: www. inicial e removido', () => {
  assert.equal(normalizarDominio('https://www.instagram.com/'), 'instagram.com');
});

test('regressao: esquema no meio da query nao e confundido com o do inicio', () => {
  assert.equal(normalizarDominio('tradutor.com/?u=https://instagram.com'), 'tradutor.com');
});

test('borda: texto que nao e endereco e recusado', () => {
  assert.equal(normalizarDominio('gatos fofos'), null);
  assert.equal(normalizarDominio('instagram'), null);
  assert.equal(normalizarDominio(''), null);
  assert.equal(normalizarDominio('-instagram.com'), null);
});
