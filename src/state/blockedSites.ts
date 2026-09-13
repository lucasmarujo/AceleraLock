const ESQUEMA = /^[a-z][a-z0-9+.-]*:\/\//;
const HOST = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/**
 * O dominio que a lista grava a partir do que a pessoa digitou, ou `null` quando
 * nao da pra tirar um dominio dali. Espelho de `SiteMatcher.hostOf` do `core/`,
 * que e quem decide de verdade e renormaliza na gravacao: esta copia existe so
 * pra tela recusar a entrada na hora e nao mostrar duas linhas pro mesmo site.
 * Os testes dos dois lados usam a mesma tabela de casos.
 */
export function normalizarDominio(entrada: string): string | null {
  const limpo = entrada.trim().toLowerCase();
  if (/\s/.test(limpo)) {
    return null;
  }
  const host = limpo
    .replace(ESQUEMA, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
    .split('@')
    .pop()!
    .split(':')[0]
    .replace(/^www\./, '');
  return HOST.test(host) ? host : null;
}
