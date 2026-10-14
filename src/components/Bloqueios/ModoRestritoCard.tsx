import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Interruptor } from '@/components/Interruptor';

import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  restricted: boolean;
  waitMinutes: number;
  /** Ligar e imediato; desligar abre a confirmacao — quem decide e a tela. */
  onAlternar: () => void;
};

/**
 * O interruptor do modo restrito, ao lado da lista que ele trava. Ligado vira
 * ambar (atrito ativo, DS §0); desligado fica neutro e diz o que ele faria.
 */
export function ModoRestritoCard({ restricted, waitMinutes, onAlternar }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.bloco}>
      <View
        style={[
          styles.cartao,
          restricted
            ? {
                backgroundColor: theme.colors.bgWarningSubtle,
                borderColor: theme.colors.borderWarning,
              }
            : { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
        ]}
      >
        <View
          style={[
            styles.icone,
            { backgroundColor: restricted ? theme.colors.bgWarningMuted : theme.colors.bgSunken },
          ]}
        >
          <Ionicons
            name={restricted ? 'lock-closed-outline' : 'lock-open-outline'}
            size={20}
            color={restricted ? theme.colors.textWarning : theme.colors.textSecondary}
          />
        </View>
        <View style={styles.textos}>
          <Text style={[styles.titulo, { color: theme.colors.textPrimary }]}>
            {restricted ? 'Modo restrito ligado' : 'Modo restrito'}
          </Text>
          <Text style={[styles.descricao, { color: theme.colors.textSecondary }]}>
            {restricted
              ? `A lista está travada. Desligar pede ${waitMinutes} min de espera.`
              : `Quando ligado, mudar a lista pede ${waitMinutes} min de espera.`}
          </Text>
        </View>
        <Interruptor
          valor={restricted}
          onChange={onAlternar}
          accessibilityLabel="Modo restrito"
          accessibilityHint={
            restricted ? 'Abre a confirmação para começar a espera' : 'Liga na hora'
          }
        />
      </View>
      {restricted && (
        <View style={styles.nota}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.textTertiary} />
          <Text style={[styles.textoNota, { color: theme.colors.textSecondary }]}>
            Os interruptores ficam travados até a espera terminar.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: {
    gap: spacing[2] + 2,
  },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3] + 2,
    padding: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  icone: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  titulo: {
    fontSize: typography.body.fontSize,
    lineHeight: 22,
    fontWeight: typography.bodyStrong.fontWeight,
  },
  descricao: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
  nota: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[1],
  },
  textoNota: {
    flex: 1,
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
});
