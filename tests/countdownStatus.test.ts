import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  angulosDoArco,
  deriveCountdownStatus,
  formatRemainingClock,
  formatRemainingForScreenReader,
  formatRemainingShort,
  fracaoDecorrida,
  pontaDoArco,
  roundToAnnouncementBucket,
} from '../src/components/Countdown/countdownStatus';

test('remaining positivo e acima de 60s: running', () => {
  assert.deepEqual(deriveCountdownStatus(90_000), { status: 'running', remainingMs: 90_000 });
});

test('remaining exatamente 60s: nearingEnd (limite é inclusivo)', () => {
  assert.deepEqual(deriveCountdownStatus(60_000), { status: 'nearingEnd', remainingMs: 60_000 });
});

test('remaining abaixo de 60s: nearingEnd', () => {
  assert.deepEqual(deriveCountdownStatus(1_000), { status: 'nearingEnd', remainingMs: 1_000 });
});

test('remaining zero: complete', () => {
  assert.deepEqual(deriveCountdownStatus(0), { status: 'complete' });
});

test('remaining negativo (tick passou do fim): complete, nunca número negativo', () => {
  assert.deepEqual(deriveCountdownStatus(-5_000), { status: 'complete' });
});

test('formatRemainingShort com minutos', () => {
  assert.equal(formatRemainingShort(6 * 60_000 + 20_000), 'Faltam 6 min 20 s');
});

test('formatRemainingShort só segundos', () => {
  assert.equal(formatRemainingShort(45_000), 'Faltam 45 s');
});

test('formatRemainingForScreenReader nunca usa dígitos tipo relógio (§2.5)', () => {
  const label = formatRemainingForScreenReader(6 * 60_000 + 20_000);
  assert.equal(label, 'Faltam 6 minutos e 20 segundos');
  assert.doesNotMatch(label, /\d{2}:\d{2}/);
});

test('formatRemainingForScreenReader com 1 minuto e 1 segundo usa singular', () => {
  assert.equal(formatRemainingForScreenReader(61_000), 'Faltam 1 minuto e 1 segundo');
});

test('roundToAnnouncementBucket agrupa em janelas de 15s, nunca desce', () => {
  assert.equal(roundToAnnouncementBucket(61_000), 75_000);
  assert.equal(roundToAnnouncementBucket(75_000), 75_000);
  assert.equal(roundToAnnouncementBucket(1_000), 15_000);
});

test('formatRemainingClock: minutos e segundos com dois dígitos', () => {
  assert.equal(formatRemainingClock(18 * 60_000 + 24_000), '18:24');
  assert.equal(formatRemainingClock(45_000), '00:45');
});

test('formatRemainingClock: a partir de uma hora mostra as horas, sem estourar os minutos', () => {
  assert.equal(formatRemainingClock(65 * 60_000 + 9_000), '1:05:09');
});

test('formatRemainingClock arredonda pra cima — 00:00 só quando a espera acabou', () => {
  assert.equal(formatRemainingClock(500), '00:01');
  assert.equal(formatRemainingClock(0), '00:00');
  assert.equal(formatRemainingClock(-3_000), '00:00');
});

test('fracaoDecorrida: proporção do que já passou', () => {
  assert.equal(fracaoDecorrida(15 * 60_000, 30 * 60_000), 0.5);
  assert.equal(fracaoDecorrida(30 * 60_000, 30 * 60_000), 0);
  assert.equal(fracaoDecorrida(0, 30 * 60_000), 1);
});

test('regressao: fracaoDecorrida clampa quando o pedido foi feito com outra duração', () => {
  assert.equal(fracaoDecorrida(45 * 60_000, 30 * 60_000), 0);
  assert.equal(fracaoDecorrida(-1_000, 30 * 60_000), 1);
});

test('fracaoDecorrida sem total válido não desenha progresso', () => {
  assert.equal(fracaoDecorrida(10_000, 0), 0);
  assert.equal(fracaoDecorrida(10_000, Number.NaN), 0);
});

test('angulosDoArco: a metade direita enche primeiro, a esquerda depois', () => {
  assert.deepEqual(angulosDoArco(0), { direita: 0, esquerda: 0 });
  assert.deepEqual(angulosDoArco(0.25), { direita: 90, esquerda: 0 });
  assert.deepEqual(angulosDoArco(0.5), { direita: 180, esquerda: 0 });
  assert.deepEqual(angulosDoArco(0.75), { direita: 180, esquerda: 90 });
  assert.deepEqual(angulosDoArco(1), { direita: 180, esquerda: 180 });
});

test('regressao: angulosDoArco nunca passa de 180 por metade nem fica negativo', () => {
  assert.deepEqual(angulosDoArco(1.4), { direita: 180, esquerda: 180 });
  assert.deepEqual(angulosDoArco(-0.2), { direita: 0, esquerda: 0 });
  assert.deepEqual(angulosDoArco(Number.NaN), { direita: 0, esquerda: 0 });
});

test('pontaDoArco: comeca no topo e anda no sentido horario', () => {
  const perto = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  const topo = pontaDoArco(0, 88);
  assert.ok(perto(topo.x, 0) && perto(topo.y, -88));
  const direita = pontaDoArco(0.25, 88);
  assert.ok(perto(direita.x, 88) && perto(direita.y, 0));
  const baixo = pontaDoArco(0.5, 88);
  assert.ok(perto(baixo.x, 0) && perto(baixo.y, 88));
});
