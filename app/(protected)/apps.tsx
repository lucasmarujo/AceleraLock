import { useRouter } from 'expo-router';

import { AppPickerScreen } from '@/components/AppPickerScreen';

/**
 * Mesma tela do ultimo passo do onboarding, alcancavel de novo pela home:
 * app instalado depois nao deveria exigir desligar a protecao pra entrar na
 * lista. Sai por router.back() — o veredito nao muda ao mexer na lista.
 */
export default function ProtectedApps() {
  const router = useRouter();

  return (
    <AppPickerScreen
      title="Apps bloqueados"
      ctaLabel="Salvar lista"
      onConfirm={() => router.back()}
    />
  );
}
