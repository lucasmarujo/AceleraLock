import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Stack, ThemeProvider } from 'expo-router';
import * as NativeSplash from 'expo-splash-screen';

import { SplashScreen } from '@/components/SplashScreen';
import { ProtectionVerdictProvider, useProtectionVerdictContext } from '@/state/ProtectionVerdictContext';
import { AceleraLockDarkTheme, AceleraLockLightTheme } from '@/theme/navigationTheme';

NativeSplash.preventAutoHideAsync().catch(() => {});

/**
 * Tempo mínimo do splash de marca. O veredito costuma resolver em poucos ms,
 * e sem piso a assinatura "Made By AceleraDev" apareceria por um frame — que
 * é o mesmo que não aparecer. Não é atraso artificial do app: o piso corre em
 * paralelo com o veredito, não em série.
 */
const SPLASH_MIN_MS = 1400;

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { verdict } = useProtectionVerdictContext();
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const theme = colorScheme === 'dark' ? AceleraLockDarkTheme : AceleraLockLightTheme;

  useEffect(() => {
    const timer = setTimeout(() => setMinimumElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  if (verdict === 'loading' || !minimumElapsed) {
    return <SplashScreen />;
  }

  return (
    <ThemeProvider value={theme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={verdict === 'plataforma-nao-suportada'}>
          <Stack.Screen name="(unsupported)" />
        </Stack.Protected>
        <Stack.Protected guard={verdict === 'onboarding-incompleto'}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={verdict === 'pausado'}>
          <Stack.Screen name="(paused)" />
        </Stack.Protected>
        <Stack.Protected guard={verdict === 'protegido'}>
          <Stack.Screen name="(protected)" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  /**
   * Esconde a splash nativa assim que a árvore monta — e não quando o
   * veredito resolve, como era antes. O splash de marca é uma tela do app:
   * se a nativa ficasse por cima até o veredito, ela cobriria exatamente a
   * tela que precisa ser vista. Fica aqui, e não no `SplashScreen`, porque
   * este componente monta em toda execução: um veredito que nunca passe por
   * `loading` não pode deixar o app preso atrás da splash nativa.
   */
  useEffect(() => {
    NativeSplash.hideAsync().catch(() => {});
  }, []);

  return (
    <ProtectionVerdictProvider>
      <RootNavigator />
    </ProtectionVerdictProvider>
  );
}
