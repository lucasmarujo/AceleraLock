import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  visible: boolean;
  waitMinutes: number;
  onClose: () => void;
  onConfirmar: () => void;
};

/**
 * Confirmacao de desligar o modo restrito. Nao e a espera — e um respiro antes
 * de abrir o pedido (docs/decisoes.md, modo restrito). "Manter ligado" e o
 * primario: a saida sem custo tem peso igual ou maior que a acao com atrito
 * (DS §3.4), e o rotulo da outra diz o custo em vez de "Iniciar espera".
 */
export function ConfirmarDesligarRestrito({ visible, waitMinutes, onClose, onConfirmar }: Props) {
  const theme = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel="Desligar o modo restrito?">
      <View style={styles.conteudo}>
        <View style={[styles.icone, { backgroundColor: theme.colors.bgWarningSubtle }]}>
          <Ionicons name="lock-open-outline" size={24} color={theme.colors.textWarning} />
        </View>
        <Text
          accessibilityRole="header"
          style={[styles.titulo, { color: theme.colors.textPrimary }]}
        >
          Desligar o modo restrito?
        </Text>
        <Text style={[styles.corpo, { color: theme.colors.textSecondary }]}>
          A lista de apps só volta a ser editável depois de uma espera de {waitMinutes} minutos. Dá
          para desistir a qualquer momento, sem custo.
        </Text>
      </View>

      <View
        style={[styles.linhaDoTempo, { backgroundColor: theme.colors.bgCanvas }]}
        accessible
        accessibilityLabel={`Agora, ${waitMinutes} minutos de espera, depois a lista é liberada`}
      >
        <View style={styles.marco}>
          <View style={[styles.ponto, { backgroundColor: theme.colors.textPrimary }]} />
          <Text style={[styles.rotuloMarco, { color: theme.colors.textPrimary }]}>Agora</Text>
        </View>
        <View style={styles.trecho}>
          <View style={[styles.barra, { backgroundColor: theme.colors.iconWarning }]} />
          <Text style={[styles.rotuloTrecho, { color: theme.colors.textWarning }]}>
            {waitMinutes} min de espera
          </Text>
        </View>
        <View style={styles.marco}>
          <View style={[styles.pontoVazio, { borderColor: theme.colors.textTertiary }]} />
          <Text style={[styles.rotuloMarco, { color: theme.colors.textSecondary }]}>
            Lista liberada
          </Text>
        </View>
      </View>

      <View style={styles.acoes}>
        <Button label="Manter ligado" onPress={onClose} />
        <Button
          label={`Começar espera de ${waitMinutes} min`}
          variant="secondary"
          onPress={onConfirmar}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: spacing[3],
    paddingHorizontal: spacing[1],
  },
  icone: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    fontSize: typography.title2.fontSize,
    lineHeight: typography.title2.lineHeight,
    fontWeight: '700',
  },
  corpo: {
    fontSize: typography.callout.fontSize,
    lineHeight: 22,
  },
  linhaDoTempo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3] + 2,
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
  },
  marco: {
    alignItems: 'center',
    gap: spacing[1],
  },
  ponto: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pontoVazio: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  trecho: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[1],
  },
  barra: {
    alignSelf: 'stretch',
    height: 4,
    borderRadius: 2,
  },
  rotuloMarco: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
    fontWeight: '600',
  },
  rotuloTrecho: {
    fontSize: typography.caption.fontSize,
    lineHeight: typography.caption.lineHeight,
  },
  acoes: {
    gap: spacing[2] + 2,
  },
});
