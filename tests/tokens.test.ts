import { test } from 'node:test';
import assert from 'node:assert/strict';

import { darkTheme, lightTheme } from '../src/theme/tokens';

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
