import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

/**
 * Cores de marca (decisao do usuario, 2026-08-29). O primario e invertido
 * entre temas de proposito — nao derivar um do outro:
 * - claro: fundo #F6F7F8 (bg.canvas claro, design-system.md §1.2), primario
 *   #04141c (botao principal e escuro no tema claro).
 * - escuro: fundo #04141c, primario #03c3bf (botao principal e turquesa no
 *   tema escuro).
 *
 * Existe por causa do flash branco do React Navigation em transicao de tela
 * no tema escuro (fundo padrao da lib e branco) — sem isto o app pisca
 * branco a cada navegacao com o SO em modo escuro.
 */
export const AceleraLockLightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#F6F7F8',
    primary: '#04141c',
  },
};

export const AceleraLockDarkTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#04141c',
    primary: '#03c3bf',
  },
};
