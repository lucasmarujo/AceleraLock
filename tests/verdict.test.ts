import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeVerdict } from '../src/state/verdict';

const BASE = { platformSupported: true, coreGranted: true, onboardingComplete: true, protectionActive: true };

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
    computeVerdict({ ...BASE, platformSupported: false, coreGranted: false, onboardingComplete: false }),
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
