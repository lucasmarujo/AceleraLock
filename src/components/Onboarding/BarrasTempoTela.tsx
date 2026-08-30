import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { duration, easing, radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Dado = { rotulo: string; horas: number };

type Props = {
  dados: Dado[];
  /** Fica sempre visivel — ver o comentario do componente. */
  legenda: string;
};

const ALTURA = 132;
const ESCALONAMENTO_MS = 70;

function Barra({ dado, maximo, indice }: { dado: Dado; maximo: number; indice: number }) {
  const theme = useTheme();
  const reduzido = useReducedMotion();
  const progresso = useSharedValue(0);
  const alvo = maximo > 0 ? (dado.horas / maximo) * ALTURA : 0;

  useEffect(() => {
    progresso.value = withDelay(
      reduzido ? 0 : indice * ESCALONAMENTO_MS,
      withTiming(1, {
        duration: reduzido ? duration.instant : duration.slow,
        easing: Easing.bezier(...easing.decelerate),
      })
    );
  }, [indice, progresso, reduzido]);

  const estilo = useAnimatedStyle(() => ({ height: progresso.value * alvo }));

  return (
    <View style={styles.coluna}>
      <View style={styles.trilho}>
        <Animated.View
          style={[styles.barra, estilo, { backgroundColor: theme.colors.borderBrand }]}
        />
      </View>
      <Text style={[styles.rotulo, { color: theme.colors.textTertiary }]}>{dado.rotulo}</Text>
    </View>
  );
}

/**
 * Barras verticais de tempo de tela. Os dados vem por prop e a `legenda` fica
 * sempre visivel porque hoje eles sao ilustrativos: o app nao le tempo de uso
 * (docs/decisao-modulos-nativos.md — "nao medimos tempo de tela, so
 * bloqueamos"). Uma tela que pede acesso ao uso e logo abaixo mostra numero
 * inventado, sem dizer que e exemplo, promete uma leitura que nao existe: a
 * legenda e o que separa "forma do dado" de "seu dado". Quando entrar leitura
 * real, troca-se a prop e a legenda — o componente nao muda.
 */
export function BarrasTempoTela({ dados, legenda }: Props) {
  const theme = useTheme();
  const maximo = Math.max(...dados.map((dado) => dado.horas), 1);

  return (
    <View
      style={[
        styles.caixa,
        { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${legenda}. ${dados
        .map((dado) => `${dado.rotulo}: ${dado.horas.toFixed(1)} horas`)
        .join(', ')}`}
    >
      <View style={styles.grade}>
        {dados.map((dado, indice) => (
          <Barra key={`${dado.rotulo}-${indice}`} dado={dado} maximo={maximo} indice={indice} />
        ))}
      </View>
      <Text style={[styles.legenda, { color: theme.colors.textTertiary }]}>{legenda}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[3],
  },
  grade: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  coluna: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[2],
  },
  trilho: {
    height: ALTURA,
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
  },
  barra: {
    borderRadius: radius.sm,
  },
  rotulo: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: typography.caption.fontWeight,
  },
  legenda: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
    textAlign: 'center',
  },
});
