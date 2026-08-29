import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import AceleralockBlocker from '@/native/blocker';

import { readOnboardingComplete } from './onboardingStorage';

export type ProtectionVerdict =
  | 'loading'
  | 'onboarding-incompleto'
  | 'protegido';

type Snapshot = {
  coreGranted: boolean;
  onboardingComplete: boolean;
};

function computeVerdict(snapshot: Snapshot): ProtectionVerdict {
  const { coreGranted, onboardingComplete } = snapshot;

  if (!onboardingComplete) {
    return 'onboarding-incompleto';
  }

  if (!coreGranted) {
    return 'onboarding-incompleto';
  }

  return 'protegido';
}

export function useProtectionVerdict() {
  const [verdict, setVerdict] = useState<ProtectionVerdict>('loading');
  const previousVerdict = useRef<ProtectionVerdict>('loading');

  const refresh = useCallback(async () => {
    try {
      const onboardingComplete = await readOnboardingComplete();

      let coreGranted = false;
      if (Platform.OS === 'android') {
        const state = AceleralockBlocker.probePermissions();
        coreGranted = state.coreGranted;
      }

      const next = computeVerdict({ coreGranted, onboardingComplete });
      previousVerdict.current = next;
      setVerdict(next);
    } catch (error) {
      console.warn('[useProtectionVerdict] falha ao reavaliar', error);
      if (previousVerdict.current !== 'loading') {
        setVerdict(previousVerdict.current);
      }
    }
  }, []);

  useEffect(() => {
    refresh();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
      }
    });

    return () => subscription.remove();
  }, [refresh]);

  return { verdict, refresh };
}
