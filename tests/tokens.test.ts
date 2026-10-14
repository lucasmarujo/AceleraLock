import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  brand,
  darkTheme,
  duration,
  easing,
  elevation,
  lightTheme,
  neutral,
} from '../src/theme/tokens';

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
  const setor =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
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

test('elevacao bate com docs/design-system.md §1.6 — sombra nao inventa nivel proprio', () => {
  assert.deepEqual(
    Object.values(elevation).map((nivel) => [
      nivel.shadowOpacity,
      nivel.shadowRadius,
      nivel.shadowOffset.height,
      nivel.elevation,
    ]),
    [
      [0.08, 8, 2, 2],
      [0.12, 16, 6, 6],
      [0.18, 28, 12, 12],
    ]
  );
});

test('motion tokens batem com docs/design-system.md §1.7 — animacao nao inventa duracao propria', () => {
  assert.deepEqual({ ...duration }, { instant: 100, fast: 150, base: 220, slow: 300 });
  assert.deepEqual([...easing.standard], [0.2, 0, 0, 1]);
  assert.deepEqual([...easing.decelerate], [0, 0, 0, 1]);
  assert.deepEqual([...easing.accelerate], [0.3, 0, 1, 1]);
});

/** Razao de contraste WCAG 2.1 entre duas cores hex. */
function contraste(a: string, b: string): number {
  const luminancia = (hex: string) => {
    const [r, g, b2] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

for (const [name, theme] of [
  ['lightTheme', lightTheme],
  ['darkTheme', darkTheme],
] as const) {
  const c = theme.colors;

  test(`${name}: texto sobre o hero passa AA (4.5:1) no fundo e no degrau elevado`, () => {
    for (const fundo of [c.bgHero, c.bgHeroRaised]) {
      for (const texto of [
        c.textOnHero,
        c.textOnHeroSecondary,
        c.textOnHeroBrand,
        c.textOnHeroFriction,
      ]) {
        assert.ok(
          contraste(texto, fundo) >= 4.5,
          `${texto} sobre ${fundo} da ${contraste(texto, fundo).toFixed(2)}:1`
        );
      }
    }
  });

  // Nao e 3:1 (1.4.11 vale pra controle, e o hero e superficie): no escuro a
  // separacao vem do degrau de luma somado a `borderHero`, que o cartao desenha.
  test(`${name}: o hero nao se confunde com o canvas — senao o momento de tinta some`, () => {
    assert.ok(
      contraste(c.bgHero, c.bgCanvas) >= 1.2,
      `bgHero ${c.bgHero} sobre canvas ${c.bgCanvas} da ${contraste(c.bgHero, c.bgCanvas).toFixed(2)}:1`
    );
    assert.notEqual(c.bgHero.toLowerCase(), c.bgCanvas.toLowerCase());
  });

  test(`${name}: surfaces.brand — onFill passa AA sobre fill (botao primario e dia marcado do horario livre)`, () => {
    const { fill, onFill } = c.surfaces.brand;
    assert.ok(
      contraste(onFill, fill) >= 4.5,
      `${onFill} sobre ${fill} da ${contraste(onFill, fill).toFixed(2)}:1`
    );
  });

  test(`${name}: aviso ambar — texto passa AA e o icone passa 3:1 sobre o proprio fundo`, () => {
    assert.ok(contraste(c.textWarning, c.bgWarningSubtle) >= 4.5);
    assert.ok(contraste(c.iconWarning, c.bgWarningSubtle) >= 3);
    assert.ok(contraste(c.iconWarning, c.bgSurface) >= 3);
  });
}

test('regressao: no escuro o hero nao pode ser o proprio canvas (brand.tema sobre brand.tema)', () => {
  assert.notEqual(darkTheme.colors.bgHero.toLowerCase(), darkTheme.colors.bgCanvas.toLowerCase());
  assert.equal(lightTheme.colors.bgHero.toLowerCase(), brand.tema.toLowerCase());
});

test('boas-vindas: texto claro fecha 4.5:1 nas duas pontas do degrade', () => {
  for (const fundo of [brand.temaTurquesa, brand.tema]) {
    for (const texto of [neutral[0], neutral[300]]) {
      assert.ok(
        contraste(texto, fundo) >= 4.5,
        `${texto} sobre ${fundo} da ${contraste(texto, fundo).toFixed(2)}:1`
      );
    }
    assert.ok(contraste(brand.turquesa, fundo) >= 4.5, `turquesa sobre ${fundo}`);
  }
});

test('cadeado do modo restrito: icone ambar passa 3:1 sobre o circulo nos dois temas', () => {
  for (const tema of [lightTheme, darkTheme]) {
    const c = tema.colors;
    assert.ok(
      contraste(c.textWarning, c.bgWarningMuted) >= 3,
      `${c.textWarning} sobre ${c.bgWarningMuted} da ${contraste(c.textWarning, c.bgWarningMuted).toFixed(2)}:1`
    );
  }
});

test('claro sem contorno, escuro com: hero e trilho do segmentado seguem o Paper no claro', () => {
  assert.equal(lightTheme.colors.borderHero, lightTheme.colors.bgHero);
  assert.equal(lightTheme.colors.borderSunken, lightTheme.colors.bgSunken);
  assert.notEqual(darkTheme.colors.borderHero, darkTheme.colors.bgCanvas);
  assert.ok(contraste(darkTheme.colors.borderSunken, darkTheme.colors.bgCanvas) >= 1.4);
});
