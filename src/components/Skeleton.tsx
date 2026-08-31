import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { LOCAIS_SHIMMER, VARREDURA_MS, paradasShimmer } from '@/components/skeletonShimmer';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  width: number | `${number}%`;
  height: number;
};

/**
 * docs/design-system.md §3.16. O tom do shimmer e o mesmo ja fixado em §3.4
 * pra overlay do Android: nao e urgencia, e ambiente — varredura lenta e
 * continua, sem piscar e sem acelerar, e desligada sob reduce-motion.
 *
 * Tres decisoes que contrariam o default do projeto, de proposito:
 *
 * - `Easing.linear` e nao `easing.standard`: bezier acelera e desacelera em
 *   cada volta, e num looping isso vira pulso — o "sem acelerar" de §3.4.
 * - `VARREDURA_MS` e nao `duration.slow`: ver o comentario em
 *   `skeletonShimmer.ts`.
 * - Destaque sai de `bgShimmer` e nao de `bgSurface`: medido no device, o par
 *   `bgSunken`/`bgSurface` no escuro da 8 passos de luma em 255 e a varredura
 *   nao aparece. O token novo e so de UI, nao entra no `colors.xml` nativo.
 */
export function Skeleton({ width, height }: Props) {
  const theme = useTheme();
  const reduzido = useReducedMotion();
  const [largura, setLargura] = useState(0);
  const progresso = useSharedValue(0);

  useEffect(() => {
    if (reduzido || largura === 0) {
      return;
    }
    progresso.value = 0;
    progresso.value = withRepeat(
      withTiming(1, { duration: VARREDURA_MS, easing: Easing.linear }),
      -1
    );
  }, [largura, progresso, reduzido]);

  const estilo = useAnimatedStyle(() => ({
    transform: [{ translateX: -largura + progresso.value * 2 * largura }],
  }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={({ nativeEvent }) => setLargura(nativeEvent.layout.width)}
      style={[
        styles.base,
        { width, height, backgroundColor: theme.colors.bgSunken, borderRadius: radius.sm },
      ]}
    >
      {!reduzido && largura > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, estilo]}>
          <LinearGradient
            colors={paradasShimmer(theme.colors.bgShimmer)}
            locations={[...LOCAIS_SHIMMER]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
