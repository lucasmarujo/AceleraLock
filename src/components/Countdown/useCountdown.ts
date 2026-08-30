import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { deriveCountdownStatus, type CountdownStatus } from './countdownStatus';

export type CountdownSnapshot =
  { status: 'loading' } | CountdownStatus | { status: 'error'; message: string };

export type RemainingMsReader = () => Promise<number> | number;

const TICK_MS = 1000;

/**
 * Fonte do tempo: quem chama passa `readRemainingMs`, que lê o tempo
 * restante de onde quer que ele more — hoje o módulo nativo, contando em
 * tempo monotônico acumulado (native/modules/aceleralock-blocker). Este hook
 * não chama o nativo direto nem assume o formato do contrato, que o `dev`
 * ainda está escrevendo — só consome um número em ms. Trocar a leitura por
 * uma chamada real ao nativo não deve exigir tocar neste arquivo.
 *
 * Nunca usa Date.now(). Entre leituras, interpola com `performance.now()`
 * (monotônico, imune a ajuste de relógio de parede) a partir da última
 * leitura confirmada — refresh() reancora nela. Um restart do app só perde a
 * interpolação entre ticks, nunca o valor de verdade, que sempre vem de novo
 * de readRemainingMs().
 */
export function useCountdown(readRemainingMs: RemainingMsReader) {
  const [snapshot, setSnapshot] = useState<CountdownSnapshot>({ status: 'loading' });
  const anchor = useRef<{ atMs: number; remainingMs: number } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const remainingMs = await readRemainingMs();
      anchor.current = { atMs: performance.now(), remainingMs };
      setSnapshot(deriveCountdownStatus(remainingMs));
    } catch (error) {
      console.warn('[useCountdown] falha ao ler tempo restante', error);
      anchor.current = null;
      setSnapshot({ status: 'error', message: 'Não foi possível ler o tempo restante.' });
    }
  }, [readRemainingMs]);

  useEffect(() => {
    // `refresh` e async: todo setState dela acontece depois de um await,
    // nunca sincrono no corpo do efeito. E a carga inicial, que precisa
    // rodar no mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();

    const interval = setInterval(() => {
      if (!anchor.current) return;
      const elapsed = performance.now() - anchor.current.atMs;
      setSnapshot(deriveCountdownStatus(anchor.current.remainingMs - elapsed));
    }, TICK_MS);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [refresh]);

  return { snapshot, refresh };
}
