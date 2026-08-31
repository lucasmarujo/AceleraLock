/**
 * Parte pura do shimmer do `Skeleton` (docs/design-system.md §3.16), separada
 * do componente pelo mesmo motivo de `countdownStatus.ts`: o runner e
 * `node:test`, que nao renderiza componente nem carrega o runtime nativo.
 */

/**
 * Um ciclo de varredura. Nao e `duration.slow` (300ms) de proposito: os tokens
 * de §1.7 sao de *transicao* — algo sai de A e chega em B uma vez. Aqui a
 * varredura roda em looping infinito, e 300ms por volta pisca, que e
 * exatamente o que §3.4 exclui ("varredura lenta e continua, sem piscar e sem
 * acelerar").
 */
export const VARREDURA_MS = 1200;

/**
 * A faixa clara ocupa o terco central e some nas pontas. Espalhar de 0 a 1
 * daria um degrade largo que le como "o fundo todo clareou"; concentrar no
 * meio e o que faz parecer reflexo passando.
 */
export const LOCAIS_SHIMMER = [0.3, 0.5, 0.7] as const;

/**
 * A ponta transparente e a propria cor de destaque com alfa zero, e nao a
 * string `'transparent'`: interpolar a partir de `rgba(0,0,0,0)` ate um
 * destaque claro passa por cinza e deixa franja na borda do gradiente.
 * Hex de 8 digitos (`#RRGGBBAA`) e o formato que o RN aceita.
 */
export function paradasShimmer(corDestaque: string): [string, string, string] {
  const transparente = `${corDestaque}00`;
  return [transparente, corDestaque, transparente];
}
