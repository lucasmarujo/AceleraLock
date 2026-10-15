/**
 * Matematica pura do movimento da landing: rolagem vira progresso, progresso vira
 * pose do aparelho. Sem `document` nem `window` — e o que deixa `node --test`
 * carregar o modulo, mesma divisao de `countdownStatus.ts` × `useCountdown.ts`.
 * As curvas sao as do video de lancamento (`entrada` = expoOut, `transicao` = suave).
 */

export function limitar(valor, minimo = 0, maximo = 1) {
  return Math.min(maximo, Math.max(minimo, valor));
}

export function mistura(a, b, t) {
  return a + (b - a) * t;
}

/** Onde `valor` esta entre `de` e `ate`, de 0 a 1. */
export function faixa(valor, de, ate) {
  if (ate === de) {
    return valor >= ate ? 1 : 0;
  }
  return limitar((valor - de) / (ate - de));
}

/** Desacelera ate parar: entrada de tudo que aparece. */
export function expoOut(t) {
  const x = limitar(t);
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

/** Entrada e saida suaves: troca de estado e movimento de camera. */
export function suave(t) {
  const x = limitar(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Progresso de um passo da historia: 0 quando o topo dele cruza o meio da janela,
 * 1 quando o fim cruza. O meio, e nao o topo, porque e ali que o olho esta.
 */
export function progressoNoPasso(topo, altura, alturaJanela) {
  if (!(altura > 0)) {
    return 0;
  }
  return limitar((alturaJanela / 2 - topo) / altura);
}

/** Escala que faz o aparelho caber na caixa sem distorcer. */
export function escalaQueCabe(largura, altura, base) {
  if (!(largura > 0) || !(altura > 0)) {
    return 0;
  }
  return Math.min(largura / base.largura, altura / base.altura);
}

/**
 * Aproxima `atual` de `alvo` independente da taxa de quadros: a 30 ou a 120 Hz a
 * inclinacao chega no mesmo lugar no mesmo tempo.
 */
export function amortecer(atual, alvo, segundos, rigidez) {
  return alvo + (atual - alvo) * Math.exp(-rigidez * Math.max(0, segundos));
}

/** Quantas palavras do manifesto ja acenderam. */
export function palavrasAcesas(progresso, total) {
  return Math.round(limitar(progresso) * total);
}
