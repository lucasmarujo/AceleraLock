import { darkTheme, lightTheme, type Theme } from './tokens';
import { useThemePreference } from './ThemePreferenceContext';

/**
 * Le o esquema ja resolvido do `ThemePreferenceProvider` (raiz do app) em vez
 * de chamar `useColorScheme()` direto, que era o que fazia antes de existir a
 * escolha manual no perfil. Continua sem decidir nada sozinho: quem combina
 * "o que a pessoa escolheu" com "o que o aparelho esta usando" e o Provider,
 * pra nao existirem duas respostas pra "qual tema" no mesmo frame.
 */
export function useTheme(): Theme {
  const { esquema } = useThemePreference();
  return esquema === 'escuro' ? darkTheme : lightTheme;
}
