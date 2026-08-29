export type PermissionState = {
  usageAccess: boolean;
  overlay: boolean;
  batteryExempt: boolean;
  notifications: boolean;
  /** A1 + A2: sem elas o app nao bloqueia nada. */
  coreGranted: boolean;
};

export type PendingTarget = 'UNLOCK_APP' | 'STOP_PROTECTION' | 'CHANGE_DURATIONS';

export type ProtectionState = {
  /** Flag persistida: o que o usuario decidiu, nao se o servico esta no ar agora. */
  protectionActive: boolean;
  /** Soma dos periodos medidos em que a protecao devia estar de pe e nao estava. */
  downtimeTotalSeconds: number;
  /** null quando a ultima interrupcao atravessou um reboot e nao da para cronometrar. */
  downtimeLastSeconds: number | null;
  /** Quantas interrupcoes existiram sem duracao apuravel. */
  downtimeUnknownCount: number;
  configured: boolean;
  waitMinutes: number;
  grantMinutes: number;
  /** null quando nao ha pedido em curso. */
  pendingTarget: PendingTarget | null;
  pendingRemainingSeconds: number | null;
  pendingReady: boolean;
};
