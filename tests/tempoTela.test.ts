import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  alturaDaBarra,
  compararComEstimativa,
  descreverComparacao,
  descreverDuracao,
  diasDoMes,
  escalaDoGrafico,
  espacosAntesDoPrimeiro,
  formatarDuracao,
  formatarDuracaoCompacta,
  intensidadeDoDia,
  isoLocal,
  maiorLeitura,
  semanaAteHoje,
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

test('formatarDuracaoCompacta encurta so o que tem hora — e mantem o resto igual', () => {
  assert.equal(formatarDuracaoCompacta(4 * 3600 + 30 * 60), '4h30');
  assert.equal(formatarDuracaoCompacta(4 * 3600 + 5 * 60), '4h05');
  assert.equal(formatarDuracaoCompacta(4 * 3600), '4h');
  assert.equal(formatarDuracaoCompacta(45 * 60), '45min');
  assert.equal(formatarDuracaoCompacta(45), '45s');
  assert.equal(formatarDuracaoCompacta(0), '0min');
  assert.equal(formatarDuracaoCompacta(Number.NaN), '0min');
});

test('alturaDaBarra e proporcional e satura no maximo', () => {
  assert.equal(alturaDaBarra(5, 10, 100), 50);
  assert.equal(alturaDaBarra(10, 10, 100), 100);
  assert.equal(alturaDaBarra(20, 10, 100), 100);
});

test('alturaDaBarra: leitura curta ganha piso, mas zero medido continua zero', () => {
  assert.equal(alturaDaBarra(0.08, 7, 132, 6), 6);
  assert.equal(alturaDaBarra(0, 7, 132, 6), 0);
  assert.equal(alturaDaBarra(-1, 7, 132, 6), 0);
  assert.equal(alturaDaBarra(Number.NaN, 7, 132, 6), 0);
});

test('alturaDaBarra sem escala nao desenha nada', () => {
  assert.equal(alturaDaBarra(3, 0, 132, 6), 0);
});

test('escalaDoGrafico: a estimativa divide a escala com as leituras', () => {
  assert.equal(escalaDoGrafico([3, 6, 4], 5), 6);
  assert.equal(escalaDoGrafico([3, 2, 4], 9), 9);
  assert.equal(escalaDoGrafico([3, 6, 4], null), 6);
});

test('escalaDoGrafico: sem leitura e sem estimativa a escala nao zera', () => {
  assert.equal(escalaDoGrafico([], null), 1);
  assert.equal(escalaDoGrafico([0, 0], null), 1);
});

test('semanaAteHoje: sete dias de calendario terminando hoje, ultimo rotulado Hoje', () => {
  const sabado = new Date(2026, 9, 10);
  const semana = semanaAteHoje([], sabado);
  assert.equal(semana.length, 7);
  assert.deepEqual(
    semana.map((dia) => dia.rotulo),
    ['D', 'S', 'T', 'Q', 'Q', 'S', 'Hoje']
  );
  assert.equal(semana[0].data, '2026-10-04');
  assert.equal(semana[6].data, '2026-10-10');
  assert.equal(semana[6].hoje, true);
  assert.equal(semana.filter((dia) => dia.hoje).length, 1);
});

test('regressao: dia sem leitura fica null na semana, nunca zero e nunca some', () => {
  const sabado = new Date(2026, 9, 10);
  const semana = semanaAteHoje(
    [
      { date: '2026-10-04', seconds: 3600 },
      { date: '2026-10-06', seconds: 0 },
    ],
    sabado
  );
  assert.equal(semana[0].segundos, 3600);
  assert.equal(semana[1].segundos, null);
  assert.equal(semana[2].segundos, 0);
});

test('semanaAteHoje atravessa a virada do mes sem pular dia', () => {
  const semana = semanaAteHoje([], new Date(2026, 9, 2));
  assert.deepEqual(
    semana.map((dia) => dia.data),
    [
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]
  );
});

test('compararComEstimativa: abaixo, acima e a diferenca em segundos', () => {
  assert.deepEqual(compararComEstimativa(3 * 3600 + 53 * 60, 5), {
    sentido: 'abaixo',
    diferencaSegundos: 3600 + 7 * 60,
  });
  assert.deepEqual(compararComEstimativa(6 * 3600, 5), {
    sentido: 'acima',
    diferencaSegundos: 3600,
  });
});

test('compararComEstimativa: menos de um minuto de diferenca conta como igual', () => {
  assert.deepEqual(compararComEstimativa(5 * 3600 - 30, 5), {
    sentido: 'igual',
    diferencaSegundos: 0,
  });
});

test('regressao: hoje sem leitura nao vira "5h abaixo da estimativa"', () => {
  assert.equal(compararComEstimativa(null, 5), null);
});

test('compararComEstimativa sem estimativa nao inventa referencia', () => {
  assert.equal(compararComEstimativa(3600, null), null);
  assert.equal(compararComEstimativa(3600, 0), null);
});

test('descreverComparacao fala a diferenca e a estimativa', () => {
  assert.equal(
    descreverComparacao({ sentido: 'abaixo', diferencaSegundos: 3600 + 7 * 60 }, 5),
    '1h 07min abaixo da sua estimativa de 5h'
  );
  assert.equal(
    descreverComparacao({ sentido: 'igual', diferencaSegundos: 0 }, 5),
    'Na sua estimativa de 5h'
  );
});
