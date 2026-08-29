import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import AceleralockBlocker from '@/native/blocker';

import { readOnboardingComplete } from './onboardingStorage';
import { computeVerdict, type ProtectionVerdict } from './verdict';

export type { ProtectionVerdict };

export function useProtectionVerdict() {
  const [verdict, setVerdict] = useState<ProtectionVerdict>('loading');
  const previousVerdict = useRef<ProtectionVerdict>('loading');

  const refresh = useCallback(async () => {
    try {
      const onboardingComplete = await readOnboardingComplete();

      const platformSupported = Platform.OS === 'android';
      let coreGranted = false;
      if (platformSupported) {
        const state = AceleralockBlocker.probePermissions();
        coreGranted = state.coreGranted;
      }

      const next = computeVerdict({ platformSupported, coreGranted, onboardingComplete });
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
