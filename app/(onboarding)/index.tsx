import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';

import { OnboardingStepScreen } from '@/components/OnboardingStepScreen';

export default function OnboardingStart() {
  useFocusEffect(
    useCallback(() => {
      // Primeiro passo do grupo: nao ha passo anterior pra voltar, entao
      // engolir aqui e inambiguo (nunca "as vezes navega, as vezes fecha
      // o app"). useFocusEffect, nao useEffect: o React Navigation mantem
      // telas anteriores montadas quando empilha uma nova (push), entao um
      // useEffect simples continuaria escutando o voltar mesmo com
      // permissoes.tsx em foco por cima — reproduziria o mesmo bug que
      // engolir o grupo inteiro no _layout.tsx tinha. useFocusEffect
      // instala so enquanto esta tela esta em foco e remove no blur.
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => subscription.remove();
    }, [])
  );

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <OnboardingStepScreen
        title="Você escolhe os apps que roubam seu tempo. A gente tranca."
        nextHref="/permissoes"
        ctaLabel="Começar"
      />
    </>
  );
}
