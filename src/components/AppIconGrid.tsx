import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { InstalledApp } from '@/native/blocker';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  apps: InstalledApp[];
  onPress?: () => void;
  /** Acima disso, o excedente vira "+N" em vez de estourar a linha. */
  max?: number;
};

const ICON = 44;

/**
 * So os icones dos apps bloqueados, sem rotulo. E um relance: quem quer ler
 * nome e mexer na lista toca e vai pra tela de selecao, que ja existe.
 *
 * O rotulo de acessibilidade lista os nomes, porque a grade sem texto e
 * exatamente o tipo de componente que some pro leitor de tela.
 */
export function AppIconGrid({ apps, onPress, max = 8 }: Props) {
  const theme = useTheme();
  const visiveis = apps.slice(0, max);
  const excedente = apps.length - visiveis.length;

  const corpo = (
    <View style={styles.grade}>
      {visiveis.map((app) =>
        app.iconUri ? (
          <Image
            key={app.packageName}
            source={{ uri: app.iconUri }}
            style={styles.icone}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View
            key={app.packageName}
            style={[styles.icone, { backgroundColor: theme.colors.bgSunken }]}
          />
        )
      )}
      {excedente > 0 && (
        <View style={[styles.excedente, { backgroundColor: theme.colors.bgSunken }]}>
          <Text style={[styles.excedenteTexto, { color: theme.colors.textSecondary }]}>
            +{excedente}
          </Text>
        </View>
      )}
    </View>
  );

  const rotulo =
    apps.length === 0
      ? 'Nenhum app bloqueado'
      : `${apps.length} ${apps.length === 1 ? 'app bloqueado' : 'apps bloqueados'}: ${apps
          .map((app) => app.label)
          .join(', ')}`;

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={rotulo}>
        {corpo}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityHint="Abre a lista para escolher os apps bloqueados"
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressionado}
    >
      {corpo}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grade: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  icone: {
    width: ICON,
    height: ICON,
    borderRadius: radius.sm,
  },
  excedente: {
    width: ICON,
    height: ICON,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  excedenteTexto: {
    fontSize: typography.callout.fontSize,
    fontWeight: typography.bodyStrong.fontWeight,
  },
  pressionado: {
    opacity: 0.7,
  },
});
