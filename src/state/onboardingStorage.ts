import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Unico flag local persistido pelo JS. Existe porque a tabela do health
 * check (docs/onboarding-permissoes-nativas.md §6.2) distingue
 * `onboarding-incompleto` de `degradado` pelo mesmo estado de permissao —
 * a diferenca e so "ja terminou o onboarding uma vez?", que nao da pra
 * derivar de nenhuma leitura nativa. Nao e segredo (nao e token, nao e
 * policy) — por isso AsyncStorage, nao SecureStore.
 */
const KEY_ONBOARDING_COMPLETE = 'aceleralock.onboarding_complete';

export async function readOnboardingComplete(): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEY_ONBOARDING_COMPLETE);
  return value === 'true';
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(KEY_ONBOARDING_COMPLETE, 'true');
}
