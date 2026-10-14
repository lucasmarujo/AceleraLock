import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { brand, radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type Segmento<T extends string> = {
  valor: T;
  rotulo: string;
  contador?: number;
};

type Props<T extends string> = {
  segmentos: Segmento<T>[];
  valor: T;
  onChange: (valor: T) => void;
  accessibilityLabel: string;
  /** Visto antes do rotulo selecionado (escolha de tema), alem do fundo. */
  marcarSelecionado?: boolean;
};

/**
 * Escolha entre poucas opcoes irmas (Apps/Sites, tema). O selecionado e dito
 * por fundo + peso do rotulo + `selected` pro leitor de tela — nunca so cor.
 */
export function SegmentedControl<T extends string>({
  segmentos,
  valor,
  onChange,
  accessibilityLabel,
  marcarSelecionado = false,
}: Props<T>) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.trilho,
        { backgroundColor: theme.colors.bgSunken, borderColor: theme.colors.borderSunken },
      ]}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {segmentos.map((segmento) => {
        const ativo = segmento.valor === valor;
        return (
          <Pressable
            key={segmento.valor}
            accessibilityRole="tab"
            accessibilityState={{ selected: ativo }}
            accessibilityLabel={
              segmento.contador === undefined
                ? segmento.rotulo
                : `${segmento.rotulo}, ${segmento.contador}`
            }
            onPress={() => onChange(segmento.valor)}
            style={[
              styles.segmento,
              ativo && [
                styles.segmentoAtivo,
                {
                  backgroundColor: theme.colors.bgSurface,
                  borderColor: theme.colors.borderSunken,
                },
              ],
            ]}
          >
            {marcarSelecionado && ativo && (
              <Ionicons name="checkmark" size={16} color={theme.colors.textPrimary} />
            )}
            <Text
              style={[
                styles.rotulo,
                {
                  color: ativo ? theme.colors.textPrimary : theme.colors.textSecondary,
                  fontWeight: ativo ? typography.bodyStrong.fontWeight : '500',
                },
              ]}
              numberOfLines={1}
            >
              {segmento.rotulo}
            </Text>
            {segmento.contador !== undefined && (
              <View
                style={[
                  styles.contador,
                  {
                    backgroundColor: ativo
                      ? theme.colors.bgBrandSubtle
                      : theme.colors.borderDefault,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.rotuloContador,
                    { color: ativo ? theme.colors.textBrand : theme.colors.textSecondary },
                  ]}
                >
                  {segmento.contador}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  trilho: {
    flexDirection: 'row',
    padding: spacing[1] - 1,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  segmento: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1] + 2,
    borderRadius: radius.sm + 1,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentoAtivo: {
    shadowColor: brand.tema,
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  rotulo: {
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
  },
  contador: {
    minWidth: 22,
    paddingVertical: 1,
    paddingHorizontal: 7,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  rotuloContador: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: '700',
  },
});
