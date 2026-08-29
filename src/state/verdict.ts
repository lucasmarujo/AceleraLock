export type ProtectionVerdict =
  | 'loading'
  | 'onboarding-incompleto'
  | 'protegido'
  | 'plataforma-nao-suportada';

export type Snapshot = {
  /**
   * false quando a plataforma nao tem mecanismo de bloqueio nenhum hoje
   * (iOS: Family Controls sem entitlement pedido). Nao e "falta permissao"
   * — e "o recurso nao existe" -, por isso fica fora de coreGranted e e
   * checado antes de qualquer coisa. Quem decide o valor e o chamador
   * (useProtectionVerdict.ts): esta funcao continua pura, sem importar
   * Platform do RN.
   */
  platformSupported: boolean;
  coreGranted: boolean;
  onboardingComplete: boolean;
};

export function computeVerdict(snapshot: Snapshot): ProtectionVerdict {
  const { platformSupported, coreGranted, onboardingComplete } = snapshot;

  if (!platformSupported) {
    return 'plataforma-nao-suportada';
  }

  if (!onboardingComplete || !coreGranted) {
    return 'onboarding-incompleto';
  }

  return 'protegido';
}
