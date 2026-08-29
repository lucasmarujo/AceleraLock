import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveCountdownStatus,
  formatRemainingForScreenReader,
  formatRemainingShort,
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
