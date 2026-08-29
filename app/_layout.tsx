import { useColorScheme } from 'react-native';
import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { ProtectionVerdictProvider, useProtectionVerdictContext } from '@/state/ProtectionVerdictContext';
import { AceleraLockDarkTheme, AceleraLockLightTheme } from '@/theme/navigationTheme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { verdict } = useProtectionVerdictContext();
  const theme = colorScheme === 'dark' ? AceleraLockDarkTheme : AceleraLockLightTheme;

  if (verdict === 'loading') {
    return null;
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
  return (
    <ProtectionVerdictProvider>
      <RootNavigator />
    </ProtectionVerdictProvider>
  );
}
