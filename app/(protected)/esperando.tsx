import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { WaitingScreen } from '@/components/WaitingScreen';
import AceleralockBlocker from '@/native/blocker';
import { useProtectionVerdictContext } from '@/state/ProtectionVerdictContext';

// Mesma cadencia de BlockerTuning.POLL_OUTSIDE_WINDOW — nao ha razao pra
// checar mais rapido que o proprio nativo tickeia.
const POLL_MS = 2000;

/**
 * Tela generica pros tres alvos de WaitingPeriod, mas so STOP_PROTECTION tem
 * gatilho hoje (app/(protected)/index.tsx). CHANGE_DURATIONS/UNLOCK_APP nao
 * tem tela de origem ainda — quando tiverem, o efeito abaixo precisa de um
 * caminho de saida proprio pra elas (STOP_PROTECTION sai sozinho: o veredito
 * vira 'pausado' e o guard de app/_layout.tsx desmonta este grupo).
 */
export default function Esperando() {
  const router = useRouter();
  const { refresh } = useProtectionVerdictContext();
  const pendingTarget = AceleralockBlocker.protectionState().pendingTarget;

  useEffect(() => {
    if (!pendingTarget) {
      // Sem pedido pendente ao montar (ja foi concluido ou cancelado antes
      // desta tela existir) — nada pra mostrar.
      router.back();
      return;
    }

    // Detecta conclusao real em segundo plano (o nativo consumiu o pedido
    // sozinho, ninguem cancelou por aqui) e reavalia o veredito. Nenhuma
    // navegacao explicita: pra STOP_PROTECTION o refresh() ja basta, o
    // guard troca de grupo e desmonta esta tela.
    const interval = setInterval(async () => {
      const state = AceleralockBlocker.protectionState();
      if (!state.pendingTarget) {
        clearInterval(interval);
        await refresh();
      }
    }, POLL_MS);

    return () => clearInterval(interval);
  }, [pendingTarget, refresh, router]);

  if (!pendingTarget) {
    return null;
  }

  return (
    <WaitingScreen
      pendingTarget={pendingTarget}
      readRemainingMs={() => (AceleralockBlocker.protectionState().pendingRemainingSeconds ?? 0) * 1000}
      onCancel={async () => {
        AceleralockBlocker.cancelRequest();
        router.back();
      }}
    />
  );
}
