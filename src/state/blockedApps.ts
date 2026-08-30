/**
 * O que gravar quando a tela de selecao salva. Nao e `marcados` direto: a
 * lista mostra so apps com icone de launcher e nao-criticos, entao um pacote
 * bloqueado que saiu de vista — app desinstalado, app que perdeu o launcher,
 * app que virou critico depois (virou o discador padrao) — nao aparece
 * marcado em tela nenhuma. Gravar so o que estava visivel apagaria esse
 * bloqueio sem ninguem pedir, e reinstalar o app voltaria com ele liberado.
 *
 * Regra: dentro do que a tela mostrou, vale a tela; fora dela, vale o que ja
 * estava. Desmarcar so alcanca o que a pessoa consegue ver e desmarcar.
 */
export function mergeBlockedPackages(
  atual: readonly string[],
  visiveis: readonly string[],
  marcados: readonly string[]
): string[] {
  const visiveisSet = new Set(visiveis);
  const foraDeVista = atual.filter((pacote) => !visiveisSet.has(pacote));
  return [...new Set([...foraDeVista, ...marcados])];
}
