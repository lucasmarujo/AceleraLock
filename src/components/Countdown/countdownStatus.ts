/**
 * Logica pura do Countdown (docs/design-system.md §2), separada do hook que
 * le o tempo — testável sem React nem runtime nativo, mesmo padrão de
 * src/state/verdict.ts + useProtectionVerdict.ts.
 */

export type CountdownStatus =
  | { status: 'running'; remainingMs: number }
  | { status: 'nearingEnd'; remainingMs: number }
  | { status: 'complete' };

const NEARING_END_MS = 60_000;

export function deriveCountdownStatus(remainingMs: number): CountdownStatus {
  if (remainingMs <= 0) {
    return { status: 'complete' };
  }
  if (remainingMs <= NEARING_END_MS) {
    return { status: 'nearingEnd', remainingMs };
  }
  return { status: 'running', remainingMs };
}

function splitMinutesSeconds(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  return { minutes: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60 };
}

/** Rótulo visual — pode mudar a cada tick, é texto, nunca só cor. */
export function formatRemainingShort(remainingMs: number): string {
  const { minutes, seconds } = splitMinutesSeconds(remainingMs);
  return minutes > 0 ? `Faltam ${minutes} min ${seconds} s` : `Faltam ${seconds} s`;
}

/**
 * Número grande do cronômetro: "18:24", e "1:05:09" a partir de uma hora — a
 * espera é configurável, então o formato não pode assumir que cabe em minutos.
 * Arredonda pra cima pelo mesmo motivo do rótulo: "00:00" só quando acabou.
 */
export function formatRemainingClock(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  }
  return `${String(minutes).padStart(2, '0')}:${ss}`;
}

/**
 * Quanto da espera já passou (0..1), pra barra de progresso (§2.4). É desenho,
 * não verdade: o total vem da duração configurada hoje, e um pedido feito com
 * outra duração pode não bater — por isso clampado nas duas pontas, e por isso
 * a barra nunca é o único indicador (número e rótulo continuam do lado).
 */
export function fracaoDecorrida(remainingMs: number, totalMs: number): number {
  if (!Number.isFinite(totalMs) || totalMs <= 0 || !Number.isFinite(remainingMs)) {
    return 0;
  }
  return Math.min(1, Math.max(0, 1 - remainingMs / totalMs));
}

/**
 * Rotação das duas metades do anel (§2.4), em graus no sentido horário a
 * partir do topo. O anel é desenhado com duas metades recortadas: a direita
 * cobre 0..50% da espera e a esquerda 50..100%, cada uma girando até 180°.
 */
export function angulosDoArco(fracao: number): { direita: number; esquerda: number } {
  const f = Number.isFinite(fracao) ? Math.min(1, Math.max(0, fracao)) : 0;
  return { direita: Math.min(f, 0.5) * 360, esquerda: Math.max(0, f - 0.5) * 360 };
}

/**
 * Centro da ponta arredondada do arco, relativo ao centro do anel: o arco
 * começa no topo e anda no sentido horário. `y` cresce pra baixo, como na tela.
 */
export function pontaDoArco(fracao: number, raio: number): { x: number; y: number } {
  const f = Number.isFinite(fracao) ? Math.min(1, Math.max(0, fracao)) : 0;
  const angulo = f * 2 * Math.PI;
  return { x: raio * Math.sin(angulo), y: -raio * Math.cos(angulo) };
}

/**
 * Rótulo de leitor de tela — não pode mudar a cada segundo (§2.5: abusivo
 * com VoiceOver/TalkBack). Quem chama passa o mesmo `remainingMs` arredondado
 * pro bucket de 15s (roundToAnnouncementBucket), não o valor cru do tick.
 */
export function formatRemainingForScreenReader(remainingMs: number): string {
  const { minutes, seconds } = splitMinutesSeconds(remainingMs);
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);
  if (seconds > 0 || minutes === 0)
    parts.push(`${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`);
  return `Faltam ${parts.join(' e ')}`;
}

/**
 * ponytail: arredondar pro bucket de 15s é o que evita reescrever o
 * accessibilityLabel a cada tick (§2.5). Marcos de anúncio explícitos
 * (AccessibilityInfo.announceForAccessibility em 50%/1min/10s/concluído)
 * ficam pra quando teste real de VoiceOver/TalkBack mostrar que só isto não
 * basta — o bucket já resolve "não é abusivo", que é a exigência dura.
 */
export function roundToAnnouncementBucket(remainingMs: number, bucketMs = 15_000): number {
  return Math.ceil(remainingMs / bucketMs) * bucketMs;
}
