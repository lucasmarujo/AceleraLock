import { LinearGradient } from 'expo-linear-gradient';
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

import {
  alturaDaBarra,
  descreverDuracao,
  escalaDoGrafico,
  formatarDuracaoCompacta,
} from '@/components/TempoTela/tempoTela';
import { duration, easing, radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Dado = { rotulo: string; horas: number };

type Props = {
  dados: Dado[];
  /** Fica sempre visivel — ver o comentario do componente. */
  legenda: string;
  /**
   * Escreve a duracao sob cada barra. Fica de fora por padrao: nas barras de
   * exemplo do onboarding, cravar "3h 12min" daria ao numero inventado a mesma
   * assertividade de um dado medido.
   */
  mostrarValor?: boolean;
  /**
   * Horas por dia que a pessoa estimou na secao 2 do onboarding
   * (`readDailyHours`), desenhadas como linha de referencia. `null` some com a
   * linha — quem nunca estimou nao ganha regua inventada.
   *
   * Nao e passada no onboarding de proposito: ali as barras sao exemplo, e
   * cruzar a estimativa *real* com dado inventado montaria uma comparacao
   * falsa. So a home, que le do aparelho, tem os dois lados verdadeiros.
   */
  estimativaHoras?: number | null;
};

const ALTURA = 132;
const ESCALONAMENTO_MS = 70;

/** Ver `alturaDaBarra`: piso pra leitura curta nao virar risco de 1px. */
const ALTURA_MINIMA = 6;

/**
 * Mais larga que isto a barra vira bloco e a capsula do topo some. A coluna
 * continua com a largura toda — quem estreita e so a barra, centrada nela.
 */
const LARGURA_MAXIMA = 22;

/**
 * Tracos da linha da estimativa. Desenhada em pedacos e nao com
 * `borderStyle: 'dashed'`, que o Android ignora quando so um lado tem borda.
 */
const TRACOS_DA_LINHA = 22;

/**
 * Volume no pe da barra. Escurece e nunca clareia: no tema claro a barra e
 * `borderBrand` sobre branco a 3,58:1, e clarear levaria o elemento grafico
 * abaixo do piso de 3:1 (§4). Escurecer so aumenta a relacao no claro, e no
 * escuro sobra folga (8,12:1).
 *
 * A ponta transparente e preto com alfa 00, e nao `'transparent'`, pelo mesmo
 * motivo de `paradasShimmer`: interpolar a partir de outra cor deixa franja.
 */
const SOMBRA_DA_BASE = ['#00000000', '#00000033'] as const;

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
  const alvo = alturaDaBarra(dado.horas, maximo, ALTURA, ALTURA_MINIMA);

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
      <View style={[styles.trilho, { backgroundColor: theme.colors.bgSunken }]}>
        <Animated.View
          style={[styles.barra, estilo, { backgroundColor: theme.colors.borderBrand }]}
        >
          <LinearGradient colors={SOMBRA_DA_BASE} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>

      <View style={styles.eixo}>
        {mostrarValor && (
          <Text numberOfLines={1} style={[styles.valor, { color: theme.colors.textSecondary }]}>
            {formatarDuracaoCompacta(dado.horas * 3600)}
          </Text>
        )}
        <Text style={[styles.rotulo, { color: theme.colors.textTertiary }]}>{dado.rotulo}</Text>
      </View>
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
 *   de "seu dado", e o valor fica de fora pra o numero inventado nao ganhar a
 *   assertividade de um medido.
 *
 * A duracao mora sob a barra, nunca dentro dela: dentro, ela so cabia nas
 * barras altas e pulava pra fora nas curtas — o mesmo dado mudava de lugar de
 * um dia pro outro. Embaixo, valor e dia formam uma linha de eixo so, e o topo
 * da barra fica livre pra capsula.
 */
export function BarrasTempoTela({
  dados,
  legenda,
  mostrarValor = false,
  estimativaHoras = null,
}: Props) {
  const theme = useTheme();

  // A estimativa divide a escala com as leituras (ver `escalaDoGrafico`). O
  // preco e que uma estimativa muito acima do medido achata as barras — que e
  // exatamente o que essa pessoa precisa ver.
  const maximo = escalaDoGrafico(
    dados.map((dado) => dado.horas),
    estimativaHoras
  );
  const alturaEstimativa = alturaDaBarra(estimativaHoras ?? 0, maximo, ALTURA);
  const mostrarEstimativa = alturaEstimativa > 0;

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
        .join(', ')}${
        mostrarEstimativa
          ? `. Você estimou ${descreverDuracao((estimativaHoras ?? 0) * 3600)} por dia`
          : ''
      }`}
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

        {mostrarEstimativa && (
          <View
            pointerEvents="none"
            style={[styles.linhaEstimativa, { top: ALTURA - alturaEstimativa }]}
          >
            {Array.from({ length: TRACOS_DA_LINHA }, (_, indice) => (
              <View
                key={indice}
                style={[styles.traco, { backgroundColor: theme.colors.textTertiary }]}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.rodape}>
        <Text
          style={[
            styles.legenda,
            mostrarEstimativa && styles.legendaComEstimativa,
            { color: theme.colors.textTertiary },
          ]}
        >
          {legenda}
        </Text>
        {mostrarEstimativa && (
          <Text style={[styles.rotuloEstimativa, { color: theme.colors.textTertiary }]}>
            Você estimou {formatarDuracaoCompacta((estimativaHoras ?? 0) * 3600)}
          </Text>
        )}
      </View>
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
    alignItems: 'flex-start',
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
    width: '100%',
    maxWidth: LARGURA_MAXIMA,
    justifyContent: 'flex-end',
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  // Capsula so no topo: a base e o zero da escala e fica reta. O arredondamento
  // de baixo quem da e a trilha, que recorta.
  barra: {
    borderTopLeftRadius: radius.full,
    borderTopRightRadius: radius.full,
    overflow: 'hidden',
  },
  linhaEstimativa: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  traco: {
    width: 5,
    height: 1,
  },
  eixo: {
    alignItems: 'center',
    gap: spacing[1],
  },
  valor: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  rotulo: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: typography.caption.fontWeight,
  },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  legenda: {
    flex: 1,
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
    textAlign: 'center',
  },
  legendaComEstimativa: {
    textAlign: 'left',
  },
  rotuloEstimativa: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
    fontVariant: ['tabular-nums'],
  },
});
