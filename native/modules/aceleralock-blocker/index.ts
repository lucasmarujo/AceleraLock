import { requireNativeModule } from 'expo-modules-core';

import type { PermissionState, ProtectionState } from './src/AceleralockBlocker.types';

type AceleralockBlockerModule = {
  probePermissions(): PermissionState;
  criticalPackages(): string[];
  setBlockedPackages(packages: string[]): void;
  /** So vale enquanto nunca houve configuracao. Depois disso, requestDurationChange. */
  configureInitialDurations(waitMinutes: number, grantMinutes: number): boolean;
  requestUnlock(packageName: string): boolean;
  requestStopProtection(): boolean;
  requestDurationChange(waitMinutes: number, grantMinutes: number): boolean;
  /** Cancelar e livre: desistir tem de ser barato. */
  cancelRequest(): void;
  protectionState(): ProtectionState;
  start(): void;
  /** Sempre lanca. Desligar exige requestStopProtection e a espera cumprida. */
  stop(): never;
};

export default requireNativeModule<AceleralockBlockerModule>('AceleralockBlocker');
export type { PermissionState, ProtectionState };
