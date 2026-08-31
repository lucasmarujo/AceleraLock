import AsyncStorage from '@react-native-async-storage/async-storage';

import { ehPreferenciaTema, type PreferenciaTema } from '@/theme/preferenciaTema';

/**
 * Preferencia de tema escolhida no perfil. Nao e segredo nem policy — e gosto
 * visual -, entao AsyncStorage pelo mesmo criterio de `onboardingStorage.ts`.
 * Mora em modulo proprio porque nao vem do onboarding: da pra trocar a
 * qualquer momento e nada no fluxo de permissoes depende dela.
 */
const KEY_THEME_PREFERENCE = 'aceleralock.theme_preference';

/**
 * Valor ausente ou ilegivel conta como `sistema`, que e o comportamento que o
 * app ja tinha — quem nunca abriu esta tela nao percebe diferenca.
 */
export async function readThemePreference(): Promise<PreferenciaTema> {
  const value = await AsyncStorage.getItem(KEY_THEME_PREFERENCE);
  return ehPreferenciaTema(value) ? value : 'sistema';
}

export async function saveThemePreference(preferencia: PreferenciaTema): Promise<void> {
  await AsyncStorage.setItem(KEY_THEME_PREFERENCE, preferencia);
}
