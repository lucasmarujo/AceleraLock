import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LOCAIS_SHIMMER, VARREDURA_MS, paradasShimmer } from '../src/components/skeletonShimmer';
import { darkTheme, duration, lightTheme } from '../src/theme/tokens';

/**
 * Luma aproximada (sem correcao de gama) so pra ordenar duas cores. Vive aqui
 * e nao no modulo de producao: quem consome a cor e o LinearGradient, que nao
 * precisa saber medir claridade.
 */
function luma(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test('paradasShimmer: 3 paradas, destaque no meio e alfa zero nas pontas', () => {
  assert.deepEqual(paradasShimmer('#FFFFFF'), ['#FFFFFF00', '#FFFFFF', '#FFFFFF00']);
});

test('paradasShimmer: as pontas sao a propria cor com alfa, nao "transparent" (evita franja cinza)', () => {
  const [inicio, meio, fim] = paradasShimmer('#14181D');
  assert.equal(meio, '#14181D');
  assert.equal(inicio, fim);
  assert.match(inicio, /^#[0-9a-fA-F]{6}00$/);
});

for (const [nome, tema] of [
  ['lightTheme', lightTheme],
  ['darkTheme', darkTheme],
] as const) {
  test(`${nome}: bgShimmer e hex de 6 digitos — concatenar o alfa depende disso`, () => {
    assert.match(tema.colors.bgShimmer, /^#[0-9a-fA-F]{6}$/);
    const [inicio] = paradasShimmer(tema.colors.bgShimmer);
    assert.match(inicio, /^#[0-9a-fA-F]{8}$/);
  });

  test(`${nome}: bgShimmer e mais claro que bgSunken — reflexo escuro nao reflete nada`, () => {
    assert.ok(
      luma(tema.colors.bgShimmer) > luma(tema.colors.bgSunken),
      `bgShimmer ${tema.colors.bgShimmer} nao e mais claro que bgSunken ${tema.colors.bgSunken}`
    );
  });

  /**
   * O caso que quebrou de verdade foi o escuro, onde havia espaco de sobra pra
   * clarear e o token escolhido nao usava. No claro a base ja e neutral[100] e
   * o branco e o teto — nao da pra abrir 20 sem escurecer a base, que mudaria
   * o skeleton parado. Por isso o teto puro isenta a regra em vez de afrouxa-la
   * pros dois temas.
   */
  test(`${nome}: abre 20/255 de luma sobre bgSunken, ou ja esta no branco`, () => {
    const delta = luma(tema.colors.bgShimmer) - luma(tema.colors.bgSunken);
    const noTeto = tema.colors.bgShimmer.toUpperCase() === '#FFFFFF';
    assert.ok(
      delta > 20 || noTeto,
      `delta de ${delta.toFixed(1)} e fraco demais e ${tema.colors.bgShimmer} nao e o teto`
    );
  });
}

test('LOCAIS_SHIMMER: faixa centrada, crescente e dentro de 0..1', () => {
  const locais = [...LOCAIS_SHIMMER];
  assert.equal(locais.length, 3);
  assert.equal(locais[1], 0.5);
  assert.ok(
    locais[0] > 0 && locais[2] < 1,
    'faixa larga demais le como fundo clareando, nao reflexo'
  );
  assert.deepEqual(
    locais,
    [...locais].sort((a, b) => a - b)
  );
});

test('VARREDURA_MS: looping nao usa duracao de transicao — 300ms por volta piscaria (§3.4)', () => {
  assert.ok(
    VARREDURA_MS > duration.slow * 3,
    `varredura de ${VARREDURA_MS}ms teria que ser bem maior que duration.slow (${duration.slow}ms)`
  );
});
