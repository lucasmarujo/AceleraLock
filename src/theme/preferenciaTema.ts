/**
 * Parte pura da escolha de tema, sem import de react-native pelo mesmo motivo
 * de `tokens.ts`: quem decide qual esquema vale e uma funcao de duas entradas,
 * e o runner e `node:test`.
 */

/** O que a pessoa escolheu no perfil. */
export type PreferenciaTema = 'sistema' | 'claro' | 'escuro';

/** O que a tela de fato pinta — `sistema` ja resolvido. */
export type EsquemaTema = 'claro' | 'escuro';

/** Ordem em que aparecem no perfil: o padrao primeiro. */
export const PREFERENCIAS: readonly PreferenciaTema[] = ['sistema', 'claro', 'escuro'];

export const ROTULOS_PREFERENCIA: Record<PreferenciaTema, string> = {
  sistema: 'Sistema',
  claro: 'Claro',
  escuro: 'Escuro',
};

/**
 * Valor gravado so vale se for uma das tres opcoes. Sem isto, uma chave
 * corrompida ou de uma versao futura viraria um esquema invalido e o app
 * pintaria com `undefined`.
 */
export function ehPreferenciaTema(valor: string | null): valor is PreferenciaTema {
  return valor !== null && (PREFERENCIAS as readonly string[]).includes(valor);
}

/**
 * `sistema` nao e um terceiro tema: e a delegacao pro esquema do aparelho, que
 * e exatamente o comportamento que o app tinha antes de existir esta tela.
 */
export function resolverEsquema(
  preferencia: PreferenciaTema,
  esquemaDoSistema: EsquemaTema
): EsquemaTema {
  return preferencia === 'sistema' ? esquemaDoSistema : preferencia;
}
