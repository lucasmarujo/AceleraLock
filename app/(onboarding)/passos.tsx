import { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { OnboardingFlow } from '@/components/Onboarding/OnboardingFlow';
import { passoInicial as calcularPassoInicial, type Passo } from '@/components/Onboarding/passos';
import { readOnboardingComplete } from '@/state/onboardingStorage';

/**
 * As cinco secoes moram numa rota so, com o passo em estado local: elas
 * compartilham nome, estimativa e selecao de apps, e uma rota por secao
 * transformaria isso em params carregados de tela em tela.
 *
 * `null` enquanto o flag local nao voltou — montar o fluxo antes disso faria a
 * secao 1 aparecer por um frame pra quem deveria comecar na 3 (reentrada por
 * permissao revogada).
 */
export default function OnboardingPassos() {
  const router = useRouter();
  const [inicial, setInicial] = useState<Passo | null>(null);
  const [passo, setPasso] = useState<Passo | null>(null);

  useEffect(() => {
    let ativo = true;
    readOnboardingComplete()
      .then((concluido) => {
        if (!ativo) {
          return;
        }
        const primeiro = calcularPassoInicial(concluido);
        setInicial(primeiro);
        setPasso(primeiro);
      })
      .catch(() => {
        if (ativo) {
          // Leitura falhou: o lado seguro e o fluxo completo, nao pular passo.
          setInicial(1);
          setPasso(1);
        }
      });
    return () => {
      ativo = false;
    };
  }, []);

  useFocusBackHandler(passo, inicial, setPasso, () => router.back());

  if (passo === null || inicial === null) {
    return null;
  }

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <OnboardingFlow
        passoInicial={inicial}
        passo={passo}
        onPasso={(proximo) => setPasso(proximo)}
      />
    </>
  );
}

/**
 * O voltar fisico anda uma secao pra tras. Na primeira secao do caminho desta
 * pessoa, sai pra tela de boas-vindas. `gestureEnabled: false` cobre o swipe:
 * so o botao volta, e sempre pelo mesmo caminho.
 */
function useFocusBackHandler(
  passo: Passo | null,
  inicial: Passo | null,
  setPasso: (passo: Passo) => void,
  sair: () => void
) {
  const aoVoltar = useCallback(() => {
    if (passo === null || inicial === null) {
      return true;
    }
    if (passo <= inicial) {
      sair();
      return true;
    }
    setPasso((passo - 1) as Passo);
    return true;
  }, [passo, inicial, setPasso, sair]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', aoVoltar);
    return () => subscription.remove();
  }, [aoVoltar]);
}
