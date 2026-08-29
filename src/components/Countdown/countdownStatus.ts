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
 * Rótulo de leitor de tela — não pode mudar a cada segundo (§2.5: abusivo
 * com VoiceOver/TalkBack). Quem chama passa o mesmo `remainingMs` arredondado
 * pro bucket de 15s (roundToAnnouncementBucket), não o valor cru do tick.
 */
export function formatRemainingForScreenReader(remainingMs: number): string {
  const { minutes, seconds } = splitMinutesSeconds(remainingMs);
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);
  if (seconds > 0 || minutes === 0) parts.push(`${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`);
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
