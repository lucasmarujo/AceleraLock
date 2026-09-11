import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeVerdict, nextMissingCorePermission } from '../src/state/verdict';

const BASE = {
  platformSupported: true,
  coreGranted: true,
  onboardingComplete: true,
  protectionActive: true,
  restricted: false,
};

test('onboarding nao concluido: onboarding-incompleto mesmo com permissoes', () => {
  assert.equal(computeVerdict({ ...BASE, onboardingComplete: false }), 'onboarding-incompleto');
});

test('onboarding concluido sem permissoes core: onboarding-incompleto', () => {
  assert.equal(computeVerdict({ ...BASE, coreGranted: false }), 'onboarding-incompleto');
});

test('onboarding concluido e permissoes core: protegido', () => {
  assert.equal(computeVerdict(BASE), 'protegido');
});

test('nada: onboarding-incompleto', () => {
  assert.equal(
    computeVerdict({ ...BASE, coreGranted: false, onboardingComplete: false }),
    'onboarding-incompleto'
  );
});

test('plataforma sem suporte: plataforma-nao-suportada mesmo com onboarding e permissoes', () => {
  assert.equal(computeVerdict({ ...BASE, platformSupported: false }), 'plataforma-nao-suportada');
});

test('plataforma sem suporte e nada mais: plataforma-nao-suportada', () => {
  assert.equal(
    computeVerdict({
      ...BASE,
      platformSupported: false,
      coreGranted: false,
      onboardingComplete: false,
    }),
    'plataforma-nao-suportada'
  );
});

test('protecao desligada de proposito: pausado', () => {
  assert.equal(computeVerdict({ ...BASE, protectionActive: false }), 'pausado');
});

test('protecao desligada mas onboarding nunca concluido: onboarding-incompleto, nao pausado', () => {
  assert.equal(
    computeVerdict({ ...BASE, protectionActive: false, onboardingComplete: false }),
    'onboarding-incompleto'
  );
});

test('protecao desligada mas plataforma sem suporte: plataforma-nao-suportada, nao pausado', () => {
  assert.equal(
    computeVerdict({ ...BASE, protectionActive: false, platformSupported: false }),
    'plataforma-nao-suportada'
  );
});

test('sem sonda nativa: pede a primeira permissao, nunca deixa concluir', () => {
  assert.equal(nextMissingCorePermission(null), 'usageAccess');
});

test('nenhuma permissao concedida: pede o acesso ao uso primeiro', () => {
  assert.equal(nextMissingCorePermission({ usageAccess: false, overlay: false }), 'usageAccess');
});

test('acesso ao uso concedido: pede a sobreposicao', () => {
  assert.equal(nextMissingCorePermission({ usageAccess: true, overlay: false }), 'overlay');
});

test('so a sobreposicao concedida: ainda pede o acesso ao uso', () => {
  assert.equal(nextMissingCorePermission({ usageAccess: false, overlay: true }), 'usageAccess');
});

test('as duas concedidas: nada pendente', () => {
  assert.equal(nextMissingCorePermission({ usageAccess: true, overlay: true }), null);
});

test('modo restrito: nao muda o ramo do veredito (continua protegido)', () => {
  assert.equal(computeVerdict({ ...BASE, restricted: true }), 'protegido');
});

test('modo restrito: nao esconde protecao desativada de proposito', () => {
  assert.equal(computeVerdict({ ...BASE, restricted: true, protectionActive: false }), 'pausado');
});
