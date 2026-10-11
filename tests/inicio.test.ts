import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  dataPorExtenso,
  notaSemLeitura,
  proporcaoDoMaior,
  restoDaPilha,
  resumoBloqueios,
  resumoLiberados,
  tituloSitesSemBloqueio,
} from '../src/components/Inicio/inicio';

test('dataPorExtenso: dia da semana, dia e mes por extenso em pt-BR', () => {
  assert.equal(dataPorExtenso(new Date(2026, 9, 10)), 'Sábado, 10 de outubro');
  assert.equal(dataPorExtenso(new Date(2026, 2, 1)), 'Domingo, 1 de março');
});

test('resumoBloqueios: apps e sites, com singular e plural corretos', () => {
  assert.equal(resumoBloqueios(3, 2), '3 apps e 2 sites bloqueados');
  assert.equal(resumoBloqueios(1, 1), '1 app e 1 site bloqueados');
});

test('resumoBloqueios: so apps ou so sites nao fala do que esta vazio', () => {
  assert.equal(resumoBloqueios(1, 0), '1 app bloqueado');
  assert.equal(resumoBloqueios(4, 0), '4 apps bloqueados');
  assert.equal(resumoBloqueios(0, 2), '2 sites bloqueados');
});

test('regressao: lista vazia nunca vira "0 apps e 0 sites"', () => {
  assert.equal(resumoBloqueios(0, 0), 'Nada bloqueado ainda');
});

test('barreira: sites com a leitura do navegador desligada nao contam como bloqueados', () => {
  assert.equal(resumoBloqueios(3, 2, true), '3 apps bloqueados · sites pausados');
  assert.equal(resumoBloqueios(0, 2, true), '2 sites pausados');
  assert.equal(resumoBloqueios(0, 1, true), '1 site pausado');
});

test('feliz: leitura desligada sem site na lista nao fala de pausa', () => {
  assert.equal(resumoBloqueios(3, 0, true), '3 apps bloqueados');
  assert.equal(resumoBloqueios(0, 0, true), 'Nada bloqueado ainda');
});

test('proporcaoDoMaior: relativa ao maior, clampada e sem divisao por zero', () => {
  assert.equal(proporcaoDoMaior(30, 60), 0.5);
  assert.equal(proporcaoDoMaior(60, 60), 1);
  assert.equal(proporcaoDoMaior(90, 60), 1);
  assert.equal(proporcaoDoMaior(10, 0), 0);
  assert.equal(proporcaoDoMaior(0, 60), 0);
});

test('notaSemLeitura: semana completa nao gera nota', () => {
  assert.equal(
    notaSemLeitura([
      { data: '2026-10-10', segundos: 3600 },
      { data: '2026-10-11', segundos: 0 },
    ]),
    null
  );
});

test('notaSemLeitura: um dia faltando e nomeado sem o "-feira"', () => {
  assert.equal(
    notaSemLeitura([
      { data: '2026-10-06', segundos: null },
      { data: '2026-10-07', segundos: 120 },
    ]),
    'Terça sem leitura: o aparelho não registrou esse dia.'
  );
  assert.equal(
    notaSemLeitura([{ data: '2026-10-10', segundos: null }]),
    'Sábado sem leitura: o aparelho não registrou esse dia.'
  );
});

test('notaSemLeitura: varios dias faltando viram contagem', () => {
  assert.equal(
    notaSemLeitura([
      { data: '2026-10-05', segundos: null },
      { data: '2026-10-06', segundos: null },
      { data: '2026-10-07', segundos: 60 },
    ]),
    '2 dias sem leitura: o aparelho não registrou esses dias.'
  );
});

test('regressao: zero medido nao conta como dia sem leitura', () => {
  assert.equal(notaSemLeitura([{ data: '2026-10-07', segundos: 0 }]), null);
});

test('restoDaPilha: sites sempre ficam fora da pilha, apps so o que passa dos visiveis', () => {
  assert.equal(restoDaPilha(3, 2, 3), '+ 2 sites');
  assert.equal(restoDaPilha(5, 1, 3), '+ 2 apps e 1 site');
  assert.equal(restoDaPilha(4, 0, 3), '+ 1 app');
});

test('restoDaPilha: sem icone na pilha nao ha "+"; tudo visivel nao gera texto', () => {
  assert.equal(restoDaPilha(0, 2, 3), '2 sites');
  assert.equal(restoDaPilha(2, 0, 3), null);
  assert.equal(restoDaPilha(0, 0, 3), null);
});

test('tituloSitesSemBloqueio: singular e plural', () => {
  assert.equal(tituloSitesSemBloqueio(1), '1 site sem bloqueio agora');
  assert.equal(tituloSitesSemBloqueio(2), '2 sites sem bloqueio agora');
});

test('resumoLiberados: o que a protecao desligada deixou livre', () => {
  assert.equal(resumoLiberados(3, 2), '3 apps e 2 sites liberados');
  assert.equal(resumoLiberados(1, 0), '1 app liberado');
  assert.equal(resumoLiberados(0, 2), '2 sites liberados');
});

test('regressao: protecao desligada com lista vazia nao diz "0 apps liberados"', () => {
  assert.equal(resumoLiberados(0, 0), null);
});
