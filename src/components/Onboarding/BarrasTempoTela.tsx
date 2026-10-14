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

type Dado = {
  rotulo: string;
  /** `null` = dia sem leitura: coluna tracejada, nunca barra zerada. */
  horas: number | null;
  /** A coluna de hoje, na cor da marca; as outras ficam neutras. */
  destaque?: boolean;
};

type Props = {
  dados: Dado[];
  /** So pro leitor de tela — o titulo visivel e de quem monta o cartao. */
  legenda: string;
  mostrarValor?: boolean;
  estimativaHoras?: number | null;
  /** `exemplo`: miniatura do onboarding — mais baixa, sem eixo nem estimativa. */
  variante?: 'completo' | 'exemplo';
};

type Medidas = { altura: number; largura: number; raio: number };

const MEDIDAS: Record<'completo' | 'exemplo', Medidas> = {
  completo: { altura: 112, largura: 36, raio: radius.sm },
  exemplo: { altura: 72, largura: 30, raio: 6 },
};

const ESCALONAMENTO_MS = 70;

/**
 * Piso visual de uma leitura curta: 4min num grafico de 6h dariam menos de um
 * pixel. Zero medido continua zero (sem barra) — ver `alturaDaBarra`.
 */
const ALTURA_MINIMA = 6;

/**
 * Tracos da linha da estimativa. Linha tracejada de verdade (`borderStyle:
 * 'dashed'`) num lado so e instavel no Android; tracos soltos desenham igual
 * nas duas plataformas.
 */
const TRACOS_DA_LINHA = 26;

function Barra({
  dado,
  maximo,
  indice,
  medidas,
}: {
  dado: Dado & { horas: number };
  maximo: number;
  indice: number;
  medidas: Medidas;
}) {
  const theme = useTheme();
  const reduzido = useReducedMotion();
  const progresso = useSharedValue(0);
  const alvo = alturaDaBarra(dado.horas, maximo, medidas.altura, ALTURA_MINIMA);

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
    <Animated.View
      style={[
        styles.barra,
        estilo,
        {
          maxWidth: medidas.largura,
          borderRadius: medidas.raio,
          backgroundColor: dado.destaque ? theme.colors.borderBrand : theme.colors.borderStrong,
        },
      ]}
    />
  );
}

/**
 * Grafico de barras do tempo de tela. Neutro por padrao, marca so em `destaque`
 * (hoje): a cor aponta pro dia que importa em vez de pintar a semana inteira.
 */
export function BarrasTempoTela({
  dados,
  legenda,
  mostrarValor = false,
  estimativaHoras = null,
  variante = 'completo',
}: Props) {
  const theme = useTheme();
  const medidas = MEDIDAS[variante];
  const exemplo = variante === 'exemplo';

  // A estimativa divide a escala com as leituras (ver `escalaDoGrafico`). O
  // preco e que uma estimativa muito acima do medido achata as barras — que e
  // exatamente o que essa pessoa precisa ver.
  const maximo = escalaDoGrafico(
    dados.flatMap((dado) => (dado.horas === null ? [] : [dado.horas])),
    estimativaHoras
  );
  const alturaEstimativa = exemplo
    ? 0
    : alturaDaBarra(estimativaHoras ?? 0, maximo, medidas.altura);
  const mostrarEstimativa = alturaEstimativa > 0;

  return (
    <View
      style={styles.caixa}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${legenda}. ${dados
        .map(
          (dado) =>
            `${dado.rotulo}: ${dado.horas === null ? 'sem leitura' : descreverDuracao(dado.horas * 3600)}`
        )
        .join(', ')}${
        mostrarEstimativa
          ? `. Você estimou ${descreverDuracao((estimativaHoras ?? 0) * 3600)} por dia`
          : ''
      }`}
    >
      <View style={[styles.grade, { height: medidas.altura }]}>
        {dados.map((dado, indice) => (
          <View
            key={`${dado.rotulo}-${indice}`}
            style={[styles.coluna, { height: medidas.altura, width: medidas.largura }]}
          >
            {dado.horas === null ? (
              <View
                style={[
                  styles.semLeitura,
                  {
                    height: medidas.altura,
                    maxWidth: medidas.largura,
                    borderRadius: medidas.raio,
                    borderColor: theme.colors.borderStrong,
                  },
                ]}
              />
            ) : (
              <Barra
                dado={{ ...dado, horas: dado.horas }}
                maximo={maximo}
                indice={indice}
                medidas={medidas}
              />
            )}
          </View>
        ))}

        {mostrarEstimativa && (
          <View
            pointerEvents="none"
            style={[styles.linhaEstimativa, { top: medidas.altura - alturaEstimativa }]}
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

      {!exemplo && (
        <View style={styles.eixos}>
          {dados.map((dado, indice) => (
            <View
              key={`${dado.rotulo}-eixo-${indice}`}
              style={[styles.eixo, { width: medidas.largura }]}
            >
              {mostrarValor && (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.valor,
                    {
                      color: dado.destaque
                        ? theme.colors.textBrand
                        : dado.horas === null
                          ? theme.colors.textTertiary
                          : theme.colors.textSecondary,
                      fontWeight: dado.destaque ? '700' : '400',
                    },
                  ]}
                >
                  {dado.horas === null ? '—' : formatarDuracaoCompacta(dado.horas * 3600)}
                </Text>
              )}
              <Text
                style={[
                  styles.rotulo,
                  {
                    color: dado.destaque ? theme.colors.textPrimary : theme.colors.textTertiary,
                    fontWeight: dado.destaque ? '700' : '500',
                  },
                ]}
              >
                {dado.rotulo}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: {
    alignSelf: 'stretch',
    gap: spacing[3],
  },
  // Colunas de largura fixa espalhadas (Paper): a primeira encosta na borda
  // esquerda e a ultima na direita, e o eixo usa a mesma largura por coluna.
  grade: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  coluna: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barra: {
    width: '100%',
  },
  semLeitura: {
    width: '100%',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  linhaEstimativa: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  traco: {
    width: 6,
    height: 2,
    borderRadius: 1,
  },
  eixos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eixo: {
    alignItems: 'center',
    gap: 2,
  },
  valor: {
    fontSize: 11,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
  rotulo: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
});
