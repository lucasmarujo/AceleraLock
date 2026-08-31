import { useEffect, useState } from 'react';
import { Stack, ThemeProvider } from 'expo-router';
import * as NativeSplash from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { SplashScreen } from '@/components/SplashScreen';
import {
  ProtectionVerdictProvider,
  useProtectionVerdictContext,
} from '@/state/ProtectionVerdictContext';
import { AceleraLockDarkTheme, AceleraLockLightTheme } from '@/theme/navigationTheme';
import { ThemePreferenceProvider, useThemePreference } from '@/theme/ThemePreferenceContext';

NativeSplash.preventAutoHideAsync().catch(() => {});

/**
 * Tempo mínimo do splash de marca. O veredito costuma resolver em poucos ms,
 * e sem piso a assinatura "Made By AceleraDev" apareceria por um frame — que
 * é o mesmo que não aparecer. Não é atraso artificial do app: o piso corre em
 * paralelo com o veredito, não em série.
 */
const SPLASH_MIN_MS = 1400;

function RootNavigator() {
  const { esquema } = useThemePreference();
  const { verdict } = useProtectionVerdictContext();
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const theme = esquema === 'escuro' ? AceleraLockDarkTheme : AceleraLockLightTheme;

  useEffect(() => {
    const timer = setTimeout(() => setMinimumElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  /**
   * Ate existir escolha manual de tema, a barra de status acertava sozinha: o
   * app seguia o esquema do aparelho, entao o contraste sempre fechava. Com
   * `claro` sobre um sistema escuro (ou o contrario) os dois divergem, e sem
   * isto o relogio fica ilegivel — texto claro sobre fundo claro.
   */
  const barraDeStatus = <StatusBar style={esquema === 'escuro' ? 'light' : 'dark'} />;

  if (verdict === 'loading' || !minimumElapsed) {
    return (
      <>
        {barraDeStatus}
        <SplashScreen />
      </>
    );
  }

  return (
    <ThemeProvider value={theme}>
      {barraDeStatus}
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

  /**
   * `ThemePreferenceProvider` por fora de tudo: a `SplashScreen` tambem chama
   * `useTheme()`, e ela renderiza antes do veredito resolver.
   */
  return (
    <ThemePreferenceProvider>
      <ProtectionVerdictProvider>
        <RootNavigator />
      </ProtectionVerdictProvider>
    </ThemePreferenceProvider>
  );
}
