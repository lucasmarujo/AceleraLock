import { test } from 'node:test';
import assert from 'node:assert/strict';

import { contarPendentes, itensDePermissao } from '../src/components/Ajustes/ajustes';

const tudoConcedido = {
  usageAccess: true,
  overlay: true,
  batteryExempt: true,
  notifications: true,
  accessibility: true,
};

test('feliz: no Android sao cinco permissoes, todas concedidas', () => {
  const itens = itensDePermissao(tudoConcedido, 'android');
  assert.equal(itens.length, 5);
  assert.equal(contarPendentes(itens), 0);
});

test('a leitura do navegador so aparece no Android', () => {
  const chaves = itensDePermissao(tudoConcedido, 'ios').map((item) => item.chave);
  assert.ok(!chaves.includes('accessibility'));
  assert.equal(chaves.length, 4);
});

test('cada pendencia vem com acao e motivo', () => {
  const itens = itensDePermissao(
    { ...tudoConcedido, batteryExempt: false, notifications: false },
    'android'
  );
  assert.equal(contarPendentes(itens), 2);
  for (const item of itens.filter((i) => !i.concedida)) {
    assert.ok(item.rotuloAcao.length > 0);
    assert.ok(item.descricao.length > 0);
  }
});

test('regressao: permissao ainda nao sondada conta como pendente, nunca como concedida', () => {
  const itens = itensDePermissao(null, 'android');
  assert.equal(contarPendentes(itens), itens.length);
});

test('as essenciais vem primeiro, na ordem em que o onboarding pede', () => {
  const chaves = itensDePermissao(tudoConcedido, 'android').map((item) => item.chave);
  assert.deepEqual(chaves.slice(0, 2), ['usageAccess', 'overlay']);
});
