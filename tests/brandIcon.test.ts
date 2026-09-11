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
    `${relative}: não é um PNG`
  );
  assert.equal(buffer.subarray(12, 16).toString('latin1'), 'IHDR', `${relative}: IHDR ausente`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    hasAlpha: (buffer.readUInt8(25) & 4) !== 0,
  };
}

/**
 * Os ícones não são gerados por script no repo: chegam prontos do design em
 * `assets/`. O que sobra pra travar aqui, e que continua sendo o que quebra o
 * build de verdade, é: o app.json aponta pra arquivo que existe, com a
 * geometria que cada slot da plataforma exige.
 *
 * O export novo entrega só o ícone composto (squircle com fundo embutido). As
 * camadas do adaptive em `assets/android/adaptive/` são derivadas dele: o
 * foreground é a mesma arte reduzida a 72% com o degradê replicado até a
 * borda, pra máscara do launcher cortar degradê e nunca o cadeado.
 */

const ANDROID_MIPMAP = 'assets/android/res';

test('todo ícone referenciado pelo app.json existe e é quadrado 1024', () => {
  const referenced = [
    appJson.expo.icon,
    appJson.expo.android.adaptiveIcon.foregroundImage,
    appJson.expo.android.adaptiveIcon.monochromeImage,
  ];
  for (const reference of referenced) {
    const { width, height } = readPngHeader(reference);
    assert.deepEqual([width, height], [1024, 1024], reference);
  }
});

test('foreground do adaptive sangra até a borda; só o monochrome tem alfa', () => {
  // O foreground carrega o degradê do próprio ícone, então precisa ser opaco:
  // um PNG sem canal alfa não tem como abrir buraco no canto sob a máscara de
  // quadrado arredondado, que é mais larga que a circular e chega perto deles.
  // Se voltar a ter alfa, o `iconBackground` navy vaza nos cantos.
  assert.equal(
    readPngHeader(appJson.expo.android.adaptiveIcon.foregroundImage).hasAlpha,
    false,
    appJson.expo.android.adaptiveIcon.foregroundImage
  );
  // O monochrome é o oposto: é só silhueta, quem pinta é o tint do launcher.
  assert.equal(
    readPngHeader(appJson.expo.android.adaptiveIcon.monochromeImage).hasAlpha,
    true,
    appJson.expo.android.adaptiveIcon.monochromeImage
  );
});

test('escada de densidades do launcher Android: 48dp em cada dpi', () => {
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
    const reference = `${ANDROID_MIPMAP}/mipmap-${dp}/ic_launcher.png`;
    const header = readPngHeader(reference);
    assert.deepEqual([header.width, header.height], [size, size], `${reference} (${dp})`);
  }
});

test('ícone da Play Store é 512×512', () => {
  const header = readPngHeader('assets/android/playstore-icon.png');
  assert.deepEqual([header.width, header.height], [512, 512]);
});

test('ícone de loja é 1024×1024 e opaco — é por isso que há dois mestres', () => {
  // `expo.icon` não pode ser a squircle recortada: o Expo achata o alfa do
  // ícone iOS sobre branco (`removeTransparency` em withIosIcons) e o iOS
  // aplica a máscara *dele* por cima, então canto transparente vira cunha
  // branca na home. O mestre de loja sangra até a borda e é o sistema que
  // arredonda; `assets/icon-1024.png`, com os cantos, fica pra splash, tela
  // de marca, onboarding e overlay, onde é o app que desenha o recorte.
  const header = readPngHeader(appJson.expo.icon);
  assert.deepEqual([header.width, header.height], [1024, 1024]);
  assert.equal(header.hasAlpha, false, appJson.expo.icon);
});

test('fundo do adaptive icon continua sendo o tema da marca, não hex solto', () => {
  // Não há `backgroundImage`: o foreground é opaco e cobre a camada de trás.
  // `backgroundColor` fica como fallback declarado (vira `@color/iconBackground`
  // no XML do adaptive) e por isso ainda precisa concordar com o token.
  assert.equal(appJson.expo.android.adaptiveIcon.backgroundColor, brand.tema);
});

test('marca do overlay nativo existe com a geometria que a tela de bloqueio espera', () => {
  // O overlay do bloqueador nao passa pelo `expo prebuild` — o `res/` dele e
  // mantido a mao, entao nada avisa se o PNG sumir num rebase. O sintoma seria
  // `Resources$NotFoundException` no `addView`, ja com a tela por cima do app.
  const header = readPngHeader(
    'native/modules/aceleralock-blocker/android/src/main/res/drawable-xxxhdpi/ic_aceleralock_mark.png'
  );
  assert.deepEqual([header.width, header.height], [512, 512]);
  // Um asset so serve tema claro e escuro: quem pinta o fundo e o canvas do overlay.
  assert.equal(header.hasAlpha, true);
});
