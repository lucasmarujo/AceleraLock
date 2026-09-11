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
  // Declarado no escopo da funcao: `refresh` (que atribui) e async, e o return
  // le `restricted` no escopo de fora. Mantido em estado (e nao em ref) porque
  // o React precisa reagendar a UI quando o flag muda — `setRestricted` seria
  // o proximo passo se a UI passar a ouvir isso em vez de reler o nativo.
  const [restricted, setRestricted] = useState(false);
  const previousVerdict = useRef<ProtectionVerdict>('loading');

  const refresh = useCallback(async () => {
    try {
      const onboardingComplete = await readOnboardingComplete();

      const platformSupported = Platform.OS === 'android' || Platform.OS === 'ios';
      let coreGranted = false;
      let protectionActive = true;
      let restrictedValue = false;
      if (platformSupported) {
        const state = AceleralockBlocker.probePermissions();
        const protection = AceleralockBlocker.protectionState();
        coreGranted = state.coreGranted;
        protectionActive = protection.protectionActive;
        restrictedValue = protection.restricted;
        setPermissions(state);
      }

      setRestricted(restrictedValue);

      const next = computeVerdict({
        platformSupported,
        coreGranted,
        onboardingComplete,
        protectionActive,
        restricted: restrictedValue,
      });
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
    // `refresh` e async: todo setState dela acontece depois de um await,
    // nunca sincrono no corpo do efeito. E a carga inicial, que precisa
    // rodar no mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh();
      }
    });

    return () => subscription.remove();
  }, [refresh]);

  return { verdict, permissions, restricted, refresh };
}
