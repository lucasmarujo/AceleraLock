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

/**
 * Os ícones deixaram de ser gerados por script Python no repo (redesenho de
 * 2026-08-30, commit `77ef62b`): agora chegam prontos em `assets/png/**` e
 * `assets/svg/**`. Os testes que liam constantes do gerador morreram com ele —
 * o que sobra, e que continua sendo o que quebra o build de verdade, é: o
 * app.json aponta pra arquivo que existe, com a geometria que cada slot da
 * plataforma exige.
 */

const ANDROID_MIPMAP = 'assets/png/android/mipmap';

test('todo ícone referenciado pelo app.json existe e é quadrado 1024', () => {
  const referenced = [
    appJson.expo.icon,
    appJson.expo.android.adaptiveIcon.backgroundImage,
    appJson.expo.android.adaptiveIcon.foregroundImage,
    appJson.expo.android.adaptiveIcon.monochromeImage,
  ];
  for (const reference of referenced) {
    const { width, height } = readPngHeader(reference);
    assert.deepEqual([width, height], [1024, 1024], reference);
  }
});

test('foreground e monochrome do adaptive têm alfa — quem preenche o fundo é a camada de trás', () => {
  for (const reference of [
    appJson.expo.android.adaptiveIcon.foregroundImage,
    appJson.expo.android.adaptiveIcon.monochromeImage,
  ]) {
    assert.equal(readPngHeader(reference).hasAlpha, true, reference);
  }
});

test('escada de densidades do launcher Android: 48dp redondo em cada dpi', () => {
  // O `expo prebuild` gera a mipmap a partir do adaptive icon, mas o conjunto
  // exportado pelo design acompanha a escada pronta — se faltar um degrau, é
  // export incompleto, e o sintoma no aparelho é ícone borrado só numa
  // densidade, que ninguém acha olhando o emulador padrão.
  for (const [size, dp] of [
    [48, 'mdpi'],
    [72, 'hdpi'],
    [96, 'xhdpi'],
    [144, 'xxhdpi'],
    [192, 'xxxhdpi'],
  ] as const) {
    const reference = `${ANDROID_MIPMAP}/icon-round-${size}.png`;
    const header = readPngHeader(reference);
    assert.deepEqual([header.width, header.height], [size, size], `${reference} (${dp})`);
  }
});

test('ícone da Play Store é 512×512', () => {
  const header = readPngHeader('assets/png/android/playstore-icon-512.png');
  assert.deepEqual([header.width, header.height], [512, 512]);
});

test('ícone da App Store é 1024×1024', () => {
  const header = readPngHeader('assets/png/ios/icon-1024.png');
  assert.deepEqual([header.width, header.height], [1024, 1024]);
});

test('fundo do adaptive icon continua sendo o tema da marca, não hex solto', () => {
  // `backgroundImage` é o campo que o Android usa; `backgroundColor` fica como
  // fallback pra quem não compõe as duas camadas. Os dois precisam concordar
  // com o token, senão o ícone muda de fundo dependendo do launcher.
  assert.equal(appJson.expo.android.adaptiveIcon.backgroundColor, brand.tema);
});
