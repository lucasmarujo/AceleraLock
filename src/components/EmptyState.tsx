import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  title: string;
  message: string;
  icon?: ReactNode;
  action?: ReactNode;
};

/**
 * docs/design-system.md §3.15. Tom convidativo, nao neutro-vazio: §3.23 exige
 * que toda tela declare o estado vazio, e "sem dados" dito de forma seca faz
 * parecer defeito do app quando e so comeco de historico.
 */
export function EmptyState({ title, message, icon, action }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {icon}
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.message, { color: theme.colors.textSecondary }]}>{message}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[4],
  },
  title: {
    fontSize: typography.title3.fontSize,
    lineHeight: typography.title3.lineHeight,
    fontWeight: typography.title3.fontWeight,
    textAlign: 'center',
  },
  message: {
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
    textAlign: 'center',
  },
});
