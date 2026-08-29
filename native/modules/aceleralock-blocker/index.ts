import { requireNativeModule } from 'expo-modules-core';

import type { PermissionState } from './src/AceleralockBlocker.types';

type AceleralockBlockerModule = {
  probePermissions(): PermissionState;
  criticalPackages(): string[];
  setBlockedPackages(packages: string[]): void;
  addGrant(packageName: string, grantEndsAtIso: string): void;
  clearGrant(packageName: string): void;
  start(): void;
  stop(): void;
};

export default requireNativeModule<AceleralockBlockerModule>('AceleralockBlocker');
export type { PermissionState };
