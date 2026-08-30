const { withProjectBuildGradle, withSettingsGradle } = require('@expo/config-plugins');

// O modulo nativo declara minSdk 26 (android/build.gradle) porque as APIs de
// overlay e de canal de notificacao que ele usa sao de API 26. O padrao do
// Expo e 24, e o merge de manifesto falha quando a biblioteca pede mais que o
// app. O plugin "expo-root-project" so define o default se o ext ainda nao
// existir, entao basta setar antes dele.
const MIN_SDK = `
// aceleralock-blocker: piso do modulo nativo. Ver
// native/plugins/withAceleralockBlocker.js.
ext {
    minSdkVersion = 26
}
`.trim();

const ROOT_PROJECT_APPLY = 'apply plugin: "expo-root-project"';

// O autolinking do Expo so enxerga a pasta android/ do proprio modulo Expo
// (via package.json em native/modules/aceleralock-blocker). Ele nao sabe que
// core/ existe como projeto Gradle irmao, puro Kotlin/JVM, que
// android/build.gradle ja referencia como ':aceleralock-blocker-core'
// (implementation project(':aceleralock-blocker-core')). Sem este bloco essa
// dependencia nunca resolve e android/ nunca compila.
const CORE_INCLUDE = `
// aceleralock-blocker: liga o modulo core (Kotlin puro, sem dependencia de
// Android, testado em JVM) que android/build.gradle ja espera sob o nome
// :aceleralock-blocker-core. Ver native/plugins/withAceleralockBlocker.js.
include ':aceleralock-blocker-core'
project(':aceleralock-blocker-core').projectDir = new File(rootDir, '../native/modules/aceleralock-blocker/core')
`.trim();

function withAceleralockBlockerCoreGradle(config) {
  return withSettingsGradle(config, (mod) => {
    if (!mod.modResults.contents.includes(CORE_INCLUDE)) {
      mod.modResults.contents += `\n${CORE_INCLUDE}\n`;
    }
    return mod;
  });
}

function withAceleralockBlockerMinSdk(config) {
  return withProjectBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes('minSdkVersion = 26')) {
      if (!mod.modResults.contents.includes(ROOT_PROJECT_APPLY)) {
        throw new Error(
          `withAceleralockBlocker: nao achei '${ROOT_PROJECT_APPLY}' no build.gradle raiz — ` +
            'sem esse ponto de ancoragem o minSdk 26 do modulo nativo nao entra e o ' +
            'merge de manifesto falha. Conferir se o template do Expo mudou.'
        );
      }
      mod.modResults.contents = mod.modResults.contents.replace(
        ROOT_PROJECT_APPLY,
        `${MIN_SDK}\n\n${ROOT_PROJECT_APPLY}`
      );
    }
    return mod;
  });
}

function withAceleralockBlocker(config) {
  return withAceleralockBlockerMinSdk(withAceleralockBlockerCoreGradle(config));
}

module.exports = withAceleralockBlocker;
