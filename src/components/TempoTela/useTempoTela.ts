import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import AceleralockBlocker, { type ScreenTimeSummary } from '@/native/blocker';

export type CargaTempoTela =
  | { estado: 'carregando' }
  | { estado: 'erro' }
  | { estado: 'pronto'; resumo: ScreenTimeSummary };

/**
 * Le o resumo de tempo de tela a cada foco da tela. Duas abas consomem isto, e
 * cada uma tem a propria instancia de proposito: o resumo e uma leitura barata
 * de cache do sistema, e compartilhar estado entre abas exigiria mais um
 * provider pra economizar uma chamada por troca de aba.
 *
 * `useFocusEffect` e nao `useEffect`: voltando do Settings ou de outra aba, o
 * total de hoje ja mudou.
 */
export function useTempoTela(): CargaTempoTela {
  const [carga, setCarga] = useState<CargaTempoTela>({ estado: 'carregando' });

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      AceleralockBlocker.screenTimeSummary()
        .then((resumo) => {
          if (ativo) {
            setCarga({ estado: 'pronto', resumo });
          }
        })
        .catch((error) => {
          console.warn('[useTempoTela] falha ao ler tempo de tela', error);
          if (ativo) {
            setCarga({ estado: 'erro' });
          }
        });

      return () => {
        ativo = false;
      };
    }, [])
  );

  return carga;
}
