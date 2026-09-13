export type PermissionState = {
  usageAccess: boolean;
  overlay: boolean;
  batteryExempt: boolean;
  notifications: boolean;
  /**
   * Servico de acessibilidade que le a barra de endereco (Android). Fora de
   * `coreGranted`: sem ele so o bloqueio de sites para. No iOS acompanha o
   * Family Controls, que e quem aplica o filtro de sites.
   */
  accessibility: boolean;
  /** A1 + A2: sem elas o app nao bloqueia nada. */
  coreGranted: boolean;
};

export type PendingTarget =
  'UNLOCK_APP' | 'STOP_PROTECTION' | 'CHANGE_DURATIONS' | 'RESTRICTED_MODE_OFF';

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
  /**
   * Modo restrito: enquanto true, a tela de escolha de apps nao e acessivel.
   * Ativado de forma imediata; desativado so apos a espera de
   * RESTRICTED_MODE_OFF cumprir (mesmo motor das outras esperas).
   */
  restricted: boolean;
  /** null quando nao ha pedido em curso. */
  pendingTarget: PendingTarget | null;
  pendingRemainingSeconds: number | null;
  pendingReady: boolean;
};

/** App que a pessoa pode escolher bloquear (com icone de launcher, nao critico). */
export type InstalledApp = {
  packageName: string;
  label: string;
  /** `file://` do PNG em cache. null quando o icone nao pode ser lido. */
  iconUri: string | null;
};

/** Um app no ranking de consumo do dia. */
export type ScreenTimeApp = {
  packageName: string;
  /** Cai pro proprio packageName quando o app nao esta na lista de launcher. */
  label: string;
  /** `file://` do PNG em cache, ou null (launcher, Ajustes, app sem icone). */
  iconUri: string | null;
  seconds: number;
};

/** Um dia com leitura. Dia ausente da lista nunca virou zero: nao foi medido. */
export type ScreenTimeDay = {
  /** ISO `YYYY-MM-DD`, no fuso do aparelho. */
  date: string;
  seconds: number;
};

export type ScreenTimeSummary = {
  todaySeconds: number;
  /** Do que mais consome pro que menos, so o dia corrente. */
  byPackage: ScreenTimeApp[];
  /**
   * Todo o historico acumulado pelo app (ate 90 dias), em ordem crescente de
   * data. Quem recorta e a tela: o calendario filtra o mes, a home pega os
   * ultimos sete dias — que podem atravessar a virada do mes.
   */
  days: ScreenTimeDay[];
};
