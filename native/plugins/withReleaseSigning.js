const { withAppBuildGradle } = require('@expo/config-plugins');

// O template do Expo assina o release com o debug.keystore, que a Play Console
// recusa. A chave de upload e as senhas moram em credentials.json (formato do
// EAS), versionado de proposito: qualquer pessoa do time gera o AAB aceito pela
// Play. O Gradle le o arquivo na hora do build, entao a senha nao e copiada
// para android/.
const SIGNING_RELEASE = `
        release {
            // withReleaseSigning: chave de upload da Play. Ver native/plugins/withReleaseSigning.js.
            def credenciais = new groovy.json.JsonSlurper().parse(new File(projectRoot, 'credentials.json')).android.keystore
            storeFile new File(projectRoot, credenciais.keystorePath)
            storePassword credenciais.keystorePassword
            keyAlias credenciais.keyAlias
            keyPassword credenciais.keyPassword
        }`;

const SIGNING_CONFIGS = /signingConfigs \{/;
const RELEASE_COM_CHAVE_DEBUG =
  /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/;

function aplicarAssinaturaRelease(conteudo) {
  if (conteudo.includes('signingConfig signingConfigs.release')) {
    return conteudo;
  }
  if (!SIGNING_CONFIGS.test(conteudo) || !RELEASE_COM_CHAVE_DEBUG.test(conteudo)) {
    throw new Error(
      'withReleaseSigning: nao achei signingConfigs nem o buildType release no ' +
        'android/app/build.gradle — sem esse ponto de ancoragem o AAB sairia assinado ' +
        'com a chave de debug. Conferir se o template do Expo mudou.'
    );
  }
  return conteudo
    .replace(SIGNING_CONFIGS, `signingConfigs {${SIGNING_RELEASE}`)
    .replace(RELEASE_COM_CHAVE_DEBUG, '$1signingConfig signingConfigs.release');
}

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = aplicarAssinaturaRelease(mod.modResults.contents);
    return mod;
  });
}

module.exports = withReleaseSigning;
module.exports.aplicarAssinaturaRelease = aplicarAssinaturaRelease;
