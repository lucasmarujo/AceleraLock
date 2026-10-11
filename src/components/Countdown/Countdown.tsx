import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Skeleton } from '@/components/Skeleton';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import {
  formatRemainingClock,
  formatRemainingForScreenReader,
  formatRemainingShort,
  fracaoDecorrida,
  roundToAnnouncementBucket,
} from './countdownStatus';
import { useCountdown, type RemainingMsReader } from './useCountdown';

type Props = {
  readRemainingMs: RemainingMsReader;
  /**
   * Duracao total configurada, so pra desenhar a barra. Sem ela a barra nao
   * aparece — o numero e o rotulo bastam (§2.4: a barra nunca e o unico
   * indicador).
   */
  totalMs?: number;
  /** O que mostrar quando a espera termina (CTA da próxima etapa). */
  completeSlot?: ReactNode;
};

/**
 * docs/design-system.md §2. Componente crítico: nunca crava dígito de prazo
 * (o valor vem sempre de `readRemainingMs`), e é sempre calmo — sem
 * vermelho, sem piscar, sem contagem dramática, mesmo em `nearingEnd`.
 *
 * Vive sobre o `HeroCard` da tela de espera, por isso as cores são as
 * `textOnHero*`. A barra é âmbar (atrito) — o anel do §2.4 pediria
 * `react-native-svg`, e a barra linear é a alternativa que o próprio §2.4 dá.
 */
export function Countdown({ readRemainingMs, totalMs, completeSlot }: Props) {
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
        <Skeleton width={180} height={typography.timerHero.lineHeight} />
      </View>
    );
  }

  if (snapshot.status === 'error') {
    return (
      <View style={styles.container} accessibilityLiveRegion="polite">
        <Text style={[styles.message, { color: theme.colors.textOnHero }]}>{snapshot.message}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: retrying }}
          onPress={retrying ? undefined : handleRetry}
          style={styles.retry}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Text style={[styles.retryLabel, { color: theme.colors.textOnHeroBrand }]}>
            Tentar de novo
          </Text>
        </Pressable>
      </View>
    );
  }

  if (snapshot.status === 'complete') {
    return (
      <View style={styles.container} accessibilityLiveRegion="polite">
        <Text style={[styles.title, { color: theme.colors.textOnHero }]}>Espera concluída</Text>
        {completeSlot}
      </View>
    );
  }

  // running | nearingEnd — mesmo layout, só o peso do número sobe um degrau
  // em nearingEnd (§2.2). Nunca vermelho, nunca pisca.
  const { remainingMs } = snapshot;
  const reta = snapshot.status === 'nearingEnd';
  const bucketedMs = roundToAnnouncementBucket(remainingMs);
  const fracao = totalMs ? fracaoDecorrida(remainingMs, totalMs) : null;
  const totalMin = totalMs ? Math.round(totalMs / 60_000) : null;

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
            color: theme.colors.textOnHero,
            fontSize: reta ? 64 : typography.timerHero.fontSize,
            lineHeight: reta ? 68 : typography.timerHero.lineHeight,
            fontWeight: reta ? '800' : typography.timerHero.fontWeight,
          },
        ]}
        maxFontSizeMultiplier={1.3}
        importantForAccessibility="no"
      >
        {formatRemainingClock(remainingMs)}
      </Text>

      {fracao !== null && (
        <View
          style={[styles.trilho, { backgroundColor: theme.colors.bgHeroRaised }]}
          importantForAccessibility="no-hide-descendants"
        >
          <View
            style={[
              styles.preenchimento,
              {
                width: `${Math.round(fracao * 100)}%`,
                backgroundColor: theme.colors.textOnHeroFriction,
              },
            ]}
          />
        </View>
      )}

      <Text
        style={[styles.label, { color: theme.colors.textOnHeroSecondary }]}
        importantForAccessibility="no"
      >
        {formatRemainingShort(remainingMs)}
        {totalMin ? ` de ${totalMin} min` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing[3],
  },
  number: {
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  trilho: {
    alignSelf: 'stretch',
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  preenchimento: {
    height: '100%',
    borderRadius: radius.full,
  },
  label: {
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
    fontWeight: typography.callout.fontWeight,
    fontVariant: ['tabular-nums'],
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
  retry: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
  },
  retryLabel: {
    fontSize: typography.bodyStrong.fontSize,
    lineHeight: typography.bodyStrong.lineHeight,
    fontWeight: typography.bodyStrong.fontWeight,
  },
});
