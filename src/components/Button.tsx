import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';

import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { Surface, Theme } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'lg' | 'md';

type Props = {
  label: string;
  onPress: (event: GestureResponderEvent) => void | Promise<void>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /**
   * Sobrepoe `surfaces.brand` no variant primario. Existe pra tela que e uma
   * superficie de marca fixa (o degrade das boas-vindas), onde a inversao
   * clara/escura do sistema entregaria o par errado. Fora desse caso, nao usar.
   */
  surface?: Surface;
};

const HEIGHT: Record<ButtonSize, number> = { lg: 52, md: 44 };

function variantStyle(theme: Theme, variant: ButtonVariant, pressed: boolean, surface?: Surface) {
  switch (variant) {
    case 'primary': {
      const s = surface ?? theme.colors.surfaces.brand;
      return { backgroundColor: pressed ? s.pressedFill : s.fill, textColor: s.onFill, borderWidth: 0, borderColor: 'transparent' };
    }
    case 'destructive': {
      const s = theme.colors.surfaces.danger;
      return { backgroundColor: pressed ? s.pressedFill : s.fill, textColor: s.onFill, borderWidth: 0, borderColor: 'transparent' };
    }
    case 'secondary':
      return {
        backgroundColor: 'transparent',
        textColor: theme.colors.textPrimary,
        borderWidth: 1,
        borderColor: theme.colors.borderStrong,
      };
    case 'ghost':
      return { backgroundColor: 'transparent', textColor: theme.colors.textBrand, borderWidth: 0, borderColor: 'transparent' };
  }
}

/**
 * docs/design-system.md §3.1. Rótulo diz a ação ("Salvar alterações", nunca
 * "OK") — decisão de copy de quem chama, este componente só desenha.
 */
export function Button({ label, onPress, variant = 'primary', size = 'lg', disabled = false, loading = false, surface }: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const isDisabled = disabled || loading;

  return (
    <View
      style={[
        styles.focusRing,
        // size 'lg' e full-width (design-system.md 3.1) e o Pressable pede width
        // '100%' — que so resolve se este wrapper tiver largura propria. Os
        // containers de tela usam alignItems 'center': sem o stretch, o wrapper
        // encolhe pro conteudo e o rotulo sai do lugar dentro do botao.
        size === 'lg' && styles.stretch,
        { borderRadius: radius.md + 4 },
        focused && { borderColor: theme.colors.focusRing },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        onPress={isDisabled ? undefined : onPress}
        disabled={isDisabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        style={({ pressed }) => {
          const v = variantStyle(theme, variant, pressed, surface);
          return [
            styles.base,
            {
              height: HEIGHT[size],
              width: size === 'lg' ? '100%' : undefined,
              borderRadius: radius.md,
              backgroundColor: v.backgroundColor,
              borderWidth: v.borderWidth,
              borderColor: v.borderColor,
              opacity: isDisabled && !loading ? 0.4 : pressed && v.borderWidth > 0 ? 0.92 : 1,
            },
          ];
        }}
      >
        {({ pressed }) => {
          const v = variantStyle(theme, variant, pressed, surface);
          return (
            <>
              <Text style={[styles.label, { color: v.textColor, opacity: loading ? 0 : 1 }]} numberOfLines={1}>
                {label}
              </Text>
              {loading && (
                <View style={styles.spinner} pointerEvents="none">
                  <ActivityIndicator color={v.textColor} />
                </View>
              )}
            </>
          );
        }}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  focusRing: {
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 2,
  },
  stretch: {
    alignSelf: 'stretch',
  },
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  label: {
    fontSize: typography.bodyStrong.fontSize,
    lineHeight: typography.bodyStrong.lineHeight,
    fontWeight: typography.bodyStrong.fontWeight,
  },
  spinner: {
    position: 'absolute',
  },
});
