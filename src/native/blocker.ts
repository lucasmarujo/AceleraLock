import AceleralockBlockerNative from 'aceleralock-blocker';
import type {
  InstalledApp,
  PermissionState,
  ProtectionState,
  ScreenTimeApp,
  ScreenTimeDay,
  ScreenTimeSummary,
} from 'aceleralock-blocker';

export type {
  InstalledApp,
  PermissionState,
  ProtectionState,
  ScreenTimeApp,
  ScreenTimeDay,
  ScreenTimeSummary,
};

/**
 * index.ts do modulo nao reexporta PendingTarget por nome (so
 * PermissionState/ProtectionState) — deriva da propria ProtectionState em
 * vez de duplicar a union aqui.
 */
export type PendingTarget = NonNullable<ProtectionState['pendingTarget']>;

type AceleralockBlockerModule = {
  probePermissions(): PermissionState;
  criticalPackages(): string[];
  /** Assincrona: varre o PackageManager, cara demais para a thread de JS. */
  installedApps(): Promise<InstalledApp[]>;
  /**
   * Assincrona pelo mesmo motivo: varre ate sete dias de eventos de uso.
   * `days` e o historico inteiro que o app acumula, nao do sistema — o Android
   * esquece a granularidade diaria em poucos dias, entao dia ausente da lista
   * significa nao medido, nunca zero.
   */
  screenTimeSummary(): Promise<ScreenTimeSummary>;
  /** Politica vigente. Lanca em politica ilegivel, nunca devolve lista vazia por engano. */
  blockedPackages(): string[];
  setBlockedPackages(packages: string[]): void;
  /** Dominios ja normalizados. Lanca em politica ilegivel, como `blockedPackages`. */
  blockedDomains(): string[];
  /** O nativo renormaliza e descarta entrada invalida; ver `src/state/blockedSites.ts`. */
  setBlockedDomains(domains: string[]): void;
  /**
   * Ativa ou desativa o modo restrito de forma imediata. So a desativacao pede
   * espera (`requestDisableRestricted`); ativar e o compromisso da pessoa com o
   * proprio futuro.
   */
  setRestricted(restricted: boolean): void;
  /** So vale enquanto nunca houve configuracao. Depois disso, requestDurationChange. */
  configureInitialDurations(waitMinutes: number, grantMinutes: number): boolean;
  /**
   * Hoje substitui um pedido pendente em silencio (zera o progresso
   * acumulado do alvo anterior) — decisao do supervisor (2026-08-29,
   * rodada das telas de espera): isso vai virar recusa quando existir
   * pedido em curso. Trocar de alvo vai exigir cancelRequest() primeiro,
   * que ja e livre e imediato. Ainda nao implementado (so
   * requestStopProtection tem tela hoje, a troca so fica alcancavel
   * quando uma segunda tela de gatilho — duracao ou desbloqueio de app —
   * existir). Quem construir essa tela: nao repita a substituicao
   * silenciosa, e nao assuma que request() sempre aceita.
   */
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

/**
 * Reexport tipado do modulo nativo (native/modules/aceleralock-blocker).
 * Nenhuma tela deve chamar stop() — so existe pra documentar que ela lanca.
 */
const AceleralockBlocker = AceleralockBlockerNative as AceleralockBlockerModule;

export default AceleralockBlocker;
