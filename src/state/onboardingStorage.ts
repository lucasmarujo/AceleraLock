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

/**
 * Nome de tratamento, coletado na secao 1 do onboarding e usado na saudacao
 * da home. Nao e identidade nem credencial — e como a pessoa quer ser
 * chamada -, entao AsyncStorage pelo mesmo motivo do flag acima.
 */
const KEY_USER_NAME = 'aceleralock.user_name';

export async function readUserName(): Promise<string | null> {
  const value = await AsyncStorage.getItem(KEY_USER_NAME);
  return value && value.length > 0 ? value : null;
}

/**
 * Nome vazio nao apaga o que ja esta gravado. Protege a reentrada: quem so
 * voltou pro onboarding porque revogou uma permissao comeca na secao 3, com
 * `nome` em branco em memoria, e chega na secao 5 gravando — sem esta guarda,
 * concluir de novo apagaria o nome que a pessoa deu da primeira vez.
 */
export async function saveUserName(nome: string): Promise<void> {
  const limpo = nome.trim();
  if (limpo.length === 0) {
    return;
  }
  await AsyncStorage.setItem(KEY_USER_NAME, limpo);
}

/**
 * Horas por dia que a pessoa estimou na secao 2 do onboarding. Informativo por
 * decisao: nao e meta, nao dispara nada, nao e comparado com a leitura real —
 * so aparece no perfil, onde da pra corrigir.
 */
const KEY_DAILY_HOURS = 'aceleralock.daily_hours';

export async function readDailyHours(): Promise<number | null> {
  const value = await AsyncStorage.getItem(KEY_DAILY_HOURS);
  if (value === null) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  // Valor ilegivel conta como ausente: melhor a tela nao mostrar nada do que
  // mostrar NaN onde deveria ter um numero de horas.
  return Number.isInteger(parsed) ? parsed : null;
}

export async function saveDailyHours(horas: number): Promise<void> {
  if (!Number.isInteger(horas)) {
    return;
  }
  await AsyncStorage.setItem(KEY_DAILY_HOURS, String(horas));
}
