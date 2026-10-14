import { useRouter, type Href } from 'expo-router';

import { Button } from '@/components/Button';
import { TelaDeEstado } from '@/components/TelaDeEstado';
import { useProtectionVerdictContext } from '@/state/ProtectionVerdictContext';
import type { ProtectionVerdict } from '@/state/verdict';

/**
 * `/` nao serve de destino: todo grupo tem um `index`, e o router resolve `/`
 * pro primeiro deles — que quase sempre esta com o `Stack.Protected` fechado, e
 * a navegacao e ignorada em silencio. O destino e o grupo do veredito atual.
 */
const INICIO_DO_VEREDITO: Record<Exclude<ProtectionVerdict, 'loading'>, Href> = {
  'plataforma-nao-suportada': '/(unsupported)',
  'onboarding-incompleto': '/(onboarding)',
  pausado: '/(paused)',
  protegido: '/(protected)/(tabs)',
};

export default function NotFound() {
  const router = useRouter();
  const { verdict } = useProtectionVerdictContext();

  return (
    <TelaDeEstado
      icon="compass-outline"
      title="Esta tela não existe"
      message="O link que trouxe você até aqui está quebrado ou desatualizado."
      action={
        verdict === 'loading' ? undefined : (
          <Button
            label="Voltar para o início"
            onPress={() => router.replace(INICIO_DO_VEREDITO[verdict])}
          />
        )
      }
    />
  );
}
