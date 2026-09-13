import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import appJson from '../app.json';
import credentials from '../credentials.json';
import { aplicarAssinaturaRelease } from '../native/plugins/withReleaseSigning.js';

const ROOT = path.join(import.meta.dirname, '..');

const TEMPLATE_EXPO = `
android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            minifyEnabled enableMinifyInReleaseBuilds
        }
    }
}
`;

function blocoBuildType(conteudo: string, nome: 'debug' | 'release') {
  const buildTypes = conteudo.slice(conteudo.indexOf('buildTypes {'));
  const inicio = buildTypes.indexOf(`${nome} {`);
  return buildTypes.slice(inicio, buildTypes.indexOf('}', inicio));
}

test('feliz: release passa a ser assinado pela chave de upload', () => {
  const resultado = aplicarAssinaturaRelease(TEMPLATE_EXPO);
  assert.match(blocoBuildType(resultado, 'release'), /signingConfig signingConfigs\.release/);
  assert.match(resultado, /signingConfigs \{\s*release \{/);
  assert.match(resultado, /credentials\.json/);
});

test('regressao: debug continua com o debug.keystore (senao o expo run:android quebra)', () => {
  const resultado = aplicarAssinaturaRelease(TEMPLATE_EXPO);
  assert.match(blocoBuildType(resultado, 'debug'), /signingConfig signingConfigs\.debug/);
  assert.match(resultado, /storeFile file\('debug\.keystore'\)/);
});

test('regressao: release nao cai de volta na chave de debug, que a Play recusa', () => {
  const resultado = aplicarAssinaturaRelease(TEMPLATE_EXPO);
  assert.doesNotMatch(blocoBuildType(resultado, 'release'), /signingConfigs\.debug/);
});

test('feliz: aplicar duas vezes nao duplica o bloco', () => {
  const uma = aplicarAssinaturaRelease(TEMPLATE_EXPO);
  assert.equal(aplicarAssinaturaRelease(uma), uma);
});

test('template do Expo mudou: falha no prebuild em vez de gerar AAB com chave de debug', () => {
  assert.throws(() => aplicarAssinaturaRelease('android {\n}\n'), /withReleaseSigning/);
});

test('regressao: pacote android e o registrado na Play Console, senao o upload e recusado', () => {
  assert.equal(appJson.expo.android.package, 'dev.marujo.appblocker');
});

test('o app.json registra o plugin de assinatura', () => {
  assert.ok(appJson.expo.plugins.includes('./native/plugins/withReleaseSigning'));
});

test('credentials.json aponta para um keystore versionado que existe', () => {
  const { keystore } = credentials.android;
  assert.ok(existsSync(path.join(ROOT, keystore.keystorePath)), keystore.keystorePath);
  assert.ok(keystore.keystorePassword.length >= 16);
  assert.ok(keystore.keyAlias);
});

test('o keystore nao esta no .gitignore — sem ele versionado ninguem mais gera o AAB', () => {
  const gitignore = readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.doesNotMatch(gitignore, /^\s*(\*\.jks|credentials)/m);
});
