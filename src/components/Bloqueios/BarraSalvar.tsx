import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { elevation, radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  titulo: string;
  detalhe: string;
  salvando: boolean;
  onSalvar: () => void;
};

/**
 * Aparece so quando ha alteracao pendente e diz qual — antes o "Salvar lista"
 * ficava fixo mesmo sem nada pra salvar. A gravacao continua no toque, nao a
 * cada interruptor: `setBlockedPackages` reescreve a politica e acorda o
 * servico.
 */
export function BarraSalvar({ titulo, detalhe, salvando, onSalvar }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.envoltorio}>
      <View
        style={[
          styles.barra,
          { backgroundColor: theme.colors.bgHero, borderColor: theme.colors.borderHero },
        ]}
        accessibilityLiveRegion="polite"
      >
        <View style={styles.textos}>
          <Text style={[styles.titulo, { color: theme.colors.textOnHero }]}>{titulo}</Text>
          <Text
            style={[styles.detalhe, { color: theme.colors.textOnHeroSecondary }]}
            numberOfLines={1}
          >
            {detalhe}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salvar alterações"
          accessibilityState={{ busy: salvando }}
          onPress={salvando ? undefined : onSalvar}
          style={({ pressed }) => [
            styles.botao,
            { backgroundColor: theme.colors.textOnHeroBrand, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          {salvando ? (
            <ActivityIndicator color={theme.colors.bgHero} />
          ) : (
            <Text style={[styles.rotuloBotao, { color: theme.colors.bgHero }]}>Salvar</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  envoltorio: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    // Paper: 10/18/10 sem borda. A borda (so visivel no escuro) come 1 de cada lado.
    paddingVertical: spacing[2] + 1,
    paddingLeft: spacing[4] + 1,
    paddingRight: spacing[2] + 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    ...elevation[2],
  },
  textos: {
    flex: 1,
    gap: 1,
  },
  titulo: {
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
    fontWeight: typography.bodyStrong.fontWeight,
  },
  detalhe: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
  botao: {
    minWidth: 92,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
    borderRadius: radius.md,
  },
  rotuloBotao: {
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
    fontWeight: '700',
  },
});
