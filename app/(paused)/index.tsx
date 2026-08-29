import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import AceleralockBlocker from '@/native/blocker';
import { useProtectionVerdictContext } from '@/state/ProtectionVerdictContext';
import { spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Veredito 'pausado' (src/state/verdict.ts): configurado, permissao ok, mas
 * a propria pessoa desligou a protecao (pedido de STOP_PROTECTION cumprido).
 * Ligar de volta nao tem espera — a friccao do produto e so pra desligar,
 * nunca pra ligar (docs/design-system.md, decisao do supervisor). Config e
 * apps bloqueados continuam intactos: religar nao passa por onboarding.
 */
export default function Paused() {
  const theme = useTheme();
  const { refresh } = useProtectionVerdictContext();

  const handleActivate = () => {
    AceleralockBlocker.start();
    refresh();
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing[4],
        padding: spacing[6],
        backgroundColor: theme.colors.bgCanvas,
      }}
    >
      <Text
        style={{
          fontSize: typography.title3.fontSize,
          lineHeight: typography.title3.lineHeight,
          fontWeight: typography.title3.fontWeight,
          textAlign: 'center',
          color: theme.colors.textPrimary,
        }}
      >
        A proteção está desligada.
      </Text>
      <Text
        style={{
          fontSize: typography.body.fontSize,
          lineHeight: typography.body.lineHeight,
          textAlign: 'center',
          color: theme.colors.textSecondary,
        }}
      >
        Foi um pedido seu, cumprido depois da espera. Nada está bloqueado agora.
      </Text>
      <Button label="Ativar proteção" onPress={handleActivate} />
    </View>
  );
}
