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
  configured: boolean;
  waitMinutes: number;
  grantMinutes: number;
  /** null quando nao ha pedido em curso. */
  pendingTarget: PendingTarget | null;
  pendingRemainingSeconds: number | null;
  pendingReady: boolean;
};
