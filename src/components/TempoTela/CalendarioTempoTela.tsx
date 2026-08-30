import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import {
  descreverDuracao,
  diasDoMes,
  espacosAntesDoPrimeiro,
  intensidadeDoDia,
  maiorLeitura,
  type DiaDoMes,
} from './tempoTela';

type Props = {
  /** Mes a exibir. */
  ancora: Date;
  leituras: { date: string; seconds: number }[];
};

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const CIRCULO = 34;

/**
 * Calendario do mes corrente: um circulo por dia, mais cheio quanto mais tempo
 * de tela.
 *
 * **Dia sem leitura fica vazio, nunca zerado.** E a mesma distincao que
 * `ProtectionLog` faz entre interrupcao imensuravel e interrupcao de duracao
 * zero: pintar de "usou pouco" um dia que ninguem mediu seria afirmar sobre o
 * passado anterior a instalacao. O historico nasce raso de proposito.
 *
 * A intensidade nunca e o unico indicador — o numero do dia esta sempre la, e o
 * leitor de tela recebe a duracao por extenso. Mesma regra do anel do
 * `Countdown` (§2.4).
 */
export function CalendarioTempoTela({ ancora, leituras }: Props) {
  const theme = useTheme();
  const dias = diasDoMes(ancora, leituras);
  const maximo = maiorLeitura(dias);
  const vazios = espacosAntesDoPrimeiro(ancora);

  return (
    <View style={styles.container}>
      <View style={styles.semana}>
        {SEMANA.map((letra, indice) => (
          <Text
            key={indice}
            style={[styles.cabecalho, { color: theme.colors.textTertiary }]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {letra}
          </Text>
        ))}
      </View>

      <View style={styles.grade}>
        {Array.from({ length: vazios }, (_, indice) => (
          <View key={`vazio-${indice}`} style={styles.celula} />
        ))}
        {dias.map((dia) => (
          <Dia key={dia.data} dia={dia} maximo={maximo} />
        ))}
      </View>
    </View>
  );
}

function Dia({ dia, maximo }: { dia: DiaDoMes; maximo: number }) {
  const theme = useTheme();
  const intensidade = intensidadeDoDia(dia.segundos, maximo);

  // Sem leitura: so a borda, sem preenchimento. Com leitura: opacidade da marca
  // com piso, pra um dia medido de uso baixo nao sumir dentro do fundo.
  const preenchimento =
    intensidade === null ? 'transparent' : theme.colors.borderBrand;
  const opacidade = intensidade === null ? 0 : 0.2 + intensidade * 0.8;

  return (
    <View style={styles.celula}>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={
          dia.segundos === null
            ? `Dia ${dia.numero}, sem medicao`
            : `Dia ${dia.numero}, ${descreverDuracao(dia.segundos)}`
        }
        style={[
          styles.circulo,
          {
            borderColor: theme.colors.borderDefault,
            borderWidth: intensidade === null ? 1 : 0,
          },
        ]}
      >
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.preenchimento,
            { backgroundColor: preenchimento, opacity: opacidade },
          ]}
        />
        <Text style={[styles.numero, { color: theme.colors.textPrimary }]}>{dia.numero}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    gap: spacing[2],
  },
  semana: {
    flexDirection: 'row',
  },
  cabecalho: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: typography.caption.fontWeight,
  },
  grade: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing[2],
  },
  celula: {
    width: `${100 / 7}%`,
    alignItems: 'center',
  },
  circulo: {
    width: CIRCULO,
    height: CIRCULO,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  preenchimento: {
    borderRadius: radius.full,
  },
  numero: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: typography.caption.fontWeight,
  },
});
