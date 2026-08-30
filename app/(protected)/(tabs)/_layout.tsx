import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs, useFocusEffect, useRouter } from 'expo-router';

import AceleralockBlocker from '@/native/blocker';
import { spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Duas abas. O design system (§3.20) pede "3-4 destinos" — aqui sao dois, por
 * decisao de produto: o app faz uma coisa, e inventar um terceiro destino so
 * pra cumprir a faixa seria menu com item de enfeite. A linha da doc foi
 * atualizada junto, pra isto ser decisao registrada e nao desvio silencioso.
 *
 * Primeiro uso de `@expo/vector-icons` no projeto: a lib ja estava instalada e
 * nunca importada, e tab bar sem icone nao existe.
 */
/** Altura da barra sem contar a area de sistema embaixo. */
const ALTURA_BARRA = 56;

/**
 * Folga extra alem do inset do sistema. Sem ela a nossa barra encosta na barra
 * de navegacao do Android e as duas leem como uma faixa so — o gesto de voltar
 * fica a poucos pixels do rotulo "Perfil".
 */
const RESPIRO = 5;

export default function TabsLayout() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Sobe do antigo (protected)/index.tsx: o desvio vale para as duas abas, nao
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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.textBrand,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.bgSurface,
          borderTopColor: theme.colors.borderDefault,
          // O inset entra na conta a mao porque estamos sobrescrevendo a altura:
          // so `paddingBottom` deixaria o rotulo pra fora da barra.
          height: ALTURA_BARRA + insets.bottom + RESPIRO,
          paddingBottom: insets.bottom + RESPIRO,
          paddingTop: spacing[1],
        },
        tabBarLabelStyle: {
          fontSize: typography.caption.fontSize,
          fontWeight: typography.caption.fontWeight,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
