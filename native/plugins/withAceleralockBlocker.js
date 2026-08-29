const { withSettingsGradle } = require('@expo/config-plugins');

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

function withAceleralockBlocker(config) {
  return withAceleralockBlockerCoreGradle(config);
}

module.exports = withAceleralockBlocker;
