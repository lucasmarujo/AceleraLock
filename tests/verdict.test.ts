import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeVerdict } from '../src/state/verdict';

test('onboarding nao concluido: onboarding-incompleto mesmo com permissoes', () => {
  assert.equal(
    computeVerdict({ platformSupported: true, coreGranted: true, onboardingComplete: false }),
    'onboarding-incompleto'
  );
});

test('onboarding concluido sem permissoes core: onboarding-incompleto', () => {
  assert.equal(
    computeVerdict({ platformSupported: true, coreGranted: false, onboardingComplete: true }),
    'onboarding-incompleto'
  );
});

test('onboarding concluido e permissoes core: protegido', () => {
  assert.equal(
    computeVerdict({ platformSupported: true, coreGranted: true, onboardingComplete: true }),
    'protegido'
  );
});

test('nada: onboarding-incompleto', () => {
  assert.equal(
    computeVerdict({ platformSupported: true, coreGranted: false, onboardingComplete: false }),
    'onboarding-incompleto'
  );
});

test('plataforma sem suporte: plataforma-nao-suportada mesmo com onboarding e permissoes', () => {
  assert.equal(
    computeVerdict({ platformSupported: false, coreGranted: true, onboardingComplete: true }),
    'plataforma-nao-suportada'
  );
});

test('plataforma sem suporte e nada mais: plataforma-nao-suportada', () => {
  assert.equal(
    computeVerdict({ platformSupported: false, coreGranted: false, onboardingComplete: false }),
    'plataforma-nao-suportada'
  );
});
