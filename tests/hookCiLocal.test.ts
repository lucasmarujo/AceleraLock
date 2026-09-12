import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  classificarCaminho,
  ehArtefatoDePrebuild,
  ehComandoDeEntrega,
} from '../.claude/hooks/ci-local.mjs';

test('regressao: importar o hook nao dispara o despacho de modos', () => {
  // O modulo le process.argv no topo. Sem a guarda de entry point, um argv que
  // nao case com modo nenhum chamaria process.exit(1) e derrubaria esta suite.
  assert.equal(typeof classificarCaminho, 'function');
  assert.equal(typeof ehComandoDeEntrega, 'function');
  assert.equal(typeof ehArtefatoDePrebuild, 'function');
});

test('feliz: arquivo de src/ e de app/ obriga o ciclo JS', () => {
  assert.equal(classificarCaminho('src/theme/tokens.ts'), 'js');
  assert.equal(classificarCaminho('app/(protected)/(tabs)/perfil.tsx'), 'js');
  assert.equal(classificarCaminho('tests/verdict.test.ts'), 'js');
});

test('feliz: fonte do core obriga o ciclo Kotlin', () => {
  assert.equal(
    classificarCaminho('native/modules/aceleralock-blocker/core/src/main/kotlin/WaitingPeriod.kt'),
    'kotlin'
  );
  assert.equal(
    classificarCaminho('native/modules/aceleralock-blocker/core/build.gradle.kts'),
    'kotlin'
  );
});

test('feliz: contrato TS do modulo nativo entra no ciclo JS (o tsc alcanca)', () => {
  assert.equal(
    classificarCaminho('native/modules/aceleralock-blocker/src/AceleralockBlocker.types.ts'),
    'js'
  );
  assert.equal(classificarCaminho('native/modules/aceleralock-blocker/index.ts'), 'js');
});

test('regressao: adaptador android/ do modulo nao dispara ciclo — nao tem suite', () => {
  assert.equal(
    classificarCaminho(
      'native/modules/aceleralock-blocker/android/src/main/java/BlockerService.kt'
    ),
    null
  );
});

test('regressao: Swift do modulo nao dispara ciclo — nao tem suite', () => {
  assert.equal(
    classificarCaminho('native/modules/aceleralock-blocker/ios/Core/WaitingPeriod.swift'),
    null
  );
});

test('regressao: android/ e ios/ da raiz sao gerados por prebuild, nunca disparam ciclo', () => {
  assert.equal(classificarCaminho('android/app/src/main/AndroidManifest.xml'), null);
  assert.equal(classificarCaminho('android/app/build.gradle'), null);
  assert.equal(classificarCaminho('ios/Podfile'), null);
});

test('feliz: prosa e configuracao de agente ficam fora das duas suites', () => {
  assert.equal(classificarCaminho('docs/decisoes.md'), null);
  assert.equal(classificarCaminho('README.md'), null);
  assert.equal(classificarCaminho('.claude/settings.json'), null);
});

test('feliz: caminho com barra invertida do Windows classifica igual', () => {
  assert.equal(classificarCaminho('src\\state\\verdict.ts'), 'js');
  assert.equal(classificarCaminho('.\\app\\_layout.tsx'), 'js');
});

test('feliz: android/, ios/ e .expo/ da raiz sao artefato de prebuild', () => {
  assert.equal(ehArtefatoDePrebuild('android/app/build.gradle'), true);
  assert.equal(ehArtefatoDePrebuild('ios/Podfile'), true);
  assert.equal(ehArtefatoDePrebuild('.expo/types/router.d.ts'), true);
});

test('barreira: fonte do modulo nativo NAO e artefato — precisa continuar editavel', () => {
  assert.equal(
    ehArtefatoDePrebuild('native/modules/aceleralock-blocker/android/src/main/AndroidManifest.xml'),
    false
  );
  assert.equal(
    ehArtefatoDePrebuild('native/modules/aceleralock-blocker/ios/AceleralockBlockerModule.swift'),
    false
  );
  assert.equal(ehArtefatoDePrebuild('src/theme/tokens.ts'), false);
});

test('regressao: arquivo fora do repositorio nao marca escopo pendente', () => {
  assert.equal(classificarCaminho('../outro-projeto/src/index.ts'), null);
  assert.equal(classificarCaminho('../../Users/alguem/.claude/plans/plano.md'), null);
});

test('feliz: entrega e commit ou push, em qualquer posicao da linha', () => {
  assert.equal(ehComandoDeEntrega('git commit -m "feat: x"'), true);
  assert.equal(ehComandoDeEntrega('git push'), true);
  assert.equal(ehComandoDeEntrega('git push --force-with-lease origin master'), true);
  assert.equal(ehComandoDeEntrega('cd /repo && git commit --amend'), true);
  assert.equal(ehComandoDeEntrega('git -C . push'), true);
});

test('regressao: leitura do git nao e entrega e nunca pode ser bloqueada', () => {
  assert.equal(ehComandoDeEntrega('git status --short'), false);
  assert.equal(ehComandoDeEntrega('git diff HEAD~1'), false);
  assert.equal(ehComandoDeEntrega('git log --oneline -5'), false);
  assert.equal(ehComandoDeEntrega('npm test'), false);
  assert.equal(ehComandoDeEntrega(''), false);
});
