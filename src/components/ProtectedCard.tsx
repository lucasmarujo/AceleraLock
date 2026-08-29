import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Skeleton } from '@/components/Skeleton';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  title: string;
  subtitle?: string;
  streakLabel?: string;
  /** Sem lib de ícone instalada ainda — quem chama passa o que tiver. */
  icon?: ReactNode;
  loading?: boolean;
};

/**
 * docs/design-system.md §3.3. Tom recompensador, não punitivo — nunca "você
 * tentou abrir X vezes". Estado `empty` não é deste componente: chamar
 * EmptyState quando não houver nada bloqueado.
 *
 * ponytail: sem a "respiração" do ícone (§3.3, escala 1.0→1.03 em 4s) —
 * decorativo, precisaria de reanimated + checar reduce-motion, e o cartão
 * comunica "protegido" sem ela. Adicionar se o produto pedir o polish.
 */
export function ProtectedCard({ title, subtitle, streakLabel, icon, loading = false }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.bgBrandSubtle, borderRadius: radius.lg }]}>
      {icon}
      {loading ? (
        <>
          <Skeleton width="70%" height={typography.title3.lineHeight} />
          <Skeleton width="40%" height={typography.callout.lineHeight} />
        </>
      ) : (
        <>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
          {subtitle && <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>}
          {streakLabel && <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{streakLabel}</Text>}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing[4],
    gap: spacing[1],
  },
  title: {
    fontSize: typography.title3.fontSize,
    lineHeight: typography.title3.lineHeight,
    fontWeight: typography.title3.fontWeight,
  },
  subtitle: {
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
    fontWeight: typography.callout.fontWeight,
  },
});
