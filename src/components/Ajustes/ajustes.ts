/**
 * Logica pura da aba Ajustes. Sem import de react-native: o tipo de permissao
 * e redeclarado aqui pelo mesmo motivo de `Onboarding/passos.ts#filtrarApps`
 * — importar `@/native/blocker` chamaria `requireNativeModule` no teste.
 */

type Permissoes = {
  usageAccess: boolean;
  overlay: boolean;
  batteryExempt: boolean;
  notifications: boolean;
  accessibility: boolean;
};

export type ItemDePermissao = {
  chave: keyof Permissoes;
  titulo: string;
  /** Para que serve — permissao sem motivo dito e permissao que ninguem corrige. */
  descricao: string;
  concedida: boolean;
  rotuloConcedida: string;
  rotuloAcao: string;
  /** Intent do Android que abre a tela certa; `null` = Configuracoes do app. */
  intent: string | null;
};

const ITENS: Omit<ItemDePermissao, 'concedida'>[] = [
  {
    chave: 'usageAccess',
    titulo: 'Acesso ao uso',
    descricao: 'Mede o tempo de tela',
    rotuloConcedida: 'Concedida',
    rotuloAcao: 'Corrigir',
    intent: 'android.settings.USAGE_ACCESS_SETTINGS',
  },
  {
    chave: 'overlay',
    titulo: 'Sobrepor outros apps',
    descricao: 'Mostra a tela de bloqueio',
    rotuloConcedida: 'Concedida',
    rotuloAcao: 'Corrigir',
    intent: 'android.settings.action.MANAGE_OVERLAY_PERMISSION',
  },
  {
    chave: 'accessibility',
    titulo: 'Leitura do navegador',
    descricao: 'Bloqueia os sites',
    rotuloConcedida: 'Ativa',
    rotuloAcao: 'Ativar',
    intent: 'android.settings.ACCESSIBILITY_SETTINGS',
  },
  {
    chave: 'batteryExempt',
    titulo: 'Bateria sem otimização',
    descricao: 'Evita que o Android pare a proteção',
    rotuloConcedida: 'Sim',
    rotuloAcao: 'Corrigir',
    intent: 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
  },
  {
    chave: 'notifications',
    titulo: 'Notificações',
    descricao: 'Mantém o aviso de proteção ativa',
    rotuloConcedida: 'Ativadas',
    rotuloAcao: 'Ativar',
    intent: null,
  },
];

/**
 * Checklist de permissoes na ordem em que importam. `null` (ainda nao sondado)
 * conta como pendente: o lado seguro e oferecer a correcao, mesma regra de
 * `nextMissingCorePermission`. A leitura do navegador so existe no Android — no
 * iOS quem filtra sites e o Family Controls.
 */
export function itensDePermissao(
  permissoes: Permissoes | null,
  plataforma: 'android' | 'ios'
): ItemDePermissao[] {
  return ITENS.filter((item) => plataforma === 'android' || item.chave !== 'accessibility').map(
    (item) => ({ ...item, concedida: permissoes?.[item.chave] === true })
  );
}

export function contarPendentes(itens: ItemDePermissao[]): number {
  return itens.filter((item) => !item.concedida).length;
}
