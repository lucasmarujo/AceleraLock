import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs, useFocusEffect, useRouter } from 'expo-router';

import AceleralockBlocker from '@/native/blocker';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Altura da barra sem o inset de baixo. Comporta o indicador de 32 do item
 * ativo (Material 3) mais o rotulo: menos que isso e o rotulo corta.
 */
const ALTURA_BARRA = 64;

/**
 * Folga entre o rotulo e a borda inferior. Sem ela, em aparelho com navegacao
 * por gestos o inset e pequeno e o rotulo fica colado na barra do sistema.
 */
const RESPIRO = 5;

type IconeDaAba = {
  ativo: keyof typeof Ionicons.glyphMap;
  inativo: keyof typeof Ionicons.glyphMap;
};

/**
 * Tres destinos desde o redesign (2026-10-11, docs/decisoes.md): Bloqueios
 * deixou de ser tela empilhada aberta por botoes da Inicio e virou aba —
 * e o que o app faz, e o modo restrito mora la, junto da lista que ele trava.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Sobe do antigo (protected)/index.tsx: o desvio vale para todas as abas, nao
  // so pra home. Quem tem pedido pendente nao fica navegando pelo app como se
  // nada estivesse em curso.
  useFocusEffect(
    useCallback(() => {
      AceleralockBlocker.start();
      if (AceleralockBlocker.protectionState().pendingTarget) {
        router.replace('/esperando');
      }
    }, [router])
  );

  const icone = ({ ativo, inativo }: IconeDaAba) =>
    function IconeDaAbaComFoco({ focused }: { focused: boolean }) {
      return (
        <View
          style={[styles.indicador, focused && { backgroundColor: theme.colors.bgBrandSubtle }]}
        >
          <Ionicons
            name={focused ? ativo : inativo}
            size={22}
            color={focused ? theme.colors.textBrand : theme.colors.textTertiary}
          />
        </View>
      );
    };

  const rotulo = ({ focused, children }: { focused: boolean; children: string }) => (
    <Text
      style={[
        styles.rotulo,
        {
          color: focused ? theme.colors.textPrimary : theme.colors.textSecondary,
          fontWeight: focused ? '700' : '500',
        },
      ]}
    >
      {children}
    </Text>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarLabel: rotulo,
        tabBarStyle: {
          backgroundColor: theme.colors.bgSurface,
          borderTopColor: theme.colors.borderDefault,
          // O inset entra na conta a mao porque estamos sobrescrevendo a altura:
          // so `paddingBottom` deixaria o rotulo pra fora da barra.
          height: ALTURA_BARRA + insets.bottom + RESPIRO,
          paddingBottom: insets.bottom + RESPIRO,
          paddingTop: spacing[3],
        },
        tabBarItemStyle: styles.item,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: icone({ ativo: 'home', inativo: 'home-outline' }),
        }}
      />
      <Tabs.Screen
        name="bloqueios"
        options={{
          title: 'Bloqueios',
          tabBarIcon: icone({ ativo: 'shield-checkmark', inativo: 'shield-outline' }),
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: icone({ ativo: 'options', inativo: 'options-outline' }),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  item: {
    gap: spacing[1],
  },
  indicador: {
    width: 64,
    height: 32,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotulo: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
});
