import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type Theme } from './tokens';

/**
 * Sem Context/Provider de proposito: nenhum componente ainda precisa de
 * override manual de tema (so deteccao de sistema), e useColorScheme() ja e
 * a fonte que app/_layout.tsx usa pro tema de navegacao — chamar de novo
 * aqui e barato e evita duas fontes de verdade sobre "qual tema".
 * ponytail: adicionar Provider quando existir toggle manual de tema.
 */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}
