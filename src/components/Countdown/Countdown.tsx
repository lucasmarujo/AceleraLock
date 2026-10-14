import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Skeleton } from '@/components/Skeleton';
import { spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import {
  angulosDoArco,
  formatRemainingClock,
  formatRemainingForScreenReader,
  formatRemainingShort,
  fracaoDecorrida,
  pontaDoArco,
  roundToAnnouncementBucket,
} from './countdownStatus';
import { useCountdown, type RemainingMsReader } from './useCountdown';

type Props = {
  readRemainingMs: RemainingMsReader;
  /**
   * Duracao total configurada, so pra desenhar o anel. Sem ela o anel nao
   * aparece — o numero e o rotulo bastam (§2.4: o anel nunca e o unico
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
 * `textOnHero*`. O anel é âmbar (atrito) e desenhado só com `View` — duas
 * metades recortadas girando —, sem puxar `react-native-svg` pra um traço só.
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

  const numero = (
    <View style={styles.centro} importantForAccessibility="no-hide-descendants">
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
      >
        {formatRemainingClock(remainingMs)}
      </Text>
      <Text style={[styles.restantes, { color: theme.colors.textOnHeroSecondary }]}>restantes</Text>
    </View>
  );

  return (
    <View
      style={styles.container}
      accessibilityRole="timer"
      accessibilityLiveRegion="polite"
      accessibilityLabel={formatRemainingForScreenReader(bucketedMs)}
    >
      {fracao === null ? (
        numero
      ) : (
        <Anel
          fracao={fracao}
          corDoTrilho={theme.colors.lineOnHero}
          corDoArco={theme.colors.textOnHeroFriction}
        >
          {numero}
        </Anel>
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

/** Caixa do anel, a espessura do traco e o raio da linha central (Paper: r=88). */
const CAIXA = 196;
const TRACO = 10;
const DIAMETRO = CAIXA - TRACO;
const RAIO_CENTRAL = (DIAMETRO - TRACO) / 2;

function Anel({
  fracao,
  corDoTrilho,
  corDoArco,
  children,
}: {
  fracao: number;
  corDoTrilho: string;
  corDoArco: string;
  children: ReactNode;
}) {
  const { direita, esquerda } = angulosDoArco(fracao);
  // Pontas arredondadas, como o `strokeLinecap="round"` do Paper.
  const inicio = pontaDoArco(0, RAIO_CENTRAL);
  const ponta = pontaDoArco(fracao, RAIO_CENTRAL);
  const circulo = { borderColor: corDoArco };

  return (
    <View style={styles.anel} importantForAccessibility="no-hide-descendants">
      <View style={[styles.circulo, styles.trilhoAnel, { borderColor: corDoTrilho }]} />
      {fracao > 0 && (
        <>
          <View style={[styles.metade, styles.metadeDireita]}>
            <View
              style={[
                styles.giro,
                { left: -DIAMETRO / 2, transform: [{ rotate: `${direita}deg` }] },
              ]}
            >
              <View style={[styles.metade, styles.recorteEsquerdo]}>
                <View style={[styles.circulo, circulo]} />
              </View>
            </View>
          </View>
          <View style={[styles.metade, styles.metadeEsquerda]}>
            <View style={[styles.giro, { left: 0, transform: [{ rotate: `${esquerda}deg` }] }]}>
              <View style={[styles.metade, styles.recorteDireito]}>
                <View style={[styles.circulo, circulo, { left: -DIAMETRO / 2 }]} />
              </View>
            </View>
          </View>
          {[inicio, ponta].map((centro, indice) => (
            <View
              key={indice}
              style={[
                styles.ponta,
                {
                  backgroundColor: corDoArco,
                  left: CAIXA / 2 + centro.x - TRACO / 2,
                  top: CAIXA / 2 + centro.y - TRACO / 2,
                },
              ]}
            />
          ))}
        </>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing[3] + 2,
  },
  number: {
    fontVariant: ['tabular-nums'],
    letterSpacing: typography.timerHero.letterSpacing,
  },
  centro: {
    alignItems: 'center',
    gap: 2,
  },
  restantes: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
  anel: {
    width: CAIXA,
    height: CAIXA,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circulo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: DIAMETRO,
    height: DIAMETRO,
    borderRadius: DIAMETRO / 2,
    borderWidth: TRACO,
  },
  trilhoAnel: {
    top: TRACO / 2,
    left: TRACO / 2,
  },
  metade: {
    position: 'absolute',
    top: 0,
    width: DIAMETRO / 2,
    height: DIAMETRO,
    overflow: 'hidden',
  },
  metadeDireita: {
    top: TRACO / 2,
    left: CAIXA / 2,
  },
  metadeEsquerda: {
    top: TRACO / 2,
    left: TRACO / 2,
  },
  recorteEsquerdo: {
    left: 0,
  },
  recorteDireito: {
    left: DIAMETRO / 2,
  },
  giro: {
    position: 'absolute',
    top: 0,
    width: DIAMETRO,
    height: DIAMETRO,
  },
  ponta: {
    position: 'absolute',
    width: TRACO,
    height: TRACO,
    borderRadius: TRACO / 2,
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
