export type PermissionState = {
  usageAccess: boolean;
  overlay: boolean;
  batteryExempt: boolean;
  notifications: boolean;
  /** A1 + A2: sem elas o app nao bloqueia nada. */
  coreGranted: boolean;
};
