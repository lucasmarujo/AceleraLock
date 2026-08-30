import { Linking } from 'react-native';

import { OnboardingStepScreen } from '@/components/OnboardingStepScreen';
import { useProtectionVerdictContext } from '@/state/ProtectionVerdictContext';
import { nextMissingCorePermission, type CorePermission } from '@/state/verdict';

/**
 * Um passo por permissao essencial. Cada uma mora numa tela diferente do
 * sistema — nao ha dialogo de runtime pra nenhuma das duas -, entao o CTA
 * abre as Settings e a leitura de volta e o AppState 'active' do
 * useProtectionVerdict, que ja resonda ao voltar pro app.
 *
 * Linking.sendIntent nao carrega data URI, entao a tela de sobreposicao
 * abre na lista geral de apps em vez de ja no AceleraLock: um toque a mais,
 * em troca de nao ter funcao nativa nova (e rebuild) so pra montar o
 * `package:` do Intent.
 */
const PASSO: Record<CorePermission, { title: string; ctaLabel: string; intent: string }> = {
  usageAccess: {
    title: 'Permita o acesso ao uso do aparelho para o AceleraLock saber qual app está aberto.',
    ctaLabel: 'Abrir acesso ao uso',
    intent: 'android.settings.USAGE_ACCESS_SETTINGS',
  },
  overlay: {
    title: 'Permita a exibição sobre outros apps para a tela de bloqueio aparecer.',
    ctaLabel: 'Abrir exibição sobre apps',
    intent: 'android.settings.action.MANAGE_OVERLAY_PERMISSION',
  },
};

const ESCOLHER_APPS = {
  title: 'Acesso concedido. Agora escolha o que bloquear.',
  ctaLabel: 'Continuar',
};

export default function OnboardingPermissoes() {
  const { permissions } = useProtectionVerdictContext();
  const pendente = nextMissingCorePermission(permissions);
  const passo = pendente ? PASSO[pendente] : ESCOLHER_APPS;

  // So abre Settings. Quando nao ha permissao pendente o CTA nao tem acao
  // propria: e o nextHref que leva pra escolha dos apps.
  const abrirSettings = async () => {
    if (!pendente) {
      return;
    }
    // Fabricante que nao tem a tela do intent: cai nos detalhes do proprio
    // app, onde as duas permissoes tambem sao alcancaveis. Nunca falha
    // calado — ficar sem reacao nenhuma era o bug.
    await Linking.sendIntent(PASSO[pendente].intent).catch(() => Linking.openSettings());
  };

  return (
    <OnboardingStepScreen
      title={passo.title}
      ctaLabel={passo.ctaLabel}
      // Sem href enquanto falta permissao: o CTA abre as Settings e a pessoa
      // volta pra esta mesma tela, agora no passo seguinte.
      nextHref={pendente ? undefined : '/apps'}
      onPressContinue={pendente ? abrirSettings : undefined}
    />
  );
}
