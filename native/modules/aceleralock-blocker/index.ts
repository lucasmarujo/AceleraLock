import { requireNativeModule } from 'expo-modules-core';

import type {
  AppException,
  AutomaticClock,
  ExceptionWindow,
  InstalledApp,
  PermissionState,
  ProtectionState,
  ScreenTimeApp,
  ScreenTimeDay,
  ScreenTimeSummary,
} from './src/AceleralockBlocker.types';

type AceleralockBlockerModule = {
  probePermissions(): PermissionState;
  criticalPackages(): string[];
  /** Assincrona: varre o PackageManager, cara demais para a thread de JS. */
  installedApps(): Promise<InstalledApp[]>;
  screenTimeSummary(): Promise<ScreenTimeSummary>;
  blockedPackages(): string[];
  setBlockedPackages(packages: string[]): void;
  blockedDomains(): string[];
  setBlockedDomains(domains: string[]): void;
  /** Horarios livres de todos os apps bloqueados, uma entrada por faixa. */
  appExceptions(): AppException[];
  /** Substitui as faixas de um app (lista vazia apaga). Lanca para faixa invalida. */
  setAppExceptions(packageName: string, windows: ExceptionWindow[]): void;
  automaticClock(): AutomaticClock;
  /** Ativa/desativa o modo restrito imediato. So a desativacao pede espera. */
  setRestricted(restricted: boolean): void;
  /** So vale enquanto nunca houve configuracao. Depois disso, requestDurationChange. */
  configureInitialDurations(waitMinutes: number, grantMinutes: number): boolean;
  requestUnlock(packageName: string): boolean;
  requestStopProtection(): boolean;
  requestDurationChange(waitMinutes: number, grantMinutes: number): boolean;
  requestDisableRestricted(): boolean;
  /** Cancelar e livre: desistir tem de ser barato. */
  cancelRequest(): void;
  protectionState(): ProtectionState;
  start(): void;
  /** Sempre lanca. Desligar exige requestStopProtection e a espera cumprida. */
  stop(): never;
};

export default requireNativeModule<AceleralockBlockerModule>('AceleralockBlocker');
export type {
  AppException,
  AutomaticClock,
  ExceptionWindow,
  InstalledApp,
  PermissionState,
  ProtectionState,
  ScreenTimeApp,
  ScreenTimeDay,
  ScreenTimeSummary,
};
