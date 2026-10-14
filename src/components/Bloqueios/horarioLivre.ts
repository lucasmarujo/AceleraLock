/**
 * Logica pura dos horarios livres (excecoes de bloqueio por app). Sem import de
 * react-native nem de `@/native/blocker`: o tipo da faixa e redeclarado aqui pelo
 * mesmo motivo de `Ajustes/ajustes.ts` — importar o modulo nativo chamaria
 * `requireNativeModule` no `node --test`.
 *
 * Quem decide se a faixa vale agora e o core (`ScheduleExceptions.kt`), com hora e
 * fuso automaticos e modo restrito na conta. Aqui so se descreve e valida o que a
 * pessoa configura — duas fontes da mesma decisao divergiriam.
 */

/** Dias ISO (1 = segunda ... 7 = domingo), minutos desde 00:00. */
export type Faixa = {
  days: number[];
  start: number;
  end: number;
};

export const MINUTOS_POR_DIA = 24 * 60;

/** Mesmo teto do core (`ScheduleExceptions.MAX_WINDOWS_PER_APP`). */
export const MAX_FAIXAS = 8;

/** Passo do seletor de hora. */
export const PASSO_MINUTOS = 15;

export const DIAS_DA_SEMANA = [
  { valor: 1, curto: 'seg', inicial: 'S', nome: 'segunda' },
  { valor: 2, curto: 'ter', inicial: 'T', nome: 'terça' },
  { valor: 3, curto: 'qua', inicial: 'Q', nome: 'quarta' },
  { valor: 4, curto: 'qui', inicial: 'Q', nome: 'quinta' },
  { valor: 5, curto: 'sex', inicial: 'S', nome: 'sexta' },
  { valor: 6, curto: 'sáb', inicial: 'S', nome: 'sábado' },
  { valor: 7, curto: 'dom', inicial: 'D', nome: 'domingo' },
] as const;

const DIAS_UTEIS = [1, 2, 3, 4, 5];

/** Faixa que o formulario abre ao adicionar: almoco em dia util. */
export function faixaInicial(): Faixa {
  return { days: [...DIAS_UTEIS], start: 12 * 60, end: 13 * 60 };
}

/** `12:00`, `08:15`. */
export function formatarHora(minuto: number): string {
  const normalizado = ((Math.round(minuto) % MINUTOS_POR_DIA) + MINUTOS_POR_DIA) % MINUTOS_POR_DIA;
  const horas = Math.floor(normalizado / 60);
  const minutos = normalizado % 60;
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

/** Anda `passos` vezes o passo do seletor, dando a volta na meia-noite. */
export function ajustarMinuto(minuto: number, passos: number): number {
  const proximo = minuto + passos * PASSO_MINUTOS;
  return ((proximo % MINUTOS_POR_DIA) + MINUTOS_POR_DIA) % MINUTOS_POR_DIA;
}

export function atravessaMeiaNoite(faixa: Faixa): boolean {
  return faixa.end < faixa.start;
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1);
}

function juntar(partes: string[]): string {
  if (partes.length <= 1) {
    return partes.join('');
  }
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

/**
 * "Todos os dias", "Seg a sex", "Sáb e dom", "Ter a qui", "Seg, qua e sex".
 * Sequencia de tres ou mais dias seguidos vira intervalo.
 */
export function descreverDias(dias: number[]): string {
  const ordenados = [...new Set(dias)].filter((dia) => dia >= 1 && dia <= 7).sort((a, b) => a - b);
  if (ordenados.length === 0) {
    return 'Nenhum dia';
  }
  if (ordenados.length === 7) {
    return 'Todos os dias';
  }
  const curto = (dia: number) => DIAS_DA_SEMANA[dia - 1].curto;
  const seguidos = ordenados.every((dia, i) => i === 0 || dia === ordenados[i - 1] + 1);
  if (seguidos && ordenados.length >= 3) {
    return capitalizar(`${curto(ordenados[0])} a ${curto(ordenados[ordenados.length - 1])}`);
  }
  return capitalizar(juntar(ordenados.map(curto)));
}

/** "Seg a sex · 12:00–13:00", "Sex · 22:00–02:00 do dia seguinte". */
export function descreverFaixa(faixa: Faixa): string {
  const horario = `${formatarHora(faixa.start)}–${formatarHora(faixa.end)}`;
  const virada = atravessaMeiaNoite(faixa) ? ' do dia seguinte' : '';
  return `${descreverDias(faixa.days)} · ${horario}${virada}`;
}

/**
 * Linha do app na lista: quantos horarios livres ele tem. `null` sem nenhum. Sem o
 * "Bloqueado" na frente: a secao e o interruptor ja dizem, e a legenda tem uma linha
 * so ao lado do botao de horario.
 */
export function legendaComHorarios(quantidade: number): string | null {
  if (quantidade <= 0) {
    return null;
  }
  return quantidade === 1 ? '1 horário livre' : `${quantidade} horários livres`;
}

/** Mensagem que diz como resolver, ou `null` quando a faixa pode ser gravada. */
export function validarFaixa(faixa: Faixa): string | null {
  if (faixa.days.length === 0) {
    return 'Escolha pelo menos um dia.';
  }
  if (faixa.days.some((dia) => !Number.isInteger(dia) || dia < 1 || dia > 7)) {
    return 'Dia da semana inválido.';
  }
  const dentroDoDia = (minuto: number) =>
    Number.isInteger(minuto) && minuto >= 0 && minuto < MINUTOS_POR_DIA;
  if (!dentroDoDia(faixa.start) || !dentroDoDia(faixa.end)) {
    return 'Horário inválido.';
  }
  if (faixa.start === faixa.end) {
    return 'O início e o fim não podem ser iguais.';
  }
  return null;
}

export function validarFaixas(faixas: Faixa[]): string | null {
  if (faixas.length > MAX_FAIXAS) {
    return `No máximo ${MAX_FAIXAS} horários livres por app.`;
  }
  for (const faixa of faixas) {
    const erro = validarFaixa(faixa);
    if (erro) {
      return erro;
    }
  }
  return null;
}

/** Mesma configuracao, independente da ordem dos dias. */
export function mesmasFaixas(a: Faixa[], b: Faixa[]): boolean {
  const chave = (faixa: Faixa) =>
    `${[...new Set(faixa.days)].sort((x, y) => x - y).join(',')}|${faixa.start}|${faixa.end}`;
  if (a.length !== b.length) {
    return false;
  }
  return a.every((faixa, i) => chave(faixa) === chave(b[i]));
}

/** Agrupa a lista achatada do nativo por app. */
export function agruparPorApp<T extends Faixa & { packageName: string }>(
  lista: T[]
): Map<string, Faixa[]> {
  const porApp = new Map<string, Faixa[]>();
  for (const { packageName, days, start, end } of lista) {
    porApp.set(packageName, [...(porApp.get(packageName) ?? []), { days, start, end }]);
  }
  return porApp;
}

export type AvisoDoHorario = {
  titulo: string;
  mensagem: string;
  /** So quando ha o que a pessoa possa fazer nas Configuracoes. */
  podeAbrirConfiguracoes: boolean;
};

/**
 * Por que os horarios livres nao estao valendo agora, na ordem em que o core
 * recusa: modo restrito primeiro (decisao do usuario), depois hora ou fuso manual.
 * `null` quando nada impede.
 */
export function avisoDoHorario(estado: {
  restricted: boolean;
  automaticTime: boolean;
  automaticZone: boolean;
}): AvisoDoHorario | null {
  if (estado.restricted) {
    return {
      titulo: 'Horários livres pausados',
      mensagem:
        'Com o modo restrito ligado, nenhum horário livre vale: o app fica bloqueado o tempo todo.',
      podeAbrirConfiguracoes: false,
    };
  }
  if (!estado.automaticTime || !estado.automaticZone) {
    return {
      titulo: 'Ligue data e hora automáticas',
      mensagem:
        'Sem hora e fuso automáticos os horários livres não valem — assim ninguém abre o app mudando o relógio.',
      podeAbrirConfiguracoes: true,
    };
  }
  return null;
}
