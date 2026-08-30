import { Image, StyleSheet, Switch, Text, View } from 'react-native';

import type { InstalledApp } from '@/native/blocker';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  app: InstalledApp;
  marcado: boolean;
  onToggle: () => void;
};

export const APP_ROW_HEIGHT = 56;
const ICON_SIZE = 40;

/**
 * docs/design-system.md §3.8 (`AppListItem`) e §3.9 (`Toggle`): icone do app +
 * nome a esquerda, Switch nativo a direita, estado dito por accessibilityState
 * e nao so pela posicao do botao.
 *
 * O icone chega como `file://` de um PNG que o nativo mantem em cache
 * (InstalledAppsResolver) — o JS nunca desenha Drawable nem carrega base64.
 *
 * Sai do `AppPickerScreen` porque a secao 4 do onboarding mostra a mesma linha
 * numa lista de 3 itens; duplicar o fallback de icone e o accessibilityState
 * era o caminho pra as duas listas divergirem em acessibilidade.
 */
export function AppListRow({ app, marcado, onToggle }: Props) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.linha,
        {
          backgroundColor: marcado ? theme.colors.bgBrandSubtle : theme.colors.bgSurface,
          borderColor: marcado ? theme.colors.borderBrand : theme.colors.borderDefault,
        },
      ]}
    >
      {app.iconUri ? (
        <Image
          source={{ uri: app.iconUri }}
          style={styles.icone}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      ) : (
        // Mesmo espaco reservado: lista que muda de alinhamento no meio e pior
        // do que lista sem icone nenhum.
        <View style={[styles.icone, { backgroundColor: theme.colors.bgSunken }]} />
      )}
      <Text style={[styles.rotulo, { color: theme.colors.textPrimary }]} numberOfLines={1}>
        {app.label}
      </Text>
      <Switch
        accessibilityRole="switch"
        accessibilityLabel={app.label}
        accessibilityState={{ checked: marcado }}
        value={marcado}
        onValueChange={onToggle}
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
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: APP_ROW_HEIGHT,
  },
  icone: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: radius.sm,
  },
  rotulo: {
    flex: 1,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
});
