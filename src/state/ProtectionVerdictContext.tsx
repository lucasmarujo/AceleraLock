import { createContext, useContext, type ReactNode } from 'react';

import type { PermissionState } from '@/native/blocker';

import { useProtectionVerdict, type ProtectionVerdict } from './useProtectionVerdict';

type ProtectionVerdictContextValue = {
  verdict: ProtectionVerdict;
  /** null enquanto nao houve sonda nativa (loading, ou plataforma sem suporte). */
  permissions: PermissionState | null;
  /** Modo restrito persistido no nativo. false ate a primeira sonda de Android voltar. */
  restricted: boolean;
  refresh: () => Promise<void>;
};

const ProtectionVerdictContext = createContext<ProtectionVerdictContextValue | null>(null);

/**
 * Unica instancia de useProtectionVerdict do app (montada uma vez no
 * app/_layout.tsx raiz). Telas leem via useProtectionVerdictContext() em vez
 * de chamar o hook de novo — duas instancias do hook leriam o nativo em
 * momentos diferentes e poderiam decidir vereditos diferentes ao mesmo
 * tempo, que e exatamente a divergencia de duas fontes que a secao 4 do
 * plano de scaffold evita.
 */
export function ProtectionVerdictProvider({ children }: { children: ReactNode }) {
  const { verdict, permissions, restricted, refresh } = useProtectionVerdict();

  return (
    <ProtectionVerdictContext.Provider value={{ verdict, permissions, restricted, refresh }}>
      {children}
    </ProtectionVerdictContext.Provider>
  );
}

export function useProtectionVerdictContext(): ProtectionVerdictContextValue {
  const context = useContext(ProtectionVerdictContext);
  if (!context) {
    throw new Error(
      'useProtectionVerdictContext precisa estar dentro de ProtectionVerdictProvider'
    );
  }
  return context;
}
