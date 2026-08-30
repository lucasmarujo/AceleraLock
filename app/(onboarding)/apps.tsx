import { AppPickerScreen } from '@/components/AppPickerScreen';
import AceleralockBlocker from '@/native/blocker';
import { markOnboardingComplete } from '@/state/onboardingStorage';
import { useProtectionVerdictContext } from '@/state/ProtectionVerdictContext';

/**
 * Ultimo passo do onboarding, e o unico que termina: escolher os apps vem
 * depois das permissoes de proposito — sem elas nada bloqueia, e a lista
 * seria uma escolha sem efeito. Aqui e onde o flag local e gravado e o
 * servico sobe, com permissao concedida E lista escolhida.
 */
export default function OnboardingApps() {
  const { refresh } = useProtectionVerdictContext();

  const handleConfirm = async () => {
    await markOnboardingComplete();
    AceleralockBlocker.start();
    await refresh();
  };

  return (
    <AppPickerScreen
      title="Escolha os apps que roubam seu tempo."
      ctaLabel="Concluir"
      onConfirm={handleConfirm}
    />
  );
}
