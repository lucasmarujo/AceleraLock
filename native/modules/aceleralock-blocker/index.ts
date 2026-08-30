import { requireNativeModule } from 'expo-modules-core';

import type { InstalledApp, PermissionState, ProtectionState } from './src/AceleralockBlocker.types';

type AceleralockBlockerModule = {
  probePermissions(): PermissionState;
  criticalPackages(): string[];
  /** Assincrona: varre o PackageManager, cara demais para a thread de JS. */
  installedApps(): Promise<InstalledApp[]>;
  blockedPackages(): string[];
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
export type { InstalledApp, PermissionState, ProtectionState };
