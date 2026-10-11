import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { IconeApp } from '@/components/IconeApp';
import type { InstalledApp } from '@/native/blocker';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  app: InstalledApp;
  marcado: boolean;
  onToggle: () => void;
  /**
   * `switch` na aba Bloqueios (liga/desliga o bloqueio de um app ja escolhido);
   * `check` no onboarding (escolha numa lista).
   */
  variante?: 'switch' | 'check';
  /** Estado por extenso sob o nome ("Bloqueado", "Bloqueia ao salvar"). */
  legenda?: string | null;
  disabled?: boolean;
};

export const APP_ROW_HEIGHT = 60;
const ICON_SIZE = 40;

/**
 * docs/design-system.md §3.8. Uma linha por app, sem cartao proprio — vive
 * dentro de `Grupo`. Linha marcada no modo `check` ganha fundo de marca; o
 * estado vai tambem em texto e no `accessibilityState`, nunca so na cor.
 */
export function AppListRow({
  app,
  marcado,
  onToggle,
  variante = 'switch',
  legenda,
  disabled = false,
}: Props) {
  const theme = useTheme();
  const destacado = variante === 'check' && marcado;

  const textos = (
    <View style={styles.textos}>
      <Text style={[styles.rotulo, { color: theme.colors.textPrimary }]} numberOfLines={1}>
        {app.label}
      </Text>
      {legenda && (
        <Text
          style={[
            styles.legenda,
            { color: marcado ? theme.colors.textBrand : theme.colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          {legenda}
        </Text>
      )}
    </View>
  );

  if (variante === 'check') {
    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={app.label}
        accessibilityState={{ checked: marcado, disabled }}
        onPress={disabled ? undefined : onToggle}
        style={({ pressed }) => [
          styles.linha,
          destacado && { backgroundColor: theme.colors.bgBrandSubtle },
          pressed && !destacado && { backgroundColor: theme.colors.bgSunken },
        ]}
      >
        <IconeApp iconUri={app.iconUri} tamanho={ICON_SIZE} />
        {textos}
        <View
          style={[
            styles.check,
            marcado
              ? { backgroundColor: theme.colors.borderBrand, borderColor: theme.colors.borderBrand }
              : { borderColor: theme.colors.borderStrong },
          ]}
        >
          {marcado && <Ionicons name="checkmark" size={16} color={theme.colors.bgSurface} />}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.linha, disabled && styles.desabilitada]}>
      <IconeApp iconUri={app.iconUri} tamanho={ICON_SIZE} />
      {textos}
      <Switch
        accessibilityRole="switch"
        accessibilityLabel={app.label}
        accessibilityState={{ checked: marcado, disabled }}
        value={marcado}
        disabled={disabled}
        onValueChange={onToggle}
        trackColor={{ false: theme.colors.borderStrong, true: theme.colors.borderBrand }}
        thumbColor={marcado ? theme.colors.bgSurface : theme.colors.textSecondary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    minHeight: APP_ROW_HEIGHT,
  },
  desabilitada: {
    opacity: 0.55,
  },
  textos: {
    flex: 1,
    gap: 1,
  },
  rotulo: {
    fontSize: typography.body.fontSize,
    lineHeight: 22,
  },
  legenda: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
