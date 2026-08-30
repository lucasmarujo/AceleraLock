import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import appJson from '../app.json';
import { brand, lightTheme, darkTheme } from '../src/theme/tokens';

const ROOT = path.join(import.meta.dirname, '..');
const GENERATOR = 'assets/brand/build-icons.py';

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

function generatorConstant(name: string): string {
  const source = readFileSync(path.join(ROOT, GENERATOR), 'utf8');
  const match = source.match(new RegExp(`^${name} = (?:"(#[0-9a-fA-F]{6})"|([\\d.]+))`, 'm'));
  assert.ok(match, `${GENERATOR}: constante ${name} não encontrada`);
  return match[1] ?? match[2];
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

test('app.json configura a splash nativa com o badge gerado', () => {
  assert.equal(splash.image, './assets/splash-icon.png');
  // O badge carrega o próprio disco escuro, então serve os dois temas: uma
  // imagem só, e nenhuma variante clara/escura pra sair de sincronia.
  assert.equal(splash.dark.image, splash.image);
});

test('badge da splash é 1024 com alfa (o fundo é o do tema, não o da imagem)', () => {
  for (const reference of ['assets/splash-icon.png', 'assets/alock-badge.png']) {
    const header = readPngHeader(reference);
    assert.deepEqual([header.width, header.height], [1024, 1024], reference);
    assert.equal(header.hasAlpha, true, reference);
  }
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

test('cores do badge saem de `brand`, não de hex solto no gerador', () => {
  const expected = {
    TURQUESA: brand.turquesa,
    TEMA: brand.tema,
    AZUL: brand.aceleraAzul,
    CIANO: brand.aceleraCiano,
  };
  for (const [name, value] of Object.entries(expected)) {
    assert.equal(generatorConstant(name).toLowerCase(), value.toLowerCase(), name);
  }
});

test('badge da splash nativa cabe na máscara circular do Android 12+', () => {
  // O Android 12+ só mostra o miolo do drawable da splash; o badge preenche a
  // caixa inteira do desenho, então a folga tem que vir da escala. O gerador
  // trava isso num assert — este teste é a mesma trava rodando no `npm test`,
  // onde ninguém precisa reexecutar o Python pra descobrir que quebrou.
  const safe = Number(generatorConstant('SPLASH_SCALE_SAFE'));
  assert.ok(safe > 0, 'SPLASH_SCALE_SAFE não é um número');
  assert.ok(safe <= 2 / 3, `SPLASH_SCALE_SAFE=${safe} estoura a máscara do Android 12+`);
});

test('o rasterizador da logo do AceleraDev recusa SVG fora do subconjunto', () => {
  // A logo é de terceiro: se o arquivo for trocado por um que use arco,
  // subpath múltiplo ou gradiente radial, o gerador tem que levantar em vez
  // de entregar um PNG deformado em silêncio.
  const source = readFileSync(path.join(ROOT, 'assets/brand/build-aceleradev-logo.py'), 'utf8');
  for (const guard of [
    'comando SVG nao suportado',
    'path com mais de um subpath',
    'so gradientUnits=userSpaceOnUse e suportado',
    'nenhum <path> encontrado',
  ]) {
    assert.ok(source.includes(guard), `guarda ausente: ${guard}`);
  }
});
