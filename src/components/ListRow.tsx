import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  label: string;
  /** Linha de apoio sob o rotulo: para que serve, ou o estado por extenso. */
  description?: string;
  value?: string;
  icon?: ReactNode;
  accessory?: ReactNode;
  onPress?: () => void;
  emphasis?: 'default' | 'brand' | 'danger';
  selected?: boolean;
  /** Chevron quando o toque leva a outra tela. */
  chevron?: boolean;
};

const MIN_HEIGHT = 56;

/**
 * docs/design-system.md §3.19. Pensada pra viver dentro de `Grupo`: o padding
 * horizontal e da linha, nao do cartao, pra divisoria ir de ponta a ponta.
 */
export function ListRow({
  label,
  description,
  value,
  icon,
  accessory,
  onPress,
  emphasis = 'default',
  selected,
  chevron = false,
}: Props) {
  const theme = useTheme();
  const corDoValor = {
    default: theme.colors.textSecondary,
    brand: theme.colors.textBrand,
    danger: theme.colors.textDanger,
  }[emphasis];

  const conteudo = (
    <>
      {icon}
      <View style={styles.textos}>
        <Text style={[styles.label, { color: theme.colors.textPrimary }]} numberOfLines={2}>
          {label}
        </Text>
        {description && (
          <Text style={[styles.descricao, { color: theme.colors.textSecondary }]}>
            {description}
          </Text>
        )}
      </View>
      {value !== undefined && (
        <Text
          style={[styles.value, { color: corDoValor }, emphasis !== 'default' && styles.valueForte]}
          numberOfLines={1}
        >
          {value}
        </Text>
      )}
      {accessory}
      {chevron && <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />}
    </>
  );

  if (!onPress) {
    return <View style={styles.linha}>{conteudo}</View>;
  }

  return (
    <Pressable
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={description}
      onPress={onPress}
      style={({ pressed }) => [styles.linha, pressed && { backgroundColor: theme.colors.bgSunken }]}
    >
      {conteudo}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: MIN_HEIGHT,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  textos: {
    flex: 1,
    gap: 1,
  },
  label: {
    fontSize: typography.body.fontSize,
    lineHeight: 22,
  },
  descricao: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
  value: {
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
  },
  valueForte: {
    fontWeight: typography.bodyStrong.fontWeight,
  },
});
