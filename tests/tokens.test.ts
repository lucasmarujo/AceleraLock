import { test } from 'node:test';
import assert from 'node:assert/strict';

import { brand, darkTheme, duration, easing, lightTheme } from '../src/theme/tokens';

const HEX = /^#[0-9a-fA-F]{6}$/;

for (const [name, theme] of [
  ['lightTheme', lightTheme],
  ['darkTheme', darkTheme],
] as const) {
  test(`${name}: surfaces.brand e surfaces.danger têm fill/onFill/pressedFill em hex válido`, () => {
    for (const surface of [theme.colors.surfaces.brand, theme.colors.surfaces.danger]) {
      assert.match(surface.fill, HEX);
      assert.match(surface.onFill, HEX);
      assert.match(surface.pressedFill, HEX);
    }
  });

  test(`${name}: fill e onFill nunca são a mesma cor (par de contraste teria que existir)`, () => {
    for (const surface of [theme.colors.surfaces.brand, theme.colors.surfaces.danger]) {
      assert.notEqual(surface.fill.toLowerCase(), surface.onFill.toLowerCase());
    }
  });
}

test('surfaces.brand inverte fill/onFill entre os temas — regra do sistema, não coincidência (design-system.md §1.2)', () => {
  assert.equal(lightTheme.colors.surfaces.brand.fill, darkTheme.colors.surfaces.brand.onFill);
  assert.equal(lightTheme.colors.surfaces.brand.onFill, darkTheme.colors.surfaces.brand.fill);
});

/**
 * Matiz em graus (HSL). Vive no teste e nao em producao: nenhum componente
 * precisa medir cor, so a regra abaixo precisa.
 */
function matiz(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (delta === 0) return NaN;
  const setor = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (setor * 60 + 360) % 360;
}

test('darkTheme: fundo e borda seguem o matiz de brand.tema — neutro puro le como cinza sujo sobre o canvas de marca', () => {
  const { colors } = darkTheme;
  const alvo = matiz(brand.tema);
  for (const [nome, cor] of Object.entries({
    bgCanvas: colors.bgCanvas,
    bgSurface: colors.bgSurface,
    bgSunken: colors.bgSunken,
    bgShimmer: colors.bgShimmer,
    borderDefault: colors.borderDefault,
    borderStrong: colors.borderStrong,
  })) {
    assert.ok(
      Math.abs(matiz(cor) - alvo) <= 6,
      `${nome} (${cor}) esta no matiz ${matiz(cor).toFixed(0)}, longe dos ${alvo.toFixed(0)} de brand.tema`
    );
  }
});

test('motion tokens batem com docs/design-system.md §1.7 — animacao nao inventa duracao propria', () => {
  assert.deepEqual({ ...duration }, { instant: 100, fast: 150, base: 220, slow: 300 });
  assert.deepEqual([...easing.standard], [0.2, 0, 0, 1]);
  assert.deepEqual([...easing.decelerate], [0, 0, 0, 1]);
  assert.deepEqual([...easing.accelerate], [0.3, 0, 1, 1]);
});
