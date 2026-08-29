import { requireNativeModule } from 'expo-modules-core';

import type { PermissionState } from './src/AceleralockBlocker.types';

type AceleralockBlockerModule = {
  probePermissions(): PermissionState;
  criticalPackages(): string[];
  clientRefFor(packageName: string): string;
  rememberTarget(targetId: string, packageName: string): void;
  /**
   * Entrega a sessao ao modulo nativo logo apos o login. Depois disso o JS
   * esquece o refresh token: quem rotaciona e o nativo, sozinho.
   */
  adoptSession(
    baseUrl: string,
    deviceId: string,
    accessToken: string,
    expiresInSeconds: number,
    refreshToken: string
  ): void;
  start(): void;
  stop(): void;
  requestSync(): void;
};

export default requireNativeModule<AceleralockBlockerModule>('AceleralockBlocker');
export type { PermissionState };
