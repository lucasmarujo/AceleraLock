import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  /** Conteudo entre o texto e a acao (ex.: o que fica liberado). */
  children?: ReactNode;
  action?: ReactNode;
  /** Linha de apoio sob a acao, dizendo o custo dela. */
  caption?: string;
};

/**
 * Layout comum das telas de veredito fora do caminho principal (pausado, nao
 * suportado, rota inexistente): estado, nao alarme. Toda cor vem do tema — as
 * versoes antigas tinham cor fixa e sumiam no escuro.
 */
export function TelaDeEstado({ icon, title, message, children, action, caption }: Props) {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bgCanvas }]}>
      <View style={styles.espaco} />
      <View style={styles.estado}>
        <View style={[styles.circulo, { backgroundColor: theme.colors.bgSunken }]}>
          <Ionicons name={icon} size={36} color={theme.colors.textSecondary} />
        </View>
        <Text
          accessibilityRole="header"
          style={[styles.titulo, { color: theme.colors.textPrimary }]}
        >
          {title}
        </Text>
        <Text style={[styles.mensagem, { color: theme.colors.textSecondary }]}>{message}</Text>
      </View>
      {children && <View style={styles.extra}>{children}</View>}
      <View style={styles.espaco} />
      {(action || caption) && (
        <View style={styles.acao}>
          {action}
          {caption && (
            <Text style={[styles.legenda, { color: theme.colors.textTertiary }]}>{caption}</Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  espaco: {
    flex: 1,
  },
  estado: {
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: spacing[2],
  },
  circulo: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontWeight: typography.heading.fontWeight,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  mensagem: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    textAlign: 'center',
  },
  extra: {
    paddingTop: spacing[8],
  },
  acao: {
    alignItems: 'center',
    gap: spacing[2],
  },
  legenda: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
    textAlign: 'center',
  },
});
