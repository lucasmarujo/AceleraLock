/**
 * Tokens do design system (docs/design-system.md §1). Modulo unico, sem
 * import de react-native, para poder ser consumido por navigationTheme.ts,
 * por componentes e por teste puro sem puxar o runtime nativo.
 *
 * Cor de marca: decisao do usuario, 2026-08-29 (ver navigationTheme.ts) mais
 * a revalidacao de contraste WCAG feita junto com o supervisor na mesma
 * rodada. Regra do sistema, nao coincidencia de dois hex: o primario e
 * sempre a cor que contrasta com o canvas do tema, o rotulo e sempre a
 * oposta — por isso `surfaces.brand` inverte fill/onFill entre claro e
 * escuro em vez de repetir o mesmo par.
 */

export const neutral = {
  0: '#FFFFFF',
  50: '#F6F7F8',
  100: '#ECEEF1',
  200: '#DDE1E6',
  300: '#C2C8D0',
  400: '#98A0AB',
  500: '#6C7480',
  600: '#4C535E',
  700: '#343A43',
  800: '#21262D',
  900: '#14181D',
  950: '#0D1014',
} as const;

export const brand = {
  turquesa: '#03c3bf',
  tema: '#04141c',
  /** t=0.45 em direcao a `tema` — link/texto de marca no claro (>=4.5:1). */
  turquesaTextLight: '#037476',
  /** t=0.25 — icone/borda de marca no claro (elemento grafico, >=3:1). */
  turquesaIconLight: '#039796',
  /** t=0.20 em direcao a `tema` — pressed do primario escuro. */
  turquesaPressedDark: '#03a09e',
  /** t=0.15 em direcao a `turquesa` — pressed do primario claro (invertido). */
  temaPressedLight: '#042e34',
  /** t=0.20 em direcao a `turquesa` — topo do degrade das boas-vindas. */
  temaTurquesa: '#04373d',
  /**
   * As duas pontas do gradiente do anel da logo do AceleraDev
   * (`assets/aceleradev-logo.svg`), medidas do proprio arquivo: azul embaixo
   * a esquerda, ciano em cima a direita. Sao cor de *marca*, nao de UI.
   *
   * Estao orfas desde o redesenho de 2026-08-30 (commit `77ef62b`): o badge
   * do AceleraLock era gerado no repo a partir delas e agora chega pronto em
   * `assets/icon-1024.png`, na paleta nova. Ficam registradas porque a logo do
   * AceleraDev na splash ainda e essa; nenhum token semantico as consome, e
   * se alguma tela precisar de azul, o primitivo `blue` do §1.1 e o lugar.
   */
  aceleraAzul: '#014D93',
  aceleraCiano: '#08EFD5',
} as const;

/**
 * Neutros do tema escuro. Existem porque `neutral` e frio demais em cima do
 * canvas escuro: a escala neutra fica no matiz 213-217 (azul) e `brand.tema`
 * no 200 (ciano), entao card e borda liam como cinza sujo sobre um fundo de
 * marca — no claro isso nao aparece porque la o canvas e quase branco.
 *
 * Cada passo e `brand.tema` misturado com branco (ou com preto, no 950) no
 * `t` anotado, escolhido pra bater a luma do passo de `neutral` que ele
 * substitui. Bater luma e o ponto: as relacoes de contraste do §1.2 ficam
 * todas dentro de 0,05 do que eram, entao isto e troca de matiz, nao de
 * hierarquia — nao ha nada pra remedir aqui.
 */
export const temaNeutral = {
  /** t=0.076 em direcao ao preto — par de `neutral.950`. */
  950: '#04121A',
  /** t=0.026 em direcao ao branco — par de `neutral.900`. */
  900: '#0B1A22',
  /** t=0.083 — par de `neutral.800`. `bgHeroRaised` no claro, `bgHero` no escuro. */
  800: '#19282F',
  /** t=0.169 — par de `neutral.700`. */
  700: '#2E3C42',
  /** t=0.273 — par de `neutral.600`. */
  600: '#49545A',
} as const;

export const amber = {
  50: '#FBF1E2',
  100: '#F5DEBC',
  300: '#E7B369',
  500: '#C9871F',
  /**
   * Nao e o passo 500 nem o 600 do primitivo — e o fill claro de
   * `surfaces.amber`, calculado pra fechar as duas relacoes ao mesmo tempo
   * (fill-vs-canvas 1.4.11 E onFill-vs-fill 1.4.3). `amber.500` sozinho
   * reprova 1.4.11 contra `neutral.50` (2.81:1); `amber.600` sozinho reprova
   * o texto (`neutral.900` em cima cai a 4.04:1). t=0.60 entre os dois.
   * Nomeado pra nao virar hex orfao que alguem "corrige" de volta pro 500.
   */
  550: '#b37718',
  600: '#A56C13',
  700: '#7C4F0C',
  /**
   * Fundo do aviso no tema escuro (`bgWarningSubtle`). `amber.50` acenderia
   * sobre o canvas escuro; este e o ambar escurecido ate a luma dos fundos do
   * tema, e `amber.300` por cima passa de 8:1.
   */
  900: '#2E2210',
} as const;

export const red = {
  50: '#FCEBEA',
  100: '#F7CFCC',
  300: '#E88C86',
  500: '#C33A30',
  600: '#9F2C24',
  700: '#7A211B',
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

/**
 * docs/design-system.md §1.6. Existia so na doc ate o redesign (2026-10-11),
 * quando a barra de salvar e a sheet passaram a flutuar. Sombra (iOS) e
 * `elevation` (Android) andam juntas: mesma intencao, API de cada plataforma.
 * No escuro a sombra some — quem flutua la tambem leva borda.
 */
export const elevation = {
  1: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  2: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  3: {
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const;

/**
 * docs/design-system.md §1.7. Existiam so na doc ate agora — nao havia
 * animacao nenhuma no app pra consumi-los. Easing sai como tupla e nao como
 * string CSS porque quem consome e `Easing.bezier(...easing.standard)` do
 * reanimated, nao um browser.
 */
export const duration = {
  instant: 100,
  fast: 150,
  base: 220,
  slow: 300,
} as const;

export const easing = {
  standard: [0.2, 0, 0, 1],
  /** entrada: desacelera ate parar */
  decelerate: [0, 0, 0, 1],
  /** saida: acelera pra fora */
  accelerate: [0.3, 0, 1, 1],
} as const;

type TextStyleToken = {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700' | '800';
};

export const typography: Record<string, TextStyleToken> = {
  /** Numero-heroi de um cartao (tempo de tela de hoje) e manchete das boas-vindas. */
  metric: { fontSize: 44, lineHeight: 48, fontWeight: '800' },
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
  /** Titulo de tela — o `title1` com o peso de manchete do redesign. */
  heading: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  title3: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  timerHero: { fontSize: 56, lineHeight: 60, fontWeight: '700' },
};

export type Surface = { fill: string; onFill: string; pressedFill: string };

type SemanticTokens = {
  colors: {
    bgCanvas: string;
    bgSurface: string;
    bgSunken: string;
    bgShimmer: string;
    bgBrandSubtle: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    textDanger: string;
    textBrand: string;
    borderDefault: string;
    borderStrong: string;
    borderBrand: string;
    focusRing: string;
    /**
     * Superficie "hero": o unico momento de tinta da tela (status da protecao,
     * cronometro). No claro e a propria `brand.tema`; no escuro o canvas ja e
     * `brand.tema`, entao o hero sobe um degrau pra nao sumir no fundo.
     */
    bgHero: string;
    bgHeroRaised: string;
    borderHero: string;
    textOnHero: string;
    textOnHeroSecondary: string;
    textOnHeroBrand: string;
    /** Atrito sobre o hero (cronometro, cadeado ligado). Ambar, nunca vermelho. */
    textOnHeroFriction: string;
    /** Aviso com solucao (DS §3.11): ambar. Vermelho continua so pra erro. */
    bgWarningSubtle: string;
    borderWarning: string;
    textWarning: string;
    iconWarning: string;
    surfaces: {
      brand: Surface;
      danger: Surface;
    };
  };
};

export const lightTheme: SemanticTokens = {
  colors: {
    bgCanvas: neutral[50],
    bgSurface: neutral[0],
    bgSunken: neutral[100],
    // Faixa do shimmer do Skeleton: tem que ser mais clara que `bgSunken`, e
    // no claro o teto e o branco — a base ja esta perto dele.
    bgShimmer: neutral[0],
    bgBrandSubtle: '#E6F9F9',
    textPrimary: neutral[900],
    textSecondary: neutral[600],
    textTertiary: neutral[500],
    textDanger: red[600],
    textBrand: brand.turquesaTextLight,
    borderDefault: neutral[200],
    borderStrong: neutral[300],
    borderBrand: brand.turquesaIconLight,
    focusRing: brand.turquesaIconLight,
    bgHero: brand.tema,
    bgHeroRaised: temaNeutral[800],
    borderHero: temaNeutral[700],
    textOnHero: neutral[0],
    textOnHeroSecondary: neutral[300],
    textOnHeroBrand: brand.turquesa,
    textOnHeroFriction: amber[300],
    bgWarningSubtle: amber[50],
    borderWarning: amber[300],
    textWarning: amber[700],
    iconWarning: amber[550],
    surfaces: {
      // B: primario invertido no claro — fundo quase-preto, rotulo turquesa.
      brand: { fill: brand.tema, onFill: brand.turquesa, pressedFill: brand.temaPressedLight },
      danger: { fill: red[500], onFill: neutral[0], pressedFill: red[600] },
    },
  },
};

export const darkTheme: SemanticTokens = {
  colors: {
    bgCanvas: brand.tema,
    bgSurface: temaNeutral[900],
    bgSunken: temaNeutral[950],
    // No escuro `bgSurface` (temaNeutral[900]) e quase indistinguivel de
    // `bgSunken` (temaNeutral[950]): 8 passos de luma em 255, a varredura
    // some. Sobe pra temaNeutral[700], que le como reflexo sem virar alarme.
    bgShimmer: temaNeutral[700],
    bgBrandSubtle: '#04262C',
    textPrimary: neutral[50],
    textSecondary: neutral[300],
    textTertiary: neutral[400],
    textDanger: red[300],
    textBrand: brand.turquesa,
    borderDefault: temaNeutral[700],
    borderStrong: temaNeutral[600],
    borderBrand: brand.turquesa,
    focusRing: brand.turquesa,
    bgHero: temaNeutral[800],
    bgHeroRaised: temaNeutral[700],
    borderHero: temaNeutral[600],
    textOnHero: neutral[50],
    textOnHeroSecondary: neutral[300],
    textOnHeroBrand: brand.turquesa,
    textOnHeroFriction: amber[300],
    bgWarningSubtle: amber[900],
    borderWarning: amber[700],
    textWarning: amber[300],
    iconWarning: amber[300],
    surfaces: {
      brand: { fill: brand.turquesa, onFill: brand.tema, pressedFill: brand.turquesaPressedDark },
      danger: { fill: red[500], onFill: neutral[0], pressedFill: red[600] },
    },
  },
};

export type Theme = SemanticTokens;
