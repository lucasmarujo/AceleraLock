/**
 * Logica pura do onboarding em secoes. Fica separada dos componentes pelo
 * mesmo motivo de `countdownStatus.ts` e `verdict.ts`: o runner do repo e
 * `node --test`, sem renderer de RN, entao so modulo sem import nativo e
 * testavel. Nada aqui importa react-native.
 */

export type Passo = 1 | 2 | 3 | 4 | 5;

export const PASSO_PRIMEIRO: Passo = 1;
export const PASSO_ULTIMO: Passo = 5;

export const HORAS_MIN = 1;
export const HORAS_MAX = 12;
export const HORAS_PADRAO = 1;

/**
 * Dados ilustrativos das barras da secao 3 — decisao do usuario, 2026-08-30:
 * o app nao le tempo de tela (`docs/decisao-modulos-nativos.md`: "nao medimos
 * tempo de tela, so bloqueamos"), entao a secao mostra a forma do dado, nunca
 * um numero que finja vir do aparelho. Por isso o componente rotula "Exemplo".
 * Trocar por leitura real e trocar esta constante por uma prop — o
 * `BarrasTempoTela` ja recebe os dados de fora.
 */
export const TEMPO_TELA_EXEMPLO: { rotulo: string; horas: number }[] = [
  { rotulo: 'S', horas: 3.2 },
  { rotulo: 'T', horas: 4.6 },
  { rotulo: 'Q', horas: 3.9 },
  { rotulo: 'Q', horas: 5.4 },
  { rotulo: 'S', horas: 4.1 },
  { rotulo: 'S', horas: 6.8 },
  { rotulo: 'D', horas: 5.7 },
];

/**
 * Quem ja concluiu o onboarding uma vez e so caiu de volta no grupo porque
 * revogou uma permissao nao responde nome nem estimativa de novo: entra
 * direto na secao que pede a permissao que falta.
 */
export function passoInicial(onboardingComplete: boolean): Passo {
  return onboardingComplete ? 3 : PASSO_PRIMEIRO;
}

/**
 * Posicao continua (0..1) do dedo na trilha. Separada do arredondamento de
 * proposito: o thumb segue esta, o numero segue `horasDaProporcao`. Derivar a
 * posicao da hora ja arredondada e o que faz o thumb andar aos pulos, porque
 * ele so consegue parar nas 12 posicoes inteiras.
 *
 * Clampado nas duas pontas: arrastar pra fora da trilha satura, nao extrapola.
 */
export function proporcaoDoToque(x: number, largura: number): number {
  if (largura <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, x / largura));
}

export function horasDaProporcao(proporcao: number, min = HORAS_MIN, max = HORAS_MAX): number {
  return Math.round(min + Math.min(1, Math.max(0, proporcao)) * (max - min));
}

export function horasDoToque(x: number, largura: number, min = HORAS_MIN, max = HORAS_MAX): number {
  return horasDaProporcao(proporcaoDoToque(x, largura), min, max);
}

/** Posicao (0..1) do valor na trilha — inverso de `horasDoToque`. */
export function proporcaoDasHoras(horas: number, min = HORAS_MIN, max = HORAS_MAX): number {
  if (max === min) {
    return 0;
  }
  return Math.min(1, Math.max(0, (horas - min) / (max - min)));
}

/** `null` quando so ha espaco em branco — o que `saveUserName` tambem recusa. */
export function normalizarNome(input: string): string | null {
  const limpo = input.trim();
  return limpo.length > 0 ? limpo : null;
}

/**
 * Generico de proposito: tipar por `InstalledApp` puxaria `@/native/blocker`,
 * que chama `requireNativeModule` no import e derrubaria o `node --test`.
 * Ignora acento nos dois lados — "video" acha "Vídeo".
 */
export function filtrarApps<T extends { label: string }>(apps: T[], termo: string): T[] {
  const alvo = semAcento(termo);
  if (alvo.length === 0) {
    return apps;
  }
  return apps.filter((app) => semAcento(app.label).includes(alvo));
}

function semAcento(texto: string): string {
  return texto
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/** Atalhos de valor da secao 2: o slider sozinho e dificil com leitor de tela. */
export const HORAS_ATALHOS = [2, 4, 5, 8] as const;

/**
 * "1 de 5" do cabecalho, medido no caminho desta pessoa — mesma regra da barra:
 * quem entra na secao 3 por reentrada ve "1 de 3", nao "3 de 5".
 */
export function progressoDoPasso(passo: Passo, inicial: Passo): { atual: number; total: number } {
  return { atual: passo - inicial + 1, total: PASSO_ULTIMO - inicial + 1 };
}

/** Titulo da secao 5: diz o que aconteceu, com o nome do app quando e um so. */
export function tituloDaConclusao(rotulos: string[]): string {
  if (rotulos.length === 0) {
    return 'Bloqueio criado.';
  }
  if (rotulos.length === 1) {
    return `${rotulos[0]} bloqueado.`;
  }
  return `${rotulos.length} apps bloqueados.`;
}

export type PermissaoEssencial = 'usageAccess' | 'overlay';

/**
 * As duas permissoes sem as quais o bloqueio nao funciona, na ordem do
 * checklist da secao 4. `null` (sem sonda ainda) conta as duas como faltando —
 * mesmo lado seguro de `nextMissingCorePermission`.
 */
export function permissoesFaltando(
  permissoes: { usageAccess: boolean; overlay: boolean } | null
): PermissaoEssencial[] {
  return (['usageAccess', 'overlay'] as const).filter((chave) => permissoes?.[chave] !== true);
}

export function tituloPermissoesFaltando(faltando: number): string {
  return faltando === 1
    ? 'Falta 1 permissão para bloquear'
    : `Faltam ${faltando} permissões para bloquear`;
}

/** CTA da secao 4: diz quantos apps o toque bloqueia. */
export function rotuloDoBloqueio(marcados: number): string {
  if (marcados === 0) {
    return 'Bloquear';
  }
  return marcados === 1 ? 'Bloquear 1 app' : `Bloquear ${marcados} apps`;
}

/** Linha sob o app no cartao da secao 5. */
export function legendaDaConclusao(total: number): string {
  if (total <= 1) {
    return 'A partir de agora';
  }
  const outros = total - 1;
  return `E mais ${outros} ${outros === 1 ? 'app' : 'apps'}, a partir de agora`;
}

/**
 * Oferta do modo restrito na secao 5. Diz o custo dos dois lados com o app que
 * a pessoa acabou de escolher — "um app" quando ha mais de um.
 */
export function textoOfertaRestrito(rotulos: string[], esperaMinutos: number): string {
  const alvo = rotulos.length === 1 ? `o ${rotulos[0]}` : 'um app';
  return `Sem ele, você tira ${alvo} da lista na hora. Com ele, mudar a lista pede ${esperaMinutos} min de espera — tempo para a vontade passar.`;
}
