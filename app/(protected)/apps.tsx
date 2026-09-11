import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppPickerScreen } from '@/components/AppPickerScreen';
import { Button } from '@/components/Button';
import { useProtectionVerdictContext } from '@/state/ProtectionVerdictContext';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Mesma tela do ultimo passo do onboarding, alcancavel de novo pela home:
 * app instalado depois nao deveria exigir desligar a protecao pra entrar na
 * lista. Sai por router.back() — o veredito nao muda ao mexer na lista.
 *
 * Gate do modo restrito fica aqui (e nao num guard do Stack) porque
 * `restricted` e configuracao, nao chave de roteamento — ver
 * `src/state/verdict.ts` (Snapshot.restricted) e AGENTS.md §4.5. Enquanto
 * o modo restrito estiver ativo, a lista nem e renderizada: a pessoa nao
 * ve quais apps estao na lista porque a vazao de "existe um app bloqueado
 * X" ja conta como isca.
 */
export default function ProtectedApps() {
  const router = useRouter();
  const theme = useTheme();
  const { restricted } = useProtectionVerdictContext();

  if (restricted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bgCanvas }]}>
        <View
          style={[
            styles.cartao,
            { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
          ]}
        >
          <Text style={[styles.titulo, { color: theme.colors.textPrimary }]}>
            Modo restrito ativo
          </Text>
          <Text style={[styles.corpo, { color: theme.colors.textSecondary }]}>
            Para mudar a lista de apps, desligue o modo restrito no Perfil. A desativação pede 30
            minutos de espera.
          </Text>
        </View>
        <ScrollView />
        <View style={styles.rodape}>
          <Button label="Voltar" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AppPickerScreen
      title="Apps bloqueados"
      ctaLabel="Salvar lista"
      onConfirm={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing[6], gap: spacing[4] },
  cartao: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[2],
  },
  titulo: {
    fontSize: typography.title3.fontSize,
    lineHeight: typography.title3.lineHeight,
    fontWeight: typography.title3.fontWeight,
  },
  corpo: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  rodape: {
    paddingTop: spacing[2],
  },
});
