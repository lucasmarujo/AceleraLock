import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcularAlteracoes,
  descreverAlteracoes,
  legendaDaLinha,
  separarPorSalvos,
  tituloDaBarra,
  totalDeAlteracoes,
} from '../src/components/Bloqueios/bloqueios';

const ROTULOS: Record<string, string> = { 'com.x': 'X', 'com.ig': 'Instagram' };
const rotulo = (pacote: string) => ROTULOS[pacote] ?? pacote;

test('feliz: sem diferenca entre gravado e marcado nao ha o que salvar', () => {
  const alteracoes = calcularAlteracoes(['com.ig'], ['com.ig']);
  assert.equal(totalDeAlteracoes(alteracoes), 0);
});

test('calcularAlteracoes separa o que entra do que sai', () => {
  assert.deepEqual(calcularAlteracoes(['com.ig', 'com.yt'], ['com.ig', 'com.x']), {
    entram: ['com.x'],
    saem: ['com.yt'],
  });
});

test('regressao: pacote gravado fora da lista visivel nao conta como saindo', () => {
  const alteracoes = calcularAlteracoes(['com.ig', 'com.oculto'], ['com.ig'], ['com.ig', 'com.x']);
  assert.deepEqual(alteracoes, { entram: [], saem: [] });
});

test('descreverAlteracoes nomeia a alteracao quando e uma so', () => {
  assert.equal(descreverAlteracoes({ entram: ['com.x'], saem: [] }, rotulo), 'X entra na lista');
  assert.equal(
    descreverAlteracoes({ entram: [], saem: ['com.ig'] }, rotulo),
    'Instagram sai da lista'
  );
});

test('descreverAlteracoes resume quando sao varias', () => {
  assert.equal(descreverAlteracoes({ entram: ['a', 'b'], saem: ['c'] }, rotulo), '2 entram, 1 sai');
});

test('tituloDaBarra conta as alteracoes com singular correto', () => {
  assert.equal(tituloDaBarra({ entram: ['a'], saem: [] }), '1 alteração não salva');
  assert.equal(tituloDaBarra({ entram: ['a'], saem: ['b'] }), '2 alterações não salvas');
});

test('separarPorSalvos usa a lista gravada, nao a marcacao em curso', () => {
  const apps = [{ packageName: 'com.ig' }, { packageName: 'com.x' }, { packageName: 'com.yt' }];
  const { bloqueados, outros } = separarPorSalvos(apps, ['com.yt', 'com.ig']);
  assert.deepEqual(
    bloqueados.map((app) => app.packageName),
    ['com.ig', 'com.yt']
  );
  assert.deepEqual(
    outros.map((app) => app.packageName),
    ['com.x']
  );
});

test('legendaDaLinha conta o estado em texto, nao so na cor do interruptor', () => {
  assert.equal(legendaDaLinha(true, true), 'Bloqueado');
  assert.equal(legendaDaLinha(false, true), 'Bloqueia ao salvar');
  assert.equal(legendaDaLinha(true, false), 'Sai ao salvar');
  assert.equal(legendaDaLinha(false, false), null);
});
