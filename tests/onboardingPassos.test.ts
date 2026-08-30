import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HORAS_MAX,
  HORAS_MIN,
  filtrarApps,
  horasDoToque,
  normalizarNome,
  passoInicial,
  proporcaoDasHoras,
} from '../src/components/Onboarding/passos';

test('primeira execucao comeca na secao 1 (nome)', () => {
  assert.equal(passoInicial(false), 1);
});

test('reentrada por permissao revogada comeca na secao 3, sem repetir o pedido de nome', () => {
  assert.equal(passoInicial(true), 3);
});

test('horasDoToque: as duas pontas da trilha dao os extremos do intervalo', () => {
  assert.equal(horasDoToque(0, 300), HORAS_MIN);
  assert.equal(horasDoToque(300, 300), HORAS_MAX);
});

test('horasDoToque: arrastar pra fora da trilha satura, nao extrapola', () => {
  assert.equal(horasDoToque(-120, 300), HORAS_MIN);
  assert.equal(horasDoToque(9999, 300), HORAS_MAX);
});

test('horasDoToque: o meio da trilha cai no meio do intervalo', () => {
  // 1..12 tem 11 passos; metade da trilha e 1 + 5.5 = 6.5, que arredonda pra 7.
  assert.equal(horasDoToque(150, 300), 7);
});

test('horasDoToque: largura zero (medida antes do layout) nao vira NaN', () => {
  assert.equal(horasDoToque(50, 0), HORAS_MIN);
});

test('proporcaoDasHoras e o inverso de horasDoToque nas pontas', () => {
  assert.equal(proporcaoDasHoras(HORAS_MIN), 0);
  assert.equal(proporcaoDasHoras(HORAS_MAX), 1);
});

test('normalizarNome: so espaco em branco nao e nome', () => {
  assert.equal(normalizarNome(''), null);
  assert.equal(normalizarNome('   '), null);
  assert.equal(normalizarNome('  Lucas  '), 'Lucas');
});

test('filtrarApps ignora acento e caixa — "video" acha "Vídeo"', () => {
  const apps = [{ label: 'Vídeo Player' }, { label: 'Instagram' }];
  assert.deepEqual(filtrarApps(apps, 'video'), [{ label: 'Vídeo Player' }]);
  assert.deepEqual(filtrarApps(apps, 'INSTA'), [{ label: 'Instagram' }]);
});

test('filtrarApps: termo vazio devolve a lista inteira, sem match devolve vazio', () => {
  const apps = [{ label: 'Instagram' }, { label: 'TikTok' }];
  assert.deepEqual(filtrarApps(apps, '   '), apps);
  assert.deepEqual(filtrarApps(apps, 'zzz'), []);
});
