// Flat config (ESLint 9+). `eslint-config-expo` traz as regras de React,
// React Hooks e React Native que fazem sentido pra este app; nao adicionamos
// regras de estilo aqui de proposito — formatacao e trabalho do Prettier, e
// duas ferramentas brigando pelo mesmo arquivo e ruido garantido.
const expo = require('eslint-config-expo/flat');

module.exports = [
  ...expo,
  {
    ignores: ['android/**', 'ios/**', '.expo/**', 'node_modules/**', 'assets/**', 'backend.bkp/**'],
  },
];
