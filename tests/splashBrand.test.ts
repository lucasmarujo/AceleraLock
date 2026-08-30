import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import appJson from '../app.json';
import { lightTheme, darkTheme } from '../src/theme/tokens';

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

type SplashConfig = {
  backgroundColor: string;
  image: string;
  imageWidth: number;
  dark: { backgroundColor: string; image: string };
};

function splashConfig(): SplashConfig {
  for (const plugin of appJson.expo.plugins) {
    if (Array.isArray(plugin) && plugin[0] === 'expo-splash-screen') {
      const config = plugin[1];
      if (typeof config === 'object') {
        return config;
      }
    }
  }
  throw new Error('app.json: plugin expo-splash-screen sem configuração');
}

const splash = splashConfig();

/** O que a tela de marca (`src/components/SplashScreen.tsx`) carrega por `require`. */
const BADGE_DA_TELA = 'assets/png/mark/lock-3d-trail-1024.png';

test('a splash nativa usa uma imagem só nos dois temas — nada pra sair de sincronia', () => {
  assert.equal(splash.dark.image, splash.image);
});

test('imagem da splash nativa existe, é quadrada e tem alfa (o fundo é o do tema)', () => {
  const header = readPngHeader(splash.image.replace(/^\.\//, ''));
  assert.deepEqual([header.width, header.height], [1024, 1024]);
  assert.equal(header.hasAlpha, true);
});

test('badge da tela de marca existe, é quadrado e tem alfa', () => {
  // Se este `require` quebrar, o app não abre: a tela de splash é a primeira
  // coisa que monta. O teste falha aqui em vez de no aparelho.
  const header = readPngHeader(BADGE_DA_TELA);
  assert.deepEqual([header.width, header.height], [1024, 1024]);
  assert.equal(header.hasAlpha, true);
});

test('o require do SplashScreen aponta pro mesmo arquivo que este teste verifica', () => {
  // Trava o par: trocar a marca na tela sem atualizar o teste (ou o contrário)
  // deixaria o teste verde verificando um arquivo que ninguém carrega.
  const source = readFileSync(path.join(ROOT, 'src/components/SplashScreen.tsx'), 'utf8');
  assert.ok(
    source.includes(`../../${BADGE_DA_TELA}`),
    `SplashScreen.tsx não carrega ${BADGE_DA_TELA}`,
  );
});

test('logo do AceleraDev rasterizada existe, quadrada e com alfa', () => {
  const header = readPngHeader('assets/aceleradev-logo.png');
  assert.deepEqual([header.width, header.height], [512, 512]);
  assert.equal(header.hasAlpha, true);
});

test('fundo da splash nativa é o mesmo canvas do tema — senão a troca pisca', () => {
  assert.equal(splash.backgroundColor, lightTheme.colors.bgCanvas);
  assert.equal(splash.dark.backgroundColor, darkTheme.colors.bgCanvas);
});

test('a imagem da splash nativa cabe na máscara circular do Android 12+', () => {
  // O Android 12+ mostra só o miolo do drawable. A folga agora vem do próprio
  // export (é o foreground do adaptive icon, desenhado dentro da safe zone),
  // não mais de uma constante de gerador — o que dá pra travar aqui é o
  // `imageWidth`, que é o que o plugin usa pra escalar dentro da janela.
  assert.ok(splash.imageWidth <= 288, `imageWidth=${splash.imageWidth} estoura a máscara`);
  assert.equal(splash.image, appJson.expo.android.adaptiveIcon.foregroundImage);
});
