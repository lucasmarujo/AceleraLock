/**
 * Logica pura das telas de tempo de tela. Sem import de react-native: e o que o
 * `node --test` consegue carregar, mesma divisao de `countdownStatus.ts` e
 * `Onboarding/passos.ts`.
 */

export type DiaDoMes = {
  /** ISO `YYYY-MM-DD`. */
  data: string;
  /** Dia do mes, 1..31. */
  numero: number;
  /**
   * `null` quando aquele dia nao foi medido — nunca 0. A distincao e a mesma
   * que `ProtectionLog` ja faz entre interrupcao imensuravel e interrupcao de
   * duracao zero: dia sem leitura e um circulo vazio, dia com zero e um dia em
   * que a pessoa nao usou o celular, e sao coisas diferentes.
   */
  segundos: number | null;
};

/** `1h 04min`, `12min`, `45s`. Nunca `0h 0min`. */
export function formatarDuracao(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) {
    return '0min';
  }
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);

  if (horas > 0) {
    return minutos > 0 ? `${horas}h ${String(minutos).padStart(2, '0')}min` : `${horas}h`;
  }
  if (minutos > 0) {
    return `${minutos}min`;
  }
  return `${Math.floor(segundos)}s`;
}

/** Versao falada, pro leitor de tela — abreviacao vira palavra. */
export function descreverDuracao(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) {
    return 'nenhum tempo registrado';
  }
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const partes: string[] = [];
  if (horas > 0) {
    partes.push(horas === 1 ? '1 hora' : `${horas} horas`);
  }
  if (minutos > 0) {
    partes.push(minutos === 1 ? '1 minuto' : `${minutos} minutos`);
  }
  return partes.length > 0 ? partes.join(' e ') : 'menos de um minuto';
}

/** ISO `YYYY-MM-DD` de uma data local, sem passar por UTC (que muda o dia). */
export function isoLocal(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/**
 * Os dias do mes de [ancora], casados com as leituras que existirem.
 *
 * Dia sem leitura sai com `segundos: null`. Preencher com zero seria afirmar
 * "voce nao usou o celular nesse dia" sobre um dia que ninguem mediu — e o
 * calendario nasce assim, porque o historico so comeca na instalacao.
 */
export function diasDoMes(ancora: Date, leituras: { date: string; seconds: number }[]): DiaDoMes[] {
  const porData = new Map(leituras.map((leitura) => [leitura.date, leitura.seconds]));
  const total = new Date(ancora.getFullYear(), ancora.getMonth() + 1, 0).getDate();

  return Array.from({ length: total }, (_, indice) => {
    const data = new Date(ancora.getFullYear(), ancora.getMonth(), indice + 1);
    const iso = isoLocal(data);
    return {
      data: iso,
      numero: indice + 1,
      segundos: porData.has(iso) ? (porData.get(iso) as number) : null,
    };
  });
}

/**
 * Quantas casas vazias antes do dia 1, pra semana comecar no domingo — que e
 * como o calendario do Android mostra em pt-BR.
 */
export function espacosAntesDoPrimeiro(ancora: Date): number {
  return new Date(ancora.getFullYear(), ancora.getMonth(), 1).getDay();
}

/**
 * Intensidade (0..1) do circulo do dia. `null` continua `null`: a ausencia de
 * leitura nao vira o tom mais claro da escala, senao ela viraria "usou pouco".
 */
export function intensidadeDoDia(segundos: number | null, maximo: number): number | null {
  if (segundos === null) {
    return null;
  }
  if (maximo <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, segundos / maximo));
}

/** Maior leitura do conjunto, pra escala do calendario. 0 quando nada foi medido. */
export function maiorLeitura(dias: DiaDoMes[]): number {
  return dias.reduce(
    (maior, dia) => (dia.segundos !== null && dia.segundos > maior ? dia.segundos : maior),
    0
  );
}

/**
 * `4h30`, `4h`, `45min`. Versao curta pro eixo do grafico de barras, onde a
 * coluna tem ~32dp: `formatarDuracao` daria "4h 30min", que nao cabe e quebra
 * em duas linhas. Abaixo de uma hora as duas formas ja sao iguais.
 */
export function formatarDuracaoCompacta(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 3600) {
    return formatarDuracao(segundos);
  }
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  return minutos > 0 ? `${horas}h${String(minutos).padStart(2, '0')}` : `${horas}h`;
}

/**
 * Altura em px da barra de `valor` numa escala que vai ate `maximo`.
 *
 * Leitura acima de zero nunca desce abaixo de `minima`: um dia de 5 minutos
 * contra um maximo de 7h daria 1px, e 1px le como "nao teve leitura" — que ja
 * tem outro desenho (a trilha vazia). Zero medido continua zero, pela mesma
 * distincao que `intensidadeDoDia` faz.
 */
export function alturaDaBarra(valor: number, maximo: number, altura: number, minima = 0): number {
  if (!Number.isFinite(valor) || valor <= 0 || maximo <= 0) {
    return 0;
  }
  return Math.max(minima, Math.min(1, valor / maximo) * altura);
}

/**
 * Teto da escala do grafico de barras. A estimativa entra junto com as
 * leituras: linha de referencia so compara alguma coisa se dividir a escala
 * das barras — presa no topo, "estimei 12h" e "estimei 5h" cairiam no mesmo
 * lugar. O piso de 1 segura a escala quando ainda nao ha nada medido.
 */
export function escalaDoGrafico(horas: number[], estimativa: number | null): number {
  return Math.max(...horas, estimativa ?? 0, 1);
}

export type DiaDaSemana = {
  /** ISO `YYYY-MM-DD`. */
  data: string;
  /** Letra do dia da semana, ou "Hoje" na ultima coluna. */
  rotulo: string;
  /** `null` = dia sem leitura, desenhado tracejado. Nunca vira zero. */
  segundos: number | null;
  hoje: boolean;
};

const LETRA_DO_DIA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/**
 * Os ultimos `dias` dias de calendario terminando hoje, na ordem do grafico.
 * Dia sem leitura entra como `null` em vez de sumir: a coluna tracejada diz
 * "nao medido" sem afirmar que a pessoa nao usou o celular, e a semana nao
 * encolhe nem desalinha as letras.
 */
export function semanaAteHoje(
  leituras: { date: string; seconds: number }[],
  hoje: Date,
  dias = 7
): DiaDaSemana[] {
  const porData = new Map(leituras.map((leitura) => [leitura.date, leitura.seconds]));
  return Array.from({ length: dias }, (_, indice) => {
    const data = new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate() - (dias - 1 - indice)
    );
    const iso = isoLocal(data);
    const ehHoje = indice === dias - 1;
    return {
      data: iso,
      rotulo: ehHoje ? 'Hoje' : LETRA_DO_DIA[data.getDay()],
      segundos: porData.has(iso) ? (porData.get(iso) as number) : null,
      hoje: ehHoje,
    };
  });
}

export type ComparacaoComEstimativa = {
  sentido: 'abaixo' | 'acima' | 'igual';
  diferencaSegundos: number;
};

/** Diferenca de menos de um minuto conta como igual — "0min abaixo" nao informa nada. */
const MARGEM_IGUAL_SEGUNDOS = 60;

/**
 * `null` sem estimativa (nao ha com o que comparar) e sem leitura de hoje: dia
 * nao medido nao esta "5h abaixo" de nada.
 */
export function compararComEstimativa(
  segundosHoje: number | null,
  estimativaHoras: number | null
): ComparacaoComEstimativa | null {
  if (
    segundosHoje === null ||
    estimativaHoras === null ||
    !(estimativaHoras > 0) ||
    !Number.isFinite(segundosHoje)
  ) {
    return null;
  }
  const diferenca = segundosHoje - estimativaHoras * 3600;
  if (Math.abs(diferenca) < MARGEM_IGUAL_SEGUNDOS) {
    return { sentido: 'igual', diferencaSegundos: 0 };
  }
  return { sentido: diferenca < 0 ? 'abaixo' : 'acima', diferencaSegundos: Math.abs(diferenca) };
}

export function descreverComparacao(
  comparacao: ComparacaoComEstimativa,
  estimativaHoras: number
): string {
  const estimativa = formatarDuracaoCompacta(estimativaHoras * 3600);
  if (comparacao.sentido === 'igual') {
    return `Na sua estimativa de ${estimativa}`;
  }
  return `${formatarDuracao(comparacao.diferencaSegundos)} ${comparacao.sentido} da sua estimativa de ${estimativa}`;
}
