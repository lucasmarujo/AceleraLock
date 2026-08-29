export type ProtectionVerdict =
  | 'loading'
  | 'onboarding-incompleto'
  | 'protegido';

export type Snapshot = {
  coreGranted: boolean;
  onboardingComplete: boolean;
};

export function computeVerdict(snapshot: Snapshot): ProtectionVerdict {
  const { coreGranted, onboardingComplete } = snapshot;

  if (!onboardingComplete) {
    return 'onboarding-incompleto';
  }

  if (!coreGranted) {
    return 'onboarding-incompleto';
  }

  return 'protegido';
}
