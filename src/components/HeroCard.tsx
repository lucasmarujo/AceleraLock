import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * O momento de tinta da tela (status da protecao, cronometro, oferta do modo
 * restrito). Um por tela: e o que diz "isto e o que importa aqui". As cores de
 * dentro vem de `textOnHero*`, nunca de `textPrimary`.
 */
export function HeroCard({ children, style }: Props) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.cartao,
        { backgroundColor: theme.colors.bgHero, borderColor: theme.colors.borderHero },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: {
    borderRadius: radius.xl,
    borderWidth: 1,
    // 19 + 1 de borda = os 20 do Paper; a borda so aparece no escuro.
    padding: spacing[5] - 1,
    gap: spacing[5],
  },
});
