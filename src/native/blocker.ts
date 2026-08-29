import AceleralockBlockerNative from 'aceleralock-blocker';
import type { PermissionState } from 'aceleralock-blocker';

export type { PermissionState };

type AceleralockBlockerModule = {
  probePermissions(): PermissionState;
  criticalPackages(): string[];
  setBlockedPackages(packages: string[]): void;
  addGrant(packageName: string, grantEndsAtIso: string): void;
  clearGrant(packageName: string): void;
  start(): void;
  stop(): void;
};

const AceleralockBlocker = AceleralockBlockerNative as AceleralockBlockerModule;

export default AceleralockBlocker;
