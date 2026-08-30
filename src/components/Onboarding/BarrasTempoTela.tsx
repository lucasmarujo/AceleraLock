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

import { descreverDuracao, formatarDuracao } from '@/components/TempoTela/tempoTela';
import { duration, easing, radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Dado = { rotulo: string; horas: number };

type Props = {
  dados: Dado[];
  /** Fica sempre visivel — ver o comentario do componente. */
  legenda: string;
  /**
   * Escreve a duracao na propria barra. Fica de fora por padrao: nas barras de
   * exemplo do onboarding, cravar "3h 12min" daria ao numero inventado a mesma
   * assertividade de um dado medido.
   */
  mostrarValor?: boolean;
};

const ALTURA = 132;
const ESCALONAMENTO_MS = 70;

/**
 * Abaixo disso a barra nao comporta as duas linhas do rotulo, que entao sobe
 * pra cima dela. Texto espremido pra fora do proprio retangulo e pior do que
 * texto ao lado.
 */
const ALTURA_MINIMA_PRO_VALOR = 36;

function Barra({
  dado,
  maximo,
  indice,
  mostrarValor,
}: {
  dado: Dado;
  maximo: number;
  indice: number;
  mostrarValor: boolean;
}) {
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

  // Com texto por cima, a barra deixa de ser so indicador e vira superficie de
  // conteudo: o par vem de `surfaces.brand`, que e o unico do sistema com
  // contraste medido (8,52:1) e que ja inverte sozinho entre os temas.
  const preenchimento = mostrarValor
    ? theme.colors.surfaces.brand.fill
    : theme.colors.borderBrand;

  const valor = formatarDuracao(dado.horas * 3600);
  const cabeDentro = alvo >= ALTURA_MINIMA_PRO_VALOR;

  return (
    <View style={styles.coluna}>
      <View style={styles.trilho}>
        {mostrarValor && !cabeDentro && dado.horas > 0 && (
          <Text style={[styles.valorFora, { color: theme.colors.textSecondary }]}>{valor}</Text>
        )}
        <Animated.View style={[styles.barra, estilo, { backgroundColor: preenchimento }]}>
          {mostrarValor && cabeDentro && (
            <Text style={[styles.valorDentro, { color: theme.colors.surfaces.brand.onFill }]}>
              {valor}
            </Text>
          )}
        </Animated.View>
      </View>
      <Text style={[styles.rotulo, { color: theme.colors.textTertiary }]}>{dado.rotulo}</Text>
    </View>
  );
}

/**
 * Barras verticais de tempo de tela, usadas em dois contextos com dados de
 * origens diferentes — e por isso `dados` e `legenda` vem sempre de fora:
 *
 * - **Home:** leitura real (`screenTimeSummary`), com `mostrarValor`.
 * - **Secao 3 do onboarding:** exemplo, porque ela roda *antes* de a permissao
 *   existir e ali nao ha o que medir. A legenda e o que separa "forma do dado"
 *   de "seu dado", e o valor fica fora da barra pra o numero inventado nao
 *   ganhar a assertividade de um medido.
 */
export function BarrasTempoTela({ dados, legenda, mostrarValor = false }: Props) {
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
        .map((dado) => `${dado.rotulo}: ${descreverDuracao(dado.horas * 3600)}`)
        .join(', ')}`}
    >
      <View style={styles.grade}>
        {dados.map((dado, indice) => (
          <Barra
            key={`${dado.rotulo}-${indice}`}
            dado={dado}
            maximo={maximo}
            indice={indice}
            mostrarValor={mostrarValor}
          />
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
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing[1],
    overflow: 'hidden',
  },
  // 11/13 e nao `caption` (12/16): duas linhas de caption nao cabem numa barra
  // curta, e o rotulo quebra sozinho no espaco de "4h 12min".
  valorDentro: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: typography.caption.fontWeight,
    textAlign: 'center',
  },
  valorFora: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: typography.caption.fontWeight,
    textAlign: 'center',
    marginBottom: spacing[1],
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
