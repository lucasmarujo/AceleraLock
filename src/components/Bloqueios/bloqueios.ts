/**
 * Logica pura da aba Bloqueios. Sem import de react-native.
 *
 * A gravacao continua sendo no "Salvar" e nao a cada toque (ver
 * `setBlockedPackages`): o que muda e que o botao so aparece quando ha o que
 * salvar, e diz o que vai mudar.
 */

export type Alteracoes = {
  entram: string[];
  saem: string[];
};

/**
 * O que difere entre a lista gravada e a marcada na tela. Generico (pacotes de
 * app ou dominios) e restrito ao `universo` visivel quando ele vem: pacote
 * gravado que nao aparece na lista nao e "saiu" — e o caso que
 * `mergeBlockedPackages` preserva.
 */
export function calcularAlteracoes(
  salvos: Iterable<string>,
  marcados: Iterable<string>,
  universo?: Iterable<string>
): Alteracoes {
  const salvosSet = new Set(salvos);
  const marcadosSet = new Set(marcados);
  const visiveis = universo ? new Set(universo) : null;
  const dentro = (item: string) => visiveis === null || visiveis.has(item);

  return {
    entram: [...marcadosSet].filter((item) => dentro(item) && !salvosSet.has(item)),
    saem: [...salvosSet].filter((item) => dentro(item) && !marcadosSet.has(item)),
  };
}

export function totalDeAlteracoes(alteracoes: Alteracoes): number {
  return alteracoes.entram.length + alteracoes.saem.length;
}

/**
 * Linha de apoio da barra de salvar. Com uma alteracao so, diz qual; com mais,
 * resume — a lista inteira nao cabe na barra.
 */
export function descreverAlteracoes(
  alteracoes: Alteracoes,
  rotulo: (item: string) => string
): string {
  const { entram, saem } = alteracoes;
  if (entram.length === 1 && saem.length === 0) {
    return `${rotulo(entram[0])} entra na lista`;
  }
  if (saem.length === 1 && entram.length === 0) {
    return `${rotulo(saem[0])} sai da lista`;
  }
  const partes: string[] = [];
  if (entram.length > 0) {
    partes.push(`${entram.length} ${entram.length === 1 ? 'entra' : 'entram'}`);
  }
  if (saem.length > 0) {
    partes.push(`${saem.length} ${saem.length === 1 ? 'sai' : 'saem'}`);
  }
  return partes.join(', ');
}

export function tituloDaBarra(alteracoes: Alteracoes): string {
  const total = totalDeAlteracoes(alteracoes);
  return total === 1 ? '1 alteração não salva' : `${total} alterações não salvas`;
}

/**
 * Secoes pela lista *gravada*, nao pela marcacao em curso: se a linha pulasse
 * de secao a cada toque, o dedo perderia o lugar. A legenda da linha ("Bloqueia
 * ao salvar") e quem conta o que vai mudar.
 */
export function separarPorSalvos<T extends { packageName: string }>(
  apps: T[],
  salvos: Iterable<string>
): { bloqueados: T[]; outros: T[] } {
  const salvosSet = new Set(salvos);
  return {
    bloqueados: apps.filter((app) => salvosSet.has(app.packageName)),
    outros: apps.filter((app) => !salvosSet.has(app.packageName)),
  };
}

/** Legenda de status de uma linha. `null` = linha sem mudanca e fora da lista. */
export function legendaDaLinha(salvo: boolean, marcado: boolean): string | null {
  if (salvo && marcado) return 'Bloqueado';
  if (!salvo && marcado) return 'Bloqueia ao salvar';
  if (salvo && !marcado) return 'Sai ao salvar';
  return null;
}
