import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeVerdict } from '../src/state/verdict';

test('onboarding nao concluido: onboarding-incompleto mesmo com permissoes', () => {
  assert.equal(
    computeVerdict({ coreGranted: true, onboardingComplete: false }),
    'onboarding-incompleto'
  );
});

test('onboarding concluido sem permissoes core: onboarding-incompleto', () => {
  assert.equal(
    computeVerdict({ coreGranted: false, onboardingComplete: true }),
    'onboarding-incompleto'
  );
});

test('onboarding concluido e permissoes core: protegido', () => {
  assert.equal(
    computeVerdict({ coreGranted: true, onboardingComplete: true }),
    'protegido'
  );
});

test('nada: onboarding-incompleto', () => {
  assert.equal(
    computeVerdict({ coreGranted: false, onboardingComplete: false }),
    'onboarding-incompleto'
  );
});
