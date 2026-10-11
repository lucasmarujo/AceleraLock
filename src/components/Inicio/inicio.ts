/**
 * Logica pura da aba Inicio. Sem import de react-native, pelo mesmo motivo de
 * `TempoTela/tempoTela.ts`: e o que o `node --test` consegue carregar.
 */

const DIAS_DA_SEMANA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/**
 * "Sábado, 11 de outubro". Tabela propria em vez de `toLocaleDateString`: o
 * Intl do Hermes varia por build, e um cabecalho em ingles por falta de locale
 * seria pior que nenhum.
 */
export function dataPorExtenso(data: Date): string {
  return `${DIAS_DA_SEMANA[data.getDay()]}, ${data.getDate()} de ${MESES[data.getMonth()]}`;
}

function contar(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

/**
 * Subtitulo do cartao de protecao. Nunca "0 apps e 0 sites". Com a leitura do
 * navegador desligada, os sites saem da conta de bloqueados: lista cheia sem o
 * servico nao pode parecer protecao.
 */
export function resumoBloqueios(apps: number, sites: number, sitesPausados = false): string {
  if (sitesPausados && sites > 0) {
    return apps === 0
      ? contar(sites, 'site pausado', 'sites pausados')
      : `${contar(apps, 'app bloqueado', 'apps bloqueados')} · sites pausados`;
  }
  if (apps === 0 && sites === 0) {
    return 'Nada bloqueado ainda';
  }
  if (sites === 0) {
    return `${contar(apps, 'app bloqueado', 'apps bloqueados')}`;
  }
  if (apps === 0) {
    return `${contar(sites, 'site bloqueado', 'sites bloqueados')}`;
  }
  return `${contar(apps, 'app', 'apps')} e ${contar(sites, 'site', 'sites')} bloqueados`;
}

/**
 * O que nao coube na pilha de icones do cartao de protecao: apps alem dos
 * visiveis e os sites, que nao tem icone. O "+" so aparece depois de icone.
 */
export function restoDaPilha(apps: number, sites: number, visiveis: number): string | null {
  const partes: string[] = [];
  const appsForaDaPilha = Math.max(0, apps - visiveis);
  if (appsForaDaPilha > 0) {
    partes.push(contar(appsForaDaPilha, 'app', 'apps'));
  }
  if (sites > 0) {
    partes.push(contar(sites, 'site', 'sites'));
  }
  if (partes.length === 0) {
    return null;
  }
  return `${apps > 0 ? '+ ' : ''}${partes.join(' e ')}`;
}

/** Titulo do aviso de sites com a leitura do navegador desligada. */
export function tituloSitesSemBloqueio(sites: number): string {
  return `${contar(sites, 'site', 'sites')} sem bloqueio agora`;
}

/**
 * Linha da tela de protecao desligada: o que ficou livre e volta a ser
 * bloqueado ao reativar. `null` com a lista vazia — nao ha o que listar.
 */
export function resumoLiberados(apps: number, sites: number): string | null {
  if (apps === 0 && sites === 0) {
    return null;
  }
  if (sites === 0) {
    return contar(apps, 'app liberado', 'apps liberados');
  }
  if (apps === 0) {
    return contar(sites, 'site liberado', 'sites liberados');
  }
  return `${contar(apps, 'app', 'apps')} e ${contar(sites, 'site', 'sites')} liberados`;
}

/** Largura da barra de "mais usados", relativa ao app que mais consumiu. */
export function proporcaoDoMaior(valor: number, maior: number): number {
  if (!(maior > 0) || !(valor > 0)) {
    return 0;
  }
  return Math.min(1, valor / maior);
}

/**
 * Nota embaixo do grafico quando a semana tem dia tracejado. `null` sem dia
 * faltando: nota que diz "nada a declarar" so ocupa espaco.
 */
export function notaSemLeitura(semana: { data: string; segundos: number | null }[]): string | null {
  const faltando = semana.filter((dia) => dia.segundos === null);
  if (faltando.length === 0) {
    return null;
  }
  if (faltando.length === 1) {
    const [ano, mes, numero] = faltando[0].data.split('-').map(Number);
    const nome = DIAS_DA_SEMANA[new Date(ano, mes - 1, numero).getDay()].replace('-feira', '');
    return `${nome} sem leitura: o aparelho não registrou esse dia.`;
  }
  return `${faltando.length} dias sem leitura: o aparelho não registrou esses dias.`;
}
