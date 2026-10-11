import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
};

/**
 * docs/design-system.md §3.11, variante `warning`: pendencia com solucao —
 * permissao revogada, servico desligado. Ambar, porque vermelho e so erro
 * (§0), e sempre com a acao que resolve quando ela existe.
 */
export function InlineAlert({
  title,
  message,
  actionLabel,
  onAction,
  icon = 'warning-outline',
}: Props) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.caixa,
        {
          backgroundColor: theme.colors.bgWarningSubtle,
          borderColor: theme.colors.borderWarning,
        },
      ]}
      accessibilityRole="alert"
    >
      <Ionicons name={icon} size={22} color={theme.colors.textWarning} />
      <View style={styles.conteudo}>
        <View style={styles.textos}>
          <Text style={[styles.titulo, { color: theme.colors.textWarning }]}>{title}</Text>
          {message && (
            <Text style={[styles.mensagem, { color: theme.colors.textWarning }]}>{message}</Text>
          )}
        </View>
        {actionLabel && onAction && (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={({ pressed }) => [
              styles.acao,
              {
                backgroundColor: pressed
                  ? theme.colors.surfaces.brand.pressedFill
                  : theme.colors.surfaces.brand.fill,
              },
            ]}
          >
            <Text style={[styles.rotuloAcao, { color: theme.colors.surfaces.brand.onFill }]}>
              {actionLabel}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    paddingVertical: spacing[3] + 2,
    paddingLeft: spacing[4],
    paddingRight: spacing[3] + 2,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  conteudo: {
    flex: 1,
    gap: spacing[2] + 2,
  },
  textos: {
    gap: 2,
  },
  titulo: {
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
    fontWeight: typography.bodyStrong.fontWeight,
  },
  mensagem: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
  acao: {
    alignSelf: 'flex-start',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing[3] + 2,
    borderRadius: radius.sm,
  },
  rotuloAcao: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
    fontWeight: typography.bodyStrong.fontWeight,
  },
});
