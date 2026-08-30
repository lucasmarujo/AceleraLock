import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import {
  formatRemainingForScreenReader,
  formatRemainingShort,
  roundToAnnouncementBucket,
} from './countdownStatus';
import { useCountdown, type RemainingMsReader } from './useCountdown';

type Props = {
  readRemainingMs: RemainingMsReader;
  /** O que mostrar quando a espera termina (CTA da próxima etapa). */
  completeSlot?: ReactNode;
};

/**
 * docs/design-system.md §2. Componente crítico: nunca crava dígito de prazo
 * (o valor vem sempre de `readRemainingMs`), e é sempre calmo — sem
 * vermelho, sem piscar, sem contagem dramática, mesmo em `nearingEnd`.
 */
export function Countdown({ readRemainingMs, completeSlot }: Props) {
  const theme = useTheme();
  const { snapshot, refresh } = useCountdown(readRemainingMs);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    await refresh();
    setRetrying(false);
  };

  if (snapshot.status === 'loading') {
    return (
      <View
        style={styles.container}
        accessibilityRole="timer"
        accessibilityLabel="Carregando tempo restante"
        accessibilityLiveRegion="polite"
      >
        <Skeleton width={160} height={typography.timerHero.lineHeight} />
      </View>
    );
  }

  if (snapshot.status === 'error') {
    return (
      <View style={styles.container} accessibilityLiveRegion="polite">
        <Text style={[styles.message, { color: theme.colors.textDanger }]}>{snapshot.message}</Text>
        <Button
          label="Tentar de novo"
          variant="secondary"
          size="md"
          loading={retrying}
          onPress={handleRetry}
        />
      </View>
    );
  }

  if (snapshot.status === 'complete') {
    return (
      <View style={styles.container} accessibilityLiveRegion="polite">
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Espera concluída</Text>
        {completeSlot}
      </View>
    );
  }

  // running | nearingEnd — mesmo layout, só o peso do número sobe um degrau
  // em nearingEnd (§2.2). Nunca vermelho, nunca pisca.
  const { remainingMs } = snapshot;
  const numberStyle = snapshot.status === 'nearingEnd' ? typography.timerHero : typography.display;
  const bucketedMs = roundToAnnouncementBucket(remainingMs);

  return (
    <View
      style={styles.container}
      accessibilityRole="timer"
      accessibilityLiveRegion="polite"
      accessibilityLabel={formatRemainingForScreenReader(bucketedMs)}
    >
      <Text
        style={[
          styles.number,
          {
            color: theme.colors.textPrimary,
            fontSize: numberStyle.fontSize,
            lineHeight: numberStyle.lineHeight,
            fontWeight: numberStyle.fontWeight,
          },
        ]}
        maxFontSizeMultiplier={1.3}
        importantForAccessibility="no"
      >
        {formatRemainingShort(remainingMs).replace('Faltam ', '')}
      </Text>
      <Text
        style={[styles.label, { color: theme.colors.textSecondary }]}
        importantForAccessibility="no"
      >
        {formatRemainingShort(remainingMs)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing[2],
  },
  number: {
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
    fontWeight: typography.callout.fontWeight,
  },
  title: {
    fontSize: typography.title2.fontSize,
    lineHeight: typography.title2.lineHeight,
    fontWeight: typography.title2.fontWeight,
  },
  message: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontWeight: typography.body.fontWeight,
    textAlign: 'center',
  },
});
