/**
 * Os textos que o celular da landing mostra, no formato exato do app.
 *
 * A pagina e estatica e nao tem build: nao da pra importar o TypeScript de `src/`
 * no navegador. Cada funcao daqui espelha uma do app, e `tests/landing.test.ts`
 * compara as duas numa faixa larga de entradas — se o app mudar o formato, o teste
 * quebra antes de a landing mostrar um texto que o app nao mostraria.
 */

function segundosInteiros(segundos) {
  return Math.max(0, Math.ceil(segundos));
}

/** Espelha `formatRemainingClock` (Countdown/countdownStatus.ts), em segundos. */
export function relogio(segundos) {
  const total = segundosInteiros(segundos);
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const ss = String(total % 60).padStart(2, '0');
  if (horas > 0) {
    return `${horas}:${String(minutos).padStart(2, '0')}:${ss}`;
  }
  return `${String(minutos).padStart(2, '0')}:${ss}`;
}

/** Espelha `formatRemainingShort` (Countdown/countdownStatus.ts), em segundos. */
export function faltam(segundos) {
  const total = segundosInteiros(segundos);
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  return minutos > 0 ? `Faltam ${minutos} min ${resto} s` : `Faltam ${resto} s`;
}

/** Espelha `fracaoDecorrida` (Countdown/countdownStatus.ts). */
export function fracaoDecorrida(restantes, total) {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(restantes)) {
    return 0;
  }
  return Math.min(1, Math.max(0, 1 - restantes / total));
}

/** Espelha `formatarDuracao` (TempoTela/tempoTela.ts). */
export function duracao(segundos) {
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

const MINUTOS_POR_DIA = 24 * 60;

/** Espelha `formatarHora` (Bloqueios/horarioLivre.ts). */
export function hora(minuto) {
  const normalizado = ((Math.round(minuto) % MINUTOS_POR_DIA) + MINUTOS_POR_DIA) % MINUTOS_POR_DIA;
  const horas = Math.floor(normalizado / 60);
  const minutos = normalizado % 60;
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

/** Espelha `legendaComHorarios` (Bloqueios/horarioLivre.ts). */
export function legendaComHorarios(quantidade) {
  if (quantidade <= 0) {
    return null;
  }
  return quantidade === 1 ? '1 horário livre' : `${quantidade} horários livres`;
}

/** Espelha `tituloDaBarra` (Bloqueios/bloqueios.ts). */
export function tituloDaBarra(total) {
  return total === 1 ? '1 alteração não salva' : `${total} alterações não salvas`;
}

/**
 * Espelha `descreverAlteracoes` (Bloqueios/bloqueios.ts) quando so entram apps — o
 * unico caso que a demonstracao encena.
 */
export function descreverEntradas(nomes) {
  if (nomes.length === 0) {
    return '';
  }
  if (nomes.length === 1) {
    return `${nomes[0]} entra na lista`;
  }
  return `${nomes.length} entram`;
}
