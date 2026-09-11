export type ProtectionVerdict =
  'loading' | 'onboarding-incompleto' | 'pausado' | 'protegido' | 'plataforma-nao-suportada';

export type Snapshot = {
  /**
   * false quando a plataforma nao tem mecanismo de bloqueio nenhum hoje
   * (iOS: Family Controls sem entitlement pedido). Nao e "falta permissao"
   * — e "o recurso nao existe" -, por isso fica fora de coreGranted e e
   * checado antes de qualquer coisa. Quem decide o valor e o chamador
   * (useProtectionVerdict.ts): esta funcao continua pura, sem importar
   * Platform do RN.
   */
  platformSupported: boolean;
  coreGranted: boolean;
  onboardingComplete: boolean;
  /**
   * false quando a pessoa desligou a protecao de proposito (pedido de
   * STOP_PROTECTION cumprido) — nao e "nunca configurado"
   * (onboarding-incompleto) nem "protegido" com o servico parado, que seria
   * a mesma mentira do loop do iOS por outro caminho. Precisa ser flag
   * persistida do lado nativo, nunca consulta de servico rodando: servico
   * morto por falta de memoria nao e a mesma coisa que desligado de
   * proposito (decisao do supervisor, rodada das telas de espera).
   */
  protectionActive: boolean;
  /**
   * Modo restrito persistido no nativo (BlockPolicy.restricted). NAO entra
   * no veredito: e uma chave de configuracao, nao uma chave de roteamento.
   * Quem precisa dele (tela de escolha de apps, perfil) le direto do nativo
   * — adicionar um sexto valor de `ProtectionVerdict` reintroduziria gating
   * manual nas telas, coisa que a secao 4.5 do AGENTS proibe.
   */
  restricted: boolean;
};

export function computeVerdict(snapshot: Snapshot): ProtectionVerdict {
  const { platformSupported, coreGranted, onboardingComplete, protectionActive } = snapshot;

  if (!platformSupported) {
    return 'plataforma-nao-suportada';
  }

  if (!onboardingComplete || !coreGranted) {
    return 'onboarding-incompleto';
  }

  if (!protectionActive) {
    return 'pausado';
  }

  return 'protegido';
}

/** As duas de coreGranted (PermissionProbe.kt), na ordem em que sao pedidas. */
export type CorePermission = 'usageAccess' | 'overlay';

/**
 * Proxima permissao essencial a pedir, ou null quando as duas ja estao
 * concedidas. Uma por vez: cada uma abre uma tela diferente do sistema, e
 * disparar as duas juntas so empilharia Settings sobre Settings.
 *
 * `null` (ainda nao sondado, ou plataforma sem suporte) conta como nada
 * concedido — o lado seguro e pedir de novo, nunca deixar concluir o
 * onboarding sem leitura nativa nenhuma.
 */
export function nextMissingCorePermission(
  permissions: Record<CorePermission, boolean> | null
): CorePermission | null {
  if (!permissions || !permissions.usageAccess) {
    return 'usageAccess';
  }
  if (!permissions.overlay) {
    return 'overlay';
  }
  return null;
}
