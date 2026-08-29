import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import appJson from '../app.json';
import { brand } from '../src/theme/tokens';

const ROOT = path.join(import.meta.dirname, '..');

/** IHDR de um PNG: assinatura + largura/altura/tipo de cor, sem decodificar pixel. */
function readPngHeader(relative: string) {
  const buffer = readFileSync(path.join(ROOT, relative));
  assert.equal(
    buffer.subarray(0, 8).toString('latin1'),
    '\x89PNG\r\n\x1a\n',
    `${relative}: não é um PNG`,
  );
  assert.equal(buffer.subarray(12, 16).toString('latin1'), 'IHDR', `${relative}: IHDR ausente`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    hasAlpha: (buffer.readUInt8(25) & 4) !== 0,
  };
}

const ANDROID_DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 } as const;
const ANDROID_RES = 'assets/brand/icon/android';

test('app.json aponta pros PNG de ícone gerados, todos 1024×1024', () => {
  const referenced = [
    appJson.expo.icon,
    appJson.expo.ios.icon.light,
    appJson.expo.ios.icon.dark,
    appJson.expo.ios.icon.tinted,
    appJson.expo.android.adaptiveIcon.foregroundImage,
    appJson.expo.android.adaptiveIcon.monochromeImage,
  ];
  for (const reference of referenced) {
    const { width, height } = readPngHeader(reference);
    assert.deepEqual([width, height], [1024, 1024], reference);
  }
});

test('ícone opaco não tem canal alfa (App Store rejeita) e as variantes têm', () => {
  assert.equal(readPngHeader(appJson.expo.icon).hasAlpha, false);
  assert.equal(readPngHeader(`${ANDROID_RES}/ic_launcher-playstore.png`).hasAlpha, false);
  for (const reference of [
    appJson.expo.ios.icon.dark,
    appJson.expo.ios.icon.tinted,
    appJson.expo.android.adaptiveIcon.foregroundImage,
    appJson.expo.android.adaptiveIcon.monochromeImage,
  ]) {
    assert.equal(readPngHeader(reference).hasAlpha, true, reference);
  }
});

test('escada de densidades do Android: launcher 48dp e foreground 108dp em cada dpi', () => {
  for (const [density, factor] of Object.entries(ANDROID_DENSITIES)) {
    for (const [file, dp] of [
      ['ic_launcher.png', 48],
      ['ic_launcher_round.png', 48],
      ['ic_launcher_foreground.png', 108],
      ['ic_launcher_monochrome.png', 108],
    ] as const) {
      const reference = `${ANDROID_RES}/mipmap-${density}/${file}`;
      const header = readPngHeader(reference);
      assert.equal(header.width, Math.round(dp * factor), reference);
      assert.equal(header.height, header.width, reference);
    }
  }
});

test('ícone da Play Store é 512×512', () => {
  const header = readPngHeader(`${ANDROID_RES}/ic_launcher-playstore.png`);
  assert.deepEqual([header.width, header.height], [512, 512]);
});

test('cores do mark e do adaptive icon saem de `brand`, não de hex solto', () => {
  const sources = {
    'assets/brand/alock-mark-turquesa.svg': brand.turquesa,
    'assets/brand/alock-mark-tema.svg': brand.tema,
    [`${ANDROID_RES}/values/ic_launcher_background.xml`]: brand.tema,
  };
  for (const [file, expected] of Object.entries(sources)) {
    const hexes = new Set(
      (readFileSync(path.join(ROOT, file), 'utf8').match(/#[0-9a-fA-F]{6}/g) ?? []).map((hex) =>
        hex.toLowerCase(),
      ),
    );
    hexes.delete('#000000');
    hexes.delete('#ffffff');
    assert.deepEqual([...hexes], [expected.toLowerCase()], file);
  }
  assert.equal(appJson.expo.android.adaptiveIcon.backgroundColor, brand.tema);
});
