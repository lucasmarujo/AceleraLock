const path = require('path');

// `babel-preset-expo` vem como dependencia do `expo`, mas o package-lock o
// grava aninhado em node_modules/expo/node_modules/ em vez de icar pra raiz.
// O Babel resolve nome de preset a partir da pasta deste arquivo — a raiz —
// e nao entra no node_modules de outro pacote, entao `presets:
// ['babel-preset-expo']` quebra o bundle com MODULE_NOT_FOUND. Resolver a
// partir da pasta do `expo` acha o preset nos dois layouts: aninhado (hoje) e
// icado (se o lock for refeito), porque a resolucao do Node sobe ate a raiz.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      require.resolve('babel-preset-expo', {
        paths: [path.dirname(require.resolve('expo/package.json'))],
      }),
    ],
  };
};
