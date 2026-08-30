import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import AceleralockBlocker, { type PermissionState } from '@/native/blocker';

import { readOnboardingComplete } from './onboardingStorage';
import { computeVerdict, type ProtectionVerdict } from './verdict';

export type { ProtectionVerdict };

export function useProtectionVerdict() {
  const [verdict, setVerdict] = useState<ProtectionVerdict>('loading');
  // Mesma leitura que decide o veredito, exposta pras telas do onboarding:
  // uma segunda sonda em outro momento poderia mostrar um estado de
  // permissao que o veredito ja nao acredita mais.
  const [permissions, setPermissions] = useState<PermissionState | null>(null);
  const previousVerdict = useRef<ProtectionVerdict>('loading');

  const refresh = useCallback(async () => {
    try {
      const onboardingComplete = await readOnboardingComplete();

      const platformSupported = Platform.OS === 'android';
      let coreGranted = false;
      let protectionActive = true;
      if (platformSupported) {
        const state = AceleralockBlocker.probePermissions();
        coreGranted = state.coreGranted;
        protectionActive = AceleralockBlocker.protectionState().protectionActive;
        setPermissions(state);
      }

      const next = computeVerdict({ platformSupported, coreGranted, onboardingComplete, protectionActive });
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

  return { verdict, permissions, refresh };
}
