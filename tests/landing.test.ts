import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  descreverEntradas,
  duracao,
  faltam,
  fracaoDecorrida,
  hora,
  legendaComHorarios,
  relogio,
  tituloDaBarra,
} from '../web/landing/js/formatos.js';
import { FRASES, sortearFrase } from '../web/landing/js/frases.js';
import {
  amortecer,
  escalaQueCabe,
  expoOut,
  faixa,
  palavrasAcesas,
  progressoNoPasso,
  suave,
} from '../web/landing/js/movimento.js';
import {
  formatRemainingClock,
  formatRemainingShort,
  fracaoDecorrida as fracaoDecorridaDoApp,
} from '../src/components/Countdown/countdownStatus';
import { formatarDuracao } from '../src/components/TempoTela/tempoTela';
import {
  formatarHora,
  legendaComHorarios as legendaComHorariosDoApp,
} from '../src/components/Bloqueios/horarioLivre';
import {
  descreverAlteracoes,
  tituloDaBarra as tituloDaBarraDoApp,
} from '../src/components/Bloqueios/bloqueios';
import { amber, brand, neutral, temaNeutral } from '../src/theme/tokens';

const ROOT = path.join(import.meta.dirname, '..');
const LANDING = path.join(ROOT, 'web/landing');
const ARRAYS_XML = 'native/modules/aceleralock-blocker/android/src/main/res/values/arrays.xml';

function lerLanding(relativo: string): string {
  return readFileSync(path.join(LANDING, relativo), 'utf8');
}

function scriptsDaLanding(): string[] {
  return readdirSync(path.join(LANDING, 'js')).filter((nome) => nome.endsWith('.js'));
}

test('feliz: cronometro da landing mostra o mesmo texto do app em cada segundo de ate duas horas', () => {
  for (let segundos = 0; segundos <= 7200; segundos += 1) {
    assert.equal(relogio(segundos), formatRemainingClock(segundos * 1000));
    assert.equal(faltam(segundos), formatRemainingShort(segundos * 1000));
  }
});

test('regressao: fracao quebrada de segundo arredonda pra cima como no app, "00:00" so no fim', () => {
  for (const segundos of [0.001, 0.5, 59.2, 1103.4, -3]) {
    assert.equal(relogio(segundos), formatRemainingClock(segundos * 1000));
    assert.equal(faltam(segundos), formatRemainingShort(segundos * 1000));
  }
});

test('feliz: anel da espera enche na mesma proporcao do app, inclusive nas bordas', () => {
  const casos: [number, number][] = [
    [1104, 1800],
    [0, 1800],
    [1800, 1800],
    [2000, 1800],
    [-5, 1800],
    [10, 0],
    [Number.NaN, 1800],
    [10, Number.POSITIVE_INFINITY],
  ];
  for (const [restantes, total] of casos) {
    assert.equal(
      fracaoDecorrida(restantes, total),
      fracaoDecorridaDoApp(restantes * 1000, total * 1000)
    );
  }
});

test('feliz: tempo de tela da landing usa o formato do app ("3h 53min", "41min", "45s")', () => {
  for (let segundos = -60; segundos <= 26 * 3600; segundos += 7) {
    assert.equal(duracao(segundos), formatarDuracao(segundos));
  }
  for (const segundos of [Number.NaN, Number.POSITIVE_INFINITY, 0.4, 3600, 233 * 60]) {
    assert.equal(duracao(segundos), formatarDuracao(segundos));
  }
});

test('feliz: hora da folha de horarios livres bate com o app, dando a volta na meia-noite', () => {
  for (let minuto = -3000; minuto <= 3000; minuto += 1) {
    assert.equal(hora(minuto), formatarHora(minuto));
  }
});

test('feliz: legenda de horarios livres da landing bate com a do app', () => {
  for (let quantidade = -1; quantidade <= 9; quantidade += 1) {
    assert.equal(legendaComHorarios(quantidade), legendaComHorariosDoApp(quantidade));
  }
});

test('feliz: barra de salvar descreve as entradas com as palavras do app', () => {
  const nomes = ['Instagram', 'TikTok', 'YouTube', 'X'];
  for (let n = 0; n <= nomes.length; n += 1) {
    const entram = nomes.slice(0, n);
    assert.equal(tituloDaBarra(n), tituloDaBarraDoApp({ entram, saem: [] }));
    assert.equal(
      descreverEntradas(entram),
      descreverAlteracoes({ entram, saem: [] }, (nome) => nome)
    );
  }
});

test('regressao: toda frase da landing existe, letra por letra, nas mil do app', () => {
  const xml = readFileSync(path.join(ROOT, ARRAYS_XML), 'utf8');
  const doApp = new Set([...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]));
  assert.ok(FRASES.length >= 2, 'o sorteio precisa de pelo menos duas frases');
  for (const frase of FRASES) {
    assert.ok(doApp.has(frase), `a landing mostraria uma frase que o app nao tem: "${frase}"`);
  }
  assert.equal(new Set(FRASES).size, FRASES.length, 'frase repetida no recorte');
});

test('feliz: sorteio nunca repete a frase que acabou de aparecer', () => {
  for (const anterior of FRASES) {
    for (const sorte of [0, 0.3, 0.5, 0.99, 0.999999]) {
      const frase = sortearFrase(FRASES, anterior, () => sorte);
      assert.notEqual(frase, anterior);
      assert.ok(FRASES.includes(frase));
    }
  }
});

test('regressao: sorteio com uma frase so devolve a mesma em vez de nada', () => {
  assert.equal(
    sortearFrase(['única'], 'única', () => 0.7),
    'única'
  );
  assert.equal(
    sortearFrase(['a', 'b'], undefined, () => 1),
    'b'
  );
});

test('feliz: progresso do passo vai de 0 a 1 enquanto o passo cruza o meio da janela', () => {
  assert.equal(progressoNoPasso(600, 1000, 800), 0);
  assert.equal(progressoNoPasso(400, 1000, 800), 0);
  assert.equal(progressoNoPasso(-100, 1000, 800), 0.5);
  assert.equal(progressoNoPasso(-600, 1000, 800), 1);
  assert.equal(progressoNoPasso(-5000, 1000, 800), 1);
});

test('regressao: passo sem altura medida nao vira NaN no meio da animacao', () => {
  assert.equal(progressoNoPasso(0, 0, 800), 0);
  assert.equal(progressoNoPasso(0, Number.NaN, 800), 0);
});

test('feliz: faixa e curvas ficam presas entre 0 e 1 e terminam exatamente no alvo', () => {
  assert.equal(faixa(5, 0, 10), 0.5);
  assert.equal(faixa(-1, 0, 10), 0);
  assert.equal(faixa(11, 0, 10), 1);
  assert.equal(faixa(3, 3, 3), 1);
  assert.equal(faixa(2, 3, 3), 0);
  for (const curva of [expoOut, suave]) {
    assert.equal(curva(0), 0);
    assert.equal(curva(1), 1);
    assert.equal(curva(-2), 0);
    assert.equal(curva(3), 1);
    let anterior = 0;
    for (let t = 0; t <= 1; t += 0.05) {
      const valor = curva(t);
      assert.ok(valor >= anterior, 'curva tem que ser monotonica');
      anterior = valor;
    }
  }
});

test('feliz: escala do aparelho respeita o lado que limita e nao distorce', () => {
  const base = { largura: 414, altura: 868 };
  assert.equal(escalaQueCabe(414, 868, base), 1);
  assert.equal(escalaQueCabe(1000, 434, base), 0.5);
  assert.equal(escalaQueCabe(207, 2000, base), 0.5);
  assert.equal(escalaQueCabe(0, 868, base), 0);
});

test('feliz: amortecimento chega ao mesmo ponto a 30 e a 120 quadros por segundo', () => {
  let lento = 0;
  let rapido = 0;
  for (let i = 0; i < 30; i += 1) lento = amortecer(lento, 10, 1 / 30, 6);
  for (let i = 0; i < 120; i += 1) rapido = amortecer(rapido, 10, 1 / 120, 6);
  assert.ok(Math.abs(lento - rapido) < 1e-9);
  assert.equal(amortecer(3, 10, -1, 6), 3);
});

test('feliz: manifesto acende palavras na proporcao da rolagem, sem passar do total', () => {
  assert.equal(palavrasAcesas(0, 30), 0);
  assert.equal(palavrasAcesas(0.5, 30), 15);
  assert.equal(palavrasAcesas(1, 30), 30);
  assert.equal(palavrasAcesas(4, 30), 30);
  assert.equal(palavrasAcesas(-1, 30), 0);
});

function camelParaKebab(nome: string): string {
  return nome.replace(/[A-Z]/g, (letra) => `-${letra.toLowerCase()}`);
}

test('barreira de marca: primitivos de cor da landing batem com src/theme/tokens.ts', () => {
  const css = lerLanding('estilo.css');
  const fonte: Record<string, Record<string, string>> = {
    brand: Object.fromEntries(Object.entries(brand).map(([k, v]) => [camelParaKebab(k), v])),
    neutral: Object.fromEntries(Object.entries(neutral).map(([k, v]) => [k, v])),
    'tema-neutral': Object.fromEntries(Object.entries(temaNeutral).map(([k, v]) => [k, v])),
    amber: Object.fromEntries(Object.entries(amber).map(([k, v]) => [k, v])),
  };
  const declarados = [
    ...css.matchAll(/--(brand|neutral|tema-neutral|amber)-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g),
  ];
  const nomes = declarados.map(([, escala, chave]) => `${escala}-${chave}`);
  assert.ok(nomes.includes('brand-turquesa') && nomes.includes('brand-tema'));
  for (const [, escala, chave, valor] of declarados) {
    const esperado = fonte[escala][chave];
    assert.ok(esperado, `--${escala}-${chave} nao existe em tokens.ts`);
    assert.equal(valor.toLowerCase(), esperado.toLowerCase(), `--${escala}-${chave}`);
  }
});

test('barreira de privacidade: a pagina nao carrega nada de outro endereco', () => {
  const html = lerLanding('index.html');
  const css = lerLanding('estilo.css');
  const recursos = [
    ...[
      ...html.matchAll(/<(?:script|img|video|source|iframe)\b[^>]*\b(?:src|poster)="([^"]+)"/g),
    ].map((m) => m[1]),
    ...[...html.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]),
    ...[...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]),
    ...scriptsDaLanding().flatMap((nome) =>
      [...lerLanding(`js/${nome}`).matchAll(/from\s+'([^']+)'/g)].map((m) => m[1])
    ),
  ].filter((recurso) => !recurso.startsWith('data:'));
  assert.ok(recursos.length > 0);
  for (const recurso of recursos) {
    assert.doesNotMatch(recurso, /^(?:[a-z]+:)?\/\//i, `recurso de terceiro: ${recurso}`);
  }
  const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
  assert.ok(csp, 'sem CSP a promessa "nada de terceiros" fica so no texto');
  assert.match(csp[1], /default-src 'self'/);
  assert.match(csp[1], /connect-src 'none'/);
});

test('regressao: link para politica, termos e lista de espera nao depende de onde a landing esta servida', () => {
  const html = lerLanding('index.html');
  const relativosARaiz = [...html.matchAll(/<a\b[^>]*\bhref="(\/[^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(
    relativosARaiz,
    [],
    'em acelera.marujo.dev, "/" e a propria landing — o link precisa nomear aceleralock.marujo.dev'
  );
  for (const destino of ['/#privacidade', '/#termos', '/teste#lista-de-espera']) {
    assert.ok(html.includes(`href="https://aceleralock.marujo.dev${destino}"`), destino);
  }
});

test('regressao: todo arquivo que a pagina referencia existe em web/landing', () => {
  const html = lerLanding('index.html');
  const css = lerLanding('estilo.css');
  const relativos = [
    ...[...html.matchAll(/\b(?:src|poster)="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]),
    ...[...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]),
  ].filter((recurso) => !recurso.startsWith('data:') && !recurso.startsWith('#'));
  for (const recurso of relativos) {
    assert.ok(existsSync(path.join(LANDING, recurso)), `arquivo ausente: web/landing/${recurso}`);
  }
  for (const nome of scriptsDaLanding()) {
    for (const [, importado] of lerLanding(`js/${nome}`).matchAll(/from\s+'([^']+)'/g)) {
      assert.ok(existsSync(path.join(LANDING, 'js', importado)), `${nome} importa ${importado}`);
    }
  }
});
