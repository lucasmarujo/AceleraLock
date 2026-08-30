import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Countdown } from '@/components/Countdown/Countdown';
import type { RemainingMsReader } from '@/components/Countdown/useCountdown';
import { spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type PendingTarget = 'UNLOCK_APP' | 'STOP_PROTECTION' | 'CHANGE_DURATIONS';

type Props = {
  readRemainingMs: RemainingMsReader;
  pendingTarget: PendingTarget;
  onCancel: () => void | Promise<void>;
};

/**
 * docs/design-system.md §3.5. A tela mais importante do produto agora: é
 * onde a pessoa está no pior momento, olhando o contador enquanto quer abrir
 * o que bloqueou. Duas regras não-negociáveis (do `supervisor`, não minhas):
 *
 * - Cancelar é fácil — mesmo peso visual da espera, sempre visível, nunca
 *   atrás de confirmação extra. Por isso é `Button` `primary`, não
 *   `secondary`/`ghost`: nesta tela não existe ação concorrente, e desistir
 *   é o resultado que o produto quer (§0).
 * - O contador nunca é hostil — `Countdown` já não usa vermelho/pisca em
 *   `nearingEnd`; esta tela não adiciona nenhum.
 *
 * Conclusão de verdade (a rota some sozinha) e o que "cancelar" faz de fato
 * são do `mobile` — `completeSlot` aqui é só uma mensagem calma, sem botão:
 * a tela desmonta pelo guard de `app/_layout.tsx` quando o estado muda,
 * independente do que este componente está desenhando no instante.
 */
export function WaitingScreen({ readRemainingMs, pendingTarget, onCancel }: Props) {
  const theme = useTheme();
  const [canceling, setCanceling] = useState(false);
  const copy = COPY[pendingTarget];

  const handleCancel = async () => {
    setCanceling(true);
    await onCancel();
    setCanceling(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bgCanvas }]}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{copy.title}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{copy.body}</Text>
        <View style={styles.countdown}>
          <Countdown
            readRemainingMs={readRemainingMs}
            completeSlot={
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Confirmando…</Text>
            }
          />
        </View>
      </View>
      <Button label="Cancelar" variant="primary" loading={canceling} onPress={handleCancel} />
    </SafeAreaView>
  );
}

const COPY: Record<PendingTarget, { title: string; body: string }> = {
  STOP_PROTECTION: {
    title: 'Desligando a proteção',
    body: 'Assim que o tempo acabar, a proteção é desligada e os apps bloqueados voltam a abrir.',
  },
  UNLOCK_APP: {
    title: 'Esperando para desbloquear',
    body: 'Assim que o tempo acabar, o app volta a abrir.',
  },
  CHANGE_DURATIONS: {
    title: 'Esperando para mudar a duração',
    body: 'A nova duração vale assim que o tempo acabar.',
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[6],
    gap: spacing[8],
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[3],
  },
  title: {
    fontSize: typography.title2.fontSize,
    lineHeight: typography.title2.lineHeight,
    fontWeight: typography.title2.fontWeight,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.body.fontWeight,
    textAlign: 'center',
  },
  countdown: {
    marginTop: spacing[6],
  },
});
