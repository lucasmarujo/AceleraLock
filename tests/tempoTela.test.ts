import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  descreverDuracao,
  diasDoMes,
  espacosAntesDoPrimeiro,
  formatarDuracao,
  intensidadeDoDia,
  isoLocal,
  maiorLeitura,
} from '../src/components/TempoTela/tempoTela';

test('formatarDuracao: horas com minutos, horas cheias, so minutos, so segundos', () => {
  assert.equal(formatarDuracao(3600 + 4 * 60), '1h 04min');
  assert.equal(formatarDuracao(2 * 3600), '2h');
  assert.equal(formatarDuracao(12 * 60), '12min');
  assert.equal(formatarDuracao(45), '45s');
});

test('formatarDuracao: zero e valor invalido nao viram "0h 0min"', () => {
  assert.equal(formatarDuracao(0), '0min');
  assert.equal(formatarDuracao(-10), '0min');
  assert.equal(formatarDuracao(Number.NaN), '0min');
});

test('descreverDuracao fala por extenso, com singular correto', () => {
  assert.equal(descreverDuracao(3600 + 60), '1 hora e 1 minuto');
  assert.equal(descreverDuracao(2 * 3600 + 120), '2 horas e 2 minutos');
  assert.equal(descreverDuracao(30), 'menos de um minuto');
  assert.equal(descreverDuracao(0), 'nenhum tempo registrado');
});

test('isoLocal usa a data local — nao deixa o fuso empurrar pro dia anterior', () => {
  // 1 de marco as 00:30 local: toISOString() daria 2026-02-28 em fuso negativo.
  assert.equal(isoLocal(new Date(2026, 2, 1, 0, 30)), '2026-03-01');
});

test('diasDoMes: cobre meses de 28, 30 e 31 dias', () => {
  assert.equal(diasDoMes(new Date(2026, 1, 10), []).length, 28);
  assert.equal(diasDoMes(new Date(2026, 3, 10), []).length, 30);
  assert.equal(diasDoMes(new Date(2026, 7, 10), []).length, 31);
});

test('diasDoMes: dia sem leitura fica null, nao zero — nao medido nao e "nao usou"', () => {
  const dias = diasDoMes(new Date(2026, 7, 15), [
    { date: '2026-08-03', seconds: 7200 },
    { date: '2026-08-04', seconds: 0 },
  ]);

  assert.equal(dias[2].segundos, 7200);
  assert.equal(dias[3].segundos, 0, 'zero medido continua zero');
  assert.equal(dias[0].segundos, null, 'dia nao medido e null');
});

test('diasDoMes ignora leitura de outro mes', () => {
  const dias = diasDoMes(new Date(2026, 7, 15), [{ date: '2026-07-03', seconds: 7200 }]);
  assert.ok(dias.every((dia) => dia.segundos === null));
});

test('espacosAntesDoPrimeiro alinha a grade com a semana comecando no domingo', () => {
  // 1 de agosto de 2026 e um sabado.
  assert.equal(espacosAntesDoPrimeiro(new Date(2026, 7, 15)), 6);
  // 1 de marco de 2026 e um domingo: nenhuma casa vazia.
  assert.equal(espacosAntesDoPrimeiro(new Date(2026, 2, 10)), 0);
});

test('intensidadeDoDia: proporcional, clampada, e null continua null', () => {
  assert.equal(intensidadeDoDia(1800, 3600), 0.5);
  assert.equal(intensidadeDoDia(7200, 3600), 1);
  assert.equal(intensidadeDoDia(null, 3600), null, 'ausencia nao vira o tom mais claro');
});

test('intensidadeDoDia: maximo zero nao vira divisao por zero', () => {
  assert.equal(intensidadeDoDia(0, 0), 0);
  assert.ok(!Number.isNaN(intensidadeDoDia(10, 0) as number));
});

test('maiorLeitura ignora dias nao medidos e devolve 0 quando nada foi medido', () => {
  const dias = diasDoMes(new Date(2026, 7, 15), [
    { date: '2026-08-01', seconds: 100 },
    { date: '2026-08-02', seconds: 900 },
  ]);
  assert.equal(maiorLeitura(dias), 900);
  assert.equal(maiorLeitura(diasDoMes(new Date(2026, 7, 15), [])), 0);
});
