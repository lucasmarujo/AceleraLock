import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = path.join(import.meta.dirname, '..');

const ARRAYS_XML = 'native/modules/aceleralock-blocker/android/src/main/res/values/arrays.xml';

/**
 * A tela de bloqueio e nativa e nao tem teste: `BlockScreenView` vive em `android/`,
 * e so o modulo `core` (Kotlin puro) roda em JVM. O que da pra travar daqui e o
 * conteudo — que e onde mora o risco real desta feature, porque sao mil frases
 * escritas a mao e qualquer uma delas pode quebrar o build de recurso do Android
 * ou trair o tom do produto sem ninguem perceber na revisao.
 */
function frases(): string[] {
  const xml = readFileSync(path.join(ROOT, ARRAYS_XML), 'utf8');
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
}

/** Minusculas, sem acento e sem pontuacao — pega quase-repeticao, nao so a exata. */
function normalizar(frase: string): string {
  return frase
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

test('são exatamente 1000 frases', () => {
  assert.equal(frases().length, 1000);
});

test('nenhuma frase se repete — nem igual, nem quase igual', () => {
  const vistas = new Map<string, string>();
  for (const frase of frases()) {
    const chave = normalizar(frase);
    const anterior = vistas.get(chave);
    assert.equal(anterior, undefined, `repetida: "${frase}" já aparece como "${anterior}"`);
    vistas.set(chave, frase);
  }
});

test('nenhum caractere que o resource do Android exige escapar', () => {
  // Apostrofo e aspas o Android desescapa por conta propria e quebram a string;
  // & < > sao XML; % faz o lint tratar como format string. Nada disso e necessario
  // pra escrever portugues — a saida barata e nao usar, e nao escapar mil vezes.
  for (const frase of frases()) {
    assert.doesNotMatch(frase, /['"&<>%]/, `caractere que exige escape em: "${frase}"`);
    // `@` e `?` no inicio viram referencia de recurso em vez de texto literal.
    assert.doesNotMatch(frase, /^[@?]/, `inicio vira referencia de recurso em: "${frase}"`);
  }
});

test('cabem numa TextView de 17sp centralizada com 32dp de padding', () => {
  for (const frase of frases()) {
    assert.ok(
      frase.length >= 8 && frase.length <= 90,
      `${frase.length} caracteres, fora de 8..90: "${frase}"`
    );
  }
});

test('nenhuma frase culpa a pessoa — regra de tom do design-system §3.4', () => {
  // A tela esta do lado de quem chegou nela. Quem pediu ajuda e topou a espera nao
  // vai ser chamado de viciado pelo proprio app. Isso e regra do produto, entao
  // vira teste em vez de boa intencao na revisao.
  const culpa = /vici(ad|o)|fracass|pregui|vergonha|culpa|falhou|fraco|patetic|ridicul/i;
  for (const frase of frases()) {
    assert.doesNotMatch(frase, culpa, `tom de culpa em: "${frase}"`);
  }
});

test('nenhuma frase é só espaço ou quebra de linha malformada', () => {
  for (const frase of frases()) {
    assert.equal(frase, frase.trim(), `espaço nas bordas: "${frase}"`);
    assert.doesNotMatch(frase, /\s{2,}|\n/, `espaçamento irregular em: "${frase}"`);
  }
});
