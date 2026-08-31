import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { readThemePreference, saveThemePreference } from '@/state/themeStorage';

import { resolverEsquema, type EsquemaTema, type PreferenciaTema } from './preferenciaTema';

type ThemePreferenceContextValue = {
  preferencia: PreferenciaTema;
  /** Ja resolvido: e este que `useTheme()` usa pra escolher o par de tokens. */
  esquema: EsquemaTema;
  definirPreferencia: (preferencia: PreferenciaTema) => void;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

/**
 * O Provider que o JSDoc de `useTheme.ts` deixou marcado como pendente ate
 * existir toggle manual de tema (o toggle agora existe, no perfil).
 *
 * Monta uma vez na raiz, acima de tudo — inclusive da `SplashScreen`, que
 * tambem chama `useTheme()`. Enquanto a leitura do AsyncStorage nao volta, a
 * preferencia e `sistema`, que e o comportamento antigo do app: quem nunca
 * escolheu nada nao ve troca nenhuma, e quem escolheu ve a troca acontecer
 * atras do piso de 1400ms da splash, nao na cara.
 */
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const esquemaDoSistema: EsquemaTema = useColorScheme() === 'dark' ? 'escuro' : 'claro';
  const [preferencia, setPreferencia] = useState<PreferenciaTema>('sistema');

  useEffect(() => {
    let ativo = true;
    readThemePreference()
      .then((salva) => {
        if (ativo) {
          setPreferencia(salva);
        }
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);

  /**
   * Pinta antes de gravar: a troca de tema precisa ser instantanea ao toque, e
   * o AsyncStorage so decide o que aparece na *proxima* abertura. Se a
   * gravacao falhar, o app segue no tema escolhido nesta sessao — perder a
   * escolha na proxima abertura e melhor que travar a tela agora.
   */
  const definirPreferencia = (nova: PreferenciaTema) => {
    setPreferencia(nova);
    void saveThemePreference(nova).catch(() => {});
  };

  const esquema = resolverEsquema(preferencia, esquemaDoSistema);

  return (
    <ThemePreferenceContext.Provider value={{ preferencia, esquema, definirPreferencia }}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceContextValue {
  const context = useContext(ThemePreferenceContext);
  if (!context) {
    throw new Error('useThemePreference precisa estar dentro de ThemePreferenceProvider');
  }
  return context;
}
